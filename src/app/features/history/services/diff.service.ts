// Computes per-entity diffs between a commit and its parent. Walks
// the two trees, classifies changed paths, then builds a structured
// view per file:
//   - entity JSON: title + body (TipTap prose) + tags chips + user
//     fields table + system fields collapsed.
//   - other text: plain unified line diff.
//   - binary: just before/after sizes.

import { Injectable, inject } from '@angular/core';
import { diffLines } from 'diff';
import * as git from 'isomorphic-git';

import { WorkspaceService } from '@core/fs/workspace.service';
import { GitFsAdapter } from '@core/versioning/git-fs.adapter';

import type { FieldCategories, FieldChangeStatus, TagsDelta } from './diff.utils';
import {
  asTagArray,
  blobToText,
  bodyDiffOf,
  categorizeFields,
  diffTagArrays,
  isEntityPath,
  isLikelyBinary,
  parseEntityJson,
  titleDiffOf,
} from './diff.utils';

export type DiffStatus = 'added' | 'modified' | 'deleted';

export interface DiffChunk {
  readonly kind: 'context' | 'add' | 'remove';
  readonly value: string;
}

export interface TitleDiff {
  readonly status: FieldChangeStatus;
  readonly before: string | null;
  readonly after: string | null;
}

export type EntityDiffView =
  | { readonly kind: 'binary'; readonly beforeSize: number; readonly afterSize: number }
  | { readonly kind: 'text'; readonly chunks: readonly DiffChunk[] }
  | {
      readonly kind: 'entity';
      readonly title: TitleDiff;
      readonly body: readonly DiffChunk[] | null;
      readonly tags: TagsDelta;
      readonly fields: FieldCategories;
    };

export interface EntityDiff {
  readonly filepath: string;
  readonly status: DiffStatus;
  readonly view: EntityDiffView;
  readonly beforeSize: number;
  readonly afterSize: number;
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
    const before = await this.readBlob(fs, change.beforeOid);
    const after = await this.readBlob(fs, change.afterOid);
    const baseSize = before?.byteLength ?? 0;
    const newSize = after?.byteLength ?? 0;
    const common = {
      filepath: change.filepath,
      status: change.status,
      beforeSize: baseSize,
      afterSize: newSize,
    };
    if (isLikelyBinary(before) || isLikelyBinary(after)) {
      return { ...common, view: { kind: 'binary', beforeSize: baseSize, afterSize: newSize } };
    }
    if (isEntityPath(change.filepath)) {
      const view = buildEntityView(before, after);
      if (view) return { ...common, view };
    }
    return {
      ...common,
      view: { kind: 'text', chunks: toChunks(textOrEmpty(before), textOrEmpty(after)) },
    };
  }

  private async readBlob(fs: GitFsAdapter, oid: string | null): Promise<Uint8Array | null> {
    if (!oid) return null;
    return (await git.readBlob({ fs, dir: '/', oid })).blob;
  }
}

interface RawChange {
  readonly filepath: string;
  readonly status: DiffStatus;
  readonly beforeOid: string | null;
  readonly afterOid: string | null;
}

function textOrEmpty(blob: Uint8Array | null): string {
  return blob ? blobToText(blob) : '';
}

function toChunks(before: string, after: string): readonly DiffChunk[] {
  return diffLines(before, after).map((p) => ({
    kind: p.added ? 'add' : p.removed ? 'remove' : 'context',
    value: p.value,
  }));
}

function buildEntityView(
  beforeBlob: Uint8Array | null,
  afterBlob: Uint8Array | null,
): EntityDiffView | null {
  const before = parseEntityJson(beforeBlob);
  const after = parseEntityJson(afterBlob);
  if (!before && !after) return null;
  return {
    kind: 'entity',
    title: titleDiffOf(before?.['title'], after?.['title']),
    body: bodyDiffOf(before?.['body'], after?.['body'], toChunks),
    tags: diffTagArrays(asTagArray(before?.['tags']), asTagArray(after?.['tags'])),
    fields: categorizeFields(before, after),
  };
}
