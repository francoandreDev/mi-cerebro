// Thin wrapper around isomorphic-git over our FS Access adapter.
// Exposes the operations 13a needs: ensure the repo exists, stage and
// commit dirty entries, list commits, read blobs at a given commit.
// Autocommit timer + triggers live in autocommit.service.ts.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsLockService } from '@core/fs/fs-lock.service';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GitFsAdapter } from './git-fs.adapter';
import { OpfsGitRootService } from './opfs-git-root';
import { DEFAULT_GIT_AUTHOR, DEFAULT_GITIGNORE } from './versioning.constants';

const REPO_DIR = '/';

export interface CommitSummary {
  readonly oid: string;
  readonly message: string;
  readonly authorTimestamp: number;
  readonly parents: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class VersioningService {
  private readonly workspace = inject(WorkspaceService);
  private readonly fs = inject(FsService);
  private readonly opfsGitRoot = inject(OpfsGitRootService);
  private readonly fsLock = inject(FsLockService);
  private adapter: GitFsAdapter | null = null;

  private async requireAdapter(): Promise<GitFsAdapter> {
    if (this.adapter) return this.adapter;
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_001, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    const gitDirRoot = await this.opfsGitRoot.getGitDir();
    this.adapter = new GitFsAdapter(root, this.fs, gitDirRoot);
    return this.adapter;
  }

  resetForNewWorkspace(): void {
    this.adapter = null;
    this.opfsGitRoot.resetForNewWorkspace();
  }

  async ensureRepo(): Promise<void> {
    await this.migrateGitDirToOpfsIfNeeded();
    const fs = await this.requireAdapter();
    try {
      // why: stat('/.git') alone isn't enough once `.git` can live on
      //      OPFS — gitDirRoot is a real, already-`getOrCreateDir`'d
      //      directory the moment OpfsGitRootService resolves it, so
      //      it always "exists" even before any git object was ever
      //      written there. HEAD is the first file git.init() writes,
      //      so checking for it is the actual "is this initialized"
      //      signal, on OPFS or the real FS alike.
      await fs.promises.stat('/.git/HEAD');
      return;
    } catch {
      // not a repo yet, fall through to init
    }
    await git.init({ fs, dir: REPO_DIR, defaultBranch: 'main' });
    try {
      await fs.promises.stat('/.gitignore');
    } catch {
      await fs.promises.writeFile('/.gitignore', DEFAULT_GITIGNORE);
    }
  }

  // why: one-time move for users who already had `.git` on the real FS
  // before this session's OPFS split shipped. Runs before requireAdapter()
  // populates `this.adapter` — that adapter is built with whatever
  // gitDirRoot exists AT THAT POINT, so if this ran after, ensureRepo()'s
  // own `.git` stat would look in an empty OPFS dir, find nothing, and
  // `git.init` a *second*, empty repo there while the real history sits
  // orphaned on disk. The copy-then-verify-then-delete order mirrors
  // writeAtomicViaTmp's rule: never touch the original until the new
  // location has been read back successfully.
  private async migrateGitDirToOpfsIfNeeded(): Promise<void> {
    const root = this.workspace.root();
    if (!root) return;
    const gitDirRoot = await this.opfsGitRoot.getGitDir();
    if (!gitDirRoot) return; // OPFS unavailable on this platform — nothing to do
    if (await this.fs.hasEntry(gitDirRoot, 'HEAD')) return; // already migrated (or freshly inited there)

    const realOnly = new GitFsAdapter(root, this.fs);
    try {
      await realOnly.promises.stat('/.git');
    } catch {
      return; // brand-new workspace, nothing on the real FS to migrate
    }

    await this.fsLock.withLock(async () => {
      const realGitDir = await this.fs.getDir(root, '.git');
      if (!realGitDir) return;
      await this.copyTree(realGitDir, gitDirRoot);

      // Verify before touching the original: resolve HEAD through the
      // split adapter exactly as normal operation would.
      const split = new GitFsAdapter(root, this.fs, gitDirRoot);
      await git.resolveRef({ fs: split, dir: REPO_DIR, ref: 'HEAD' });

      await this.fs.removeEntry(root, '.git', { recursive: true });
    });
  }

  private async copyTree(src: NativeDirRef, dest: NativeDirRef): Promise<void> {
    for await (const name of this.fs.listFiles(src)) {
      const file = await this.fs.readFile(src, name);
      // why: `file` is a real File (Blob subtype) in production, but not
      //      relying on that — arrayBuffer() is the one method every
      //      NativeFs.readFile() implementation actually guarantees.
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.fs.writeFileAtomicBinary(dest, name, new Blob([bytes as BlobPart]));
    }
    for await (const name of this.fs.listSubdirs(src)) {
      const srcSub = await this.fs.getDir(src, name);
      if (!srcSub) continue;
      const destSub = await this.fs.getOrCreateDir(dest, name);
      await this.copyTree(srcSub, destSub);
    }
  }

  // Stage every dirty non-ignored path and create a single commit.
  // Returns the new oid, or null if there was nothing to commit.
  // why: git.statusMatrix does NOT auto-filter .gitignore. isIgnored
  //      is run in parallel and git.add takes a string[] so the
  //      hot-loop overhead (per-call statSync + index update) collapses
  //      from N sequential calls to one batched call.
  async commitAll(message: string): Promise<string | null> {
    const fs = await this.requireAdapter();
    const matrix = await git.statusMatrix({ fs, dir: REPO_DIR });
    const dirty = matrix.filter(([, head, work, stage]) => head !== work || head !== stage);
    const ignored = await Promise.all(
      dirty.map(([filepath]) => git.isIgnored({ fs, dir: REPO_DIR, filepath })),
    );
    const adds: string[] = [];
    const removes: string[] = [];
    dirty.forEach((row, i) => {
      if (ignored[i]) return;
      if (row[2] === 0) removes.push(row[0]);
      else adds.push(row[0]);
    });
    if (adds.length === 0 && removes.length === 0) return null;
    for (const filepath of removes) {
      await git.remove({ fs, dir: REPO_DIR, filepath });
    }
    if (adds.length > 0) {
      // why: parallel: false is required. Internal parallelization of
      //      git.add races on .git/index updates and triggers
      //      InvalidStateError on FS Access (Chromium). Slower-but-safe.
      await git.add({ fs, dir: REPO_DIR, filepath: adds, parallel: false });
    }
    return git.commit({
      fs,
      dir: REPO_DIR,
      message,
      author: { ...DEFAULT_GIT_AUTHOR },
    });
  }

  // 13d-iv-bis — `refs` lets /history walk the family's secondary facetas
  // (comments, draft) alongside main so faceta commits and their merge
  // bundle siblings surface in the timeline. Without it, `git.log`
  // defaults to HEAD and only main commits show up.
  async log(depth = 50, refs?: readonly string[]): Promise<CommitSummary[]> {
    const fs = await this.requireAdapter();
    if (!refs || refs.length === 0) {
      const entries = await git.log({ fs, dir: REPO_DIR, depth });
      return entries.map(toSummary);
    }
    const seen = new Set<string>();
    const merged: CommitSummary[] = [];
    for (const ref of refs) {
      try {
        const entries = await git.log({ fs, dir: REPO_DIR, ref, depth });
        for (const e of entries) {
          if (seen.has(e.oid)) continue;
          seen.add(e.oid);
          merged.push(toSummary(e));
        }
      } catch {
        // ref may not exist yet (lazy seed of comments/draft branches)
      }
    }
    merged.sort((a, b) => b.authorTimestamp - a.authorTimestamp);
    return merged.slice(0, depth);
  }

  // §12 compaction needs the full history of a single ref, not the
  // capped default of log(). Kept separate so /history and other callers
  // keep their safe depth=50 cap.
  async logFull(ref: string): Promise<CommitSummary[]> {
    const fs = await this.requireAdapter();
    const entries = await git.log({ fs, dir: REPO_DIR, ref });
    return entries.map(toSummary);
  }

  // Peels every tag (annotated or lightweight) to the commit oid it
  // points to. The compaction planner needs this set as a barrier
  // membership test.
  async listTagOids(): Promise<ReadonlySet<string>> {
    const fs = await this.requireAdapter();
    const tags = await git.listTags({ fs, dir: REPO_DIR });
    const oids = new Set<string>();
    for (const tag of tags) {
      try {
        const oid = await git.resolveRef({ fs, dir: REPO_DIR, ref: `refs/tags/${tag}` });
        try {
          // Annotated tag: peel to the commit it points to.
          const { tag: peeled } = await git.readTag({ fs, dir: REPO_DIR, oid });
          oids.add(peeled.object);
        } catch {
          // Lightweight tag (resolveRef already returned the commit oid).
          oids.add(oid);
        }
      } catch {
        // skip unresolvable tags
      }
    }
    return oids;
  }

  async readBlob(oid: string, filepath: string): Promise<Uint8Array> {
    const fs = await this.requireAdapter();
    const { blob } = await git.readBlob({ fs, dir: REPO_DIR, oid, filepath });
    return blob;
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const fs = await this.requireAdapter();
    const matrix = await git.statusMatrix({ fs, dir: REPO_DIR });
    return matrix.some(([, head, work, stage]) => head !== work || head !== stage);
  }

  // why: lightweight sibling of HistoryDiffService.collectChanges (features/
  //      history) — same tree-oid comparison, but returns paths only, no
  //      blob reads/status classification. Lives here (not in the history
  //      feature) because core/search's commit-index priming needs it and
  //      features never import each other / core never imports a feature.
  async changedPaths(oid: string): Promise<readonly string[]> {
    const fs = await this.requireAdapter();
    const commit = await git.readCommit({ fs, dir: REPO_DIR, oid });
    const parent = commit.commit.parent[0] ?? null;
    const trees = parent
      ? [git.TREE({ ref: parent }), git.TREE({ ref: oid })]
      : [git.TREE({ ref: oid })];
    const result = await git.walk({
      fs,
      dir: REPO_DIR,
      trees,
      map: async (filepath, entries) => {
        if (filepath === '.') return;
        if (parent) {
          const [a, b] = entries;
          if ((await a?.type()) === 'tree' || (await b?.type()) === 'tree') return;
          if ((await a?.oid()) === (await b?.oid())) return;
          return filepath;
        }
        const [b] = entries;
        if (!b || (await b.type()) === 'tree') return;
        return filepath;
      },
    });
    return result.filter((p: unknown): p is string => typeof p === 'string');
  }
}

function toSummary(e: {
  oid: string;
  commit: { message: string; author: { timestamp: number }; parent: readonly string[] };
}): CommitSummary {
  return {
    oid: e.oid,
    message: e.commit.message,
    authorTimestamp: e.commit.author.timestamp * 1000,
    parents: e.commit.parent,
  };
}
