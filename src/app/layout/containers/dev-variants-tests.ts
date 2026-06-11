// Programmatic tests for the 13b-i close-out criteria. Each test sets
// up a controlled scenario with a throwaway slug, runs the path, asserts
// the post-state and cleans up. Returns a structured result the panel
// renders as a pass/fail badge — the user no longer has to read raw
// error banners to know whether the criterion held.

import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import type { GitFsAdapter } from '@core/versioning/git-fs.adapter';
import type { VariantsService } from '@core/versioning/variants.service';

export interface TestResult {
  readonly pass: boolean;
  readonly message: string;
}

const SLUG_PREFIX = '__dev-test';

function uniqueName(): string {
  return `${SLUG_PREFIX}-${Date.now().toString(36)}`;
}

async function listBranches(fs: GitFsAdapter): Promise<Set<string>> {
  return new Set(await git.listBranches({ fs, dir: '/' }));
}

// Criterion #1: creating a variant produces its 3 branches and a real
// entry in variants.json. Cleans up by deleting the throwaway variant.
export async function testCreateFlow(
  service: VariantsService,
  fs: GitFsAdapter,
): Promise<TestResult> {
  const name = uniqueName();
  try {
    const beforeBranches = await listBranches(fs);
    const beforeCount = service.file().variants.length;
    const created = await service.create({ name, color: '#888888' });
    const afterBranches = await listBranches(fs);
    const afterCount = service.file().variants.length;
    if (afterCount !== beforeCount + 1) {
      return { pass: false, message: 'variants.json no creció en 1 entrada' };
    }
    for (const ref of [created.refs.main, created.refs.draft, created.refs.comments]) {
      if (!afterBranches.has(ref)) {
        return { pass: false, message: `falta el ref ${ref} en .git` };
      }
      if (beforeBranches.has(ref)) {
        return { pass: false, message: `${ref} ya existía antes del create` };
      }
    }
    return {
      pass: true,
      message: `creó ${created.refs.main}, ${created.refs.draft}, ${created.refs.comments}`,
    };
  } finally {
    try {
      await service.delete(slugOf(name));
    } catch {
      // best-effort
    }
  }
}

// Criterion #2: when one of the 3 branch() calls fails, the service
// rolls back the others and does NOT write variants.json. We exercise
// this by pre-creating a ref with the same name as the 3rd branch the
// service is about to create, so git.branch throws on it.
export async function testRollbackOnFailure(
  service: VariantsService,
  fs: GitFsAdapter,
): Promise<TestResult> {
  const name = uniqueName();
  const slug = slugOf(name);
  const blockingRef = `variant/${slug}/comments`;
  let blockerCreated = false;
  try {
    const beforeBranches = await listBranches(fs);
    const beforeCount = service.file().variants.length;
    const headOid = await git.resolveRef({ fs, dir: '/', ref: 'main' });
    await git.branch({ fs, dir: '/', ref: blockingRef, object: headOid });
    blockerCreated = true;
    let threw = false;
    try {
      await service.create({ name, color: '#888888' });
    } catch (e) {
      if (e instanceof AppError && e.code === 'MCB-VER-004') threw = true;
      else return { pass: false, message: `se esperaba VER-004, salió: ${format(e)}` };
    }
    if (!threw) return { pass: false, message: 'create no lanzó VER-004 a pesar del bloqueo' };
    const afterCount = service.file().variants.length;
    if (afterCount !== beforeCount) {
      return { pass: false, message: 'variants.json cambió a pesar del fallo' };
    }
    const afterBranches = await listBranches(fs);
    for (const leftover of [`variant/${slug}/main`, `variant/${slug}/draft`]) {
      if (afterBranches.has(leftover) && !beforeBranches.has(leftover)) {
        return { pass: false, message: `quedó huérfana ${leftover} (rollback incompleto)` };
      }
    }
    return {
      pass: true,
      message: 'create lanzó VER-004 y dejó el repo y variants.json como estaban',
    };
  } catch (e) {
    return { pass: false, message: `error inesperado: ${format(e)}` };
  } finally {
    if (blockerCreated) {
      try {
        await git.deleteBranch({ fs, dir: '/', ref: blockingRef });
      } catch {
        // already gone
      }
    }
  }
}

// Criterion #3: deleting a variant removes its 3 branches and the
// variants.json entry.
export async function testDeleteFlow(
  service: VariantsService,
  fs: GitFsAdapter,
): Promise<TestResult> {
  const name = uniqueName();
  try {
    const created = await service.create({ name, color: '#888888' });
    await service.delete(created.id);
    const branches = await listBranches(fs);
    for (const ref of [created.refs.main, created.refs.draft, created.refs.comments]) {
      if (branches.has(ref)) {
        return { pass: false, message: `${ref} sigue en .git tras delete` };
      }
    }
    if (service.file().variants.some((v) => v.id === created.id)) {
      return { pass: false, message: 'la entrada sigue en variants.json' };
    }
    return { pass: true, message: 'los 3 refs y la entrada desaparecieron' };
  } catch (e) {
    return { pass: false, message: format(e) };
  }
}

function slugOf(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function format(e: unknown): string {
  if (e instanceof AppError) return `${e.code}: ${e.messageKey}`;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}
