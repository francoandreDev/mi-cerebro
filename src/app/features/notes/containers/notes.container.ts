import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TagsService } from '@core/tags/tags.service';

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
        [tags]="tags()"
        [selectedId]="active()?.id ?? null"
        (chooseNote)="onSelect($event)"
        (create)="onCreate()"
      />
      @if (active(); as note) {
        <mc-note-editor-pane
          [note]="note"
          [status]="status()"
          [availableTags]="tags()"
          (titleChange)="onTitleChange($event)"
          (bodyChange)="onBodyChange($event)"
          (removeNote)="onDelete()"
          (addTag)="onAddTag($event)"
          (removeTag)="onRemoveTag($event)"
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
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly notes = this.notesService.summaries;
  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<Note | null>(null);
  protected readonly status = signal<SaveStatus>('saved');

  constructor() {
    // why: tags must load before notes so the lazy stale-tag-ref cleanup
    //      (and the search index) sees the real tag set instead of dropping
    //      every reference as "unknown".
    void (async () => {
      try {
        await this.tagsService.refresh();
        await this.notesService.refresh();
      } catch (e: unknown) {
        this.errors.report(e);
      }
    })();

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

  protected async onAddTag(label: string): Promise<void> {
    const current = this.active();
    if (!current) return;
    try {
      await this.workspace.ensureWritable();
      const tag = await this.tagsService.touch(label);
      if (current.tags.includes(tag.id)) return;
      const next = { ...current, tags: [...current.tags, tag.id] };
      this.active.set(next);
      this.scheduleSave(next);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected onRemoveTag(id: string): void {
    const current = this.active();
    if (!current) return;
    if (!current.tags.includes(id)) return;
    const next = { ...current, tags: current.tags.filter((t) => t !== id) };
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

  private withReauthIfNeeded(error: unknown, retry?: () => void): unknown {
    return withReauthIfNeeded(error, () => this.workspace.reauthorize(), retry);
  }
}
