// Shared tree-level git primitives. Extracted from merge-apply.ts so 13c
// (CommentsService) and 13d (DraftsService) can build commits on
// non-active branches without checkout, using the same building blocks.

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from './git-fs.adapter';

const REPO_DIR = '/';

// Returns the blob oid at `filepath` inside `commitOid`'s tree, or null
// if the file does not exist. Errors on read are swallowed and returned
// as null so callers can treat "not found" and "tree corrupted" uniformly
// at the top level — most callers wrap the call in their own try/catch
// to map to a domain error code.
export async function blobOidAt(
  fs: GitFsAdapter,
  commitOid: string,
  filepath: string,
): Promise<string | null> {
  try {
    const { commit } = await git.readCommit({ fs, dir: REPO_DIR, oid: commitOid });
    return walkTreePath(fs, commit.tree, splitPath(filepath));
  } catch {
    return null;
  }
}

export async function walkTreePath(
  fs: GitFsAdapter,
  treeOid: string,
  parts: readonly string[],
): Promise<string | null> {
  if (parts.length === 0) return null;
  const { tree } = await git.readTree({ fs, dir: REPO_DIR, oid: treeOid });
  const head = parts[0]!;
  const entry = tree.find((e) => e.path === head);
  if (!entry) return null;
  if (parts.length === 1) return entry.type === 'blob' ? entry.oid : null;
  if (entry.type !== 'tree') return null;
  return walkTreePath(fs, entry.oid, parts.slice(1));
}

// Rebuilds the tree rooted at `treeOid` so the path described by `parts`
// resolves to `newBlobOid` (or is removed when null). Returns the oid of
// the new root tree. Sibling entries are preserved untouched. Intermediate
// directories are created as needed.
export async function rebuildTreeAt(
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
    const subTreeOid = await resolveSubtree(fs, existing, rest, newBlobOid);
    if (subTreeOid) {
      filtered.push({ mode: '040000', path: head, oid: subTreeOid, type: 'tree' });
    }
  }
  filtered.sort((a, b) => a.path.localeCompare(b.path));
  return git.writeTree({ fs, dir: REPO_DIR, tree: filtered });
}

async function resolveSubtree(
  fs: GitFsAdapter,
  existing: Awaited<ReturnType<typeof git.readTree>>['tree'][number] | undefined,
  rest: readonly string[],
  newBlobOid: string | null,
): Promise<string | null> {
  if (existing && existing.type === 'tree') {
    return rebuildTreeAt(fs, existing.oid, rest, newBlobOid);
  }
  if (newBlobOid) return createTreePath(fs, rest, newBlobOid);
  return null;
}

export async function createTreePath(
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

export function splitPath(filepath: string): string[] {
  return filepath.split('/').filter((p) => p.length > 0);
}

export interface TreeBlobEntry {
  readonly path: string;
  readonly oid: string;
}

// Lists the blobs directly inside `dirPath` (non-recursive) at `commitOid`.
// Returns an empty array if the directory does not exist or is empty —
// same "missing means empty" contract as blobOidAt. Used to enumerate
// per-entity files (`comments/<id>.json`, `drafts/<id>.json`) without
// callers needing to know the ids up front.
export async function listDirAt(
  fs: GitFsAdapter,
  commitOid: string,
  dirPath: string,
): Promise<readonly TreeBlobEntry[]> {
  try {
    const { commit } = await git.readCommit({ fs, dir: REPO_DIR, oid: commitOid });
    const dirTreeOid = await resolveDirTree(fs, commit.tree, splitPath(dirPath));
    if (!dirTreeOid) return [];
    const { tree } = await git.readTree({ fs, dir: REPO_DIR, oid: dirTreeOid });
    return tree
      .filter((e) => e.type === 'blob')
      .map((e) => ({ path: `${dirPath}/${e.path}`, oid: e.oid }));
  } catch {
    return [];
  }
}

async function resolveDirTree(
  fs: GitFsAdapter,
  treeOid: string,
  parts: readonly string[],
): Promise<string | null> {
  if (parts.length === 0) return treeOid;
  const { tree } = await git.readTree({ fs, dir: REPO_DIR, oid: treeOid });
  const entry = tree.find((e) => e.path === parts[0]);
  if (!entry || entry.type !== 'tree') return null;
  return resolveDirTree(fs, entry.oid, parts.slice(1));
}
