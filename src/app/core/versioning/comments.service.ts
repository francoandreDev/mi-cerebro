// 13c-ii — CommentsService. Reads/writes `comments/<entityId>.json` on
// the active variant's `comments` branch via git plumbing (no checkout).
// The comments branch is never present in the working tree; this service
// is the only writer/reader of it.

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
  COMMENTS_DIR,
  COMMENTS_FILE_SCHEMA_VERSION,
  commentsFilepath,
  emptyCommentsFile,
  type Comment,
  type CommentsFile,
} from './comments.types';
import { GitFsAdapter } from './git-fs.adapter';
import { OpfsGitRootService } from './opfs-git-root';
import { VariantsService } from './variants.service';
import { DEFAULT_GIT_AUTHOR } from './versioning.constants';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly workspace = inject(WorkspaceService);
  private readonly variants = inject(VariantsService);
  private readonly fsLock = inject(FsLockService);
  private readonly fs = inject(FsService);
  private readonly opfsGitRoot = inject(OpfsGitRootService);
  private readonly search = inject(SearchIndexService);

  // Entity ids that have a comments file on the active family's comments
  // branch — used to prime the search index without knowing ids upfront.
  async listEntityIds(): Promise<readonly string[]> {
    const ref = this.activeCommentsRef();
    const fs = await this.requireAdapter();
    const entries = await listBranchDir(fs, ref, COMMENTS_DIR);
    return entries.map((e) => e.path.slice(COMMENTS_DIR.length + 1, -'.json'.length));
  }

  // Returns the parsed file or an empty placeholder if no comments have
  // ever been written for this entity on the active family.
  async read(entityId: string): Promise<CommentsFile> {
    const ref = this.activeCommentsRef();
    const fs = await this.requireAdapter();
    let bytes: Uint8Array | null;
    try {
      bytes = await readBranchBlob(fs, ref, commentsFilepath(entityId));
    } catch (cause) {
      throw this.io(cause, entityId, 'read');
    }
    if (!bytes) return emptyCommentsFile(entityId);
    return parseFile(entityId, bytes);
  }

  // Persists the comments list. Idempotent if `comments` matches what is
  // already on the branch (writeBranchBlob returns null and the ref is
  // unchanged). The commit message follows the `auto [comentarios]:` prefix
  // documented in PROYECTO §12 so /history can group these visually.
  async save(entityId: string, entityTitle: string, comments: readonly Comment[]): Promise<void> {
    const active = this.requireActive();
    const ref = active.refs.comments;
    const fs = await this.requireAdapter();
    const file: CommentsFile = {
      schemaVersion: COMMENTS_FILE_SCHEMA_VERSION,
      entityId,
      comments,
    };
    const content = TEXT_ENCODER.encode(JSON.stringify(file, null, 2));
    const message = formatCommitMessage(entityTitle || entityId, comments.length);
    await this.fsLock.withLock(async () => {
      try {
        await writeBranchBlob({
          fs,
          ref,
          filepath: commentsFilepath(entityId),
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
      'comment',
      entityId,
      commentSearchDocs(entityId, entityTitle, comments),
    );
  }

  // Pure validation used by the panel (13c-iii) before persisting a new
  // `block` or `range` (19.16e-iii) anchor. Throws VER-021 if the anchor
  // does not exist in the doc the user is currently looking at. No I/O.
  validateAnchor(
    comment: Pick<Comment, 'anchorType' | 'anchor' | 'span'>,
    blockIdsInDoc: ReadonlySet<string>,
  ): void {
    if (comment.anchorType === 'entity') return;
    const valid =
      comment.anchorType === 'block'
        ? blockIdsInDoc.has(comment.anchor)
        : comment.span !== undefined &&
          blockIdsInDoc.has(comment.span.startBlockId) &&
          blockIdsInDoc.has(comment.span.endBlockId);
    if (!valid) {
      throw new AppError(ERROR_CODES.VER_021, {
        severity: 'warning',
        context: { anchor: comment.anchor },
        recoverable: true,
      });
    }
  }

  private activeCommentsRef(): string {
    return this.requireActive().refs.comments;
  }

  private requireActive() {
    const active = this.variants.getActive();
    if (!active) {
      throw new AppError(ERROR_CODES.VER_019, {
        severity: 'error',
        context: { reason: 'no-active-variant' },
        recoverable: true,
      });
    }
    return active;
  }

  private async requireAdapter(): Promise<GitFsAdapter> {
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.VER_019, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    const gitDirRoot = await this.opfsGitRoot.getGitDir();
    return new GitFsAdapter(root, this.fs, gitDirRoot);
  }

  private io(cause: unknown, entityId: string, op: 'read' | 'save'): AppError {
    if (cause instanceof AppError) return cause;
    return new AppError(ERROR_CODES.VER_019, {
      severity: 'error',
      cause,
      context: { entityId, op },
      recoverable: true,
    });
  }
}

export function commentSearchDocs(
  entityId: string,
  entityTitle: string,
  comments: readonly Comment[],
): readonly SearchDoc[] {
  return comments.map((c) => ({
    id: `comment:${entityId}:${c.id}`,
    kind: 'comment',
    title: entityTitle || entityId,
    body: jsonContentToText(c.body),
    tagIds: [],
  }));
}

function formatCommitMessage(label: string, count: number): string {
  const suffix = count === 1 ? '1 comentario' : `${count} comentarios`;
  return `auto [comentarios]: ${label} (${suffix})`;
}

function parseFile(entityId: string, bytes: Uint8Array): CommentsFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(TEXT_DECODER.decode(bytes));
  } catch (cause) {
    throw new AppError(ERROR_CODES.VER_020, {
      severity: 'error',
      cause,
      context: { entityId, reason: 'invalid-json' },
      recoverable: true,
    });
  }
  if (!isCommentsFile(parsed)) {
    throw new AppError(ERROR_CODES.VER_020, {
      severity: 'error',
      context: { entityId, reason: 'invalid-shape' },
      recoverable: true,
    });
  }
  if (parsed.schemaVersion > COMMENTS_FILE_SCHEMA_VERSION) {
    throw new AppError(ERROR_CODES.VER_020, {
      severity: 'error',
      context: { entityId, reason: 'schema-too-new', version: parsed.schemaVersion },
      recoverable: true,
    });
  }
  return parsed;
}

function isCommentsFile(value: unknown): value is CommentsFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['schemaVersion'] === 'number' &&
    typeof v['entityId'] === 'string' &&
    Array.isArray(v['comments'])
  );
}
