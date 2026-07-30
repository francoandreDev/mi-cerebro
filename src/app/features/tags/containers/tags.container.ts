import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { TagsAdminService } from '@core/tags/tags-admin.service';
import { TagsService } from '@core/tags/tags.service';
import { TAG_SWATCHES, tagHexFor } from '@core/theme/theme-palette';
import { ThemeService } from '@core/theme/theme.service';
import { TutorialService } from '@core/tutorials/tutorial.service';
import { registerTagsOrganizeTutorial } from './tags-organize.tutorial';
import { registerTagsTutorial } from './tags.tutorial';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { IconComponent } from '@shared/icon/icon.component';

interface TagRow {
  readonly tag: Tag;
  readonly usageCount: number;
}

const norm = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();

@Component({
  selector: 'mc-tags',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent, BgColorDirective],
  templateUrl: './tags.container.html',
  styleUrl: './tags.container.css',
})
export class TagsContainer {
  private readonly tagsService = inject(TagsService);
  private readonly admin = inject(TagsAdminService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  protected readonly query = signal('');
  protected readonly renamingId = signal<string | null>(null);
  protected readonly renameDraft = signal('');
  protected readonly recoloringId = signal<string | null>(null);
  protected readonly mergingId = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly confirm = new ConfirmController();
  protected readonly swatches = TAG_SWATCHES;

  protected readonly rows = computed<readonly TagRow[]>(() => {
    const q = norm(this.query());
    const list = this.tagsService
      .tags()
      .map((tag) => ({ tag, usageCount: this.admin.usageCount(tag.id) }));
    if (q === '') return list;
    return list.filter((r) => norm(r.tag.label).includes(q));
  });

  protected readonly isEmpty = computed(() => this.tagsService.tags().length === 0);
  protected readonly noMatch = computed(() => !this.isEmpty() && this.rows().length === 0);

  constructor() {
    registerTagsTutorial();
    // why: `tags-organize` (recolor/rename/merge/delete) only makes sense
    //      once at least one tag row exists to act on (§8.13) — gate on
    //      `!isEmpty()` (tag count), not the filtered `rows()` computed the
    //      roadmap first named, so typing a filter that matches nothing
    //      doesn't flicker the flow out of the picker mid-session.
    const tutorials = inject(TutorialService);
    let disposeOrganize: (() => void) | null = null;
    effect(() => {
      if (this.isEmpty()) {
        disposeOrganize?.();
        disposeOrganize = null;
      } else {
        disposeOrganize ??= registerTagsOrganizeTutorial(tutorials);
      }
    });
    inject(DestroyRef).onDestroy(() => disposeOrganize?.());
    void this.tagsService.refresh().catch((e: unknown) => this.errors.report(e));
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected usageLabel(count: number): string {
    return this.t(count === 1 ? 'tags.page.usageCountOne' : 'tags.page.usageCountMany', { count });
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onRenameInput(event: Event): void {
    this.renameDraft.set((event.target as HTMLInputElement).value);
  }

  protected swatchHex(id: string): string {
    return tagHexFor(this.theme.resolved(), id) ?? '#888';
  }

  protected tagColor(tag: Tag): string {
    return tagHexFor(this.theme.resolved(), tag.colorSwatchId) ?? tag.color;
  }

  protected mergeTargets(excludeId: string): readonly Tag[] {
    return this.tagsService.tags().filter((t) => t.id !== excludeId);
  }

  protected toggleRecolor(id: string): void {
    this.mergingId.set(null);
    this.recoloringId.set(this.recoloringId() === id ? null : id);
  }

  protected pickSwatch(id: string, swatchId: string | null): void {
    void this.tagsService.setSwatch(id, swatchId).catch((e: unknown) => this.errors.report(e));
    this.recoloringId.set(null);
  }

  protected startRename(tag: Tag): void {
    this.recoloringId.set(null);
    this.mergingId.set(null);
    this.renamingId.set(tag.id);
    this.renameDraft.set(tag.label);
  }

  protected cancelRename(): void {
    this.renamingId.set(null);
  }

  protected async commitRename(id: string): Promise<void> {
    const label = this.renameDraft().trim();
    this.renamingId.set(null);
    if (label === '') return;
    try {
      await this.tagsService.rename(id, label);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected toggleMerge(id: string): void {
    this.recoloringId.set(null);
    this.mergingId.set(this.mergingId() === id ? null : id);
  }

  protected mergeInto(fromId: string, toId: string): void {
    this.mergingId.set(null);
    const from = this.tagsService.tags().find((t) => t.id === fromId);
    const to = this.tagsService.tags().find((t) => t.id === toId);
    if (!from || !to) return;
    // why: merge is irreversible (the source tag is deleted and every
    //      entity that used it now points at `to` instead) — same
    //      confirm-before-destroy treatment as deleteTag, closing the gap
    //      found while splitting this row into tutorial steps (§8.13).
    this.confirm.ask(
      {
        title: this.t('tags.page.confirm.merge.title'),
        message: this.t('tags.page.mergeConfirm', { from: from.label, to: to.label }),
        confirmLabel: this.t('tags.page.confirm.merge.confirm'),
        cancelLabel: this.t('tags.page.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        this.busyId.set(fromId);
        try {
          await this.admin.merge(fromId, toId);
        } catch (e) {
          this.errors.report(e);
        } finally {
          this.busyId.set(null);
        }
      },
    );
  }

  protected deleteTag(tag: Tag, usageCount: number): void {
    const message =
      usageCount > 0
        ? this.t('tags.page.deleteConfirmUsed', { label: tag.label, count: usageCount })
        : this.t('tags.page.deleteConfirm', { label: tag.label });
    this.confirm.ask(
      {
        title: this.t('tags.page.confirm.delete.title'),
        message,
        confirmLabel: this.t('tags.page.confirm.delete.confirm'),
        cancelLabel: this.t('tags.page.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        this.busyId.set(tag.id);
        try {
          await this.admin.deleteCascade(tag.id);
        } catch (e) {
          this.errors.report(e);
        } finally {
          this.busyId.set(null);
        }
      },
    );
  }
}
