import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { MC_INTERNAL_DND_TYPE, hasInternalDnd } from '@shared/utils/dnd';

import {
  formatBytes,
  iconForMime,
  type FileCollection,
  type FileItem,
} from '../models/file-collection.types';

@Component({
  selector: 'mc-file-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <h3>{{ t('files.items.title') }} ({{ collection().items.length }})</h3>
      @if (editable()) {
        <div class="actions">
          <button type="button" class="primary" (click)="onPick()">
            + {{ t('files.items.add') }}
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
        {{ t('files.items.dropHint') }}
      </div>
      <input #picker type="file" multiple hidden (change)="onPickerChange($event)" />
    }
    @if (orderedItems().length === 0) {
      <p class="empty">{{ t('files.items.empty') }}</p>
    } @else {
      <ul class="grid">
        @for (item of orderedItems(); track item.id; let i = $index) {
          <li
            class="cell"
            [class.drop-target]="dropTargetId() === item.id"
            [class.dragging]="draggingId() === item.id"
            [attr.draggable]="editable() ? true : null"
            (dragstart)="onItemDragStart($event, item.id)"
            (dragover)="onItemDragOver($event, item.id)"
            (dragleave)="onItemDragLeave(item.id)"
            (drop)="onItemDrop($event, item.id)"
            (dragend)="onItemDragEnd()"
          >
            <button type="button" class="card" (click)="download.emit(item.id)">
              @if (previewFor(item); as preview) {
                @if (preview.kind === 'image') {
                  <img class="preview" [src]="preview.url" [alt]="item.originalName" />
                } @else if (preview.kind === 'pdf') {
                  <embed class="preview pdf" [src]="preview.url" type="application/pdf" />
                }
              } @else {
                <span class="icon" aria-hidden="true">{{ iconFor(item) }}</span>
              }
              <span class="name" [title]="item.originalName">{{ item.originalName }}</span>
              <span class="bytes">{{ formatSize(item.bytes) }}</span>
            </button>
            @if (editable()) {
              <div class="ops">
                <button
                  type="button"
                  class="ghost"
                  [disabled]="i === 0"
                  (click)="moveUp.emit(item.id)"
                  [attr.aria-label]="t('files.items.moveUp')"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="ghost"
                  [disabled]="i === orderedItems().length - 1"
                  (click)="moveDown.emit(item.id)"
                  [attr.aria-label]="t('files.items.moveDown')"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="ghost"
                  (click)="remove.emit(item.id)"
                  [attr.aria-label]="t('files.items.delete')"
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
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--mc-space-3);
    }
    .cell {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .cell[draggable='true'] {
      cursor: grab;
    }
    .cell.dragging {
      opacity: 0.4;
    }
    .cell.drop-target > .card {
      outline: 2px solid var(--mc-accent-primary);
      outline-offset: 2px;
    }
    .card {
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      padding: var(--mc-space-3);
      cursor: pointer;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
      align-items: center;
      text-align: center;
      color: var(--mc-fg-primary);
    }
    .card:hover {
      border-color: var(--mc-accent-primary);
    }
    .icon {
      font-size: 2rem;
      line-height: 1;
    }
    .preview {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: var(--mc-radius-sm);
      background: var(--mc-bg-base);
      pointer-events: none;
    }
    .preview.pdf {
      object-fit: contain;
    }
    .name {
      width: 100%;
      font-size: var(--mc-font-size-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bytes {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
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
export class FileGridComponent {
  readonly collection = input.required<FileCollection>();
  readonly previews = input<Record<string, string>>({});
  readonly editable = input<boolean>(true);
  readonly addFiles = output<readonly File[]>();
  readonly download = output<string>();
  readonly remove = output<string>();
  readonly moveUp = output<string>();
  readonly moveDown = output<string>();
  readonly reorder = output<{ from: string; to: string }>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly dragOverState = { value: false };
  protected dragOver(): boolean {
    return this.dragOverState.value;
  }

  protected orderedItems(): readonly FileItem[] {
    const c = this.collection();
    const byId = new Map(c.items.map((i) => [i.id, i] as const));
    const ordered: FileItem[] = [];
    for (const id of c.order) {
      const item = byId.get(id);
      if (item) {
        ordered.push(item);
        byId.delete(id);
      }
    }
    for (const item of byId.values()) ordered.push(item);
    return ordered;
  }

  protected iconFor(item: FileItem): string {
    return iconForMime(item.mime, item.originalName);
  }

  protected previewFor(item: FileItem): { kind: 'image' | 'pdf'; url: string } | null {
    const url = this.previews()[item.id];
    if (!url) return null;
    if (item.mime.startsWith('image/')) return { kind: 'image', url };
    if (item.mime === 'application/pdf') return { kind: 'pdf', url };
    return null;
  }

  protected formatSize(bytes: number): string {
    return formatBytes(bytes);
  }

  protected onPick(): void {
    const input = document.querySelector<HTMLInputElement>('mc-file-grid input[type="file"]');
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
    if (files.length > 0) this.addFiles.emit(files);
  }

  protected readonly draggingId = signal<string | null>(null);
  protected readonly dropTargetId = signal<string | null>(null);

  protected onItemDragStart(event: DragEvent, id: string): void {
    if (!this.editable() || !event.dataTransfer) return;
    event.dataTransfer.setData(MC_INTERNAL_DND_TYPE, id);
    event.dataTransfer.effectAllowed = 'move';
    this.draggingId.set(id);
  }
  protected onItemDragOver(event: DragEvent, id: string): void {
    if (!this.editable() || !event.dataTransfer) return;
    if (!hasInternalDnd(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (this.dropTargetId() !== id) this.dropTargetId.set(id);
  }
  protected onItemDragLeave(id: string): void {
    if (this.dropTargetId() === id) this.dropTargetId.set(null);
  }
  protected onItemDrop(event: DragEvent, to: string): void {
    if (!this.editable() || !event.dataTransfer) return;
    const from = event.dataTransfer.getData(MC_INTERNAL_DND_TYPE);
    if (!from) return;
    event.preventDefault();
    event.stopPropagation();
    this.dropTargetId.set(null);
    this.draggingId.set(null);
    if (from !== to) this.reorder.emit({ from, to });
  }
  protected onItemDragEnd(): void {
    this.draggingId.set(null);
    this.dropTargetId.set(null);
  }
}
