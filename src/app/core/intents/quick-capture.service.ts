import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';

import { NotesService } from '@features/notes/services/notes.service';
import type { Note } from '@features/notes/models/note.types';

// why: la nota siempre cae en la raíz del árbol y sin tags — no existe un
//      concepto de "carpeta/tag activo" persistente entre secciones, sólo
//      filtros locales efímeros por wall container.
const CAPTURE_FOLDER = '';

@Injectable({ providedIn: 'root' })
export class QuickCaptureService {
  private readonly shortcuts = inject(ShortcutsService);
  private readonly notes = inject(NotesService);
  private readonly errors = inject(ErrorService);
  private readonly router = inject(Router);

  private readonly openSignal = signal(false);
  readonly open = this.openSignal.asReadonly();

  constructor() {
    const dispose = this.shortcuts.register({
      combo: 'Alt+Shift+N',
      labelKey: 'shortcuts.quickCapture',
      scope: 'global',
      handler: () => this.openDialog(),
    });
    inject(DestroyRef).onDestroy(dispose);
  }

  openDialog(): void {
    this.openSignal.set(true);
  }

  closeDialog(): void {
    this.openSignal.set(false);
  }

  async capture(text: string): Promise<void> {
    const lines = text.split('\n').map((l) => l.trim());
    const title = lines[0] ?? '';
    const bodyLines = lines.slice(1).filter((l) => l.length > 0);
    if (!title && bodyLines.length === 0) {
      this.closeDialog();
      return;
    }
    try {
      const note = await this.notes.create(title, CAPTURE_FOLDER);
      const saved =
        bodyLines.length > 0 ? await this.notes.save({ ...note, body: bodyDoc(bodyLines) }) : note;
      this.closeDialog();
      this.reportCreated(saved);
    } catch (e) {
      this.closeDialog();
      this.errors.report(e);
    }
  }

  private reportCreated(note: Note): void {
    this.errors.report(
      new AppError(ERROR_CODES.UI_001, {
        severity: 'info',
        recoverable: false,
        context: { id: note.id },
        actions: [
          {
            labelKey: 'quickCapture.openNote',
            run: () => this.openNote(note),
          },
        ],
      }),
    );
  }

  private async openNote(note: Note): Promise<void> {
    await this.router.navigate(['/notes', entitySlugSegment(note.title, note.id)]);
  }
}

const bodyDoc = (lines: readonly string[]): JSONContent => ({
  type: 'doc',
  content: lines.map((line) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: line }],
  })),
});
