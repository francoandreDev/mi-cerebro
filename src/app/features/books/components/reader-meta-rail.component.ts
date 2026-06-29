import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { readingMinutes } from '@shared/utils/word-count';

import type { Book, ChapterSummary } from '../models/book.types';

@Component({
  selector: 'mc-reader-meta-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reader-meta-rail.component.html',
  styleUrl: './reader-meta-rail.component.css',
  host: {
    '[style.--mc-reader-progress]': 'progressPct() + "%"',
  },
})
export class ReaderMetaRailComponent {
  readonly book = input.required<Book>();
  readonly chapters = input.required<readonly ChapterSummary[]>();
  readonly activeIndex = input<number>(-1);

  private readonly i18n = inject(I18nService);

  protected readonly totalChapters = computed(() => this.chapters().length);
  protected readonly totalWords = computed(() =>
    this.chapters().reduce((sum, ch) => sum + ch.words, 0),
  );
  protected readonly totalReadMin = computed(() => readingMinutes(this.totalWords()));
  protected readonly activeChapter = computed(() => {
    const i = this.activeIndex();
    const list = this.chapters();
    return i >= 0 && i < list.length ? (list[i] ?? null) : null;
  });
  protected readonly chapterWords = computed(() => this.activeChapter()?.words ?? 0);
  protected readonly chapterReadMin = computed(() => readingMinutes(this.chapterWords()));
  protected readonly chapterReadingLabel = computed(() => {
    const m = this.chapterReadMin();
    return m === 0
      ? this.i18n.t('books.editor.footerReadingZero')
      : this.i18n.t('books.editor.footerReading', { n: m });
  });
  protected readonly progressLabel = computed(() => {
    const i = this.activeIndex();
    const total = this.totalChapters();
    if (i < 0 || total <= 0) return '';
    return this.i18n.t('books.reader.progressLabel', { current: i + 1, total });
  });
  protected readonly progressPct = computed(() => {
    const i = this.activeIndex();
    const total = this.totalChapters();
    if (i < 0 || total <= 0) return 0;
    return Math.round(((i + 1) / total) * 100);
  });
  protected readonly readingLabel = computed(() => {
    const m = this.totalReadMin();
    return m === 0
      ? this.i18n.t('books.editor.footerReadingZero')
      : this.i18n.t('books.editor.footerReading', { n: m });
  });

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
