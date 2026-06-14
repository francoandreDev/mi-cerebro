// 13f — Draft session controller. Replaces the prior 13d-iii "draft mode"
// toggle: instead of a per-entity switch, a session is started imperatively
// (from the bubble menu's "Proponer cambio" action) and ended on Esc / click
// outside the editor. While active, edits to the editor are captured as
// diff-marks (one per block touched) and the doc is reverted to its
// snapshot when the session ends. Reuses the snapshot+revert mechanism
// from 13d-iii — only the trigger changes.

import { signal } from '@angular/core';
import type { Editor, JSONContent } from '@tiptap/core';

import { buildBlockDiffMarks } from '@core/versioning/draft-capture';
import type { DraftsService } from '@core/versioning/drafts.service';

export interface DraftSessionContext {
  readonly drafts: DraftsService;
  readonly editor: () => Editor | null;
  readonly currentValue: () => JSONContent;
  readonly entityId: () => string;
  readonly entityTitle: () => string;
  readonly restoreView: (doc: JSONContent) => void;
  readonly onSaved: (count: number) => void;
}

const DRAFT_AUTOSAVE_DELAY_MS = 3000;

export class DraftSessionController {
  readonly active = signal(false);
  readonly saving = signal(false);
  readonly lastSaveCount = signal<number | null>(null);
  private base: JSONContent | null = null;
  private buffer: JSONContent | null = null;
  private clearSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ctx: DraftSessionContext) {}

  isActive(): boolean {
    return this.active();
  }

  captureUpdate(json: JSONContent): boolean {
    if (!this.active()) return false;
    this.buffer = json;
    this.scheduleAutosave();
    return true;
  }

  // why: imperative start. Bubble menu calls this after the user picks
  //      "Proponer cambio"; the selection is implicit in the editor state.
  start(): void {
    if (this.active()) return;
    const ed = this.ctx.editor();
    const snapshot = ed ? ed.getJSON() : this.ctx.currentValue();
    this.base = snapshot;
    this.buffer = snapshot;
    this.active.set(true);
  }

  // why: end a live session. Flushes the buffer (if any) and reverts the
  //      editor view to the snapshot, so accepted/pending marks are the
  //      only persisted form of the diff.
  async end(): Promise<void> {
    if (!this.active()) return;
    this.cancelAutosave();
    await this.save();
    this.base = null;
    this.buffer = null;
    this.active.set(false);
    this.ctx.restoreView(this.ctx.currentValue());
  }

  // why: discard a session without persisting. Used if the user explicitly
  //      cancels (future shortcut) — today only end() is wired.
  cancel(): void {
    if (!this.active()) return;
    this.cancelAutosave();
    this.base = null;
    this.buffer = null;
    this.active.set(false);
    this.ctx.restoreView(this.ctx.currentValue());
  }

  async flushPending(): Promise<void> {
    if (!this.autosaveTimer) return;
    this.cancelAutosave();
    await this.save();
  }

  async save(): Promise<void> {
    this.cancelAutosave();
    if (this.saving()) return;
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
      if (marks.length === 0) return;
      await this.ctx.drafts.save(id, this.ctx.entityTitle(), marks);
      this.base = this.buffer;
      this.ctx.onSaved(marks.length);
      this.flashSaved(marks.length);
    } finally {
      this.saving.set(false);
    }
  }

  private flashSaved(count: number): void {
    this.lastSaveCount.set(count);
    if (this.clearSaveTimer) clearTimeout(this.clearSaveTimer);
    this.clearSaveTimer = setTimeout(() => {
      this.lastSaveCount.set(null);
      this.clearSaveTimer = null;
    }, 2500);
  }

  private scheduleAutosave(): void {
    this.cancelAutosave();
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      void this.save();
    }, DRAFT_AUTOSAVE_DELAY_MS);
  }

  private cancelAutosave(): void {
    if (!this.autosaveTimer) return;
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
  }
}
