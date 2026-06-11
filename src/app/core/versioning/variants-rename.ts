// 13b-iii rename helper. Lives next to VariantsService so the service
// stays under the 200-line soft cap (rule §4.4). Same atomicity contract
// as create: rename the three refs in order, and on any failure rename
// back the ones we already touched so the workspace state is unchanged.

import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { GitFsAdapter } from './git-fs.adapter';
import { stripHeadsPrefix } from './variants.io';
import {
  PRINCIPAL_VARIANT_ID,
  refsForSlug,
  variantSlug,
  type Variant,
  type VariantsFile,
} from './variants.types';

const REPO_DIR = '/';

export interface RenameResult {
  readonly nextFile: VariantsFile;
  readonly nextVariant: Variant;
}

// Renames a variant: new slug derived from `newName`. Atomically renames
// the three branches; if the variant was active, force-checkouts HEAD to
// the new `main` so the working tree keeps tracking it. variants.json is
// updated only after every git mutation succeeds.
export async function renameVariant(
  fs: GitFsAdapter,
  current: VariantsFile,
  variant: Variant,
  newName: string,
): Promise<RenameResult> {
  const newSlug = validateRename(current, variant, newName);
  if (newSlug === variant.id) return cosmeticRename(current, variant, newName);
  const target = refsForSlug(newSlug);
  await renameThreeRefsAtomically(fs, variant, target, newSlug);
  if (current.activeId === variant.id) await checkoutNewMain(fs, target.main, newSlug);
  const renamed: Variant = { ...variant, id: newSlug, name: newName.trim(), refs: target };
  const nextVariants = current.variants.map((v) => (v.id === variant.id ? renamed : v));
  const activeId = current.activeId === variant.id ? newSlug : current.activeId;
  return { nextFile: { ...current, activeId, variants: nextVariants }, nextVariant: renamed };
}

function validateRename(current: VariantsFile, variant: Variant, newName: string): string {
  if (variant.id === PRINCIPAL_VARIANT_ID || variant.protected) {
    throw new AppError(ERROR_CODES.VER_005, {
      severity: 'warning',
      context: { reason: 'protected', id: variant.id },
      recoverable: true,
    });
  }
  const newSlug = variantSlug(newName);
  if (!newSlug || newSlug === PRINCIPAL_VARIANT_ID) {
    throw new AppError(ERROR_CODES.VER_004, {
      severity: 'warning',
      context: { reason: 'invalid-name', name: newName },
      recoverable: true,
    });
  }
  if (newSlug !== variant.id && current.variants.some((v) => v.id === newSlug)) {
    throw new AppError(ERROR_CODES.VER_004, {
      severity: 'warning',
      context: { reason: 'duplicate', slug: newSlug },
      recoverable: true,
    });
  }
  return newSlug;
}

function cosmeticRename(current: VariantsFile, variant: Variant, newName: string): RenameResult {
  const renamed = { ...variant, name: newName.trim() };
  return {
    nextFile: {
      ...current,
      variants: current.variants.map((v) => (v.id === variant.id ? renamed : v)),
    },
    nextVariant: renamed,
  };
}

async function renameThreeRefsAtomically(
  fs: GitFsAdapter,
  variant: Variant,
  target: ReturnType<typeof refsForSlug>,
  newSlug: string,
): Promise<void> {
  const pairs: readonly { from: string; to: string }[] = [
    { from: variant.refs.main, to: target.main },
    { from: variant.refs.draft, to: target.draft },
    { from: variant.refs.comments, to: target.comments },
  ];
  const done: { from: string; to: string }[] = [];
  try {
    for (const p of pairs) {
      await git.renameBranch({
        fs,
        dir: REPO_DIR,
        ref: stripHeadsPrefix(p.to),
        oldref: stripHeadsPrefix(p.from),
      });
      done.push(p);
    }
  } catch (cause) {
    await rollbackRenames(fs, done);
    if (cause instanceof AppError) throw cause;
    throw new AppError(ERROR_CODES.VER_004, {
      severity: 'error',
      cause,
      context: { reason: 'rename-failed', from: variant.id, to: newSlug },
      recoverable: true,
    });
  }
}

async function rollbackRenames(
  fs: GitFsAdapter,
  done: readonly { from: string; to: string }[],
): Promise<void> {
  for (const p of [...done].reverse()) {
    try {
      await git.renameBranch({
        fs,
        dir: REPO_DIR,
        ref: stripHeadsPrefix(p.from),
        oldref: stripHeadsPrefix(p.to),
      });
    } catch {
      // best-effort
    }
  }
}

async function checkoutNewMain(fs: GitFsAdapter, mainRef: string, newSlug: string): Promise<void> {
  try {
    await git.checkout({ fs, dir: REPO_DIR, ref: stripHeadsPrefix(mainRef), force: true });
  } catch (cause) {
    // why: refs already swapped but HEAD didn't follow. Surface as
    //      VER-008 (same overlay as switch failure); a rollback here
    //      would leave the tree in a worse state.
    throw new AppError(ERROR_CODES.VER_008, {
      severity: 'error',
      cause,
      context: { reason: 'rename-checkout', to: newSlug },
      recoverable: true,
    });
  }
}
