// 13d-iii — Draft-mode authoring extracted from EditorComponent to keep
// the component below the file-size soft cap. Owns the per-session toggle
// state, the base/buffer snapshots, and the save-to-drafts flow that
// turns the buffer delta into a DiffMark list via buildBlockDiffMarks.
//
// The controller is intentionally framework-light: it takes the bits of
// editor state it needs as functions, so the component remains the
// integration point but the bookkeeping doesn't live there.

import { signal } from '@angular/core';
import type { Editor, JSONContent } from '@tiptap/core';

import { buildBlockDiffMarks } from '@core/versioning/draft-capture';
import type { DraftsService } from '@core/versioning/drafts.service';

export interface EditorDraftModeContext {
  readonly drafts: DraftsService;
  readonly editor: () => Editor | null;
  readonly currentValue: () => JSONContent;
  readonly entityId: () => string;
  readonly entityTitle: () => string;
  readonly restoreView: (doc: JSONContent) => void;
  readonly onSaved: (count: number) => void;
}

export class EditorDraftModeController {
  readonly active = signal(false);
  readonly saving = signal(false);
  private base: JSONContent | null = null;
  private buffer: JSONContent | null = null;

  constructor(private readonly ctx: EditorDraftModeContext) {}

  isActive(): boolean {
    return this.active();
  }

  captureUpdate(json: JSONContent): boolean {
    if (!this.active()) return false;
    this.buffer = json;
    return true;
  }

  toggle(): void {
    if (this.active()) {
      this.base = null;
      this.buffer = null;
      this.active.set(false);
      this.ctx.restoreView(this.ctx.currentValue());
      return;
    }
    const ed = this.ctx.editor();
    const snapshot = ed ? ed.getJSON() : this.ctx.currentValue();
    this.base = snapshot;
    this.buffer = snapshot;
    this.active.set(true);
  }

  async save(): Promise<void> {
    if (!this.base || !this.buffer) return;
    const id = this.ctx.entityId();
    if (!id) return;
    this.saving.set(true);
    try {
      const marks = buildBlockDiffMarks({
        before: this.base,
        after: this.buffer,
        now: new Date().toISOString(),
        genId: () => crypto.randomUUID(),
      });
      await this.ctx.drafts.save(id, this.ctx.entityTitle(), marks);
      this.base = this.buffer;
      this.ctx.onSaved(marks.length);
    } finally {
      this.saving.set(false);
    }
  }
}
