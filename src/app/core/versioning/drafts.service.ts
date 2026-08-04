// 13d-i — DraftsService. Reads/writes `drafts/<entityId>.json` on the
// active variant's `draft` branch via git plumbing (no checkout). Mirror
// of CommentsService: same lock, same plumbing, same lazy-seed strategy.
// The draft branch is never present in the working tree; this service is
// the only writer/reader of it.

import { Injectable, inject } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsLockService } from '@core/fs/fs-lock.service';
import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { SearchIndexService } from '@core/search/search-index.service';
import type { SearchDoc } from '@core/search/search.types';
import { jsonContentToText } from '@core/tiptap/json-content-text';

import { listBranchDir, readBranchBlob, writeBranchBlob } from './branch-blob-ops';
import {
  DRAFTS_DIR,
  DRAFTS_FILE_SCHEMA_VERSION,
  draftsFilepath,
  emptyDraftsFile,
  type DiffMark,
  type DraftsFile,
} from './drafts.types';
import { GitFsAdapter } from './git-fs.adapter';
import { VariantsService } from './variants.service';
import { DEFAULT_GIT_AUTHOR } from './versioning.constants';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

@Injectable({ providedIn: 'root' })
export class DraftsService {
  private readonly workspace = inject(WorkspaceService);
  private readonly variants = inject(VariantsService);
  private readonly fsLock = inject(FsLockService);
  private readonly fs = inject(FsService);
  private readonly search = inject(SearchIndexService);

  // Entity ids that have a drafts file on the active family's draft
  // branch — used to prime the search index without knowing ids upfront.
  async listEntityIds(): Promise<readonly string[]> {
    const ref = this.requireActive().refs.draft;
    const fs = this.requireAdapter();
    const entries = await listBranchDir(fs, ref, DRAFTS_DIR);
    return entries.map((e) => e.path.slice(DRAFTS_DIR.length + 1, -'.json'.length));
  }

  async read(entityId: string): Promise<DraftsFile> {
    const ref = this.requireActive().refs.draft;
    const fs = this.requireAdapter();
    let bytes: Uint8Array | null;
    try {
      bytes = await readBranchBlob(fs, ref, draftsFilepath(entityId));
    } catch (cause) {
      throw this.io(cause, entityId, 'read');
    }
    if (!bytes) return emptyDraftsFile(entityId);
    return parseFile(entityId, bytes);
  }

  // Persists the marks list. Idempotent if `marks` matches what is
  // already on the branch (writeBranchBlob returns null and the ref is
  // unchanged). Commit prefix `auto [borrador]:` mirrors `auto [comentarios]:`
  // so /history can group these visually (the `draft` chip from 13c-iv
  // is already wired to this prefix).
  async save(entityId: string, entityTitle: string, marks: readonly DiffMark[]): Promise<void> {
    const active = this.requireActive();
    const ref = active.refs.draft;
    const fs = this.requireAdapter();
    const file: DraftsFile = {
      schemaVersion: DRAFTS_FILE_SCHEMA_VERSION,
      entityId,
      marks,
    };
    const content = TEXT_ENCODER.encode(JSON.stringify(file, null, 2));
    const message = formatCommitMessage(entityTitle || entityId, marks.length);
    await this.fsLock.withLock(async () => {
      try {
        await writeBranchBlob({
          fs,
          ref,
          filepath: draftsFilepath(entityId),
          content,
          message,
          author: DEFAULT_GIT_AUTHOR,
          seedFrom: active.refs.main,
        });
      } catch (cause) {
        throw this.io(cause, entityId, 'save');
      }
    });
    await this.search.replaceEntity(
      'draft',
      entityId,
      draftSearchDocs(entityId, entityTitle, marks),
    );
  }

  // Pure validation used by the panel (13d-iii) before persisting a new
  // `block` anchor. Throws VER-024 if the anchor does not exist in the
  // doc the user is currently looking at. No I/O.
  validateAnchor(
    mark: Pick<DiffMark, 'anchorType' | 'anchor'>,
    blockIdsInDoc: ReadonlySet<string>,
  ): void {
    if (mark.anchorType !== 'block') return;
    if (!blockIdsInDoc.has(mark.anchor)) {
      throw new AppError(ERROR_CODES.VER_024, {
        severity: 'warning',
        context: { anchor: mark.anchor },
        recoverable: true,
      });
    }
  }

  private requireActive() {
    const active = this.variants.getActive();
    if (!active) {
      throw new AppError(ERROR_CODES.VER_022, {
        severity: 'error',
        context: { reason: 'no-active-variant' },
        recoverable: true,
      });
    }
    return active;
  }

  private requireAdapter(): GitFsAdapter {
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_022, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    return new GitFsAdapter(root, this.fs);
  }

  private io(cause: unknown, entityId: string, op: 'read' | 'save'): AppError {
    if (cause instanceof AppError) return cause;
    return new AppError(ERROR_CODES.VER_022, {
      severity: 'error',
      cause,
      context: { entityId, op },
      recoverable: true,
    });
  }
}

export function draftSearchDocs(
  entityId: string,
  entityTitle: string,
  marks: readonly DiffMark[],
): readonly SearchDoc[] {
  return marks.map((m) => ({
    id: `draft:${entityId}:${m.id}`,
    kind: 'draft',
    title: entityTitle || entityId,
    body: jsonContentToText(m.after) || jsonContentToText(m.before),
    tagIds: [],
  }));
}

function formatCommitMessage(label: string, count: number): string {
  const suffix = count === 1 ? '1 cambio' : `${count} cambios`;
  return `auto [borrador]: ${label} (${suffix})`;
}

function parseFile(entityId: string, bytes: Uint8Array): DraftsFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(TEXT_DECODER.decode(bytes));
  } catch (cause) {
    throw new AppError(ERROR_CODES.VER_023, {
      severity: 'error',
      cause,
      context: { entityId, reason: 'invalid-json' },
      recoverable: true,
    });
  }
  if (!isDraftsFile(parsed)) {
    throw new AppError(ERROR_CODES.VER_023, {
      severity: 'error',
      context: { entityId, reason: 'invalid-shape' },
      recoverable: true,
    });
  }
  if (parsed.schemaVersion > DRAFTS_FILE_SCHEMA_VERSION) {
    throw new AppError(ERROR_CODES.VER_023, {
      severity: 'error',
      context: { entityId, reason: 'schema-too-new', version: parsed.schemaVersion },
      recoverable: true,
    });
  }
  return parsed;
}

function isDraftsFile(value: unknown): value is DraftsFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['schemaVersion'] === 'number' &&
    typeof v['entityId'] === 'string' &&
    Array.isArray(v['marks'])
  );
}
