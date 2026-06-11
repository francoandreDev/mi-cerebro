// Reads per-variant signals that don't belong in VariantsService because
// they're presentation-only (unmerged commit count, last activity for
// rendering, etc.). Kept inside the feature so the core service stays
// focused on persistence + atomic ops.

import { Injectable, inject } from '@angular/core';
import * as git from 'isomorphic-git';

import { WorkspaceService } from '@core/fs/workspace.service';
import { GitFsAdapter } from '@core/versioning/git-fs.adapter';
import { stripHeadsPrefix } from '@core/versioning/variants.io';
import type { Variant } from '@core/versioning/variants.types';

const REPO_DIR = '/';
const COUNT_DEPTH = 200;

@Injectable()
export class VariantsStatsService {
  private readonly workspace = inject(WorkspaceService);

  // Returns the number of commits on `variant.main` that are not yet
  // reachable from `main`. Used to warn before deletion.
  async unmergedAgainstPrincipal(variant: Variant): Promise<number> {
    const fs = this.adapter();
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

  private adapter(): GitFsAdapter | null {
    const root = this.workspace.root();
    if (!root) return null;
    return new GitFsAdapter(root);
  }
}
