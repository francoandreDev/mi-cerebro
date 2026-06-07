import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { EditorComponent } from '@shared/editor/editor.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { Note } from '../models/note.types';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-note-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent, TagPickerComponent],
  template: `
    <header class="bar">
      <input
        type="text"
        class="title-input"
        [value]="note().title"
        [placeholder]="t('notes.placeholderTitle')"
        [attr.aria-label]="t('notes.placeholderTitle')"
        (input)="onTitleInput($event)"
      />
      <span class="status" [attr.data-status]="status()">{{ statusLabel() }}</span>
      <button type="button" class="danger" (click)="removeNote.emit()">
        {{ t('notes.delete') }}
      </button>
    </header>
    <mc-tag-picker
      [availableTags]="availableTags()"
      [selectedIds]="note().tags"
      (addTag)="addTag.emit($event)"
      (removeTag)="removeTag.emit($event)"
    />
    <mc-editor
      class="editor"
      [value]="note().body"
      [placeholder]="t('notes.placeholderBody')"
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
    .editor {
      flex: 1;
    }
  `,
})
export class NoteEditorPaneComponent {
  readonly note = input.required<Note>();
  readonly status = input<SaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();
  readonly removeNote = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected statusLabel(): string {
    return this.t(`notes.status.${this.status()}` as TranslationKey);
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
}
