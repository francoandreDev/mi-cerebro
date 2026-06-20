import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { MenuButtonComponent, type MenuOption } from '@shared/menu-button/menu-button.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { FileCollection } from '../models/file-collection.types';

export type FileCollectionSaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-file-collection-meta-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagPickerComponent, MenuButtonComponent],
  template: `
    <mc-icon name="folder" class="title-icon" />
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
    >
      <mc-icon
        [name]="statusIcon()"
        [class.mc-anim-spin]="status() === 'saving'"
        [class.mc-anim-pulse]="status() === 'unsaved'"
      />
    </span>
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
    .title-icon {
      color: var(--mc-accent-primary);
      font-size: 1.3em;
      flex-shrink: 0;
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--mc-font-size-md);
      color: var(--mc-fg-muted);
      width: 1.2rem;
    }
    .status[data-status='saving'] {
      color: var(--mc-accent-primary);
    }
    .status[data-status='unsaved'] {
      color: var(--mc-fg-warning, #d97706);
    }
    .status[data-status='saved'] mc-icon {
      color: var(--mc-success, #4caf7a);
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
  protected statusIcon(): IconName {
    const s = this.status();
    if (s === 'saving') return 'spinner-gap';
    if (s === 'unsaved') return 'warning';
    return 'check';
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
