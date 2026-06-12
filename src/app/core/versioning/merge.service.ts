// 13b-iv — merge between variants, limited to `main`. Computes diffs
// between two `main` refs without touching the working tree; applies
// per-entity commits on the destination ref via tree-level primitives
// so the user's current HEAD is never moved.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsLockService } from '@core/fs/fs-lock.service';
import { SettingsService } from '@core/settings/settings.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { blobToText, isLikelyBinary } from '@features/history/services/diff.utils';

import { AutocommitService } from './autocommit.service';
import { GitFsAdapter } from './git-fs.adapter';
import { buildMergeCommit } from './merge-apply';
import { VariantsService } from './variants.service';
import { DEFAULT_GIT_AUTHOR } from './versioning.constants';
import { stripHeadsPrefix } from './variants.io';
import { type Variant } from './variants.types';
import type {
  MergeChoice,
  MergeDiffEntry,
  MergeOutcome,
  MergePlan,
  MergeSelection,
  MergeStatus,
} from './merge.types';

const REPO_DIR = '/';
const PREVIEW_BYTES = 240;

@Injectable({ providedIn: 'root' })
export class MergeService {
  private readonly workspace = inject(WorkspaceService);
  private readonly fsLock = inject(FsLockService);
  private readonly autocommit = inject(AutocommitService);
  private readonly variants = inject(VariantsService);
  private readonly settings = inject(SettingsService);

  // Compares main refs of two families and returns the list of paths
  // that differ, with a short preview of each side.
  async diffMains(from: Variant, into: Variant): Promise<MergePlan> {
    const fs = this.requireAdapter();
    const fromRef = stripHeadsPrefix(from.refs.main);
    const intoRef = stripHeadsPrefix(into.refs.main);
    const raw = await git.walk({
      fs,
      dir: REPO_DIR,
      trees: [git.TREE({ ref: fromRef }), git.TREE({ ref: intoRef })],
      map: async (filepath, entries) => {
        if (filepath === '.') return;
        const [a, b] = entries;
        const aType = a ? await a.type() : null;
        const bType = b ? await b.type() : null;
        if (aType === 'tree' || bType === 'tree') return;
        const aOid = a ? await a.oid() : null;
        const bOid = b ? await b.oid() : null;
        if (aOid === bOid) return;
        return { filepath, aOid, bOid };
      },
    });
    const entries: MergeDiffEntry[] = [];
    for (const r of raw as readonly {
      filepath: string;
      aOid: string | null;
      bOid: string | null;
    }[]) {
      entries.push(await this.buildEntry(fs, r.filepath, r.aOid, r.bOid));
    }
    entries.sort((x, y) => x.filepath.localeCompare(y.filepath));
    return { fromVariantId: from.id, intoVariantId: into.id, entries };
  }

  // Applies a set of per-entity selections on top of `into.main`.
  // Pre-merge step (outside the lock) flushes the active variant's
  // dirty state so any in-progress work survives a partial-fail. The
  // actual ref mutations run sequentially inside the workspace lock so
  // other tabs can't race; rollback is per-commit (each selection that
  // commits is independently revertable from /history via the shared
  // Merge-Group trailer).
  async apply(plan: MergePlan, selections: readonly MergeSelection[]): Promise<MergeOutcome> {
    await this.autocommit.commitNow('pre-merge');
    return this.fsLock.withLock(() => this.applyLocked(plan, selections));
  }

  private async applyLocked(
    plan: MergePlan,
    selections: readonly MergeSelection[],
  ): Promise<MergeOutcome> {
    const fs = this.requireAdapter();
    const from = this.findVariant(plan.fromVariantId);
    const into = this.findVariant(plan.intoVariantId);
    const intoRef = stripHeadsPrefix(into.refs.main);
    const fromTip = await git.resolveRef({
      fs,
      dir: REPO_DIR,
      ref: stripHeadsPrefix(from.refs.main),
    });
    const groupId = crypto.randomUUID();
    const actionable = selections.filter((s) => s.choice === 'from');
    const applied: string[] = [];
    let i = 0;
    try {
      for (; i < actionable.length; i++) {
        const ok = await this.commitOneSelection(
          fs,
          actionable[i]!,
          fromTip,
          intoRef,
          from,
          into,
          groupId,
        );
        if (ok) applied.push(actionable[i]!.filepath);
      }
      await this.variants.refreshActivity(this.settings.state().variants.dormantThresholdDays);
      return { groupId, applied, failedAt: null, remaining: [] };
    } catch (cause) {
      await this.variants
        .refreshActivity(this.settings.state().variants.dormantThresholdDays)
        .catch(() => undefined);
      return {
        groupId,
        applied,
        failedAt: {
          path: actionable[i]?.filepath ?? '?',
          reason: (cause as Error).message ?? 'unknown',
        },
        remaining: actionable.slice(i + 1).map((s) => s.filepath),
      };
    }
  }

  private async commitOneSelection(
    fs: GitFsAdapter,
    sel: MergeSelection,
    fromTip: string,
    intoRef: string,
    from: Variant,
    into: Variant,
    groupId: string,
  ): Promise<boolean> {
    const baseOid = await git.resolveRef({ fs, dir: REPO_DIR, ref: intoRef });
    const newOid = await buildMergeCommit({
      fs,
      baseCommitOid: baseOid,
      fromCommitOid: fromTip,
      filepath: sel.filepath,
      message: formatMessage(sel.filepath, from, into, sel.choice, groupId),
      author: DEFAULT_GIT_AUTHOR,
    });
    if (!newOid) return false;
    await git.writeRef({
      fs,
      dir: REPO_DIR,
      ref: `refs/heads/${intoRef}`,
      value: newOid,
      force: true,
    });
    return true;
  }

  private findVariant(id: string): Variant {
    const v = this.variants.file().variants.find((x) => x.id === id);
    if (!v) {
      throw new AppError(ERROR_CODES.VER_010, {
        severity: 'error',
        context: { reason: 'variant-not-found', id },
        recoverable: true,
      });
    }
    return v;
  }

  private async buildEntry(
    fs: GitFsAdapter,
    filepath: string,
    aOid: string | null,
    bOid: string | null,
  ): Promise<MergeDiffEntry> {
    const status = computeStatus(aOid, bOid);
    const [previewFrom, previewInto] = await Promise.all([
      this.preview(fs, aOid),
      this.preview(fs, bOid),
    ]);
    return { filepath, status, previewFrom, previewInto };
  }

  private async preview(fs: GitFsAdapter, oid: string | null): Promise<string | null> {
    if (!oid) return null;
    try {
      const { blob } = await git.readBlob({ fs, dir: REPO_DIR, oid });
      if (isLikelyBinary(blob)) return null;
      const slice = blob.subarray(0, Math.min(blob.length, PREVIEW_BYTES));
      return blobToText(slice);
    } catch {
      return null;
    }
  }

  private requireAdapter(): GitFsAdapter {
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_010, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    return new GitFsAdapter(root);
  }
}

// why: trailers are parsed by /history (#28) to group all per-entity
//      commits of one merge into a single visual row. Keep keys stable.
function formatMessage(
  filepath: string,
  from: Variant,
  into: Variant,
  choice: MergeChoice,
  groupId: string,
): string {
  const verb = choice === 'from' ? 'merge' : 'keep';
  const subject = `${verb}: ${filepath} (from "${from.name}" into "${into.name}")`;
  return `${subject}\n\nMerge-Group: ${groupId}\nMerge-From: ${from.id}\nMerge-Into: ${into.id}\nMerge-Choice: ${choice}\n`;
}

function computeStatus(fromOid: string | null, intoOid: string | null): MergeStatus {
  if (fromOid && !intoOid) return 'only-in-from';
  if (!fromOid && intoOid) return 'only-in-into';
  return 'modified';
}
