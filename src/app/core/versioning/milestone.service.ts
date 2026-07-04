// Named milestones over git annotated tags (PROYECTO.md §19 paso 13a-bis).
// Lets the user mark a commit ("antes de refactor X") as a persistent
// reference separate from the commit log itself. Implemented as
// isomorphic-git annotated tags so the name + user-supplied description
// live in a real git object that travels with push (13e) and survives
// any rebuild of the timeline UI.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { WorkspaceService } from '@core/fs/workspace.service';

import { SettingsService } from '@core/settings/settings.service';

import { CompactionService } from './compaction.service';
import { GitFsAdapter } from './git-fs.adapter';
import { buildMilestoneCompactionPlan } from './milestone-compaction-plan';
import { RemoteService } from './remote.service';
import { VersioningService } from './versioning.service';
import { DEFAULT_GIT_AUTHOR } from './versioning.constants';

const REPO_DIR = '/';

export interface Milestone {
  readonly name: string;
  readonly oid: string;
  readonly message: string;
}

export type CreateMilestoneResult =
  | { readonly status: 'created'; readonly milestone: Milestone }
  | { readonly status: 'name-taken'; readonly existing: Milestone };

// why: variante de create() disparada desde /history que además reescribe
//      el rango [milestone previo (o root) .. oid] en la rama pasada.
//      `rewrote` distingue el caso "compactación efectiva" del "no había
//      nada que compactar" (rango de 0 commits fusionables) y del "gated
//      por remote-toggle off".
export type CreateAndCompactResult =
  | { readonly status: 'created'; readonly milestone: Milestone; readonly rewrote: boolean }
  | { readonly status: 'name-taken'; readonly existing: Milestone };

export type RenameMilestoneResult =
  | { readonly status: 'renamed'; readonly milestone: Milestone }
  | { readonly status: 'name-taken'; readonly existing: Milestone };

@Injectable({ providedIn: 'root' })
export class MilestoneService {
  private readonly workspace = inject(WorkspaceService);
  private readonly versioning = inject(VersioningService);
  private readonly compaction = inject(CompactionService);
  private readonly remote = inject(RemoteService);
  private readonly settings = inject(SettingsService);
  private adapter: GitFsAdapter | null = null;

  private requireAdapter(): GitFsAdapter {
    if (this.adapter) return this.adapter;
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_017, {
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

  async list(): Promise<Milestone[]> {
    const fs = this.requireAdapter();
    const names = await git.listTags({ fs, dir: REPO_DIR });
    const out: Milestone[] = [];
    for (const name of names) {
      const m = await this.read(name);
      if (m) out.push(m);
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  async create(oid: string, name: string, description?: string): Promise<CreateMilestoneResult> {
    const slug = toSlug(name);
    if (!slug) {
      throw new AppError(ERROR_CODES.VER_017, {
        severity: 'warning',
        context: { reason: 'invalid-name', name },
        recoverable: true,
      });
    }
    const existing = await this.read(slug);
    if (existing) return { status: 'name-taken', existing };
    const milestone = await this.writeTag(oid, slug, name, description);
    return { status: 'created', milestone };
  }

  // §12 "Disparo por milestone": crear tag + compactar el rango
  // [milestone previo (o root) .. oid] en `ref`. El tag se planta al
  // final sobre el oid post-rewrite; si el gate remoto está apagado o
  // no hay nada que fusionar, se cae al comportamiento de create() y
  // el tag queda sobre el oid original.
  async createAndCompact(
    oid: string,
    name: string,
    description: string | undefined,
    ref: string,
  ): Promise<CreateAndCompactResult> {
    const slug = toSlug(name);
    if (!slug) {
      throw new AppError(ERROR_CODES.VER_017, {
        severity: 'warning',
        context: { reason: 'invalid-name', name },
        recoverable: true,
      });
    }
    const existing = await this.read(slug);
    if (existing) return { status: 'name-taken', existing };

    const remoteConfigured = this.remote.isConfigured();
    const compactWithRemote = this.settings.state().versioning.compactWithRemote;
    const gatedOff = remoteConfigured && !compactWithRemote;
    if (gatedOff) {
      const milestone = await this.writeTag(oid, slug, name, description);
      return { status: 'created', milestone, rewrote: false };
    }

    const commits = await this.versioning.logFull(ref);
    const tagOids = await this.versioning.listTagOids();
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids,
      milestoneOid: oid,
      milestoneLabel: slug,
    });
    if (plan.fuseGroups.length === 0) {
      const milestone = await this.writeTag(oid, slug, name, description);
      return { status: 'created', milestone, rewrote: false };
    }

    // why: capturamos la lease ANTES de reescribir para que el push
    //      posterior compare contra el estado del remoto que vimos, no
    //      contra el post-rewrite. Mismo patrón que CompactionScheduler.
    const lease = remoteConfigured ? await this.remote.snapshotRemoteOid(ref) : null;
    const result = await this.compaction.applyPlan(ref, plan);
    const newOidForMilestone = result.newOidByTerminalOid.get(oid);
    if (!newOidForMilestone) {
      throw new AppError(ERROR_CODES.VER_025, {
        severity: 'error',
        context: { ref, reason: 'milestone-oid-not-remapped', oid },
        recoverable: true,
      });
    }
    const milestone = await this.writeTag(newOidForMilestone, slug, name, description);

    if (remoteConfigured) {
      const leases = new Map<string, string | null>([[ref, lease]]);
      // why: mismos códigos y semántica que la pasada background; si el
      //      remoto avanzó por otro lado, el push aborta sin pisar y el
      //      caller ve el AppError.
      await this.remote.pushAllWithLease(leases);
    }

    return { status: 'created', milestone, rewrote: true };
  }

  private async writeTag(
    oid: string,
    slug: string,
    name: string,
    description: string | undefined,
  ): Promise<Milestone> {
    const fs = this.requireAdapter();
    const message = buildMessage(name, description);
    try {
      await git.annotatedTag({
        fs,
        dir: REPO_DIR,
        ref: slug,
        object: oid,
        message,
        tagger: { ...DEFAULT_GIT_AUTHOR, timestamp: Math.floor(Date.now() / 1000) },
      });
    } catch (e) {
      throw new AppError(ERROR_CODES.VER_017, {
        severity: 'error',
        cause: e,
        context: { name, oid },
        recoverable: true,
      });
    }
    return { name: slug, oid, message };
  }

  // Rename = delete + recreate over the same oid. Option 2 in the
  // collision flow ("mover este milestone") uses the same mechanic but
  // against a different target oid.
  async rename(currentName: string, newName: string): Promise<RenameMilestoneResult> {
    const fs = this.requireAdapter();
    const current = await this.read(currentName);
    if (!current) {
      throw new AppError(ERROR_CODES.VER_018, {
        severity: 'error',
        context: { reason: 'not-found', name: currentName },
        recoverable: true,
      });
    }
    const newSlug = toSlug(newName);
    if (!newSlug) {
      throw new AppError(ERROR_CODES.VER_018, {
        severity: 'warning',
        context: { reason: 'invalid-name', name: newName },
        recoverable: true,
      });
    }
    if (newSlug === currentName) {
      return { status: 'renamed', milestone: current };
    }
    const existing = await this.read(newSlug);
    if (existing) return { status: 'name-taken', existing };
    try {
      await git.deleteTag({ fs, dir: REPO_DIR, ref: currentName });
      await git.annotatedTag({
        fs,
        dir: REPO_DIR,
        ref: newSlug,
        object: current.oid,
        message: buildMessage(newName),
        tagger: { ...DEFAULT_GIT_AUTHOR, timestamp: Math.floor(Date.now() / 1000) },
      });
    } catch (e) {
      throw new AppError(ERROR_CODES.VER_018, {
        severity: 'error',
        cause: e,
        context: { currentName, newName },
        recoverable: true,
      });
    }
    return {
      status: 'renamed',
      milestone: { name: newSlug, oid: current.oid, message: buildMessage(newName) },
    };
  }

  // Move an existing milestone to point at a different commit. Used by
  // option 2 of the collision flow when the user picks "mover el
  // milestone existente a este commit".
  async moveTo(name: string, newOid: string): Promise<Milestone> {
    const fs = this.requireAdapter();
    const current = await this.read(name);
    if (!current) {
      throw new AppError(ERROR_CODES.VER_018, {
        severity: 'error',
        context: { reason: 'not-found', name },
        recoverable: true,
      });
    }
    try {
      await git.deleteTag({ fs, dir: REPO_DIR, ref: name });
      await git.annotatedTag({
        fs,
        dir: REPO_DIR,
        ref: name,
        object: newOid,
        message: current.message,
        tagger: { ...DEFAULT_GIT_AUTHOR, timestamp: Math.floor(Date.now() / 1000) },
      });
    } catch (e) {
      throw new AppError(ERROR_CODES.VER_018, {
        severity: 'error',
        cause: e,
        context: { name, newOid },
        recoverable: true,
      });
    }
    return { name, oid: newOid, message: current.message };
  }

  async delete(name: string): Promise<void> {
    const fs = this.requireAdapter();
    try {
      await git.deleteTag({ fs, dir: REPO_DIR, ref: name });
    } catch (e) {
      throw new AppError(ERROR_CODES.VER_018, {
        severity: 'error',
        cause: e,
        context: { name },
        recoverable: true,
      });
    }
  }

  private async read(name: string): Promise<Milestone | null> {
    const fs = this.requireAdapter();
    try {
      const tagOid = await git.resolveRef({ fs, dir: REPO_DIR, ref: `refs/tags/${name}` });
      const { tag } = await git.readTag({ fs, dir: REPO_DIR, oid: tagOid });
      return { name, oid: tag.object, message: tag.message };
    } catch {
      return null;
    }
  }
}

// Slug: lowercased ASCII, spaces → hyphens, strip diacritics, collapse
// non-alphanum to hyphens, trim hyphens. Git tag refs forbid many ASCII
// chars (~ : ? * [ \ ^ etc.) — restricting to [a-z0-9-] is the safe path.
export function toSlug(name: string): string {
  const stripped = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return stripped.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildMessage(name: string, description?: string): string {
  const trimmed = description?.trim();
  return trimmed ? `${name}\n\n${trimmed}` : name;
}
