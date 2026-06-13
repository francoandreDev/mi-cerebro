// 13e-iii — diff/apply between a local variant's main and a remote-
// tracking ref (`refs/remotes/origin/<branch>`). Mirrors MergeService's
// variant-to-variant flow but limited to `main` (no facetas) since the
// remote source has no notion of comments/draft refs from a foreign
// variant context — those still go through the local variant flow.

import * as git from 'isomorphic-git';

import { blobToText, isLikelyBinary } from '@features/history/services/diff.utils';

import type { GitFsAdapter } from './git-fs.adapter';
import { buildMergeCommit } from './merge-apply';
import type { MergeDiffEntry, MergeOutcome, MergeSelection, MergeStatus } from './merge.types';

const REPO_DIR = '/';
const PREVIEW_BYTES = 240;

export interface RemoteMergeContext {
  readonly fs: GitFsAdapter;
  readonly intoRef: string;
  readonly remoteRef: string;
  readonly author: { readonly name: string; readonly email: string };
}

export async function diffMainAgainstRemote(
  ctx: RemoteMergeContext,
): Promise<readonly MergeDiffEntry[]> {
  const { fs, intoRef, remoteRef } = ctx;
  const raw = await git.walk({
    fs,
    dir: REPO_DIR,
    trees: [git.TREE({ ref: remoteRef }), git.TREE({ ref: intoRef })],
    map: async (filepath, entries) => {
      if (filepath === '.') return;
      const [a, b] = entries;
      const aType = a ? await a.type() : null;
      const bType = b ? await b.type() : null;
      if (aType === 'tree' || bType === 'tree') return;
      const aOid = a ? await a.oid() : null;
      const bOid = b ? await b.oid() : null;
      if (aOid === bOid) return;
      return { filepath, aOid, bOid };
    },
  });
  const entries: MergeDiffEntry[] = [];
  for (const r of raw as readonly {
    filepath: string;
    aOid: string | null;
    bOid: string | null;
  }[]) {
    entries.push(await buildEntry(fs, r.filepath, r.aOid, r.bOid));
  }
  entries.sort((x, y) => x.filepath.localeCompare(y.filepath));
  return entries;
}

export async function applyFromRemoteMain(
  ctx: RemoteMergeContext,
  selections: readonly MergeSelection[],
  groupId: string,
): Promise<MergeOutcome> {
  const { fs, intoRef, remoteRef, author } = ctx;
  const fromTip = await git.resolveRef({ fs, dir: REPO_DIR, ref: remoteRef });
  const actionable = selections.filter((s) => s.choice === 'from');
  const applied: string[] = [];
  let i = 0;
  try {
    for (; i < actionable.length; i++) {
      const sel = actionable[i]!;
      const baseOid = await git.resolveRef({ fs, dir: REPO_DIR, ref: intoRef });
      const newOid = await buildMergeCommit({
        fs,
        baseCommitOid: baseOid,
        fromCommitOid: fromTip,
        filepath: sel.filepath,
        message: formatMessage(sel.filepath, remoteRef, intoRef, groupId),
        author,
      });
      if (!newOid) continue;
      await git.writeRef({
        fs,
        dir: REPO_DIR,
        ref: `refs/heads/${intoRef}`,
        value: newOid,
        force: true,
      });
      applied.push(sel.filepath);
    }
    return { groupId, applied, failedAt: null, remaining: [] };
  } catch (cause) {
    return {
      groupId,
      applied,
      failedAt: {
        path: actionable[i]?.filepath ?? '?',
        reason: (cause as Error).message ?? 'unknown',
      },
      remaining: actionable.slice(i + 1).map((s) => s.filepath),
    };
  }
}

async function buildEntry(
  fs: GitFsAdapter,
  filepath: string,
  fromOid: string | null,
  intoOid: string | null,
): Promise<MergeDiffEntry> {
  const status = computeStatus(fromOid, intoOid);
  const [previewFrom, previewInto] = await Promise.all([
    preview(fs, fromOid),
    preview(fs, intoOid),
  ]);
  return { filepath, status, previewFrom, previewInto };
}

async function preview(fs: GitFsAdapter, oid: string | null): Promise<string | null> {
  if (!oid) return null;
  try {
    const { blob } = await git.readBlob({ fs, dir: REPO_DIR, oid });
    if (isLikelyBinary(blob)) return null;
    const slice = blob.subarray(0, Math.min(blob.length, PREVIEW_BYTES));
    return blobToText(slice);
  } catch {
    return null;
  }
}

function computeStatus(fromOid: string | null, intoOid: string | null): MergeStatus {
  if (fromOid && !intoOid) return 'only-in-from';
  if (!fromOid && intoOid) return 'only-in-into';
  return 'modified';
}

function formatMessage(
  filepath: string,
  remoteRef: string,
  intoRef: string,
  groupId: string,
): string {
  const subject = `merge: ${filepath} (from remote ${remoteRef} into ${intoRef})`;
  return `${subject}\n\nMerge-Group: ${groupId}\nMerge-From: ${remoteRef}\nMerge-Into: ${intoRef}\nMerge-Choice: from\nMerge-Source: remote\n`;
}
