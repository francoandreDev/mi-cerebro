// PROYECTO.md §12 "Compactación del historial" — wiring layer over the
// pure planner. Walks a single ref's full log, snapshots refs+plan to
// `.mi-cerebro/pre-compaction/<date>/<branch>/`, then rewrites the ref
// in place via isomorphic-git plumbing (writeCommit + writeRef) without
// ever touching the working tree.
//
// Per-branch atomic: a failure on one branch leaves the rest intact;
// the failing branch is left at its original tip and the snapshot is
// the recovery path.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { AutosaveService } from '@core/autosave/autosave.service';
import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsLockService } from '@core/fs/fs-lock.service';
import { WorkspaceService } from '@core/fs/workspace.service';

import type { CompactionPlan, FuseGroup } from './compaction-plan';
import { buildCompactionPlan } from './compaction-plan';
import { GitFsAdapter } from './git-fs.adapter';
import { stripHeadsPrefix } from './variants.io';
import { VersioningService } from './versioning.service';
import { DEFAULT_GIT_AUTHOR } from './versioning.constants';

const REPO_DIR = '/';
const SNAPSHOT_ROOT = '/.mi-cerebro/pre-compaction';

export interface ApplyPlanResult {
  readonly newTipOid: string;
  readonly rewrote: boolean;
}

@Injectable({ providedIn: 'root' })
export class CompactionService {
  private readonly workspace = inject(WorkspaceService);
  private readonly versioning = inject(VersioningService);
  private readonly autosave = inject(AutosaveService);
  private readonly fsLock = inject(FsLockService);

  // Pure-planner-shaped: full log of `ref` + peeled tag oids → plan.
  async planForBranch(ref: string): Promise<CompactionPlan> {
    const bare = stripHeadsPrefix(ref);
    const commits = await this.versioning.logFull(bare);
    const tagOids = await this.versioning.listTagOids();
    return buildCompactionPlan({ commits, tagOids, now: Date.now() });
  }

  // Applies a plan to `ref` in place. No-op when the plan has no
  // fuseGroups (idempotence: a freshly rewritten ref produces an empty
  // plan on the next call).
  async applyPlan(ref: string, plan: CompactionPlan): Promise<ApplyPlanResult> {
    await this.autosave.flushAll();
    return this.fsLock.withLock(async () => {
      const fs = this.requireAdapter();
      const bare = stripHeadsPrefix(ref);
      const originalTipOid = await git.resolveRef({ fs, dir: REPO_DIR, ref: bare });
      if (plan.fuseGroups.length === 0) {
        return { newTipOid: originalTipOid, rewrote: false };
      }
      await this.writeSnapshot(fs, bare, originalTipOid, plan);
      const newTipOid = await this.rewrite(fs, bare, plan, originalTipOid);
      await git.writeRef({
        fs,
        dir: REPO_DIR,
        ref: `refs/heads/${bare}`,
        value: newTipOid,
        force: true,
      });
      return { newTipOid, rewrote: true };
    });
  }

  private async rewrite(
    fs: GitFsAdapter,
    ref: string,
    plan: CompactionPlan,
    originalTipOid: string,
  ): Promise<string> {
    const fuseByLastOid = new Map<string, FuseGroup>();
    const skipOids = new Set<string>();
    for (const group of plan.fuseGroups) {
      const last = group.oids[group.oids.length - 1]!;
      fuseByLastOid.set(last, group);
      for (let i = 0; i < group.oids.length - 1; i++) skipOids.add(group.oids[i]!);
    }
    // Full log of the ref, newest-first; reverse to root→tip so each
    // rewritten commit sees its parent already written.
    const ordered = (await this.versioning.logFull(ref)).slice().reverse();
    if (ordered.length === 0 || ordered[ordered.length - 1]!.oid !== originalTipOid) {
      throw new AppError(ERROR_CODES.VER_025, {
        severity: 'warning',
        context: { ref, reason: 'tip-moved' },
        recoverable: true,
      });
    }
    const faceta = facetaLabel(ref);
    let previousOid: string | null = null;
    try {
      for (const commit of ordered) {
        if (skipOids.has(commit.oid)) continue;
        const { commit: original } = await git.readCommit({
          fs,
          dir: REPO_DIR,
          oid: commit.oid,
        });
        const group = fuseByLastOid.get(commit.oid);
        const message = group
          ? buildFuseMessage(faceta, group)
          : ensureTrailingNewline(original.message);
        const now = Math.floor(Date.now() / 1000);
        const newOid = await git.writeCommit({
          fs,
          dir: REPO_DIR,
          commit: {
            message,
            tree: original.tree,
            parent: previousOid ? [previousOid] : [],
            author: { ...DEFAULT_GIT_AUTHOR, timestamp: now, timezoneOffset: 0 },
            committer: { ...DEFAULT_GIT_AUTHOR, timestamp: now, timezoneOffset: 0 },
          },
        });
        previousOid = newOid;
      }
    } catch (cause) {
      throw new AppError(ERROR_CODES.VER_025, {
        severity: 'warning',
        cause,
        context: { ref, reason: 'rewrite-failed' },
        recoverable: true,
      });
    }
    if (!previousOid) {
      throw new AppError(ERROR_CODES.VER_025, {
        severity: 'warning',
        context: { ref, reason: 'empty-rewrite' },
        recoverable: true,
      });
    }
    return previousOid;
  }

  private async writeSnapshot(
    fs: GitFsAdapter,
    ref: string,
    originalTipOid: string,
    plan: CompactionPlan,
  ): Promise<void> {
    try {
      const stamp = snapshotStamp(new Date());
      const slug = ref.replace(/\//g, '__');
      const path = `${SNAPSHOT_ROOT}/${stamp}/${slug}/plan.json`;
      const payload = JSON.stringify(
        {
          ref,
          originalTipOid,
          fuseGroups: plan.fuseGroups,
          preservedOids: plan.preservedOids,
          createdAt: stamp,
        },
        null,
        2,
      );
      await fs.promises.writeFile(path, payload);
    } catch (cause) {
      throw new AppError(ERROR_CODES.VER_026, {
        severity: 'error',
        cause,
        context: { ref },
        recoverable: true,
      });
    }
  }

  private requireAdapter(): GitFsAdapter {
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_001, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    return new GitFsAdapter(root);
  }
}

function facetaLabel(ref: string): 'main' | 'borrador' | 'comentarios' {
  if (ref.endsWith('/draft')) return 'borrador';
  if (ref.endsWith('/comments')) return 'comentarios';
  return 'main';
}

function buildFuseMessage(faceta: string, group: FuseGroup): string {
  const subject = `auto-batch [${faceta}]: ${group.oids.length} commits (${group.bucketKey})`;
  const range =
    group.oids.length > 1
      ? `${group.oids[0]!.slice(0, 7)}..${group.oids[group.oids.length - 1]!.slice(0, 7)}`
      : group.oids[0]!.slice(0, 7);
  return `${subject}\n\nCompacted-From: ${range}\n`;
}

function ensureTrailingNewline(message: string): string {
  return message.endsWith('\n') ? message : `${message}\n`;
}

function snapshotStamp(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`
  );
}
