// User-triggered restore of an entity to its state in a chosen commit.
// Drains pending autosaves, writes the blob back (or unlinks for a
// 'deleted' state), and records the change as its own labelled commit
// so the operation appears in /history. Serialized with autosave and
// autocommit via FsLockService.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { AutosaveService } from '@core/autosave/autosave.service';
import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsLockService } from '@core/fs/fs-lock.service';
import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';

import { AutocommitService } from './autocommit.service';
import { GitFsAdapter } from './git-fs.adapter';
import { OpfsGitRootService } from './opfs-git-root';
import { GitFsError } from './git-fs.errors';
import { collectSnapshotChanges } from './restore.snapshot';
import { VersioningService } from './versioning.service';

export type RestoreMode = 'present' | 'absent';

@Injectable({ providedIn: 'root' })
export class RestoreService {
  private readonly workspace = inject(WorkspaceService);
  private readonly versioning = inject(VersioningService);
  private readonly autosave = inject(AutosaveService);
  private readonly autocommit = inject(AutocommitService);
  private readonly fsLock = inject(FsLockService);
  private readonly fs = inject(FsService);
  private readonly opfsGitRoot = inject(OpfsGitRootService);

  async restoreEntity(commitOid: string, filepath: string, mode: RestoreMode): Promise<void> {
    try {
      await this.autosave.flushAll();
      await this.fsLock.withLock(async () => {
        const adapter = await this.adapter();
        const absPath = filepath.startsWith('/') ? filepath : '/' + filepath;
        if (mode === 'present') {
          const blob = await this.versioning.readBlob(commitOid, filepath);
          await adapter.promises.writeFile(absPath, blob);
        } else {
          try {
            await adapter.promises.unlink(absPath);
          } catch (e) {
            // why: if the file already does not exist on disk, the
            //      restore-to-absent intent is already satisfied.
            if (!(e instanceof GitFsError) || e.code !== 'ENOENT') throw e;
          }
        }
      });
      const short = commitOid.slice(0, 7);
      await this.autocommit.commitNow('restore', `restore: ${filepath} desde ${short}`);
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new AppError(ERROR_CODES.VER_003, {
        severity: 'error',
        cause,
        context: { filepath, commitOid, mode },
        recoverable: true,
      });
    }
  }

  // Full-workspace restore: snapshot current state as a `before-restore`
  // safety commit, then write/delete every file to match the target
  // commit's tree, and finally label that as its own commit so /history
  // shows both points clearly.
  async restoreCommit(commitOid: string): Promise<void> {
    const short = commitOid.slice(0, 7);
    try {
      await this.autocommit.commitNow(
        'before-restore',
        `before-restore: snapshot antes de restaurar ${short}`,
      );
      await this.autosave.flushAll();
      await this.fsLock.withLock(async () => {
        const adapter = await this.adapter();
        const headOid = await git.resolveRef({ fs: adapter, dir: '/', ref: 'HEAD' });
        const changes = await collectSnapshotChanges(adapter, headOid, commitOid);
        for (const change of changes) await this.applyChange(adapter, change);
      });
      await this.autocommit.commitNow('restore', `restore: snapshot completo desde ${short}`);
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new AppError(ERROR_CODES.VER_003, {
        severity: 'error',
        cause,
        context: { commitOid, scope: 'full-commit' },
        recoverable: true,
      });
    }
  }

  private async applyChange(
    adapter: GitFsAdapter,
    change: { filepath: string; targetOid: string | null },
  ): Promise<void> {
    const absPath = '/' + change.filepath;
    if (change.targetOid) {
      const { blob } = await git.readBlob({ fs: adapter, dir: '/', oid: change.targetOid });
      await adapter.promises.writeFile(absPath, blob);
      return;
    }
    try {
      await adapter.promises.unlink(absPath);
    } catch (e) {
      if (!(e instanceof GitFsError) || e.code !== 'ENOENT') throw e;
    }
  }

  private async adapter(): Promise<GitFsAdapter> {
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_003, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    const gitDirRoot = await this.opfsGitRoot.getGitDir();
    return new GitFsAdapter(root, this.fs, gitDirRoot);
  }
}
