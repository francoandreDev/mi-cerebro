import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { extractPlainText } from '@core/search/tiptap-text';
import { EditorComponent } from '@shared/editor/editor.component';
import { toRoman } from '@shared/utils/roman';
import { countChars, countWords, readingMinutes } from '@shared/utils/word-count';

import type { Chapter } from '../models/book.types';
import type { BookSaveStatus } from './book-meta-bar.component';

@Component({
  selector: 'mc-chapter-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent],
  templateUrl: './chapter-editor-pane.component.html',
  styleUrl: './chapter-editor-pane.component.css',
})
export class ChapterEditorPaneComponent {
  readonly chapter = input.required<Chapter>();
  readonly status = input<BookSaveStatus>('saved');
  readonly editable = input<boolean>(true);
  readonly focusMode = input<boolean>(false);
  readonly chapterIndex = input<number>(-1);
  readonly chapterTotal = input<number>(0);
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();
  readonly toggleFocus = output<void>();

  protected readonly words = computed(() => countWords(extractPlainText(this.chapter().body)));
  protected readonly chars = computed(() => countChars(extractPlainText(this.chapter().body)));
  protected readonly readMin = computed(() => readingMinutes(this.words()));
  protected readonly roman = computed(() => {
    const i = this.chapterIndex();
    return i >= 0 ? toRoman(i + 1) : '';
  });

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected statusLabel(): string {
    return this.t(`books.status.${this.status()}` as TranslationKey);
  }
  protected focusLabel(): string {
    return this.focusMode() ? this.t('books.editor.exitFocus') : this.t('books.editor.toggleFocus');
  }
  protected readingLabel(): string {
    const m = this.readMin();
    return m === 0
      ? this.t('books.editor.footerReadingZero')
      : this.t('books.editor.footerReading', { n: m });
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
}
