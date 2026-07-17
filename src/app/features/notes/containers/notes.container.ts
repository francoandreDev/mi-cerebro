import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { extractEntityId } from '@core/routing/entity-slug';
import { TagsService } from '@core/tags/tags.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';

import { NoteEditorPaneComponent, type SaveStatus } from '../components/note-editor-pane.component';
import { NOTE_KIND, type Note } from '../models/note.types';
import { NotesService } from '../services/notes.service';

@Component({
  selector: 'mc-notes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, NoteEditorPaneComponent, LockBannerComponent, IconComponent],
  templateUrl: './notes.container.html',
  styleUrl: './notes.container.css',
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

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<Note | null>(null);
  protected readonly status = signal<SaveStatus>('saved');
  protected readonly lock = new EntityLockController(NOTE_KIND, this.active);
  protected readonly confirm = new ConfirmController();

  constructor() {
    effect(() => {
      const raw = this.id();
      const wanted = raw ? extractEntityId(raw) : undefined;
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

  protected async onBackToIndex(): Promise<void> {
    await this.router.navigate(['/notes']);
  }

  protected onTitleChange(title: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, title };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected onBodyChange(body: JSONContent): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, body };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected async onAddTag(label: string): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
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

  protected onScheduledForChange(scheduledFor: string | null): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, scheduledFor };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected onRemoveTag(id: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    if (!current.tags.includes(id)) return;
    const next = { ...current, tags: current.tags.filter((t) => t !== id) };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected onDelete(): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    this.confirm.ask(
      {
        title: this.t('notes.confirm.delete.title'),
        message: this.t('notes.deleteConfirm').replace(
          '{title}',
          current.title || this.t('notes.untitledTitle'),
        ),
        confirmLabel: this.t('notes.confirm.delete.confirm'),
        cancelLabel: this.t('notes.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.notesService.deleteToTrash(current.id);
          await this.autosave.clear(current.id);
          this.active.set(null);
          await this.router.navigate(['/notes']);
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
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
