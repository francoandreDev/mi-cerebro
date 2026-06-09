import type { OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { ImageReaderService } from '@core/images/image-reader.service';

interface ThumbEntry {
  readonly galleryId: string;
  readonly imageId: string;
  readonly alt: string;
  readonly url: string;
}

// why: minimal modal that lets the user pick one image from any registered
//      gallery. Thumb URLs are created up-front for the active gallery and
//      revoked on destroy so we don't leak blob URLs across opens.
@Component({
  selector: 'mc-image-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="dismiss.emit()" role="presentation"></div>
    <div class="dialog" role="dialog" aria-modal="true">
      <header>
        <h3>{{ t('editor.imagePicker.title') }}</h3>
        <button type="button" class="ghost" (click)="dismiss.emit()" aria-label="Cerrar">✕</button>
      </header>
      @if (summaries().length === 0) {
        <p class="empty">{{ t('editor.imagePicker.empty') }}</p>
      } @else {
        <div class="layout">
          <ul class="galleries">
            @for (g of summaries(); track g.id) {
              <li>
                <button
                  type="button"
                  [class.selected]="g.id === activeId()"
                  (click)="onSelectGallery(g.id)"
                >
                  {{ g.title || t('editor.imagePicker.untitled') }}
                  <span class="count">{{ g.images.length }}</span>
                </button>
              </li>
            }
          </ul>
          <div class="thumbs">
            @if (thumbs().length === 0) {
              <p class="empty">{{ t('editor.imagePicker.galleryEmpty') }}</p>
            } @else {
              @for (t of thumbs(); track t.imageId) {
                <button
                  type="button"
                  class="thumb"
                  (click)="picked.emit({ galleryId: t.galleryId, imageId: t.imageId, alt: t.alt })"
                  [title]="t.alt"
                >
                  <img [src]="t.url" [alt]="t.alt" />
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
    }
    .dialog {
      position: relative;
      background: var(--mc-bg-base);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      width: min(720px, 92vw);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--mc-space-3);
      border-bottom: 1px solid var(--mc-border-default);
    }
    header h3 {
      margin: 0;
      font-size: var(--mc-font-size-md);
    }
    .ghost {
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--mc-fg-muted);
    }
    .empty {
      padding: var(--mc-space-4);
      color: var(--mc-fg-muted);
      text-align: center;
    }
    .layout {
      display: grid;
      grid-template-columns: 200px 1fr;
      flex: 1;
      overflow: hidden;
    }
    .galleries {
      list-style: none;
      padding: 0;
      margin: 0;
      overflow-y: auto;
      border-right: 1px solid var(--mc-border-default);
    }
    .galleries li button {
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      padding: var(--mc-space-2) var(--mc-space-3);
      cursor: pointer;
      color: var(--mc-fg-primary);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .galleries li button.selected {
      background: var(--mc-bg-elevated);
      border-left: 3px solid var(--mc-accent-primary);
    }
    .count {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
    }
    .thumbs {
      padding: var(--mc-space-3);
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: var(--mc-space-2);
      overflow-y: auto;
    }
    .thumb {
      padding: 0;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      cursor: pointer;
      aspect-ratio: 1;
      overflow: hidden;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class ImagePickerDialogComponent implements OnDestroy {
  readonly picked = output<{ galleryId: string; imageId: string; alt: string }>();
  readonly dismiss = output<void>();

  private readonly reader = inject(ImageReaderService);
  private readonly i18n = inject(I18nService);

  protected readonly summaries = this.reader.summaries;
  protected readonly activeId = signal<string | null>(null);
  protected readonly thumbs = signal<readonly ThumbEntry[]>([]);

  protected readonly initial = computed(() => {
    const first = this.summaries()[0];
    return first?.id ?? null;
  });

  constructor() {
    const id = this.initial();
    if (id) void this.loadGallery(id);
  }

  ngOnDestroy(): void {
    this.revokeAll();
  }

  protected t(key: Parameters<I18nService['t']>[0]): string {
    return this.i18n.t(key);
  }

  protected onSelectGallery(id: string): void {
    if (this.activeId() === id) return;
    void this.loadGallery(id);
  }

  private async loadGallery(id: string): Promise<void> {
    this.revokeAll();
    this.activeId.set(id);
    const gallery = this.reader.getGallery(id);
    if (!gallery) return;
    const entries: ThumbEntry[] = [];
    for (const img of gallery.images) {
      try {
        const blob =
          (await this.reader.readThumbBlob(id, img.id)) ??
          (await this.reader.readOriginalBlob(id, img.id));
        entries.push({
          galleryId: id,
          imageId: img.id,
          alt: img.originalName,
          url: URL.createObjectURL(blob),
        });
      } catch {
        /* skip missing */
      }
    }
    this.thumbs.set(entries);
  }

  private revokeAll(): void {
    for (const t of this.thumbs()) URL.revokeObjectURL(t.url);
    this.thumbs.set([]);
  }
}
