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

import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { GitFsAdapter } from '@core/versioning/git-fs.adapter';
import { OpfsGitRootService } from '@core/versioning/opfs-git-root';

import type {
  AnchorChange,
  AnchorMode,
  FieldChangeStatus,
  FieldDiff,
  TagsDelta,
} from './diff.utils';
import {
  asTagArray,
  blobToText,
  bodyDiffOf,
  computeUserFields,
  diffAnchoredItems,
  diffFlatJson,
  diffTagArrays,
  isEntityPath,
  isLikelyBinary,
  parseAnyJson,
  parseEntityJson,
  titleDiffOf,
} from './diff.utils';

// why: cede el hilo cada N sondas en findNoiseCommits. 32 es el sweet
//      spot entre "actualizar el timeline suficientemente seguido" y
//      "no saturar el event loop con setTimeout(0)".
const NOISE_SCAN_YIELD_EVERY = 32;

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
  | { readonly kind: 'json'; readonly fields: readonly FieldDiff[] }
  | {
      readonly kind: 'anchored';
      readonly mode: AnchorMode;
      readonly items: readonly AnchorChange[];
    }
  | {
      readonly kind: 'entity';
      readonly title: TitleDiff;
      readonly body: readonly DiffChunk[] | null;
      readonly tags: TagsDelta;
      readonly fields: readonly FieldDiff[];
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
  private readonly fs = inject(FsService);
  private readonly opfsGitRoot = inject(OpfsGitRootService);

  async loadForCommit(oid: string): Promise<readonly EntityDiff[]> {
    const adapter = await this.adapter();
    if (!adapter) return [];
    const parent = await this.parentOidOf(adapter, oid);
    const changes = await this.collectChanges(adapter, oid, parent);
    const out: EntityDiff[] = [];
    for (const change of changes) out.push(await this.buildDiff(adapter, change));
    return out.sort((a, b) => a.filepath.localeCompare(b.filepath));
  }

  // why: commits viejos donde el único diff es `lastActivityAt` (o `state`)
  //      en variants.json son ruido — el fix de la persistencia evita que
  //      sigan apareciendo, pero los que ya están en la historia siguen
  //      ahí. Esta sonda los marca para que el timeline los oculte.
  async findNoiseCommits(
    entries: readonly { readonly oid: string; readonly message: string }[],
    opts?: {
      readonly onBatch?: (found: ReadonlySet<string>) => void;
      readonly signal?: AbortSignal;
    },
  ): Promise<ReadonlySet<string>> {
    const adapter = await this.adapter();
    if (!adapter) return new Set();
    const noise = new Set<string>();
    let sinceYield = 0;
    let sinceReport = 0;
    for (const e of entries) {
      if (opts?.signal?.aborted) break;
      if (!isVariantsAutoCommit(e.message)) continue;
      try {
        const parent = await this.parentOidOf(adapter, e.oid);
        if (parent && (await this.isNoiseDelta(adapter, parent, e.oid))) {
          noise.add(e.oid);
          sinceReport += 1;
        }
      } catch {
        // sondas que fallan no se ocultan
      }
      // why: la scan puede tocar cientos de commits al abrir /history con
      //      un repo maduro; cediendo cada N entradas mantenemos la UI
      //      responsiva y damos oportunidad al onBatch de repintar el
      //      timeline con el ruido detectado hasta el momento.
      sinceYield += 1;
      if (sinceYield >= NOISE_SCAN_YIELD_EVERY) {
        sinceYield = 0;
        if (sinceReport > 0 && opts?.onBatch) {
          opts.onBatch(new Set(noise));
          sinceReport = 0;
        }
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    if (sinceReport > 0 && opts?.onBatch) opts.onBatch(new Set(noise));
    return noise;
  }

  private async isNoiseDelta(fs: GitFsAdapter, parent: string, oid: string): Promise<boolean> {
    const changes = await this.collectChanges(fs, oid, parent);
    if (changes.length !== 1) return false;
    const change = changes[0]!;
    if (change.filepath !== '.mi-cerebro/variants.json') return false;
    const before = await this.readBlob(fs, change.beforeOid);
    const after = await this.readBlob(fs, change.afterOid);
    const beforeJson = parseAnyJson(before);
    const afterJson = parseAnyJson(after);
    const fields = diffFlatJson(beforeJson, afterJson);
    if (fields.length === 0) return false;
    return fields.every((f) => /^variants\[\d+\]\.(lastActivityAt|state)$/.test(f.key));
  }

  private async adapter(): Promise<GitFsAdapter | null> {
    const root = this.workspace.root();
    if (!root) return null;
    const gitDirRoot = await this.opfsGitRoot.getGitDir();
    return new GitFsAdapter(root, this.fs, gitDirRoot);
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
      const view = buildEntityView(change.filepath, before, after);
      if (view) return { ...common, view };
    }
    if (change.filepath.endsWith('.json')) {
      const beforeJson = parseAnyJson(before);
      const afterJson = parseAnyJson(after);
      if (beforeJson !== undefined || afterJson !== undefined) {
        const anchored = anchoredModeFor(change.filepath);
        if (anchored) {
          const items = diffAnchoredItems(beforeJson, afterJson, anchored);
          return { ...common, view: { kind: 'anchored', mode: anchored, items } };
        }
        return { ...common, view: { kind: 'json', fields: diffFlatJson(beforeJson, afterJson) } };
      }
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

function anchoredModeFor(filepath: string): AnchorMode | null {
  if (filepath.startsWith('drafts/')) return 'drafts';
  if (filepath.startsWith('comments/')) return 'comments';
  return null;
}

function isVariantsAutoCommit(message: string): boolean {
  return /^auto(?:\s+\[[^\]]+\])?:\s.*\.mi-cerebro/.test(message);
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
  filepath: string,
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
    fields: computeUserFields(filepath, before, after),
  };
}
