import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { EditorComponent } from '@shared/editor/editor.component';

import type { Chapter } from '../models/book.types';
import type { BookSaveStatus } from './book-meta-bar.component';

@Component({
  selector: 'mc-chapter-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent],
  template: `
    <header class="bar">
      <input
        type="text"
        class="title-input"
        [value]="chapter().title"
        [placeholder]="t('books.chapters.placeholderTitle')"
        [attr.aria-label]="t('books.chapters.placeholderTitle')"
        [readOnly]="!editable()"
        (input)="onTitleInput($event)"
      />
      <span class="status" [attr.data-status]="status()">{{ statusLabel() }}</span>
    </header>
    <mc-editor
      class="editor"
      [value]="chapter().body"
      [placeholder]="t('books.chapters.placeholderBody')"
      [editable]="editable()"
      (valueChange)="bodyChange.emit($event)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      padding: var(--mc-space-4);
      gap: var(--mc-space-3);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--mc-space-3);
    }
    .title-input {
      flex: 1;
      font-size: var(--mc-font-size-lg);
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
    .editor {
      flex: 1;
    }
  `,
})
export class ChapterEditorPaneComponent {
  readonly chapter = input.required<Chapter>();
  readonly status = input<BookSaveStatus>('saved');
  readonly editable = input<boolean>(true);
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();

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
