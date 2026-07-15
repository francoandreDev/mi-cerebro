// 13b-ii — orchestrates the active-variant switch flow. This is the
// most delicate piece of the variants subsystem because it touches the
// FS (autosave drafts, git working tree), in-memory state (search index,
// entity caches) and cross-tab coordination simultaneously. The whole
// flow runs under FsLockService so it cannot race with autocommit or
// any autosave drain in flight.
//
// Steps (docs/proyecto/roadmap-13-versionado.md §19 13b-ii):
//   (a) AutosaveService.flushAll        — no pending drafts on disk
//   (b) VersioningService.commitAll      — capture dirty as pre-switch
//   (c) git.checkout(target.refs.main)  — actually swap HEAD + workdir
//   (d) WorkspaceRefreshService.refreshAll — re-walk every entity
//   (e) (deferred: per-family persisted index — see deferred.md)
//   (f) VariantsService.setActiveId      — persist the new selection
// After (f), broadcast the switch so sibling tabs can update.

import { Injectable, inject, signal } from '@angular/core';
import * as git from 'isomorphic-git';

import { AutosaveService } from '@core/autosave/autosave.service';
import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { FsLockService } from '@core/fs/fs-lock.service';
import { FsService } from '@core/fs/fs.service';
import { WorkspaceRefreshService } from '@core/fs/workspace-refresh.service';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GitFsAdapter } from './git-fs.adapter';
import { VARIANTS_CHANNEL_NAME, type VariantsBroadcast } from './variants-channel';
import { VariantsService } from './variants.service';
import { type Variant } from './variants.types';
import { VersioningService } from './versioning.service';

const REPO_DIR = '/';

export interface SwitchingState {
  readonly from: Variant;
  readonly to: Variant;
}

@Injectable({ providedIn: 'root' })
export class SwitchVariantService {
  private readonly variants = inject(VariantsService);
  private readonly autosave = inject(AutosaveService);
  private readonly versioning = inject(VersioningService);
  private readonly workspaceRefresh = inject(WorkspaceRefreshService);
  private readonly workspace = inject(WorkspaceService);
  private readonly fsLock = inject(FsLockService);
  private readonly errors = inject(ErrorService);
  private readonly fs = inject(FsService);

  private readonly switchingSignal = signal<SwitchingState | null>(null);
  readonly switching = this.switchingSignal.asReadonly();

  private readonly remoteSwitchSignal = signal<{ from: string; to: string } | null>(null);
  // why: surfaces "another tab switched variants" to the shell so it
  //      can show the stale-session banner. Cleared by reload().
  readonly remoteSwitch = this.remoteSwitchSignal.asReadonly();

  private channel: BroadcastChannel | null = null;
  private listenersWired = false;

  // Bootstrap. Called once after the workspace is ready. Aligns
  // `HEAD` with `variants.json.activeId` (covers crash mid-switch) and
  // starts listening for cross-tab broadcasts.
  async bootstrap(): Promise<void> {
    if (!this.listenersWired) {
      this.channel = new BroadcastChannel(VARIANTS_CHANNEL_NAME);
      this.channel.addEventListener('message', (e: MessageEvent<VariantsBroadcast>) => {
        this.handleBroadcast(e.data);
      });
      this.listenersWired = true;
    }
    await this.alignWithGit();
  }

  // why: if HEAD doesn't match variants.json.activeId (typically after
  //      a crash between steps c and f of a previous switch), silently
  //      checkout the active ref so the workspace matches its state.
  async alignWithGit(): Promise<void> {
    const active = this.variants.getActive();
    if (!active) return;
    const root = this.workspace.root();
    if (!root) return;
    const fs = new GitFsAdapter(root, this.fs);
    let current: string | undefined;
    try {
      const ret = await git.currentBranch({ fs, dir: REPO_DIR });
      current = ret ?? undefined;
    } catch {
      return;
    }
    const targetShort = stripHeads(active.refs.main);
    if (current === targetShort) return;
    await this.fsLock.withLock(async () => {
      try {
        await git.checkout({ fs, dir: REPO_DIR, ref: targetShort, force: true });
      } catch (cause) {
        this.errors.report(
          new AppError(ERROR_CODES.VER_008, {
            severity: 'error',
            cause,
            context: { reason: 'align', from: current, to: targetShort },
            recoverable: true,
          }),
        );
      }
    });
  }

  async switchTo(targetId: string): Promise<void> {
    const from = this.variants.getActive();
    const target = this.variants.file().variants.find((v) => v.id === targetId && !v.pendingDelete);
    if (!target || !from) return;
    if (target.id === from.id) return;
    if (this.switchingSignal()) return;

    this.switchingSignal.set({ from, to: target });
    try {
      await this.fsLock.withLock(() => this.runSwitch(from, target));
      this.broadcast({ type: 'switched', variantId: target.id, requestedAt: Date.now() });
    } finally {
      this.switchingSignal.set(null);
    }
  }

  // why: the user-facing "Recargar" button on the stale banner. Hard
  //      reload because we'd otherwise have to reinitialize half the
  //      app to pick up the new working tree; a full reload mirrors
  //      what closing+opening the tab would do.
  reload(): void {
    location.reload();
  }

  // ---- private ----

  private async runSwitch(from: Variant, to: Variant): Promise<void> {
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_007, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    const fs = new GitFsAdapter(root, this.fs);

    try {
      await this.autosave.flushAll();
      await this.versioning.commitAll(`auto: pre-switch-variant ${from.id} → ${to.id}`);
    } catch (cause) {
      throw new AppError(ERROR_CODES.VER_007, {
        severity: 'error',
        cause,
        context: { phase: 'pre-checkout', from: from.id, to: to.id },
        recoverable: true,
      });
    }

    try {
      await git.checkout({
        fs,
        dir: REPO_DIR,
        ref: stripHeads(to.refs.main),
        force: true,
      });
    } catch (cause) {
      throw new AppError(ERROR_CODES.VER_008, {
        severity: 'error',
        cause,
        context: { from: from.id, to: to.id },
        recoverable: true,
      });
    }

    // Persist activeId BEFORE the index rebuild. If the rebuild fails
    // we still want activeId to reflect the new branch (the workspace
    // already lives there); VER-009 surfaces the index issue separately.
    await this.variants.setActiveId(to.id);

    try {
      await this.workspaceRefresh.refreshAll();
    } catch (cause) {
      this.errors.report(
        new AppError(ERROR_CODES.VER_009, {
          severity: 'warning',
          cause,
          context: { to: to.id },
          recoverable: true,
        }),
      );
    }
  }

  private handleBroadcast(data: VariantsBroadcast): void {
    if (data.type !== 'switched') return;
    if (data.variantId === this.variants.getActiveId()) return;
    const from = this.variants.getActiveId();
    this.remoteSwitchSignal.set({ from, to: data.variantId });
  }

  private broadcast(msg: VariantsBroadcast): void {
    if (!this.channel) return;
    try {
      this.channel.postMessage(msg);
    } catch {
      // BroadcastChannel.postMessage rarely throws; if it does the
      // tab is being torn down and the message would be unreachable
      // anyway. No need to surface.
    }
  }
}

function stripHeads(ref: string): string {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
}
