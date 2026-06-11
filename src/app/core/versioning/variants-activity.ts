// 13b-iii activity computation. `lastActivityAt` for a family is the
// max committer timestamp across the HEADs of its three refs. We read
// only depth: 1 so the call cost is bounded — Principal's main might
// have thousands of commits and we never need them.

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from './git-fs.adapter';
import { stripHeadsPrefix } from './variants.io';
import type { Variant } from './variants.types';

const REPO_DIR = '/';

export async function computeLastActivityAt(fs: GitFsAdapter, variant: Variant): Promise<number> {
  const refs = [variant.refs.main, variant.refs.draft, variant.refs.comments];
  let max = 0;
  for (const ref of refs) {
    const ts = await tipTimestamp(fs, stripHeadsPrefix(ref));
    if (ts > max) max = ts;
  }
  return max;
}

async function tipTimestamp(fs: GitFsAdapter, ref: string): Promise<number> {
  try {
    const log = await git.log({ fs, dir: REPO_DIR, ref, depth: 1 });
    const tip = log[0];
    if (!tip) return 0;
    // why: isomorphic-git timestamp is in seconds, app uses ms.
    return tip.commit.committer.timestamp * 1000;
  } catch {
    return 0;
  }
}

export function isDormant(activityMs: number, thresholdDays: number, nowMs: number): boolean {
  if (activityMs <= 0) return false;
  return nowMs - activityMs > thresholdDays * 86_400_000;
}
