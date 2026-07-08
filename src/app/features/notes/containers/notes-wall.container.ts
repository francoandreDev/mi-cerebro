import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';

import { NoteComposeComponent } from '../components/note-compose.component';
import { NoteSlipComponent } from '../components/note-slip.component';
import { NotesFilterBarComponent } from '../components/notes-filter-bar.component';
import type { NoteSummary } from '../models/note.types';
import { NotesService } from '../services/notes.service';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Component({
  selector: 'mc-notes-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NoteSlipComponent, NoteComposeComponent, NotesFilterBarComponent],
  templateUrl: './notes-wall.container.html',
  styleUrl: './notes-wall.container.css',
})
export class NotesWallContainer {
  private readonly notesService = inject(NotesService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.notesService.summaries;
  protected readonly query = signal<string>('');
  protected readonly activeTagIds = signal<ReadonlySet<string>>(new Set());
  protected readonly creating = signal<boolean>(false);

  protected readonly untitledLabel = computed(() => this.t('notes.untitledTitle'));
  protected readonly availableTags = computed(() => {
    const used = new Set<string>();
    for (const s of this.summaries()) for (const id of s.tags) used.add(id);
    return this.tags().filter((t) => used.has(t.id));
  });
  // why: ticker shows newest first, but service orders ascending by position.
  protected readonly visible = computed<readonly NoteSummary[]>(() => {
    const q = norm(this.query().trim());
    const tagSet = this.activeTagIds();
    const filtered = this.summaries().filter((n) => {
      if (tagSet.size > 0 && !n.tags.some((id) => tagSet.has(id))) return false;
      if (!q) return true;
      return norm(`${n.title} ${n.preview}`).includes(q);
    });
    return [...filtered].reverse();
  });
  protected readonly hasFilter = computed(
    () => this.query().trim() !== '' || this.activeTagIds().size > 0,
  );
  protected readonly noMatch = computed(
    () => this.hasFilter() && this.visible().length === 0 && this.summaries().length > 0,
  );
  protected readonly empty = computed(() => this.summaries().length === 0 && !this.hasFilter());

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onOpen(id: string, title: string): void {
    void this.router.navigate(['/notes', entitySlugSegment(title, id)]);
  }

  protected async onCreate(title: string): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      await this.notesService.create(title);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected async onDelete(id: string): Promise<void> {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.t('notes.untitledTitle');
    if (!confirm(this.t('notes.deleteConfirm').replace('{title}', label))) return;
    try {
      await this.notesService.deleteToTrash(id);
      await this.autosave.clear(id);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onToggleTag(id: string): void {
    this.activeTagIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
  }

  protected onClearFilters(): void {
    this.query.set('');
    this.activeTagIds.set(new Set());
  }
}
