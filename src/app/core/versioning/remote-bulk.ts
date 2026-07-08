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

// why: `git.fetch()` writes fetched refs into `refs/remotes/<remote>/*` by
//      reading the fetch refspec from `.git/config` — it ignores the `url`
//      argument for that step. `RemoteService.configure()` only ever wrote
//      `secrets.json`, never a `[remote "origin"]` config entry, so fetch
//      has thrown `NoRefspecError` on every workspace that configured a
//      remote before this fix. `addRemote(..., force: true)` is a cheap,
//      idempotent local write (no network) — safe to call before every
//      fetchAll rather than only once at configure-time, so it self-heals
//      workspaces that already hit the bug.
export async function ensureRemoteConfigured(adapter: GitFsAdapter, url: string): Promise<void> {
  await git.addRemote({ fs: adapter, dir: REPO_DIR, remote: REMOTE_NAME, url, force: true });
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

// why: a facet branch (draft/comments) that was never created — locally by
//      push, or on the remote by fetch — surfaces as isomorphic-git's
//      `NotFoundError`, whose message ("Could not find X.") doesn't match
//      `isAbsentMsg`'s "not found" pattern.
const isMissingRef = (cause: unknown): boolean => (cause as Error)?.name === 'NotFoundError';

// why: `''` and `undefined` both mean "no message" — isomorphic-git leaves
//      `.error` unset on a successful push (not explicitly `null`), and sets
//      it to `''` on a successful per-ref update (nothing to slice out of
//      the "ok <ref>" line). Only a non-empty, non-"up to date" string is a
//      real failure.
const realFailure = (msg: string | null | undefined): boolean => !!msg && !isUpToDate(msg);

function refErrorOf(
  result: { refs?: Record<string, { ok: boolean; error: string }> },
  ref: string,
): string | null {
  const refs = result.refs;
  if (!refs) return null;
  // why: isomorphic-git keys `result.refs` by the full ref name the server
  //      echoed back (`refs/heads/<ref>`), not the short name we pass in as
  //      `ref`/`remoteRef` — look up both forms so a real per-ref rejection
  //      isn't silently dropped.
  const entry = refs[ref] ?? refs[`refs/heads/${ref}`];
  return entry?.error || null;
}

export function classifyPushResult(
  result: {
    ok: boolean;
    error?: string | null;
    refs?: Record<string, { ok: boolean; error: string }>;
  },
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
      // why: facet branches (draft/comments) are created lazily — a variant
      //      that never entered draft mode has no local `refs/heads/<ref>`
      //      to push. That's "nothing to sync" (mirrors gitFetchOne's
      //      `isAbsentMsg` handling for a ref missing on the *remote* side),
      //      not a failure — surfacing it as `error` produces a permanent,
      //      unfixable red badge on every pushAll for that variant.
      if (isMissingRef(cause)) return { status: 'absent' };
      const message = String((cause as Error)?.message ?? cause ?? 'unknown');
      return { status: 'error', error: message };
    }
  };
}

// §12 — force-push with a lease. After compaction rewrites history, the
// next push must be force, but only if the server still points at the
// oid we last saw. isomorphic-git doesn't ship `--force-with-lease`, so
// we synthesize it via `onPrePush`: the callback receives the actual
// server-side oid for the ref; if it doesn't match the lease the caller
// captured before the rewrite, abort by returning false (push throws).
// `null` lease = "no expectation" (skip the check; useful when the ref
// never existed on remote).
export function gitPushWithLeaseOne(
  adapter: GitFsAdapter,
  cfg: RemoteConfig,
  expectedRemoteOid: string | null,
): SyncOneFn {
  return async (ref) => {
    try {
      const result = await git.push({
        fs: adapter,
        http,
        dir: REPO_DIR,
        url: cfg.url,
        ref,
        remoteRef: ref,
        force: true,
        corsProxy: CORS_PROXY,
        onAuth: () => ({ username: cfg.token, password: 'x-oauth-basic' }),
        onPrePush: ({ remoteRef }) => {
          if (expectedRemoteOid === null) return true;
          return remoteRef.oid === expectedRemoteOid;
        },
      });
      return classifyPushResult(result, ref);
    } catch (cause) {
      const message = String((cause as Error)?.message ?? cause ?? 'unknown');
      const isLease = /pre-?push|onPrePush|prepush|aborted/i.test(message);
      return {
        status: 'error',
        error: isLease ? `lease-violation:${ref}` : message,
      };
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
      // why: mirrors the same lazily-created-facet-branch case gitPushOne
      //      handles — the ref is absent on the remote too, isomorphic-git
      //      throws NotFoundError with a message `isAbsentMsg` doesn't
      //      match ("Could not find X." has no "found").
      if (isMissingRef(cause)) return { status: 'absent' };
      const message = String((cause as Error)?.message ?? cause ?? 'unknown');
      if (isAbsentMsg(message)) return { status: 'absent' };
      return { status: 'error', error: message };
    }
  };
}
