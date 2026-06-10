// Thin wrapper around isomorphic-git over our FS Access adapter.
// Exposes the operations 13a needs: ensure the repo exists, stage and
// commit dirty entries, list commits, read blobs at a given commit.
// Autocommit timer + triggers live in autocommit.service.ts.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
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
    this.adapter = new GitFsAdapter(root);
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
  // why: git.statusMatrix does NOT auto-filter .gitignore. We have to
  //      call git.isIgnored per dirty path, otherwise binaries that the
  //      gitignore explicitly excludes would still land in history.
  async commitAll(message: string): Promise<string | null> {
    const fs = this.requireAdapter();
    const matrix = await git.statusMatrix({ fs, dir: REPO_DIR });
    const dirty = matrix.filter(([, head, work, stage]) => head !== work || head !== stage);
    const staged: typeof dirty = [];
    for (const row of dirty) {
      const filepath = row[0];
      if (!(await git.isIgnored({ fs, dir: REPO_DIR, filepath }))) staged.push(row);
    }
    if (staged.length === 0) return null;
    for (const [filepath, , work] of staged) {
      if (work === 0) {
        await git.remove({ fs, dir: REPO_DIR, filepath });
      } else {
        await git.add({ fs, dir: REPO_DIR, filepath });
      }
    }
    return git.commit({
      fs,
      dir: REPO_DIR,
      message,
      author: { ...DEFAULT_GIT_AUTHOR },
    });
  }

  async log(depth = 50): Promise<CommitSummary[]> {
    const fs = this.requireAdapter();
    const entries = await git.log({ fs, dir: REPO_DIR, depth });
    return entries.map((e) => ({
      oid: e.oid,
      message: e.commit.message,
      authorTimestamp: e.commit.author.timestamp * 1000,
      parents: e.commit.parent,
    }));
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
