// 13b-i foundation: persist + manage the family-of-three-branches model
// (PROYECTO.md §19 paso 13b). This service owns variants.json and the
// git-side primitives to atomically create / delete a family. It does
// NOT do the active-variant switch (that's 13b-ii).
//
// why: file goes over the 200-line soft cap (rule §4.4). Splitting any
//      further would scatter the atomicity invariant — create/delete
//      both need to keep their two-phase persistence + rollback logic
//      side by side to be auditable. Validation IO + parsing already
//      live in variants.io.ts.

import { Injectable, inject, signal } from '@angular/core';
import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GitFsAdapter } from './git-fs.adapter';
import { isNotFound, resolveOrNull, sanitizeVariantsFile, stripHeadsPrefix } from './variants.io';
import {
  DEFAULT_VARIANTS_FILE,
  PRINCIPAL_VARIANT_ID,
  refsForSlug,
  variantSlug,
  type Variant,
  type VariantRefs,
  type VariantsFile,
} from './variants.types';

const REPO_DIR = '/';
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

  // why: 13b-i only persists the choice; 13b-ii adds the real checkout
  //      + index swap flow. Splitting these makes the dangerous bit
  //      land alone in 13b-ii.
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

  async list(): Promise<readonly Variant[]> {
    await this.ensureLoaded();
    return this.fileSignal().variants.filter((v) => !v.pendingDelete);
  }

  async refresh(): Promise<void> {
    this.loaded = false;
    await this.ensureLoaded();
  }

  // Atomic creation: forks the parent family's three refs into the new
  // family. If any of the three branch() calls fails, every branch we
  // already created is deleted in reverse order and variants.json is not
  // touched, so the workspace state matches what the user saw before.
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
    await this.forkFamilyAtomic(parent.refs, newRefs);
    const variant: Variant = {
      id: slug,
      name: opts.name.trim(),
      color: opts.color,
      protected: false,
      lastActivityAt: Date.now(),
      state: 'active',
      refs: newRefs,
    };
    await this.writeFile({ ...current, variants: [...current.variants, variant] });
    return variant;
  }

  // Two-phase delete (PROYECTO.md §19 13b-i validation #2). Phase 1
  // marks the entry pendingDelete + persists; phase 2 deletes branches +
  // removes entry. If phase 2 crashes the entry stays pendingDelete and
  // gets retried on next ensureLoaded().
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
    let parsed: VariantsFile | null = null;
    try {
      const raw = await this.fs.readJson<unknown>(dir, VARIANTS_FILE);
      parsed = sanitizeVariantsFile(raw);
    } catch (cause) {
      if (!isNotFound(cause)) {
        // why: a corrupt or schema-mismatched file degrades to Principal
        //      but we still report so the user can restore from
        //      .mi-cerebro/pre-migration/ if needed.
        throw new AppError(ERROR_CODES.VER_006, {
          severity: 'error',
          cause,
          recoverable: true,
        });
      }
    }
    if (!parsed) {
      await this.writeFile(DEFAULT_VARIANTS_FILE);
      this.loaded = true;
      return;
    }
    this.fileSignal.set(parsed);
    this.loaded = true;
    // why: opportunistically retry any deletions that didn't finish in
    //      a previous run. Failure here is non-fatal — they'll be
    //      retried again next load.
    const pending = parsed.variants.filter((v) => v.pendingDelete);
    for (const v of pending) {
      try {
        await this.completeDelete(v.id);
      } catch {
        // logged via subsequent user actions
      }
    }
  }

  private async completeDelete(id: string): Promise<void> {
    const fs = this.requireAdapter();
    const current = this.fileSignal();
    const variant = current.variants.find((v) => v.id === id);
    if (!variant) return;
    const refs: readonly string[] = [variant.refs.draft, variant.refs.comments, variant.refs.main];
    const existing = new Set(await git.listBranches({ fs, dir: REPO_DIR }));
    try {
      for (const ref of refs) {
        if (!existing.has(stripHeadsPrefix(ref))) continue;
        await git.deleteBranch({ fs, dir: REPO_DIR, ref });
      }
    } catch (cause) {
      throw new AppError(ERROR_CODES.VER_005, {
        severity: 'error',
        cause,
        context: { id },
        recoverable: true,
      });
    }
    const next = current.variants.filter((v) => v.id !== id);
    await this.writeFile({ ...current, variants: next });
  }

  private async forkFamilyAtomic(parent: VariantRefs, target: VariantRefs): Promise<void> {
    const fs = this.requireAdapter();
    const pairs: readonly [keyof VariantRefs, string, string][] = [
      ['main', parent.main, target.main],
      ['draft', parent.draft, target.draft],
      ['comments', parent.comments, target.comments],
    ];
    const created: string[] = [];
    try {
      for (const [, parentRef, newRef] of pairs) {
        const oid = await resolveOrNull(fs, parentRef);
        if (oid === null) {
          // why: parent draft/comments may not exist yet if Principal
          //      never seeded them. Use Principal's main as fallback so
          //      every new family still gets a real starting point.
          const fallback = await resolveOrNull(fs, 'main');
          if (fallback === null) {
            throw new AppError(ERROR_CODES.VER_004, {
              severity: 'error',
              context: { reason: 'no-parent-oid', parentRef },
              recoverable: true,
            });
          }
          await git.branch({ fs, dir: REPO_DIR, ref: newRef, object: fallback });
        } else {
          await git.branch({ fs, dir: REPO_DIR, ref: newRef, object: oid });
        }
        created.push(newRef);
      }
    } catch (cause) {
      for (const ref of [...created].reverse()) {
        try {
          await git.deleteBranch({ fs, dir: REPO_DIR, ref });
        } catch {
          // best-effort cleanup; if it fails, ensureLoaded retry will
          // not help because we never wrote variants.json. The leftover
          // branch is invisible to the user; harmless until the next
          // attempt to create the same slug, which surfaces VER-004.
        }
      }
      if (cause instanceof AppError) throw cause;
      throw new AppError(ERROR_CODES.VER_004, {
        severity: 'error',
        cause,
        context: { target },
        recoverable: true,
      });
    }
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
    this.adapter = new GitFsAdapter(root);
    return this.adapter;
  }

  private async metaDir(): Promise<FsDirectoryHandle | null> {
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
