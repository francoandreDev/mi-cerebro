import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { MenuButtonComponent, type MenuOption } from '@shared/menu-button/menu-button.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { FileCollection } from '../models/file-collection.types';

export type FileCollectionSaveStatus = 'saved' | 'saving' | 'unsaved';

// why: stable per-collection accent colour so the binder spine identity
//      stays the same across reloads without persisting anything.
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const ACCENT_HUES = [12, 32, 96, 162, 200, 252, 302, 340] as const;

@Component({
  selector: 'mc-file-collection-meta-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagPickerComponent, MenuButtonComponent],
  template: `
    <div class="spine" [style.--mc-accent-hue]="accentHue() + 'deg'">
      <span class="accent" aria-hidden="true"></span>
      <div class="head">
        <mc-icon name="folder-open" class="folder-icon" />
        <input
          type="text"
          class="title-input"
          [value]="collection().title"
          [placeholder]="t('files.placeholderTitle')"
          [attr.aria-label]="t('files.placeholderTitle')"
          [readOnly]="!editable()"
          (input)="onTitleInput($event)"
        />
        <div class="actions">
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
            <span class="status-label">{{ statusLabel() }}</span>
          </span>
          @if (editable()) {
            <mc-menu-button
              variant="ghost"
              [label]="'⋯'"
              [options]="menuOptions()"
              (choose)="onMenuChoose($event)"
            />
          }
        </div>
      </div>
      @if (showTags()) {
        <mc-tag-picker
          class="tags"
          [availableTags]="availableTags()"
          [selectedIds]="collection().tags"
          [editable]="editable()"
          (addTag)="addTag.emit($event)"
          (removeTag)="removeTag.emit($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--mc-space-2) var(--mc-space-4) var(--mc-space-3);
    }
    .spine {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
      padding: var(--mc-space-3) var(--mc-space-4) var(--mc-space-3) calc(var(--mc-space-4) + 10px);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
    }
    .accent {
      position: absolute;
      top: 8px;
      bottom: 8px;
      left: 0;
      width: 6px;
      border-radius: 0 3px 3px 0;
      background: linear-gradient(
        180deg,
        hsl(var(--mc-accent-hue, 12deg) 70% 52%) 0%,
        hsl(var(--mc-accent-hue, 12deg) 70% 38%) 100%
      );
      box-shadow: 1px 0 2px rgba(0, 0, 0, 0.15);
    }
    .head {
      display: flex;
      align-items: center;
      gap: var(--mc-space-3);
    }
    .folder-icon {
      color: hsl(var(--mc-accent-hue, 12deg) 60% 45%);
      font-size: 1.25rem;
      flex-shrink: 0;
    }
    .title-input {
      flex: 1;
      min-width: 0;
      font-family: var(--mc-font-serif, 'Georgia', serif);
      font-size: var(--mc-font-size-lg);
      font-weight: 600;
      letter-spacing: -0.005em;
      background: transparent;
      border: none;
      color: var(--mc-fg-primary);
      padding: 2px 0;
    }
    .title-input::placeholder {
      color: var(--mc-fg-muted);
      font-weight: 400;
    }
    .title-input:focus {
      outline: none;
      box-shadow: inset 0 -1px 0 hsl(var(--mc-accent-hue, 12deg) 60% 50%);
    }
    .actions {
      display: inline-flex;
      align-items: center;
      gap: var(--mc-space-2);
      flex-shrink: 0;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: var(--mc-font-size-xs);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--mc-fg-muted);
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--mc-bg-surface);
      border: 1px solid var(--mc-border-default);
    }
    .status mc-icon {
      font-size: 0.9em;
    }
    .status-label {
      font-size: 10px;
    }
    .status[data-status='saving'] {
      color: var(--mc-accent-primary);
      border-color: color-mix(in srgb, var(--mc-accent-primary) 35%, transparent);
    }
    .status[data-status='unsaved'] {
      color: var(--mc-fg-warning, #d97706);
      border-color: color-mix(in srgb, var(--mc-fg-warning, #d97706) 35%, transparent);
    }
    .status[data-status='saved'] {
      color: var(--mc-success, #4caf7a);
      border-color: color-mix(in srgb, var(--mc-success, #4caf7a) 30%, transparent);
    }
    .tags {
      display: block;
      padding-top: var(--mc-space-1);
      border-top: 1px dashed var(--mc-border-default);
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

  protected readonly accentHue = computed(() => {
    const idx = hash(this.collection().id) % ACCENT_HUES.length;
    return ACCENT_HUES[idx] ?? ACCENT_HUES[0];
  });

  protected readonly showTags = computed(
    () => this.editable() || this.collection().tags.length > 0,
  );

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
