import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { routeFor } from '@core/search/kind-routes';
import type { TaggedItem, TaggedItemKind } from '@core/tags/tagged-item.types';
import { TaggedItemsService } from '@core/tags/tagged-items.service';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { resolveTagColor } from '@core/theme/theme-palette';
import { ThemeService } from '@core/theme/theme.service';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { BookVolumeComponent } from '@shared/entity-cards/book-volume.component';
import { ChalkEntryCardComponent } from '@shared/entity-cards/chalk-entry-card.component';
import { FileLockerCardComponent } from '@shared/entity-cards/file-locker-card.component';
import { GoalStarMiniComponent } from '@shared/entity-cards/goal-star-mini.component';
import { NoteSlipCardComponent } from '@shared/entity-cards/note-slip-card.component';
import { TaggedGenericCardComponent } from '@shared/entity-cards/tagged-generic-card.component';
import { WritingCardPreviewComponent } from '@shared/entity-cards/writing-card-preview.component';
import { IconComponent } from '@shared/icon/icon.component';

const formatDateOnly = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

@Component({
  selector: 'mc-tag-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    BgColorDirective,
    NoteSlipCardComponent,
    ChalkEntryCardComponent,
    WritingCardPreviewComponent,
    FileLockerCardComponent,
    BookVolumeComponent,
    GoalStarMiniComponent,
    TaggedGenericCardComponent,
  ],
  templateUrl: './tag-detail.container.html',
  styleUrl: './tag-detail.container.css',
})
export class TagDetailContainer {
  private readonly taggedItems = inject(TaggedItemsService);
  private readonly tagsService = inject(TagsService);
  private readonly theme = inject(ThemeService);
  protected readonly resolvedTheme = this.theme.resolved;
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly id = input.required<string>();

  protected readonly today = signal<string>(new Date().toISOString().slice(0, 10));

  protected readonly tag = computed<Tag | undefined>(() => this.tagsService.byId(this.id()));
  protected readonly availableTags = computed(() => this.tagsService.tags());
  protected readonly tagColor = computed(() => {
    const t = this.tag();
    if (!t) return 'var(--mc-fg-muted)';
    return resolveTagColor(this.theme.resolved(), t);
  });

  private readonly items = computed(() => {
    const tag = this.tag();
    return tag ? this.taggedItems.forTag(tag.id) : [];
  });

  protected readonly noteItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'note' }> => i.kind === 'note')
      .map((i) => i.summary),
  );
  protected readonly taskItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'task' }> => i.kind === 'task')
      .map((i) => i.summary),
  );
  protected readonly goalItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'goal' }> => i.kind === 'goal')
      .map((i) => i.summary),
  );
  protected readonly listItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'list' }> => i.kind === 'list')
      .map((i) => i.summary),
  );
  protected readonly writingItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'writing' }> => i.kind === 'writing')
      .map((i) => i.summary),
  );
  protected readonly bookItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'book' }> => i.kind === 'book')
      .map((i) => i.summary),
  );
  protected readonly imageItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'image' }> => i.kind === 'image')
      .map((i) => i.summary),
  );
  protected readonly fileItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'file' }> => i.kind === 'file')
      .map((i) => i.summary),
  );
  protected readonly trackItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'track' }> => i.kind === 'track')
      .map((i) => i.summary),
  );
  protected readonly playlistItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'playlist' }> => i.kind === 'playlist')
      .map((i) => i.summary),
  );
  protected readonly reminderItems = computed(() =>
    this.items()
      .filter((i): i is Extract<TaggedItem, { kind: 'reminder' }> => i.kind === 'reminder')
      .map((i) => i.summary),
  );

  protected readonly isEmpty = computed(
    () =>
      this.noteItems().length === 0 &&
      this.taskItems().length === 0 &&
      this.goalItems().length === 0 &&
      this.listItems().length === 0 &&
      this.writingItems().length === 0 &&
      this.bookItems().length === 0 &&
      this.imageItems().length === 0 &&
      this.fileItems().length === 0 &&
      this.trackItems().length === 0 &&
      this.playlistItems().length === 0 &&
      this.reminderItems().length === 0,
  );

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  private static readonly UNTITLED_KEY: Readonly<Record<string, TranslationKey>> = {
    track: 'music.untitledTrack',
    playlist: 'music.untitledPlaylist',
    reminder: 'reminders.untitled',
  };

  protected untitledLabel(kind: TaggedItemKind): string {
    const special = TagDetailContainer.UNTITLED_KEY[kind];
    return this.t(special ?? (`${kind}s.untitledTitle` as TranslationKey));
  }

  protected trackSubtitle(track: Extract<TaggedItem, { kind: 'track' }>['summary']): string {
    return track.artist?.trim() || '';
  }

  protected wordsLabel(wordCount: number): string {
    if (wordCount === 0) return this.t('writings.shelf.wordsZero');
    if (wordCount === 1) return this.t('writings.shelf.wordsOne');
    return this.t('writings.shelf.words', { n: wordCount });
  }

  protected imageCountLabel(count: number): string {
    if (count === 0) return this.t('images.index.coverCount.empty');
    if (count === 1) return this.t('images.index.coverCount.one');
    return this.t('images.index.coverCount.many', { count });
  }

  protected taskSubtitle(dueDates: readonly string[]): string {
    const first = dueDates[0];
    return first ? formatDateOnly(first) : '';
  }

  protected reminderSubtitle(dueAt: string): string {
    const datePart = dueAt.slice(0, 10);
    return datePart ? formatDateOnly(datePart) : '';
  }

  protected open(kind: TaggedItemKind, id: string, title: string): void {
    void this.router.navigate([...routeFor(kind, id, title)]);
  }
}
