// Reads per-variant signals that don't belong in VariantsService because
// they're presentation-only (unmerged commit count, head commit subject,
// reachable milestone, ahead/behind vs Principal). Kept inside the
// feature so the core service stays focused on persistence + atomic ops.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { GitFsAdapter } from '@core/versioning/git-fs.adapter';
import { OpfsGitRootService } from '@core/versioning/opfs-git-root';
import { MilestoneService } from '@core/versioning/milestone.service';
import { resolveOrNull, stripHeadsPrefix } from '@core/versioning/variants.io';
import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';

const REPO_DIR = '/';
const COUNT_DEPTH = 200;
const LOG_DEPTH = 500;

export interface HeadCommit {
  readonly oid: string;
  readonly subject: string;
  readonly ts: number;
}

export interface ReachableMilestone {
  readonly name: string;
  readonly oid: string;
}

export interface VariantOverview {
  readonly head: HeadCommit | null;
  readonly milestone: ReachableMilestone | null;
  readonly ahead: number;
  readonly behind: number;
}

@Injectable()
export class VariantsStatsService {
  private readonly workspace = inject(WorkspaceService);
  private readonly milestones = inject(MilestoneService);
  private readonly fs = inject(FsService);
  private readonly opfsGitRoot = inject(OpfsGitRootService);
  private readonly cache = new Map<string, { headOid: string; data: VariantOverview }>();

  // Returns the number of commits on `variant.main` that are not yet
  // reachable from `main`. Used to warn before deletion.
  async unmergedAgainstPrincipal(variant: Variant): Promise<number> {
    const fs = await this.adapter();
    if (!fs) return 0;
    try {
      const principal = await git.log({ fs, dir: REPO_DIR, ref: 'main', depth: COUNT_DEPTH });
      const known = new Set(principal.map((e) => e.oid));
      const log = await git.log({
        fs,
        dir: REPO_DIR,
        ref: stripHeadsPrefix(variant.refs.main),
        depth: COUNT_DEPTH,
      });
      let count = 0;
      for (const entry of log) {
        if (known.has(entry.oid)) break;
        count++;
      }
      return count;
    } catch {
      return 0;
    }
  }

  // Resolves the presentation-only signals for a variant in one pass:
  // head commit, most recent milestone reachable from head, and
  // ahead/behind vs Principal. Memoized by head OID — switching to a
  // dormant tile or scrolling the list doesn't redo the git walk
  // unless the underlying ref actually moved.
  async overview(variant: Variant): Promise<VariantOverview> {
    const fs = await this.adapter();
    if (!fs) return emptyOverview();
    const headOid = await resolveOrNull(fs, variant.refs.main);
    if (!headOid) return emptyOverview();
    const cached = this.cache.get(variant.id);
    if (cached && cached.headOid === headOid) return cached.data;

    const head = await this.readHead(fs, headOid);
    const principalOid =
      variant.id === PRINCIPAL_VARIANT_ID ? headOid : await resolveOrNull(fs, 'main');
    const { ahead, behind } = await this.diverge(fs, headOid, principalOid);
    const milestone = await this.findReachableMilestone(fs, headOid);
    const data: VariantOverview = { head, milestone, ahead, behind };
    this.cache.set(variant.id, { headOid, data });
    return data;
  }

  invalidate(): void {
    this.cache.clear();
  }

  private async readHead(fs: GitFsAdapter, oid: string): Promise<HeadCommit | null> {
    try {
      const log = await git.log({ fs, dir: REPO_DIR, ref: oid, depth: 1 });
      const entry = log[0];
      if (!entry) return null;
      const message = entry.commit.message;
      const subject = message.split('\n', 1)[0] ?? '';
      return {
        oid: entry.oid,
        subject,
        // why: git timestamps are seconds-since-epoch; UI uses ms.
        ts: entry.commit.author.timestamp * 1000,
      };
    } catch {
      return null;
    }
  }

  // Walk both sides up to LOG_DEPTH, classic ahead/behind without a
  // dedicated merge-base call. Bounded so a runaway history doesn't
  // freeze the page.
  private async diverge(
    fs: GitFsAdapter,
    headOid: string,
    principalOid: string | null,
  ): Promise<{ ahead: number; behind: number }> {
    if (!principalOid || principalOid === headOid) return { ahead: 0, behind: 0 };
    try {
      const principal = await git.log({ fs, dir: REPO_DIR, ref: principalOid, depth: LOG_DEPTH });
      const own = await git.log({ fs, dir: REPO_DIR, ref: headOid, depth: LOG_DEPTH });
      const principalSet = new Set(principal.map((e) => e.oid));
      const ownSet = new Set(own.map((e) => e.oid));
      let ahead = 0;
      for (const e of own) {
        if (principalSet.has(e.oid)) break;
        ahead++;
      }
      let behind = 0;
      for (const e of principal) {
        if (ownSet.has(e.oid)) break;
        behind++;
      }
      return { ahead, behind };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  private async findReachableMilestone(
    fs: GitFsAdapter,
    headOid: string,
  ): Promise<ReachableMilestone | null> {
    let tags: { name: string; oid: string }[];
    try {
      tags = (await this.milestones.list()).map((m) => ({ name: m.name, oid: m.oid }));
    } catch {
      return null;
    }
    if (tags.length === 0) return null;
    const byOid = new Map(tags.map((t) => [t.oid, t.name] as const));
    try {
      const log = await git.log({ fs, dir: REPO_DIR, ref: headOid, depth: LOG_DEPTH });
      for (const entry of log) {
        const name = byOid.get(entry.oid);
        if (name) return { name, oid: entry.oid };
      }
    } catch {
      return null;
    }
    return null;
  }

  private async adapter(): Promise<GitFsAdapter | null> {
    const root = this.workspace.root();
    if (!root) return null;
    const gitDirRoot = await this.opfsGitRoot.getGitDir();
    return new GitFsAdapter(root, this.fs, gitDirRoot);
  }
}

function emptyOverview(): VariantOverview {
  return { head: null, milestone: null, ahead: 0, behind: 0 };
}
