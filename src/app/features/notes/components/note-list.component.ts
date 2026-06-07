import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { NoteSummary } from '../models/note.types';

@Component({
  selector: 'mc-note-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <h2 class="title">{{ t('notes.title') }}</h2>
      <button type="button" class="primary" (click)="create.emit()">
        {{ t('notes.new') }}
      </button>
    </header>
    @if (notes().length === 0) {
      <p class="empty">{{ t('notes.empty') }}</p>
    } @else {
      <ul class="list" role="listbox" [attr.aria-label]="t('notes.title')">
        @for (n of notes(); track n.id) {
          <li
            class="row"
            role="option"
            [attr.aria-selected]="n.id === selectedId()"
            [class.selected]="n.id === selectedId()"
            (click)="chooseNote.emit(n.id)"
            (keydown.enter)="chooseNote.emit(n.id)"
            tabindex="0"
          >
            <span class="row-title">{{ n.title || t('notes.untitledTitle') }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      width: 280px;
      border-right: 1px solid var(--mc-border-default);
      background: var(--mc-bg-surface);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--mc-space-3);
      border-bottom: 1px solid var(--mc-border-default);
    }
    .title {
      font-size: var(--mc-font-size-lg);
      margin: 0;
    }
    .primary {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      font-weight: 600;
    }
    .empty {
      padding: var(--mc-space-4);
      color: var(--mc-fg-muted);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-y: auto;
    }
    .row {
      padding: var(--mc-space-2) var(--mc-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--mc-border-subtle, transparent);
    }
    .row:hover {
      background: var(--mc-bg-elevated);
    }
    .row.selected {
      background: var(--mc-bg-elevated);
      border-left: 3px solid var(--mc-accent-primary);
    }
    .row-title {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class NoteListComponent {
  readonly notes = input.required<readonly NoteSummary[]>();
  readonly selectedId = input<string | null>(null);
  readonly chooseNote = output<string>();
  readonly create = output<void>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
