// Thin wrapper around isomorphic-git over our FS Access adapter.
// Exposes the operations 13a needs: ensure the repo exists, stage and
// commit dirty entries, list commits, read blobs at a given commit.
// Autocommit timer + triggers live in autocommit.service.ts.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GitFsAdapter } from './git-fs.adapter';
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
  private adapter: GitFsAdapter | null = null;

  private requireAdapter(): GitFsAdapter {
    if (this.adapter) return this.adapter;
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_001, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    this.adapter = new GitFsAdapter(root, this.fs);
    return this.adapter;
  }

  resetForNewWorkspace(): void {
    this.adapter = null;
  }

  async ensureRepo(): Promise<void> {
    const fs = this.requireAdapter();
    try {
      await fs.promises.stat('/.git');
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

  // Stage every dirty non-ignored path and create a single commit.
  // Returns the new oid, or null if there was nothing to commit.
  // why: git.statusMatrix does NOT auto-filter .gitignore. isIgnored
  //      is run in parallel and git.add takes a string[] so the
  //      hot-loop overhead (per-call statSync + index update) collapses
  //      from N sequential calls to one batched call.
  async commitAll(message: string): Promise<string | null> {
    const fs = this.requireAdapter();
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
    const fs = this.requireAdapter();
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
    const fs = this.requireAdapter();
    const entries = await git.log({ fs, dir: REPO_DIR, ref });
    return entries.map(toSummary);
  }

  // Peels every tag (annotated or lightweight) to the commit oid it
  // points to. The compaction planner needs this set as a barrier
  // membership test.
  async listTagOids(): Promise<ReadonlySet<string>> {
    const fs = this.requireAdapter();
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
    const fs = this.requireAdapter();
    const { blob } = await git.readBlob({ fs, dir: REPO_DIR, oid, filepath });
    return blob;
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const fs = this.requireAdapter();
    const matrix = await git.statusMatrix({ fs, dir: REPO_DIR });
    return matrix.some(([, head, work, stage]) => head !== work || head !== stage);
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
