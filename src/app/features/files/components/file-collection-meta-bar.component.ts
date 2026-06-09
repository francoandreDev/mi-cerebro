import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { MenuButtonComponent, type MenuOption } from '@shared/menu-button/menu-button.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { FileCollection } from '../models/file-collection.types';

export type FileCollectionSaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-file-collection-meta-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagPickerComponent, MenuButtonComponent],
  template: `
    <input
      type="text"
      class="title-input"
      [value]="collection().title"
      [placeholder]="t('files.placeholderTitle')"
      [attr.aria-label]="t('files.placeholderTitle')"
      [readOnly]="!editable()"
      (input)="onTitleInput($event)"
    />
    <mc-tag-picker
      class="tags"
      [availableTags]="availableTags()"
      [selectedIds]="collection().tags"
      [editable]="editable()"
      (addTag)="addTag.emit($event)"
      (removeTag)="removeTag.emit($event)"
    />
    <span
      class="status"
      [attr.data-status]="status()"
      [attr.aria-label]="statusLabel()"
      [title]="statusLabel()"
      >{{ statusGlyph() }}</span
    >
    @if (editable()) {
      <mc-menu-button
        variant="ghost"
        [label]="'⋯'"
        [options]="menuOptions()"
        (choose)="onMenuChoose($event)"
      />
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--mc-space-3);
      padding: var(--mc-space-3) var(--mc-space-4);
      border-bottom: 1px solid var(--mc-border-default);
    }
    .title-input {
      flex: 1;
      min-width: 0;
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
    .tags {
      flex-shrink: 0;
    }
    .status {
      font-size: var(--mc-font-size-md);
      color: var(--mc-fg-muted);
      width: 1.2rem;
      text-align: center;
    }
    .status[data-status='saving'] {
      color: var(--mc-accent-primary);
    }
    .status[data-status='unsaved'] {
      color: var(--mc-fg-warning, #d97706);
    }
  `,
})
export class FileCollectionMetaBarComponent {
  readonly collection = input.required<FileCollection>();
  readonly status = input<FileCollectionSaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly editable = input<boolean>(true);
  readonly titleChange = output<string>();
  readonly removeCollection = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected statusLabel(): string {
    return this.t(`files.status.${this.status()}` as TranslationKey);
  }
  protected statusGlyph(): string {
    const s = this.status();
    if (s === 'saving') return '↻';
    if (s === 'unsaved') return '●';
    return '✓';
  }
  protected menuOptions(): readonly MenuOption[] {
    return [{ key: 'delete', label: this.t('files.delete') }];
  }
  protected onMenuChoose(key: string): void {
    if (key === 'delete') this.removeCollection.emit();
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
}
