// Owns variants.json + orchestrates the family-of-3-branches model.
// Switch flow is in SwitchVariantService (13b-ii); atomic branch ops
// live in variants-branch-ops.ts; rename in variants-rename.ts.

import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import { computeLastActivityAt, isDormant } from './variants-activity';
import { deleteFamilyRefs, forkFamilyAtomic } from './variants-branch-ops';
import { renameVariant } from './variants-rename';
import { GitFsAdapter } from './git-fs.adapter';
import { isNotFound, sanitizeVariantsFile } from './variants.io';
import {
  DEFAULT_VARIANTS_FILE,
  PRINCIPAL_VARIANT_ID,
  refsForSlug,
  variantSlug,
  type Variant,
  type VariantsFile,
} from './variants.types';

const META_DIR = '.mi-cerebro';
const VARIANTS_FILE = 'variants.json';

export interface CreateVariantOptions {
  readonly name: string;
  readonly color: string;
  readonly fromVariantId?: string;
}

@Injectable({ providedIn: 'root' })
export class VariantsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private adapter: GitFsAdapter | null = null;

  private readonly fileSignal = signal<VariantsFile>(DEFAULT_VARIANTS_FILE);
  readonly file = this.fileSignal.asReadonly();
  private loaded = false;

  resetForNewWorkspace(): void {
    this.adapter = null;
    this.fileSignal.set(DEFAULT_VARIANTS_FILE);
    this.loaded = false;
  }

  getActiveId(): string {
    return this.fileSignal().activeId;
  }

  getActive(): Variant | null {
    const id = this.getActiveId();
    return this.fileSignal().variants.find((v) => v.id === id) ?? null;
  }

  async setActiveId(id: string): Promise<void> {
    await this.ensureLoaded();
    const current = this.fileSignal();
    if (current.activeId === id) return;
    if (!current.variants.find((v) => v.id === id)) {
      throw new AppError(ERROR_CODES.VER_006, {
        severity: 'warning',
        context: { reason: 'unknown-variant', id },
        recoverable: true,
      });
    }
    await this.writeFile({ ...current, activeId: id });
  }

  async rename(id: string, newName: string): Promise<Variant> {
    await this.ensureLoaded();
    const current = this.fileSignal();
    const variant = current.variants.find((v) => v.id === id);
    if (!variant) {
      throw new AppError(ERROR_CODES.VER_006, {
        severity: 'warning',
        context: { reason: 'unknown-variant', id },
        recoverable: true,
      });
    }
    const fs = this.requireAdapter();
    const { nextFile, nextVariant } = await renameVariant(fs, current, variant, newName);
    await this.writeFile(nextFile);
    return nextVariant;
  }

  async setColor(id: string, color: string): Promise<void> {
    await this.ensureLoaded();
    const current = this.fileSignal();
    if (!current.variants.find((v) => v.id === id)) return;
    const next = current.variants.map((v) => (v.id === id ? { ...v, color } : v));
    await this.writeFile({ ...current, variants: next });
  }

  // why: Principal is exempt from the dormant lifecycle per PROYECTO §19 13b-iii.
  async refreshActivity(thresholdDays: number, now = Date.now()): Promise<void> {
    await this.ensureLoaded();
    const fs = this.requireAdapter();
    const current = this.fileSignal();
    const updated: Variant[] = [];
    for (const v of current.variants) {
      const lastActivityAt = await computeLastActivityAt(fs, v);
      // why: Principal is exempt from the dormant lifecycle but its
      //      lastActivityAt still tracks real commits — otherwise a
      //      merge INTO Principal would leave its tile visually stale
      //      on /variants.
      const isProtected = v.id === PRINCIPAL_VARIANT_ID || v.protected;
      const state: Variant['state'] = isProtected
        ? 'active'
        : isDormant(lastActivityAt, thresholdDays, now)
          ? 'dormant'
          : 'active';
      if (v.lastActivityAt === lastActivityAt && v.state === state) {
        updated.push(v);
      } else {
        updated.push({ ...v, lastActivityAt, state });
      }
    }
    const changed = updated.some(
      (v, i) =>
        v.lastActivityAt !== current.variants[i]?.lastActivityAt ||
        v.state !== current.variants[i]?.state,
    );
    // why: lastActivityAt + state son valores DERIVADOS de los tips git.
    //      Persistirlos en variants.json hacía que cada refresh generara
    //      un autocommit "fantasma" cuyo único diff era el timestamp.
    //      Mantenemos los valores en el signal en memoria; al recargar
    //      la app, bootstrap llama refreshActivity() antes de mostrar UI.
    if (changed) this.fileSignal.set({ ...current, variants: updated });
  }

  // why: dev-only. Pin lastActivityAt for the dormant validation gate;
  //      next refreshActivity() will recompute from git. En memoria
  //      porque lastActivityAt no se persiste (ver refreshActivity).
  async setLastActivityAt(id: string, ts: number): Promise<void> {
    await this.ensureLoaded();
    const current = this.fileSignal();
    const next = current.variants.map((v) => (v.id === id ? { ...v, lastActivityAt: ts } : v));
    this.fileSignal.set({ ...current, variants: next });
  }

  async list(): Promise<readonly Variant[]> {
    await this.ensureLoaded();
    return this.fileSignal().variants.filter((v) => !v.pendingDelete);
  }

  async refresh(): Promise<void> {
    this.loaded = false;
    await this.ensureLoaded();
  }

  async create(opts: CreateVariantOptions): Promise<Variant> {
    await this.ensureLoaded();
    const slug = variantSlug(opts.name);
    if (!slug || slug === PRINCIPAL_VARIANT_ID) {
      throw new AppError(ERROR_CODES.VER_004, {
        severity: 'warning',
        context: { reason: 'invalid-name', name: opts.name },
        recoverable: true,
      });
    }
    const current = this.fileSignal();
    if (current.variants.find((v) => v.id === slug)) {
      throw new AppError(ERROR_CODES.VER_004, {
        severity: 'warning',
        context: { reason: 'duplicate', slug },
        recoverable: true,
      });
    }
    const parent = current.variants.find(
      (v) => v.id === (opts.fromVariantId ?? PRINCIPAL_VARIANT_ID),
    );
    if (!parent) {
      throw new AppError(ERROR_CODES.VER_004, {
        severity: 'warning',
        context: { reason: 'unknown-parent', id: opts.fromVariantId },
        recoverable: true,
      });
    }
    const newRefs = refsForSlug(slug);
    const { forkOid } = await forkFamilyAtomic(this.requireAdapter(), parent.refs, newRefs);
    const variant: Variant = {
      id: slug,
      name: opts.name.trim(),
      color: opts.color,
      protected: false,
      lastActivityAt: Date.now(),
      state: 'active',
      refs: newRefs,
      parentId: parent.id,
      forkOid,
    };
    await this.writeFile({ ...current, variants: [...current.variants, variant] });
    return variant;
  }

  // why: two-phase delete. Phase 1 marks pendingDelete + persists;
  //      phase 2 wipes refs + entry. Crash between leaves a retryable
  //      pendingDelete that ensureLoaded() picks up next load.
  async delete(id: string): Promise<void> {
    await this.ensureLoaded();
    if (id === PRINCIPAL_VARIANT_ID) {
      throw new AppError(ERROR_CODES.VER_005, {
        severity: 'warning',
        context: { reason: 'protected' },
        recoverable: true,
      });
    }
    const current = this.fileSignal();
    const variant = current.variants.find((v) => v.id === id);
    if (!variant) return;
    if (current.activeId === id) {
      throw new AppError(ERROR_CODES.VER_005, {
        severity: 'warning',
        context: { reason: 'active', id },
        recoverable: true,
      });
    }
    if (!variant.pendingDelete) {
      const marked = current.variants.map((v) => (v.id === id ? { ...v, pendingDelete: true } : v));
      await this.writeFile({ ...current, variants: marked });
    }
    await this.completeDelete(id);
  }

  // ---- private ----

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const dir = await this.metaDir();
    if (!dir) return;
    let parsed: { file: VariantsFile; migrated: boolean } | null = null;
    try {
      const raw = await this.fs.readJson<unknown>(dir, VARIANTS_FILE);
      parsed = sanitizeVariantsFile(raw);
    } catch (cause) {
      if (!isNotFound(cause)) {
        throw new AppError(ERROR_CODES.VER_006, { severity: 'error', cause, recoverable: true });
      }
    }
    if (!parsed) {
      await this.writeFile(DEFAULT_VARIANTS_FILE);
      this.loaded = true;
      return;
    }
    // why: persist the schema bump on read so the on-disk file matches
    //      the in-memory model and a later crash before any mutation
    //      doesn't re-run the migration on every load.
    if (parsed.migrated) {
      await this.writeFile(parsed.file);
    } else {
      this.fileSignal.set(parsed.file);
    }
    this.loaded = true;
    // why: opportunistically retry deletions left half-applied by a
    //      previous crash; failure is non-fatal (retried next load).
    for (const v of parsed.file.variants.filter((p) => p.pendingDelete)) {
      try {
        await this.completeDelete(v.id);
      } catch {
        // surfaces on next user action
      }
    }
  }

  private async completeDelete(id: string): Promise<void> {
    const current = this.fileSignal();
    const variant = current.variants.find((v) => v.id === id);
    if (!variant) return;
    await deleteFamilyRefs(this.requireAdapter(), variant.refs);
    const next = current.variants.filter((v) => v.id !== id);
    await this.writeFile({ ...current, variants: next });
  }

  private requireAdapter(): GitFsAdapter {
    if (this.adapter) return this.adapter;
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_006, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    this.adapter = new GitFsAdapter(root, this.fs);
    return this.adapter;
  }

  private async metaDir(): Promise<NativeDirRef | null> {
    const root = this.workspace.root();
    if (!root) return null;
    try {
      return await this.fs.getOrCreateDir(root, META_DIR);
    } catch {
      return null;
    }
  }

  private async writeFile(next: VariantsFile): Promise<void> {
    const dir = await this.metaDir();
    if (!dir) {
      throw new AppError(ERROR_CODES.VER_006, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    await this.fs.writeFileAtomic(dir, VARIANTS_FILE, JSON.stringify(next, null, 2));
    this.fileSignal.set(next);
  }
}
