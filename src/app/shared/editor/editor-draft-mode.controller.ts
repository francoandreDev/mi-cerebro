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

// why: debounce window for autosave. 3s matches the typical "pause to
//      think" cadence; long enough to avoid a commit per keystroke,
//      short enough that losing work to a crash/forget-to-save is at
//      worst that 3s window.
const DRAFT_AUTOSAVE_DELAY_MS = 3000;

export class EditorDraftModeController {
  readonly active = signal(false);
  readonly saving = signal(false);
  // why: transient feedback after a successful save. Cleared by setTimeout
  //      so the toolbar doesn't keep the badge forever — the user just
  //      needs visual confirmation that the save round-tripped.
  readonly lastSaveCount = signal<number | null>(null);
  private base: JSONContent | null = null;
  private buffer: JSONContent | null = null;
  private clearSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ctx: EditorDraftModeContext) {}

  isActive(): boolean {
    return this.active();
  }

  captureUpdate(json: JSONContent): boolean {
    if (!this.active()) return false;
    this.buffer = json;
    this.scheduleAutosave();
    return true;
  }

  toggle(): void {
    if (this.active()) {
      this.cancelAutosave();
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

  // why: called by the host when the editor unmounts so a buffered diff
  //      still in the debounce window is committed instead of being lost
  //      to navigation/tab close. Mirrors AutosaveService.flushAll.
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
