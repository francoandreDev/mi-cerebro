// Parsing, validation and small git helpers for VariantsService. Lives
// in its own file so the service stays under the size cap and so the
// sanitizer can be unit-tested in isolation.

import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';

import type { GitFsAdapter } from './git-fs.adapter';
import {
  PRINCIPAL_VARIANT_ID,
  VARIANTS_SCHEMA_VERSION,
  type Variant,
  type VariantRefs,
  type VariantsFile,
} from './variants.types';

export function isNotFound(cause: unknown): boolean {
  if (cause instanceof DOMException && cause.name === 'NotFoundError') return true;
  if (cause instanceof AppError) {
    const inner = cause.cause;
    if (inner instanceof DOMException && inner.name === 'NotFoundError') return true;
  }
  return false;
}

export async function resolveOrNull(fs: GitFsAdapter, ref: string): Promise<string | null> {
  try {
    return await git.resolveRef({ fs, dir: '/', ref });
  } catch {
    return null;
  }
}

export function stripHeadsPrefix(ref: string): string {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
}

export interface SanitizeResult {
  readonly file: VariantsFile;
  // why: lets VariantsService know it must persist the upgraded file
  //      (and trigger the pre-migration backup if/when wired) instead
  //      of waiting for the next mutation.
  readonly migrated: boolean;
}

// Accept the current schema (v2) and a known previous (v1, no
// lineage). v1 is migrated in place by filling parentId='principal'
// for non-principal entries and leaving forkOid=null ("origen
// desconocido"). Any other version, or a malformed entry inside a
// known version, returns null and the service falls back to a fresh
// Principal-only file (and surfaces MCB-VER-006 if the file existed).
export function sanitizeVariantsFile(raw: unknown): SanitizeResult | null {
  if (!isObject(raw)) return null;
  const r = raw as { schemaVersion?: unknown; activeId?: unknown; variants?: unknown };
  if (r.schemaVersion !== 1 && r.schemaVersion !== VARIANTS_SCHEMA_VERSION) return null;
  if (typeof r.activeId !== 'string') return null;
  if (!Array.isArray(r.variants)) return null;
  const v1 = r.schemaVersion === 1;
  const variants: Variant[] = [];
  for (const entry of r.variants) {
    const sanitized = sanitizeVariant(entry, v1);
    if (!sanitized) return null;
    variants.push(sanitized);
  }
  return {
    file: { schemaVersion: VARIANTS_SCHEMA_VERSION, activeId: r.activeId, variants },
    migrated: v1,
  };
}

function sanitizeVariant(raw: unknown, migrateFromV1: boolean): Variant | null {
  if (!isObject(raw)) return null;
  const v = raw as Partial<Variant> & Record<string, unknown>;
  if (typeof v.id !== 'string') return null;
  if (typeof v.name !== 'string') return null;
  if (typeof v.color !== 'string') return null;
  if (typeof v.protected !== 'boolean') return null;
  if (typeof v.lastActivityAt !== 'number') return null;
  if (v.state !== 'active' && v.state !== 'dormant') return null;
  const refs = sanitizeRefs(v.refs);
  if (!refs) return null;
  const lineage = readLineage(v, migrateFromV1);
  if (!lineage) return null;
  return {
    id: v.id,
    name: v.name,
    color: v.color,
    protected: v.protected,
    lastActivityAt: v.lastActivityAt,
    state: v.state,
    refs,
    pendingDelete: v.pendingDelete === true,
    parentId: lineage.parentId,
    forkOid: lineage.forkOid,
  };
}

function readLineage(
  v: Partial<Variant> & Record<string, unknown>,
  migrateFromV1: boolean,
): { parentId: string | null; forkOid: string | null } | null {
  if (migrateFromV1) {
    return {
      parentId: v.id === PRINCIPAL_VARIANT_ID ? null : PRINCIPAL_VARIANT_ID,
      forkOid: null,
    };
  }
  const parentId =
    v.parentId === null ? null : typeof v.parentId === 'string' ? v.parentId : undefined;
  if (parentId === undefined) return null;
  const forkOid = v.forkOid === null ? null : typeof v.forkOid === 'string' ? v.forkOid : undefined;
  if (forkOid === undefined) return null;
  return { parentId, forkOid };
}

function sanitizeRefs(raw: unknown): VariantRefs | null {
  if (!isObject(raw)) return null;
  const r = raw as Partial<VariantRefs>;
  if (typeof r.main !== 'string') return null;
  if (typeof r.draft !== 'string') return null;
  if (typeof r.comments !== 'string') return null;
  return { main: r.main, draft: r.draft, comments: r.comments };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}
