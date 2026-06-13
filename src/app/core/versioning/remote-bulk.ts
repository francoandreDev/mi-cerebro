// 13e-ii — bulk push / fetch orchestration for the GitHub bridge.
// Pure orchestration: callers inject `pushOne` / `fetchOne` so unit
// tests can exercise the iteration + classification without touching
// the network. The real factories at the bottom wire isomorphic-git.

import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

import type { GitFsAdapter } from './git-fs.adapter';
import {
  FACETS,
  type Facet,
  type RefSyncOutcome,
  type RefSyncStatus,
  type RemoteConfig,
} from './remote.types';
import { stripHeadsPrefix } from './variants.io';
import type { Variant } from './variants.types';

const REPO_DIR = '/';
const CORS_PROXY = 'https://cors.isomorphic-git.org';
const REMOTE_NAME = 'origin';

export interface RefTarget {
  readonly variantId: string;
  readonly facet: Facet;
  readonly ref: string;
}

export type SyncOneFn = (ref: string) => Promise<{
  readonly status: RefSyncStatus;
  readonly error?: string;
}>;

export function listRefTargets(variants: readonly Variant[]): RefTarget[] {
  const targets: RefTarget[] = [];
  for (const v of variants) {
    for (const facet of FACETS) {
      targets.push({ variantId: v.id, facet, ref: stripHeadsPrefix(v.refs[facet]) });
    }
  }
  return targets;
}

export function remoteTrackingRef(ref: string): string {
  return `refs/remotes/${REMOTE_NAME}/${ref}`;
}

// why: serial — isomorphic-git operations on the same dir/handle race
//      under the FS Access adapter; parallelism here would gain nothing
//      and would risk corrupt loose objects.
export async function runBulk(
  targets: readonly RefTarget[],
  syncOne: SyncOneFn,
): Promise<RefSyncOutcome[]> {
  const out: RefSyncOutcome[] = [];
  for (const t of targets) {
    const r = await syncOne(t.ref);
    out.push({
      variantId: t.variantId,
      facet: t.facet,
      ref: t.ref,
      remoteRef: t.ref,
      status: r.status,
      ...(r.error ? { error: r.error } : {}),
    });
  }
  return out;
}

export function summarize(outcomes: readonly RefSyncOutcome[]): {
  errorCount: number;
  successCount: number;
} {
  let errorCount = 0;
  let successCount = 0;
  for (const o of outcomes) {
    if (o.status === 'error') errorCount++;
    else successCount++;
  }
  return { errorCount, successCount };
}

const isUpToDate = (msg: string | null | undefined): boolean =>
  typeof msg === 'string' && /up.?to.?date|up to date/i.test(msg);

const isAbsentMsg = (msg: string): boolean =>
  /not\s*found|does\s*not\s*exist|\b404\b|remote.*does.*not.*support/i.test(msg);

const realFailure = (msg: string | null): boolean => msg !== null && !isUpToDate(msg);

function refErrorOf(
  result: { refs?: Record<string, { error: string }> },
  ref: string,
): string | null {
  const refs = result.refs;
  if (!refs) return null;
  const entry = refs[ref];
  return entry?.error ?? null;
}

function classifyPushResult(
  result: { ok: boolean; error: string | null; refs?: Record<string, { error: string }> },
  ref: string,
): { status: RefSyncStatus; error?: string } {
  const refErr = refErrorOf(result, ref);
  const topErr = result.error;
  const failed = !result.ok || realFailure(topErr) || realFailure(refErr);
  if (failed) return { status: 'error', error: topErr ?? refErr ?? 'unknown' };
  return { status: isUpToDate(refErr) ? 'up-to-date' : 'ok' };
}

export function gitPushOne(adapter: GitFsAdapter, cfg: RemoteConfig): SyncOneFn {
  return async (ref) => {
    try {
      const result = await git.push({
        fs: adapter,
        http,
        dir: REPO_DIR,
        url: cfg.url,
        ref,
        remoteRef: ref,
        corsProxy: CORS_PROXY,
        onAuth: () => ({ username: cfg.token, password: 'x-oauth-basic' }),
      });
      return classifyPushResult(result, ref);
    } catch (cause) {
      const message = String((cause as Error)?.message ?? cause ?? 'unknown');
      return { status: 'error', error: message };
    }
  };
}

export function gitFetchOne(adapter: GitFsAdapter, cfg: RemoteConfig): SyncOneFn {
  return async (ref) => {
    try {
      await git.fetch({
        fs: adapter,
        http,
        dir: REPO_DIR,
        url: cfg.url,
        remote: REMOTE_NAME,
        ref,
        singleBranch: true,
        tags: false,
        corsProxy: CORS_PROXY,
        onAuth: () => ({ username: cfg.token, password: 'x-oauth-basic' }),
      });
      return { status: 'ok' };
    } catch (cause) {
      const message = String((cause as Error)?.message ?? cause ?? 'unknown');
      if (isAbsentMsg(message)) return { status: 'absent' };
      return { status: 'error', error: message };
    }
  };
}
