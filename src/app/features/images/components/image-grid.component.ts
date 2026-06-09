import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { Gallery, GalleryImage } from '../models/gallery.types';

@Component({
  selector: 'mc-image-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <h3>{{ t('images.images.title') }} ({{ gallery().images.length }})</h3>
      @if (editable()) {
        <div class="actions">
          <button type="button" class="primary" (click)="onPick()">
            + {{ t('images.images.add') }}
          </button>
        </div>
      }
    </header>
    @if (editable()) {
      <div
        class="dropzone"
        [class.over]="dragOver()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave()"
        (drop)="onDrop($event)"
      >
        {{ t('images.images.dropHint') }}
      </div>
      <input
        #picker
        type="file"
        accept="image/*"
        multiple
        hidden
        (change)="onPickerChange($event)"
      />
    }
    @if (orderedImages().length === 0) {
      <p class="empty">{{ t('images.images.empty') }}</p>
    } @else {
      <ul class="grid">
        @for (img of orderedImages(); track img.id; let i = $index) {
          <li class="cell">
            <button type="button" class="thumb" (click)="open.emit(img.id)">
              @if (urls()[img.id]; as url) {
                <img [src]="url" [alt]="img.originalName" />
              } @else {
                <span class="placeholder">…</span>
              }
            </button>
            @if (editable()) {
              <div class="ops">
                <button
                  type="button"
                  class="ghost"
                  [disabled]="i === 0"
                  (click)="moveUp.emit(img.id)"
                  [attr.aria-label]="t('images.images.moveUp')"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="ghost"
                  [disabled]="i === orderedImages().length - 1"
                  (click)="moveDown.emit(img.id)"
                  [attr.aria-label]="t('images.images.moveDown')"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="ghost"
                  (click)="remove.emit(img.id)"
                  [attr.aria-label]="t('images.images.delete')"
                >
                  ✕
                </button>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: var(--mc-space-3);
      gap: var(--mc-space-3);
      overflow-y: auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header h3 {
      margin: 0;
      font-size: var(--mc-font-size-md);
      color: var(--mc-fg-muted);
    }
    .primary {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      border: none;
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
    }
    .dropzone {
      border: 1px dashed var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      padding: var(--mc-space-3);
      color: var(--mc-fg-muted);
      text-align: center;
      font-size: var(--mc-font-size-sm);
    }
    .dropzone.over {
      border-color: var(--mc-accent-primary);
      color: var(--mc-accent-primary);
      background: var(--mc-bg-elevated);
    }
    .empty {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      margin: 0;
    }
    .grid {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--mc-space-3);
    }
    .cell {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .thumb {
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      padding: 0;
      cursor: pointer;
      width: 100%;
      aspect-ratio: 1;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .placeholder {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-lg);
    }
    .ops {
      display: flex;
      justify-content: center;
      gap: 2px;
    }
    .ghost {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: var(--mc-radius-sm);
    }
    .ghost:hover:not(:disabled) {
      color: var(--mc-fg-primary);
      background: var(--mc-bg-base);
    }
    .ghost:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  `,
})
export class ImageGridComponent {
  readonly gallery = input.required<Gallery>();
  readonly urls = input.required<Record<string, string>>();
  readonly editable = input<boolean>(true);
  readonly addFiles = output<readonly File[]>();
  readonly open = output<string>();
  readonly remove = output<string>();
  readonly moveUp = output<string>();
  readonly moveDown = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly dragOverState = { value: false };
  protected dragOver(): boolean {
    return this.dragOverState.value;
  }

  protected orderedImages(): readonly GalleryImage[] {
    const g = this.gallery();
    const byId = new Map(g.images.map((i) => [i.id, i] as const));
    const ordered: GalleryImage[] = [];
    for (const id of g.order) {
      const img = byId.get(id);
      if (img) {
        ordered.push(img);
        byId.delete(id);
      }
    }
    for (const img of byId.values()) ordered.push(img);
    return ordered;
  }

  protected onPick(): void {
    const input = document.querySelector<HTMLInputElement>('mc-image-grid input[type="file"]');
    input?.click();
  }

  protected onPickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) this.addFiles.emit(files);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOverState.value = true;
  }
  protected onDragLeave(): void {
    this.dragOverState.value = false;
  }
  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOverState.value = false;
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length > 0) this.addFiles.emit(images);
  }
}
