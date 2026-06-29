import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { toRoman } from '@shared/utils/roman';

import type { ChapterSummary } from '../models/book.types';

@Component({
  selector: 'mc-reader-toc-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reader-toc-rail.component.html',
  styleUrl: './reader-toc-rail.component.css',
})
export class ReaderTocRailComponent {
  readonly chapters = input.required<readonly ChapterSummary[]>();
  readonly activeChapterId = input<string | null>(null);
  readonly editable = input<boolean>(false);
  readonly jumpTo = output<string>();
  readonly addChapter = output<void>();

  private readonly i18n = inject(I18nService);

  protected readonly items = computed(() =>
    this.chapters().map((ch, i) => ({
      id: ch.id,
      roman: toRoman(i + 1),
      title: ch.title || this.i18n.t('books.chapters.untitled'),
      pageStart: ch.pageStart,
      pageEnd: ch.pageEnd,
    })),
  );

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected onJump(id: string): void {
    this.jumpTo.emit(id);
  }
}
