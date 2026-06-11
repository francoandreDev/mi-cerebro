// Parsing, validation and small git helpers for VariantsService. Lives
// in its own file so the service stays under the size cap and so the
// sanitizer can be unit-tested in isolation.

import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';

import type { GitFsAdapter } from './git-fs.adapter';
import {
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

// Reject anything that doesn't match the persisted shape exactly. The
// service falls back to a fresh Principal-only file when this returns
// null (and surfaces MCB-VER-006 if the file existed but failed).
export function sanitizeVariantsFile(raw: unknown): VariantsFile | null {
  if (!isObject(raw)) return null;
  const r = raw as Partial<VariantsFile>;
  if (r.schemaVersion !== VARIANTS_SCHEMA_VERSION) return null;
  if (typeof r.activeId !== 'string') return null;
  if (!Array.isArray(r.variants)) return null;
  const variants: Variant[] = [];
  for (const entry of r.variants) {
    const sanitized = sanitizeVariant(entry);
    if (!sanitized) return null;
    variants.push(sanitized);
  }
  return { schemaVersion: VARIANTS_SCHEMA_VERSION, activeId: r.activeId, variants };
}

function sanitizeVariant(raw: unknown): Variant | null {
  if (!isObject(raw)) return null;
  const v = raw as Partial<Variant>;
  if (typeof v.id !== 'string') return null;
  if (typeof v.name !== 'string') return null;
  if (typeof v.color !== 'string') return null;
  if (typeof v.protected !== 'boolean') return null;
  if (typeof v.lastActivityAt !== 'number') return null;
  if (v.state !== 'active' && v.state !== 'dormant') return null;
  const refs = sanitizeRefs(v.refs);
  if (!refs) return null;
  return {
    id: v.id,
    name: v.name,
    color: v.color,
    protected: v.protected,
    lastActivityAt: v.lastActivityAt,
    state: v.state,
    refs,
    pendingDelete: v.pendingDelete === true,
  };
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
