import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import type { ChapterSummary } from '../models/book.types';

@Component({
  selector: 'mc-chapter-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span
      class="grip"
      [attr.aria-hidden]="true"
      [attr.draggable]="editable() ? true : null"
      [title]="t('books.chapters.dragHandle')"
      >⋮⋮</span
    >
    <span class="index" aria-hidden="true">{{ indexLabel() }}</span>
    <button
      type="button"
      class="title"
      [attr.aria-current]="selected() ? 'true' : null"
      (click)="activate.emit()"
    >
      {{ chapter().title || t('books.chapters.untitled') }}
    </button>
    @if (chapter().words > 0) {
      <span
        class="words"
        [title]="t('books.chapters.wordsLong', { count: chapter().words })"
        aria-hidden="true"
        >{{ wordsShort() }}</span
      >
    } @else {
      <span class="words" aria-hidden="true">·</span>
    }
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
  styles: `
    :host {
      display: grid;
      grid-template-columns: 14px 2.2em 1fr auto auto;
      align-items: center;
      gap: var(--mc-space-1);
      padding: var(--mc-space-1) var(--mc-space-2);
      border-radius: var(--mc-radius-md);
      border-left: 3px solid transparent;
      min-height: 32px;
    }
    :host(:hover) {
      background: var(--mc-bg-elevated);
    }
    :host(.selected) {
      background: var(--mc-bg-elevated);
      border-left-color: var(--mc-accent-primary);
    }
    .grip {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      line-height: 1;
      letter-spacing: -2px;
      cursor: grab;
      opacity: 0;
      transition: opacity 0.12s ease;
      user-select: none;
    }
    :host(:hover) .grip,
    :host(:focus-within) .grip {
      opacity: 0.6;
    }
    :host(:not(.editable)) .grip {
      display: none;
    }
    .index {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .title {
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      text-align: left;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0;
      min-width: 0;
    }
    .words {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      font-variant-numeric: tabular-nums;
      padding: 0 var(--mc-space-1);
    }
    .ops {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.12s ease;
    }
    :host(:hover) .ops,
    :host(:focus-within) .ops {
      opacity: 1;
    }
    .ghost {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: var(--mc-radius-sm);
      font-size: var(--mc-font-size-sm);
    }
    .ghost:hover:not(:disabled) {
      color: var(--mc-fg-primary);
      background: var(--mc-bg-base);
    }
    .ghost:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  `,
  host: {
    '[class.selected]': 'selected()',
    '[class.editable]': 'editable()',
  },
})
export class ChapterRowComponent {
  readonly chapter = input.required<ChapterSummary>();
  readonly index = input.required<number>();
  readonly total = input.required<number>();
  readonly selected = input<boolean>(false);
  readonly editable = input<boolean>(true);

  readonly activate = output<void>();
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
  protected wordsShort(): string {
    return this.t('books.chapters.wordsShort', { count: this.chapter().words });
  }
  protected first(): boolean {
    return this.index() === 0;
  }
  protected last(): boolean {
    return this.index() === this.total() - 1;
  }
}
