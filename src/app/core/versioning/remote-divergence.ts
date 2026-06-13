// 13e-iii — divergence detection between local refs and the remote
// tracking refs that fetchAll just updated. `classifyTip` is pure — the
// async `detectDivergences` wraps it with the isomorphic-git ancestry
// queries so it can run after a fetch.

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from './git-fs.adapter';
import type { Facet, RefSyncOutcome } from './remote.types';

const REPO_DIR = '/';
const REMOTE_NAME = 'origin';

export type TipRelation = 'identical' | 'fast-forward' | 'ahead' | 'divergent' | 'absent';

export interface DivergentRef {
  readonly variantId: string;
  readonly facet: Facet;
  readonly ref: string;
  readonly remoteRef: string;
  readonly localOid: string;
  readonly remoteOid: string;
}

// Pure: given the two tips and the two ancestry answers, classifies the
// relationship. The async wrapper precomputes the ancestry bits.
export function classifyTip(
  localOid: string | null,
  remoteOid: string | null,
  localIsAncestorOfRemote: boolean,
  remoteIsAncestorOfLocal: boolean,
): TipRelation {
  if (remoteOid === null) return 'absent';
  if (localOid === null) return 'fast-forward';
  if (localOid === remoteOid) return 'identical';
  if (remoteIsAncestorOfLocal) return 'ahead';
  if (localIsAncestorOfRemote) return 'fast-forward';
  return 'divergent';
}

async function resolveOid(adapter: GitFsAdapter, ref: string): Promise<string | null> {
  try {
    return await git.resolveRef({ fs: adapter, dir: REPO_DIR, ref });
  } catch {
    return null;
  }
}

async function isAncestor(
  adapter: GitFsAdapter,
  descendant: string,
  ancestor: string,
): Promise<boolean> {
  try {
    return await git.isDescendent({ fs: adapter, dir: REPO_DIR, oid: descendant, ancestor });
  } catch {
    return false;
  }
}

export async function detectDivergences(
  adapter: GitFsAdapter,
  outcomes: readonly RefSyncOutcome[],
): Promise<DivergentRef[]> {
  const divergent: DivergentRef[] = [];
  for (const o of outcomes) {
    if (o.status === 'error' || o.status === 'absent') continue;
    const remoteRef = `refs/remotes/${REMOTE_NAME}/${o.ref}`;
    const [localOid, remoteOid] = await Promise.all([
      resolveOid(adapter, `refs/heads/${o.ref}`),
      resolveOid(adapter, remoteRef),
    ]);
    if (!localOid || !remoteOid || localOid === remoteOid) continue;
    const [localIsAnc, remoteIsAnc] = await Promise.all([
      isAncestor(adapter, remoteOid, localOid),
      isAncestor(adapter, localOid, remoteOid),
    ]);
    const rel = classifyTip(localOid, remoteOid, localIsAnc, remoteIsAnc);
    if (rel === 'divergent') {
      divergent.push({
        variantId: o.variantId,
        facet: o.facet,
        ref: o.ref,
        remoteRef,
        localOid,
        remoteOid,
      });
    }
  }
  return divergent;
}
