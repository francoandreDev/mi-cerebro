import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import type { ChapterSummary } from '../models/book.types';

@Component({
  selector: 'mc-chapter-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button type="button" class="card-btn" (click)="open.emit()">
      <header class="head">
        <span class="num">{{ indexLabel() }}</span>
        <span class="title">{{ chapter().title || t('books.chapters.untitled') }}</span>
        <span class="words">{{ wordsLabel() }}</span>
      </header>
      @if (chapter().preview.head !== '') {
        <p class="preview">
          <span class="quote">"{{ chapter().preview.head }}…"</span>
          @if (chapter().preview.tail !== '') {
            <span class="sep">…</span>
            <span class="quote">"…{{ chapter().preview.tail }}"</span>
          }
        </p>
      } @else {
        <p class="preview empty">{{ t('books.desk.previewMissing') }}</p>
      }
    </button>
    @if (editable()) {
      <div class="ops">
        <button
          type="button"
          class="ghost"
          [disabled]="first()"
          (click)="moveUp.emit()"
          [attr.aria-label]="t('books.chapters.moveUp')"
          [title]="t('books.chapters.moveUp')"
        >
          ↑
        </button>
        <button
          type="button"
          class="ghost"
          [disabled]="last()"
          (click)="moveDown.emit()"
          [attr.aria-label]="t('books.chapters.moveDown')"
          [title]="t('books.chapters.moveDown')"
        >
          ↓
        </button>
        <button
          type="button"
          class="ghost"
          (click)="remove.emit()"
          [attr.aria-label]="t('books.chapters.delete')"
          [title]="t('books.chapters.delete')"
        >
          <mc-icon name="x" />
        </button>
      </div>
    }
  `,
  styleUrl: './chapter-card.component.css',
})
export class ChapterCardComponent {
  readonly chapter = input.required<ChapterSummary>();
  readonly index = input.required<number>();
  readonly total = input.required<number>();
  readonly editable = input<boolean>(true);

  readonly open = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly remove = output<void>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected indexLabel(): string {
    return String(this.index() + 1).padStart(2, '0');
  }
  protected wordsLabel(): string {
    const w = this.chapter().words;
    return w === 0 ? '' : this.t('books.chapters.wordsLong', { count: w });
  }
  protected first(): boolean {
    return this.index() === 0;
  }
  protected last(): boolean {
    return this.index() === this.total() - 1;
  }
}
