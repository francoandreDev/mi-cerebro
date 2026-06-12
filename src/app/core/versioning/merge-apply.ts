// 13b-iv #3 — tree-level commit construction used by MergeService.apply.
// All helpers here build a new commit on top of `baseCommitOid` that
// either replaces or deletes a single blob at `filepath`, without ever
// touching the working tree. The destination ref is updated by the
// caller via git.writeRef so partial-fail rollback stays the caller's
// responsibility.

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from './git-fs.adapter';

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
  const parts = filepath.split('/').filter((p) => p.length > 0);
  const newRootTree = await rebuildTree(fs, baseCommit.tree, parts, sourceOid);
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

async function blobOidAt(
  fs: GitFsAdapter,
  commitOid: string,
  filepath: string,
): Promise<string | null> {
  try {
    const { commit } = await git.readCommit({ fs, dir: REPO_DIR, oid: commitOid });
    return walkPath(
      fs,
      commit.tree,
      filepath.split('/').filter((p) => p.length > 0),
    );
  } catch {
    return null;
  }
}

async function walkPath(
  fs: GitFsAdapter,
  treeOid: string,
  parts: readonly string[],
): Promise<string | null> {
  if (parts.length === 0) return null;
  const { tree } = await git.readTree({ fs, dir: REPO_DIR, oid: treeOid });
  const head = parts[0]!;
  const rest = parts.slice(1);
  const entry = tree.find((e) => e.path === head);
  if (!entry) return null;
  if (rest.length === 0) return entry.type === 'blob' ? entry.oid : null;
  if (entry.type !== 'tree') return null;
  return walkPath(fs, entry.oid, rest);
}

async function rebuildTree(
  fs: GitFsAdapter,
  treeOid: string,
  parts: readonly string[],
  newBlobOid: string | null,
): Promise<string> {
  const { tree } = await git.readTree({ fs, dir: REPO_DIR, oid: treeOid });
  const head = parts[0]!;
  const rest = parts.slice(1);
  const filtered = tree.filter((e) => e.path !== head);
  if (rest.length === 0) {
    if (newBlobOid) {
      filtered.push({ mode: '100644', path: head, oid: newBlobOid, type: 'blob' });
    }
  } else {
    const existing = tree.find((e) => e.path === head);
    const subTreeOid =
      existing && existing.type === 'tree'
        ? await rebuildTree(fs, existing.oid, rest, newBlobOid)
        : newBlobOid
          ? await createTreePath(fs, rest, newBlobOid)
          : null;
    if (subTreeOid) {
      filtered.push({ mode: '040000', path: head, oid: subTreeOid, type: 'tree' });
    }
  }
  filtered.sort((a, b) => a.path.localeCompare(b.path));
  return git.writeTree({ fs, dir: REPO_DIR, tree: filtered });
}

async function createTreePath(
  fs: GitFsAdapter,
  parts: readonly string[],
  blobOid: string,
): Promise<string> {
  const head = parts[0]!;
  const rest = parts.slice(1);
  if (rest.length === 0) {
    return git.writeTree({
      fs,
      dir: REPO_DIR,
      tree: [{ mode: '100644', path: head, oid: blobOid, type: 'blob' }],
    });
  }
  const subTreeOid = await createTreePath(fs, rest, blobOid);
  return git.writeTree({
    fs,
    dir: REPO_DIR,
    tree: [{ mode: '040000', path: head, oid: subTreeOid, type: 'tree' }],
  });
}
