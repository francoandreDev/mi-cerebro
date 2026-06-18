import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { MenuButtonComponent, type MenuOption } from '@shared/menu-button/menu-button.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { Gallery } from '../models/gallery.types';

export type GallerySaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-gallery-meta-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TagPickerComponent, MenuButtonComponent],
  templateUrl: './gallery-meta-bar.component.html',
  styleUrl: './gallery-meta-bar.component.css',
})
export class GalleryMetaBarComponent {
  readonly gallery = input.required<Gallery>();
  readonly status = input<GallerySaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly editable = input<boolean>(true);
  readonly titleChange = output<string>();
  readonly removeGallery = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected statusLabel(): string {
    return this.t(`images.status.${this.status()}` as TranslationKey);
  }
  protected statusGlyph(): string {
    const s = this.status();
    if (s === 'saving') return '↻';
    if (s === 'unsaved') return '●';
    return '✓';
  }
  protected menuOptions(): readonly MenuOption[] {
    return [{ key: 'delete', label: this.t('images.delete') }];
  }
  protected onMenuChoose(key: string): void {
    if (key === 'delete') this.removeGallery.emit();
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
}
