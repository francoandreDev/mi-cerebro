import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { Book } from '../models/book.types';

export type BookSaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-book-meta-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagPickerComponent],
  template: `
    <header class="bar">
      <input
        type="text"
        class="title-input"
        [value]="book().title"
        [placeholder]="t('books.placeholderTitle')"
        [attr.aria-label]="t('books.placeholderTitle')"
        [readOnly]="!editable()"
        (input)="onTitleInput($event)"
      />
      <span class="status" [attr.data-status]="status()">{{ statusLabel() }}</span>
      @if (editable()) {
        <button type="button" class="danger" (click)="removeBook.emit()">
          {{ t('books.delete') }}
        </button>
      }
    </header>
    <mc-tag-picker
      [availableTags]="availableTags()"
      [selectedIds]="book().tags"
      [editable]="editable()"
      (addTag)="addTag.emit($event)"
      (removeTag)="removeTag.emit($event)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-3);
      padding: var(--mc-space-4) var(--mc-space-4) 0;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--mc-space-3);
    }
    .title-input {
      flex: 1;
      font-size: var(--mc-font-size-xl);
      background: transparent;
      border: none;
      color: var(--mc-fg-primary);
      padding: var(--mc-space-1) 0;
    }
    .title-input:focus {
      outline: none;
      border-bottom: 1px solid var(--mc-accent-primary);
    }
    .status {
      font-size: var(--mc-font-size-sm);
      color: var(--mc-fg-muted);
    }
    .status[data-status='saving'] {
      color: var(--mc-accent-primary);
    }
    .status[data-status='unsaved'] {
      color: var(--mc-fg-warning, #d97706);
    }
    .danger {
      background: transparent;
      color: var(--mc-fg-muted);
      border: 1px solid var(--mc-border-default);
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-md);
    }
    .danger:hover {
      color: var(--mc-fg-primary);
      border-color: var(--mc-accent-primary);
    }
  `,
})
export class BookMetaBarComponent {
  readonly book = input.required<Book>();
  readonly status = input<BookSaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly editable = input<boolean>(true);
  readonly titleChange = output<string>();
  readonly removeBook = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected statusLabel(): string {
    return this.t(`books.status.${this.status()}` as TranslationKey);
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
}
