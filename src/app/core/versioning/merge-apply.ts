// 13b-iv #3 — tree-level commit construction used by MergeService.apply.
// All helpers here build a new commit on top of `baseCommitOid` that
// either replaces or deletes a single blob at `filepath`, without ever
// touching the working tree. The destination ref is updated by the
// caller via git.writeRef so partial-fail rollback stays the caller's
// responsibility.

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from './git-fs.adapter';
import { blobOidAt, rebuildTreeAt, splitPath } from './tree-ops';

const REPO_DIR = '/';

export interface ApplyOneInput {
  readonly fs: GitFsAdapter;
  readonly baseCommitOid: string;
  readonly fromCommitOid: string;
  readonly filepath: string;
  readonly message: string;
  readonly author: { readonly name: string; readonly email: string };
}

// Reads the blob the caller wants from `fromCommitOid` at `filepath`,
// produces a new tree on top of `baseCommitOid` with that blob (or with
// the path deleted, when the source side doesn't have the file), and
// writes a commit. Returns the new commit oid, or null if the tree is
// already identical (no-op — caller can skip the ref update).
export async function buildMergeCommit(input: ApplyOneInput): Promise<string | null> {
  const { fs, baseCommitOid, fromCommitOid, filepath, message, author } = input;
  const sourceOid = await blobOidAt(fs, fromCommitOid, filepath);
  const { commit: baseCommit } = await git.readCommit({ fs, dir: REPO_DIR, oid: baseCommitOid });
  const existingOid = await blobOidAt(fs, baseCommitOid, filepath);
  if (existingOid === sourceOid) return null;
  const newRootTree = await rebuildTreeAt(fs, baseCommit.tree, splitPath(filepath), sourceOid);
  if (newRootTree === baseCommit.tree) return null;
  const now = Math.floor(Date.now() / 1000);
  return git.writeCommit({
    fs,
    dir: REPO_DIR,
    commit: {
      message,
      tree: newRootTree,
      parent: [baseCommitOid],
      author: { ...author, timestamp: now, timezoneOffset: 0 },
      committer: { ...author, timestamp: now, timezoneOffset: 0 },
    },
  });
}
