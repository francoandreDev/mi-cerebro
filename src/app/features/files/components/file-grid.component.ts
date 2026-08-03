import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import { MC_INTERNAL_DND_TYPE, hasInternalDnd } from '@shared/utils/dnd';

import type { FileCollection, FileItem } from '../models/file-collection.types';
import { FileArtifactComponent, type FilePreview, hash } from './file-artifact.component';

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

interface FreeDragState {
  readonly id: string;
  readonly ox: number;
  readonly oy: number;
  readonly sx: number;
  readonly sy: number;
  readonly w: number;
  readonly h: number;
  moved: boolean;
}

@Component({
  selector: 'mc-file-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FileArtifactComponent],
  templateUrl: './file-grid.component.html',
  styleUrl: './file-grid.component.css',
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
  readonly rename = output<{ id: string; name: string }>();
  readonly toggleFreeLayout = output<boolean>();
  readonly itemMove = output<{ id: string; x: number; y: number }>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly orderedItems = computed<readonly FileItem[]>(() => {
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
  });

  // why: with very few items the cork board looks empty; tilt only when there
  //      are enough items to read as a real collage.
  protected readonly applyJitter = computed(() => this.orderedItems().length >= 3);

  protected previewFor(item: FileItem): FilePreview | null {
    const url = this.previews()[item.id];
    if (!url) return null;
    if (item.mime.startsWith('image/')) return { kind: 'image', url };
    if (item.mime === 'application/pdf') return { kind: 'pdf', url };
    return null;
  }

  protected readonly dragOver = signal(false);
  protected readonly draggingId = signal<string | null>(null);
  protected readonly dropTargetId = signal<string | null>(null);

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
    this.dragOver.set(true);
  }
  protected onDragLeave(): void {
    this.dragOver.set(false);
  }
  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
    if (files.length > 0) this.addFiles.emit(files);
  }

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

  protected readonly freeBoardRef = viewChild<ElementRef<HTMLElement>>('freeBoardEl');
  protected readonly dragPos = signal<{ id: string; x: number; y: number } | null>(null);
  private dragState: FreeDragState | null = null;

  protected onToggleFreeLayout(): void {
    this.toggleFreeLayout.emit(!this.collection().freeLayout);
  }

  // why: undragged items get a deterministic hash-based scatter so free mode
  //      never stacks everything at 0,0 — mirrors the jitter-grid precedent.
  protected positionFor(item: FileItem): { x: number; y: number } {
    const dragged = this.dragPos();
    if (dragged && dragged.id === item.id) return dragged;
    if (item.x !== undefined && item.y !== undefined) return { x: item.x, y: item.y };
    const h = hash(item.id);
    const x = 8 + ((h & 0xff) / 255) * 80;
    const y = 8 + (((h >> 8) & 0xff) / 255) * 80;
    return { x, y };
  }

  protected onItemPointerDown(event: PointerEvent, item: FileItem): void {
    if (!this.editable()) return;
    const board = this.freeBoardRef()?.nativeElement;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const pos = this.positionFor(item);
    this.dragState = {
      id: item.id,
      ox: pos.x,
      oy: pos.y,
      sx: event.clientX,
      sy: event.clientY,
      w: rect.width,
      h: rect.height,
      moved: false,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onItemPointerMove(event: PointerEvent): void {
    const d = this.dragState;
    if (!d) return;
    const dx = event.clientX - d.sx;
    const dy = event.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const x = clamp(d.ox + (dx / d.w) * 100, 3, 97);
    const y = clamp(d.oy + (dy / d.h) * 100, 3, 97);
    this.dragPos.set({ id: d.id, x, y });
  }

  protected onItemPointerUp(): void {
    const d = this.dragState;
    this.dragState = null;
    if (!d) return;
    const pos = this.dragPos();
    this.dragPos.set(null);
    if (d.moved && pos) this.itemMove.emit({ id: d.id, x: pos.x, y: pos.y });
  }
}
