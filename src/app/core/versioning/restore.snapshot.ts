// Helpers for "restore the full workspace to commit X": computes the
// list of writes and deletes by walking HEAD's tree against the target
// commit's tree. A path that exists in target → write that blob. A
// path that exists only in HEAD → delete from disk.

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from './git-fs.adapter';

export interface SnapshotChange {
  readonly filepath: string;
  readonly targetOid: string | null;
}

export async function collectSnapshotChanges(
  fs: GitFsAdapter,
  headOid: string,
  targetOid: string,
): Promise<readonly SnapshotChange[]> {
  const result = await git.walk({
    fs,
    dir: '/',
    trees: [git.TREE({ ref: headOid }), git.TREE({ ref: targetOid })],
    map: async (filepath, entries) => {
      if (filepath === '.') return;
      const [head, target] = entries;
      const headType = head ? await head.type() : null;
      const targetType = target ? await target.type() : null;
      if (headType === 'tree' || targetType === 'tree') return;
      const headOid2 = head ? await head.oid() : null;
      const targetOid2 = target ? await target.oid() : null;
      if (headOid2 === targetOid2) return;
      return { filepath, targetOid: targetOid2 };
    },
  });
  return result as readonly SnapshotChange[];
}
