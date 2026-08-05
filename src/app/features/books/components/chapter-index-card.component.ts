import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { hashColor } from '@shared/utils/hash-color';
import { IconComponent } from '@shared/icon/icon.component';

import type { ChapterSummary } from '../models/book.types';

@Component({
  selector: 'mc-chapter-index-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button type="button" class="card" (click)="open.emit()">
      <span class="thumb" [style.--mc-th-bg]="palette().bg" [style.--mc-th-fg]="palette().fg">
        @if (thumbUrl(); as url) {
          <img [src]="url" class="thumb-img" alt="" />
        } @else {
          <span class="thumb-num">{{ indexLabel() }}</span>
          <span class="thumb-glyph" aria-hidden="true">{{ glyph() }}</span>
        }
      </span>
      <span class="meta">
        <span class="title">{{ chapter().title || t('books.chapters.untitled') }}</span>
        <span class="sub">
          <span class="pages">
            {{ pagesLabel() }}
          </span>
          <span class="dot" aria-hidden="true">·</span>
          <span class="words">{{ wordsLabel() }}</span>
        </span>
        @if (chapter().preview.head !== '') {
          <span class="preview">{{ chapter().preview.head }}…</span>
        }
      </span>
    </button>
    @if (editable()) {
      <div class="ops">
        <button
          type="button"
          class="ghost"
          (click)="fileInput.click()"
          [attr.aria-label]="t('books.chapters.imagePick')"
          [title]="t('books.chapters.imagePick')"
        >
          <mc-icon name="image" />
        </button>
        @if (thumbUrl()) {
          <button
            type="button"
            class="ghost"
            (click)="removeImage.emit()"
            [attr.aria-label]="t('books.chapters.imageRemove')"
            [title]="t('books.chapters.imageRemove')"
          >
            <mc-icon name="trash" />
          </button>
        }
        <input #fileInput type="file" accept="image/*" hidden (change)="onFileChange($event)" />
        <button
          type="button"
          class="ghost"
          data-tutorial="books-index-reorder"
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
          data-tutorial="books-index-delete"
          (click)="remove.emit()"
          [attr.aria-label]="t('books.chapters.delete')"
          [title]="t('books.chapters.delete')"
        >
          <mc-icon name="x" />
        </button>
      </div>
    }
  `,
  styleUrl: './chapter-index-card.component.css',
})
export class ChapterIndexCardComponent {
  readonly chapter = input.required<ChapterSummary>();
  readonly index = input.required<number>();
  readonly total = input.required<number>();
  readonly editable = input<boolean>(true);
  readonly thumbUrl = input<string | null>(null);

  readonly open = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly remove = output<void>();
  readonly pickImage = output<File>();
  readonly removeImage = output<void>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected readonly palette = computed(() => hashColor(this.chapter().id));
  // why: glyph procedural — símbolo tipográfico distinto por capítulo
  //      derivado del hash, da identidad visual sin pedir al usuario que
  //      suba una imagen. Fallback cuando `thumbUrl` es null (sin override).
  protected readonly glyph = computed(() => {
    const palette = ['§', '✦', '✧', '❖', '✺', '✱', '✥', '✿', '✾', '☙'];
    const h = simpleHash(this.chapter().id);
    return palette[h % palette.length] ?? '§';
  });

  protected indexLabel(): string {
    return String(this.index() + 1).padStart(2, '0');
  }
  protected pagesLabel(): string {
    const { pageStart, pageEnd, pageCount, pageCountEstimated } = this.chapter();
    if (pageStart === pageEnd) {
      const key = pageCountEstimated ? 'books.index.pagesOneEstimated' : 'books.index.pagesOne';
      return this.t(key, { page: pageStart, count: pageCount });
    }
    const key = pageCountEstimated ? 'books.index.pagesRangeEstimated' : 'books.index.pagesRange';
    return this.t(key, {
      start: pageStart,
      end: pageEnd,
      count: pageCount,
    });
  }
  protected wordsLabel(): string {
    return this.t('books.chapters.wordsLong', { count: this.chapter().words });
  }
  protected first(): boolean {
    return this.index() === 0;
  }
  protected last(): boolean {
    return this.index() === this.total() - 1;
  }
  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.pickImage.emit(file);
  }
}

const simpleHash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
