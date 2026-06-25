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
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';

import { ListEditorPaneComponent, type SaveStatus } from '../components/list-editor-pane.component';
import type { ChalkLayer } from '../models/chalk.types';
import { LIST_KIND, type List } from '../models/list.types';
import { ListsService } from '../services/lists.service';

@Component({
  selector: 'mc-lists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListEditorPaneComponent, LockBannerComponent, IconComponent],
  templateUrl: './lists.container.html',
  styleUrl: './lists.container.css',
})
export class ListsContainer {
  readonly id = input<string | undefined>(undefined);

  private readonly listsService = inject(ListsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<List | null>(null);
  protected readonly status = signal<SaveStatus>('saved');
  protected readonly lock = new EntityLockController(LIST_KIND, this.active);

  constructor() {
    effect(() => {
      const wanted = this.id();
      const current = this.active();
      if (!wanted) {
        if (current) this.active.set(null);
        return;
      }
      if (current?.id === wanted) return;
      void this.loadList(wanted);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onTitleChange(title: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, title };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected onChalkLayersChange(chalkLayers: readonly ChalkLayer[]): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, chalkLayers };
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
      this.t('lists.deleteConfirm').replace(
        '{title}',
        current.title || this.t('lists.untitledTitle'),
      ),
    );
    if (!ok) return;
    try {
      await this.listsService.deleteToTrash(current.id);
      await this.autosave.clear(current.id);
      this.active.set(null);
      await this.router.navigate(['/lists']);
    } catch (e) {
      this.errors.report(e);
    }
  }

  private async loadList(id: string): Promise<void> {
    try {
      const list = await this.listsService.read(id);
      this.active.set(list);
      this.status.set('saved');
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
    }
  }

  private scheduleSave(list: List): void {
    this.status.set('unsaved');
    this.autosave.schedule<List>(list.id, LIST_KIND, () => list, {
      onFlush: async (payload) => {
        this.status.set('saving');
        try {
          await this.listsService.save(payload);
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
