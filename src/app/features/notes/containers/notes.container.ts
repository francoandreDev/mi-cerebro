import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AutosaveService } from '@core/autosave/autosave.service';
import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import { NoteEditorPaneComponent, type SaveStatus } from '../components/note-editor-pane.component';
import { NOTE_KIND, type Note } from '../models/note.types';
import { NotesService } from '../services/notes.service';
import { NoteSidebarComponent } from './note-sidebar.component';

@Component({
  selector: 'mc-notes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NoteSidebarComponent, NoteEditorPaneComponent],
  template: `
    <div class="layout">
      <mc-note-sidebar
        [notes]="notes()"
        [selectedId]="active()?.id ?? null"
        (chooseNote)="onSelect($event)"
        (create)="onCreate()"
      />
      @if (active(); as note) {
        <mc-note-editor-pane
          [note]="note"
          [status]="status()"
          (titleChange)="onTitleChange($event)"
          (bodyChange)="onBodyChange($event)"
          (removeNote)="onDelete()"
        />
      } @else {
        <div class="empty">{{ t('notes.selectOne') }}</div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .layout {
      display: flex;
      height: 100vh;
    }
    .empty {
      flex: 1;
      display: grid;
      place-items: center;
      color: var(--mc-fg-muted);
      padding: var(--mc-space-5);
    }
  `,
})
export class NotesContainer {
  readonly id = input<string | undefined>(undefined);

  private readonly notesService = inject(NotesService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly notes = this.notesService.summaries;
  protected readonly active = signal<Note | null>(null);
  protected readonly status = signal<SaveStatus>('saved');

  constructor() {
    void this.notesService.refresh().catch((e: unknown) => this.errors.report(e));

    effect(() => {
      const wanted = this.id();
      const current = this.active();
      if (!wanted) {
        if (current) this.active.set(null);
        return;
      }
      if (current?.id === wanted) return;
      void this.loadNote(wanted);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/notes', id]);
  }

  protected async onCreate(): Promise<void> {
    try {
      // why: click is a user gesture, so requestPermission can actually
      //      prompt if the browser silently dropped readwrite between visits.
      //      Doing this before create avoids the first write blowing up.
      await this.workspace.ensureWritable();
      const note = await this.notesService.create('');
      await this.router.navigate(['/notes', note.id]);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected onTitleChange(title: string): void {
    const current = this.active();
    if (!current) return;
    const next = { ...current, title };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected onBodyChange(body: JSONContent): void {
    const current = this.active();
    if (!current) return;
    const next = { ...current, body };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected async onDelete(): Promise<void> {
    const current = this.active();
    if (!current) return;
    const ok = confirm(
      this.t('notes.deleteConfirm').replace(
        '{title}',
        current.title || this.t('notes.untitledTitle'),
      ),
    );
    if (!ok) return;
    try {
      await this.notesService.deleteToTrash(current.id);
      await this.autosave.clear(current.id);
      this.active.set(null);
      await this.router.navigate(['/notes']);
    } catch (e) {
      this.errors.report(e);
    }
  }

  private async loadNote(id: string): Promise<void> {
    try {
      const note = await this.notesService.read(id);
      this.active.set(note);
      this.status.set('saved');
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
    }
  }

  private scheduleSave(note: Note): void {
    this.status.set('unsaved');
    this.autosave.schedule<Note>(note.id, NOTE_KIND, () => note, {
      onFlush: async (payload) => {
        this.status.set('saving');
        try {
          await this.notesService.save(payload);
          await this.autosave.clear(payload.id);
          this.status.set('saved');
        } catch (e) {
          this.errors.report(this.withReauthIfNeeded(e, () => this.scheduleSave(payload)));
          this.status.set('unsaved');
        }
      },
    });
  }

  // why: when the FS layer reports a dropped write permission (FS-004), wrap
  //      the error with a "Reautorizar" action that prompts via a real user
  //      gesture (modal button click) and then re-runs the failed work.
  private withReauthIfNeeded(error: unknown, retry?: () => void): unknown {
    if (!(error instanceof AppError) || error.code !== ERROR_CODES.FS_004) return error;
    return new AppError(ERROR_CODES.FS_004, {
      severity: 'warning',
      recoverable: true,
      cause: error.cause,
      ...(error.context !== undefined ? { context: error.context } : {}),
      actions: [
        {
          labelKey: 'common.reauthorize',
          run: async () => {
            await this.workspace.reauthorize();
            retry?.();
          },
        },
      ],
    });
  }
}
