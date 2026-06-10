// Computes per-entity diffs between a commit and its parent. For each
// changed path, fetches the blob on both sides, normalizes TipTap docs
// to plain text, and runs jsdiff line-by-line. Binary entries (images,
// audio) skip text rendering and just show before/after sizes.

import { Injectable, inject } from '@angular/core';
import { diffLines } from 'diff';
import * as git from 'isomorphic-git';

import { WorkspaceService } from '@core/fs/workspace.service';
import { GitFsAdapter } from '@core/versioning/git-fs.adapter';

import { blobToText, isLikelyBinary, rewriteJsonForDiff } from './diff.utils';

export type DiffStatus = 'added' | 'modified' | 'deleted';

export interface DiffChunk {
  readonly kind: 'context' | 'add' | 'remove';
  readonly value: string;
}

export interface EntityDiff {
  readonly filepath: string;
  readonly status: DiffStatus;
  readonly isBinary: boolean;
  readonly beforeSize: number;
  readonly afterSize: number;
  readonly chunks: readonly DiffChunk[];
}

@Injectable()
export class HistoryDiffService {
  private readonly workspace = inject(WorkspaceService);

  async loadForCommit(oid: string): Promise<readonly EntityDiff[]> {
    const adapter = this.adapter();
    if (!adapter) return [];
    const parent = await this.parentOidOf(adapter, oid);
    const changes = await this.collectChanges(adapter, oid, parent);
    const out: EntityDiff[] = [];
    for (const change of changes) out.push(await this.buildDiff(adapter, change));
    return out.sort((a, b) => a.filepath.localeCompare(b.filepath));
  }

  private adapter(): GitFsAdapter | null {
    const root = this.workspace.root();
    return root ? new GitFsAdapter(root) : null;
  }

  private async parentOidOf(fs: GitFsAdapter, oid: string): Promise<string | null> {
    const commit = await git.readCommit({ fs, dir: '/', oid });
    return commit.commit.parent[0] ?? null;
  }

  private async collectChanges(
    fs: GitFsAdapter,
    oid: string,
    parent: string | null,
  ): Promise<readonly RawChange[]> {
    const trees = parent
      ? [git.TREE({ ref: parent }), git.TREE({ ref: oid })]
      : [git.TREE({ ref: oid })];
    const result = await git.walk({
      fs,
      dir: '/',
      trees,
      map: async (filepath, entries) => {
        if (filepath === '.') return;
        if (parent) {
          const [a, b] = entries;
          const aType = a ? await a.type() : null;
          const bType = b ? await b.type() : null;
          if (aType === 'tree' || bType === 'tree') return;
          const aOid = a ? await a.oid() : null;
          const bOid = b ? await b.oid() : null;
          if (aOid === bOid) return;
          let status: DiffStatus = 'modified';
          if (!aOid) status = 'added';
          else if (!bOid) status = 'deleted';
          return { filepath, status, beforeOid: aOid, afterOid: bOid };
        }
        const [b] = entries;
        if (!b) return;
        if ((await b.type()) === 'tree') return;
        return { filepath, status: 'added', beforeOid: null, afterOid: await b.oid() };
      },
    });
    return result as readonly RawChange[];
  }

  private async buildDiff(fs: GitFsAdapter, change: RawChange): Promise<EntityDiff> {
    const before = change.beforeOid
      ? (await git.readBlob({ fs, dir: '/', oid: change.beforeOid })).blob
      : null;
    const after = change.afterOid
      ? (await git.readBlob({ fs, dir: '/', oid: change.afterOid })).blob
      : null;
    const isBinary = isLikelyBinary(before) || isLikelyBinary(after);
    if (isBinary) {
      return {
        filepath: change.filepath,
        status: change.status,
        isBinary: true,
        beforeSize: before?.byteLength ?? 0,
        afterSize: after?.byteLength ?? 0,
        chunks: [],
      };
    }
    const beforeText = renderText(before);
    const afterText = renderText(after);
    return {
      filepath: change.filepath,
      status: change.status,
      isBinary: false,
      beforeSize: before?.byteLength ?? 0,
      afterSize: after?.byteLength ?? 0,
      chunks: toChunks(beforeText, afterText),
    };
  }
}

interface RawChange {
  readonly filepath: string;
  readonly status: DiffStatus;
  readonly beforeOid: string | null;
  readonly afterOid: string | null;
}

function renderText(blob: Uint8Array | null): string {
  const text = blobToText(blob);
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as unknown;
    const rewritten = rewriteJsonForDiff(parsed);
    return JSON.stringify(rewritten, null, 2);
  } catch {
    return text;
  }
}

function toChunks(before: string, after: string): readonly DiffChunk[] {
  const parts = diffLines(before, after);
  return parts.map((p) => ({
    kind: p.added ? 'add' : p.removed ? 'remove' : 'context',
    value: p.value,
  }));
}
