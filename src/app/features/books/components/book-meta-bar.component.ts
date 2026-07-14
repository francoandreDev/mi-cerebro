import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { MenuButtonComponent, type MenuOption } from '@shared/menu-button/menu-button.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { Book } from '../models/book.types';
import { formatAgo } from '../containers/format-ago';

export type BookSaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-book-meta-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagPickerComponent, MenuButtonComponent, IconComponent, RouterLink],
  templateUrl: './book-meta-bar.component.html',
  styleUrl: './book-meta-bar.component.css',
})
export class BookMetaBarComponent {
  readonly book = input.required<Book>();
  readonly status = input<BookSaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly editable = input<boolean>(true);
  readonly chaptersCount = input<number>(0);
  readonly totalWords = input<number>(0);
  readonly removeBook = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  protected readonly statsLabel = computed<string>(() => {
    const chapters = this.chaptersCount();
    const words = this.totalWords();
    if (chapters === 0) return this.t('books.bookStats.zero');
    const chaptersText =
      chapters === 1
        ? this.t('books.chapters.countOne')
        : this.t('books.chapters.countMany', { count: chapters });
    const ago = formatAgo(this.book().updatedAt, (k, p) => this.t(k, p));
    return this.t('books.bookStats', { chapters: chaptersText, words: formatNumber(words), ago });
  });

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected statusLabel(): string {
    return this.t(`books.status.${this.status()}` as TranslationKey);
  }
  protected statusIcon(): 'check' | 'clock-counter-clockwise' | 'warning' {
    const s = this.status();
    if (s === 'saving') return 'clock-counter-clockwise';
    if (s === 'unsaved') return 'warning';
    return 'check';
  }
  protected menuOptions(): readonly MenuOption[] {
    return [{ key: 'delete', label: this.t('books.menu.delete') }];
  }
  protected onMenuChoose(key: string): void {
    if (key === 'delete') this.removeBook.emit();
  }
}

const formatNumber = (n: number): string => n.toLocaleString('es-AR');
