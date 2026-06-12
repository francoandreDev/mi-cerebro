// Read/write a single blob on a named branch without checking it out.
// Used by 13c (CommentsService) and 13d (DraftsService) to keep their
// data on `variant/<family>/comments` and `variant/<family>/draft`
// branches while the working tree stays on `main` of the active variant.

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from './git-fs.adapter';
import { blobOidAt, rebuildTreeAt, splitPath } from './tree-ops';
import { stripHeadsPrefix } from './variants.io';

const REPO_DIR = '/';

// why: marker class so callers (CommentsService → VER_019,
//      DraftsService → VER_022) can distinguish "the family's branch ref
//      is missing" — a structural error — from generic plumbing failures
//      they map to the same code. Subclassing Error keeps the throw out
//      of `no-restricted-syntax`, which only forbids `new Error(...)`
//      directly.
export class MissingBranchRefError extends Error {
  override name = 'MissingBranchRefError';
  constructor(public readonly ref: string) {
    super(`branch ref not found: ${ref}`);
  }
}

export interface BranchAuthor {
  readonly name: string;
  readonly email: string;
}

export interface WriteBranchBlobInput {
  readonly fs: GitFsAdapter;
  readonly ref: string;
  readonly filepath: string;
  readonly content: Uint8Array;
  readonly message: string;
  readonly author: BranchAuthor;
  // why: principal's comments/draft branches are never seeded at workspace
  //      init (forkFamilyAtomic only creates them for new forks). When the
  //      first write lands on `variant/principal/comments`, lazy-create
  //      the branch from this seed ref instead of throwing VER_019.
  readonly seedFrom?: string;
}

// Returns the blob bytes at `filepath` on `ref`'s HEAD, or null if the
// ref does not exist or the file is not present in its current tree.
// Distinguishing "ref missing" from "file missing" is rarely useful at
// the call site — both mean "no comments/drafts yet". Genuine I/O errors
// (tree corrupted, fs revoked, etc.) bubble up.
export async function readBranchBlob(
  fs: GitFsAdapter,
  ref: string,
  filepath: string,
): Promise<Uint8Array | null> {
  const headOid = await resolveOrNull(fs, ref);
  if (!headOid) return null;
  const blobOid = await blobOidAt(fs, headOid, filepath);
  if (!blobOid) return null;
  const { blob } = await git.readBlob({ fs, dir: REPO_DIR, oid: blobOid });
  return blob;
}

// Writes `content` at `filepath` on top of `ref` as a new commit and
// fast-forwards the ref. Returns the new commit oid, or null if the tree
// would be unchanged (idempotent: callers can safely call save() with the
// same content twice). The destination ref is force-updated; callers
// holding `FsLockService` guarantee no other writer races on it.
export async function writeBranchBlob(input: WriteBranchBlobInput): Promise<string | null> {
  const { fs, ref, filepath, content, message, author, seedFrom } = input;
  let headOid = await resolveOrNull(fs, ref);
  if (!headOid && seedFrom) {
    const seedOid = await resolveOrNull(fs, seedFrom);
    if (seedOid) {
      await git.writeRef({
        fs,
        dir: REPO_DIR,
        ref: `refs/heads/${stripHeadsPrefix(ref)}`,
        value: seedOid,
        force: false,
      });
      headOid = seedOid;
    }
  }
  if (!headOid) throw new MissingBranchRefError(ref);
  const newBlobOid = await git.writeBlob({ fs, dir: REPO_DIR, blob: content });
  const existingOid = await blobOidAt(fs, headOid, filepath);
  if (existingOid === newBlobOid) return null;
  const { commit: baseCommit } = await git.readCommit({ fs, dir: REPO_DIR, oid: headOid });
  const newRootTree = await rebuildTreeAt(fs, baseCommit.tree, splitPath(filepath), newBlobOid);
  if (newRootTree === baseCommit.tree) return null;
  const now = Math.floor(Date.now() / 1000);
  const commitOid = await git.writeCommit({
    fs,
    dir: REPO_DIR,
    commit: {
      message,
      tree: newRootTree,
      parent: [headOid],
      author: { ...author, timestamp: now, timezoneOffset: 0 },
      committer: { ...author, timestamp: now, timezoneOffset: 0 },
    },
  });
  await git.writeRef({
    fs,
    dir: REPO_DIR,
    ref: `refs/heads/${stripHeadsPrefix(ref)}`,
    value: commitOid,
    force: true,
  });
  return commitOid;
}

async function resolveOrNull(fs: GitFsAdapter, ref: string): Promise<string | null> {
  try {
    return await git.resolveRef({ fs, dir: REPO_DIR, ref: stripHeadsPrefix(ref) });
  } catch {
    return null;
  }
}
