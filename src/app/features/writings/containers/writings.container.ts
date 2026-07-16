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
import { IconComponent } from '@shared/icon/icon.component';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';

import {
  WritingEditorPaneComponent,
  type SaveStatus,
} from '../components/writing-editor-pane.component';
import { WRITING_KIND, type Writing } from '../models/writing.types';
import { WritingsService } from '../services/writings.service';

@Component({
  selector: 'mc-writings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WritingEditorPaneComponent, LockBannerComponent, IconComponent],
  templateUrl: './writings.container.html',
  styleUrl: './writings.container.css',
  host: { '(document:keydown.escape)': 'onEscape($event)' },
})
export class WritingsContainer {
  readonly id = input<string | undefined>(undefined);

  private readonly writingsService = inject(WritingsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<Writing | null>(null);
  protected readonly status = signal<SaveStatus>('saved');
  protected readonly lock = new EntityLockController(WRITING_KIND, this.active);

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
      void this.loadWriting(wanted);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected async onBack(): Promise<void> {
    await this.router.navigate(['/writings']);
  }

  protected onEscape(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('.ProseMirror, input, textarea, select')) return;
    event.preventDefault();
    void this.router.navigate(['/writings']);
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

  protected onDeadlineChange(deadline: string | null): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const reminder =
      deadline === null && current.reminder.enabled
        ? { ...current.reminder, enabled: false }
        : current.reminder;
    const next = { ...current, deadline, reminder };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected onReminderEnabledChange(enabled: boolean): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, reminder: { ...current.reminder, enabled } };
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

  protected onRemoveTag(id: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    if (!current.tags.includes(id)) return;
    const next = { ...current, tags: current.tags.filter((t) => t !== id) };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected async onDelete(): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const ok = confirm(
      this.t('writings.deleteConfirm').replace(
        '{title}',
        current.title || this.t('writings.untitledTitle'),
      ),
    );
    if (!ok) return;
    try {
      await this.writingsService.deleteToTrash(current.id);
      await this.autosave.clear(current.id);
      this.active.set(null);
      await this.router.navigate(['/writings']);
    } catch (e) {
      this.errors.report(e);
    }
  }

  private async loadWriting(id: string): Promise<void> {
    try {
      const writing = await this.writingsService.read(id);
      this.active.set(writing);
      this.status.set('saved');
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
    }
  }

  private scheduleSave(writing: Writing): void {
    this.status.set('unsaved');
    this.autosave.schedule<Writing>(writing.id, WRITING_KIND, () => writing, {
      onFlush: async (payload) => {
        this.status.set('saving');
        try {
          await this.writingsService.save(payload);
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
