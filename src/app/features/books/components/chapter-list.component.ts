import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { ChapterSummary } from '../models/book.types';

@Component({
  selector: 'mc-chapter-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <h3>{{ t('books.chapters.title') }}</h3>
      @if (editable()) {
        <button type="button" class="primary" (click)="addChapter.emit()">
          + {{ t('books.chapters.new') }}
        </button>
      }
    </header>
    @if (chapters().length === 0) {
      <p class="empty">{{ t('books.chapters.empty') }}</p>
    }
    <ul class="list">
      @for (ch of chapters(); track ch.id; let i = $index) {
        <li class="row" [class.selected]="ch.id === activeId()">
          <button type="button" class="title" (click)="selectChapter.emit(ch.id)">
            {{ ch.title || t('books.chapters.untitled') }}
          </button>
          @if (editable()) {
            <div class="ops">
              <button
                type="button"
                class="ghost"
                [disabled]="i === 0"
                (click)="moveUp.emit(ch.id)"
                [attr.aria-label]="t('books.chapters.moveUp')"
              >
                ↑
              </button>
              <button
                type="button"
                class="ghost"
                [disabled]="i === chapters().length - 1"
                (click)="moveDown.emit(ch.id)"
                [attr.aria-label]="t('books.chapters.moveDown')"
              >
                ↓
              </button>
              <button
                type="button"
                class="ghost"
                (click)="removeChapter.emit(ch.id)"
                [attr.aria-label]="t('books.chapters.delete')"
              >
                ✕
              </button>
            </div>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      width: 240px;
      flex-shrink: 0;
      border-right: 1px solid var(--mc-border-default);
      padding: var(--mc-space-3);
      gap: var(--mc-space-2);
      overflow-y: auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header h3 {
      margin: 0;
      font-size: var(--mc-font-size-md);
      color: var(--mc-fg-muted);
    }
    .empty {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      margin: 0;
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--mc-space-1);
      padding: var(--mc-space-1) var(--mc-space-2);
      border-radius: var(--mc-radius-md);
    }
    .row:hover {
      background: var(--mc-bg-elevated);
    }
    .row.selected {
      background: var(--mc-bg-elevated);
      border-left: 3px solid var(--mc-accent-primary);
    }
    .title {
      flex: 1;
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      text-align: left;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ops {
      display: flex;
      gap: 2px;
    }
    .ghost {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: var(--mc-radius-sm);
    }
    .ghost:hover:not(:disabled) {
      color: var(--mc-fg-primary);
      background: var(--mc-bg-base);
    }
    .ghost:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .primary {
      background: var(--mc-accent-primary);
      color: var(--mc-bg-base);
      border: none;
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
    }
  `,
})
export class ChapterListComponent {
  readonly chapters = input.required<readonly ChapterSummary[]>();
  readonly activeId = input<string | null>(null);
  readonly editable = input<boolean>(true);
  readonly selectChapter = output<string>();
  readonly moveUp = output<string>();
  readonly moveDown = output<string>();
  readonly addChapter = output<void>();
  readonly removeChapter = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
