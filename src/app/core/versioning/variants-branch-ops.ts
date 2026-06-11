// Atomic git-level branch operations for the variants family. Extracted
// from VariantsService so the service stays under the size cap; the
// atomicity invariants (3-ref reverse-order rollback on create, all-3
// deletes for delete) live together here for auditability.

import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { GitFsAdapter } from './git-fs.adapter';
import { resolveOrNull, stripHeadsPrefix } from './variants.io';
import type { VariantRefs } from './variants.types';

const REPO_DIR = '/';

export async function forkFamilyAtomic(
  fs: GitFsAdapter,
  parent: VariantRefs,
  target: VariantRefs,
): Promise<void> {
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
        // best-effort cleanup; the leftover branch is invisible to the
        // user and surfaces only on a future create attempt with the
        // same slug, which then fails fast with VER-004.
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

export async function deleteFamilyRefs(fs: GitFsAdapter, refs: VariantRefs): Promise<void> {
  const order: readonly string[] = [refs.draft, refs.comments, refs.main];
  const existing = new Set(await git.listBranches({ fs, dir: REPO_DIR }));
  try {
    for (const ref of order) {
      if (!existing.has(stripHeadsPrefix(ref))) continue;
      await git.deleteBranch({ fs, dir: REPO_DIR, ref });
    }
  } catch (cause) {
    throw new AppError(ERROR_CODES.VER_005, {
      severity: 'error',
      cause,
      recoverable: true,
    });
  }
}
