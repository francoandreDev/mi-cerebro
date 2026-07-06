import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { FocusModeService } from '@core/focus-mode/focus-mode.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { EditorComponent } from '@shared/editor/editor.component';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { Writing } from '../models/writing.types';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-writing-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent, TagPickerComponent, IconComponent],
  template: `
    @if (!focusMode.active()) {
      <header class="bar">
        <mc-icon name="pen-nib" class="title-icon" />
        <input
          type="text"
          class="title-input"
          [value]="writing().title"
          [placeholder]="t('writings.placeholderTitle')"
          [attr.aria-label]="t('writings.placeholderTitle')"
          [readOnly]="!editable()"
          (input)="onTitleInput($event)"
        />
        <span class="status" [attr.data-status]="status()">
          <mc-icon
            [name]="statusIcon()"
            [class.mc-anim-spin]="status() === 'saving'"
            [class.mc-anim-pulse]="status() === 'unsaved'"
          />
          <span>{{ statusLabel() }}</span>
        </span>
        @if (editable()) {
          <button type="button" class="danger mc-hover-wiggle" (click)="removeWriting.emit()">
            <mc-icon name="trash" />
            <span>{{ t('writings.delete') }}</span>
          </button>
        }
      </header>
      <mc-tag-picker
        [availableTags]="availableTags()"
        [selectedIds]="writing().tags"
        [editable]="editable()"
        (addTag)="addTag.emit($event)"
        (removeTag)="removeTag.emit($event)"
      />
    }
    <mc-editor
      class="editor"
      [value]="writing().body"
      [placeholder]="t('writings.placeholderBody')"
      [editable]="editable()"
      [entityId]="writing().id"
      [entityTitle]="writing().title"
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
    .title-icon {
      color: var(--mc-accent-primary);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .danger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
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
export class WritingEditorPaneComponent {
  readonly writing = input.required<Writing>();
  readonly status = input<SaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly editable = input<boolean>(true);
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();
  readonly removeWriting = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  private readonly i18n = inject(I18nService);
  protected readonly focusMode = inject(FocusModeService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected statusLabel(): string {
    return this.t(`writings.status.${this.status()}` as TranslationKey);
  }
  protected statusIcon(): IconName {
    const s = this.status();
    if (s === 'saving') return 'spinner-gap';
    if (s === 'unsaved') return 'warning';
    return 'check';
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
}
