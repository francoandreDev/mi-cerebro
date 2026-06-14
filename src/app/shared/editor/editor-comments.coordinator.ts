// 13f — Coordinates the comments side of the editor: holds the active
// comment list (mirrored from the rama via CommentsService), the popover
// state (which comment is open / a new one being authored), and the
// persistence flow on save/remove. The editor component owns the UI and
// position math; this controller owns the data.

import { signal } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import type { CommentsService } from '@core/versioning/comments.service';
import type { Comment } from '@core/versioning/comments.types';

import type { PopoverPosition } from './comment-popover.component';

export interface EditorCommentsContext {
  readonly comments: CommentsService;
  readonly entityId: () => string;
  readonly entityTitle: () => string;
  readonly pushClouds: (list: readonly Comment[]) => void;
}

export interface PopoverState {
  readonly mode: 'new' | 'edit';
  readonly commentId: string | null;
  readonly blockId: string | null;
  readonly body: string;
  readonly position: PopoverPosition;
  readonly error: string;
  readonly busy: boolean;
  readonly editing: boolean;
}

export class EditorCommentsCoordinator {
  readonly list = signal<readonly Comment[]>([]);
  readonly popover = signal<PopoverState | null>(null);
  private lastLoadedFor = '';

  constructor(private readonly ctx: EditorCommentsContext) {}

  async loadFor(entityId: string): Promise<void> {
    if (!entityId) {
      this.list.set([]);
      this.lastLoadedFor = '';
      return;
    }
    if (this.lastLoadedFor === entityId) return;
    this.lastLoadedFor = entityId;
    const file = await this.ctx.comments.read(entityId);
    if (this.ctx.entityId() === entityId) {
      this.list.set(file.comments);
      this.ctx.pushClouds(file.comments);
    }
  }

  openNew(blockId: string | null, position: PopoverPosition): void {
    this.popover.set({
      mode: 'new',
      commentId: null,
      blockId,
      body: '',
      position,
      error: '',
      busy: false,
      editing: false,
    });
  }

  openExisting(commentId: string, position: PopoverPosition): void {
    const comment = this.list().find((c) => c.id === commentId);
    if (!comment) return;
    this.popover.set({
      mode: 'edit',
      commentId,
      blockId: comment.anchorType === 'block' ? comment.anchor : null,
      body: extractText(comment.body),
      position,
      error: '',
      busy: false,
      editing: true,
    });
  }

  setBody(body: string): void {
    const current = this.popover();
    if (!current) return;
    this.popover.set({ ...current, body, error: '' });
  }

  dismiss(): void {
    this.popover.set(null);
  }

  async save(): Promise<void> {
    const current = this.popover();
    if (!current) return;
    const body = current.body.trim();
    if (body.length === 0) {
      this.popover.set({ ...current, error: 'El comentario no puede estar vacío.' });
      return;
    }
    this.popover.set({ ...current, busy: true, error: '' });
    const id = this.ctx.entityId();
    try {
      const next =
        current.mode === 'new'
          ? this.appendNew(current, body, id)
          : this.updateExisting(current, body);
      await this.ctx.comments.save(id, this.ctx.entityTitle(), next);
      this.list.set(next);
      this.ctx.pushClouds(next);
      this.popover.set(null);
    } catch (err) {
      const last = this.popover();
      if (last) {
        this.popover.set({ ...last, busy: false, error: 'No se pudo guardar.' });
      }
      throw err;
    }
  }

  async remove(): Promise<void> {
    const current = this.popover();
    if (!current || current.mode !== 'edit' || !current.commentId) return;
    this.popover.set({ ...current, busy: true });
    const id = this.ctx.entityId();
    try {
      const next = this.list().filter((c) => c.id !== current.commentId);
      await this.ctx.comments.save(id, this.ctx.entityTitle(), next);
      this.list.set(next);
      this.ctx.pushClouds(next);
      this.popover.set(null);
    } catch (err) {
      const last = this.popover();
      if (last) this.popover.set({ ...last, busy: false, error: 'No se pudo borrar.' });
      throw err;
    }
  }

  private appendNew(state: PopoverState, body: string, entityId: string): readonly Comment[] {
    const now = new Date().toISOString();
    const next: Comment = {
      id: crypto.randomUUID(),
      anchorType: state.blockId ? 'block' : 'entity',
      anchor: state.blockId ?? entityId,
      body: textToDoc(body),
      createdAt: now,
      updatedAt: now,
      orphaned: false,
    };
    return [...this.list(), next];
  }

  private updateExisting(state: PopoverState, body: string): readonly Comment[] {
    const now = new Date().toISOString();
    return this.list().map((c) =>
      c.id === state.commentId ? { ...c, body: textToDoc(body), updatedAt: now } : c,
    );
  }
}

const textToDoc = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const extractText = (doc: JSONContent): string => {
  if (!doc.content) return '';
  return doc.content
    .map((node) => {
      if (node.text) return node.text;
      if (node.content) return extractText({ type: 'doc', content: node.content });
      return '';
    })
    .join('\n');
};
