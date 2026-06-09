import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { GalleryImage } from '../models/gallery.types';

@Component({
  selector: 'mc-image-lightbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="backdrop"
      [attr.aria-label]="t('common.close')"
      (click)="dismiss.emit()"
    ></button>
    <div class="frame">
      @if (url(); as src) {
        <img [src]="src" [alt]="image().originalName" />
      }
      <div class="caption">
        <span>{{ image().originalName }}</span>
        <span class="meta">{{ image().width }} × {{ image().height }}</span>
      </div>
    </div>
    <button type="button" class="x" [attr.aria-label]="t('common.close')" (click)="dismiss.emit()">
      ✕
    </button>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 10;
      display: block;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    .x {
      position: absolute;
      top: var(--mc-space-3);
      right: var(--mc-space-3);
      background: transparent;
      border: 0;
      color: #fff;
      font-size: 1.5rem;
      cursor: pointer;
      z-index: 2;
    }
    .frame {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--mc-space-2);
      padding: var(--mc-space-4);
      pointer-events: none;
    }
    .frame img {
      max-width: 90vw;
      max-height: 80vh;
      object-fit: contain;
      border-radius: var(--mc-radius-md);
      pointer-events: auto;
    }
    .caption {
      color: #ddd;
      font-size: var(--mc-font-size-sm);
      display: flex;
      gap: var(--mc-space-3);
      pointer-events: auto;
    }
    .meta {
      color: #888;
    }
  `,
})
export class ImageLightboxComponent {
  readonly image = input.required<GalleryImage>();
  readonly url = input<string>('');
  readonly dismiss = output<void>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.dismiss.emit();
  }
}
