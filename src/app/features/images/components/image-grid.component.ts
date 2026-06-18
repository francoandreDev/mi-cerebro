import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import { MC_INTERNAL_DND_TYPE, hasInternalDnd } from '@shared/utils/dnd';

import type { Gallery, GalleryImage } from '../models/gallery.types';

type Density = 'compact' | 'cozy' | 'large';

interface DensityOption {
  readonly value: Density;
  readonly glyph: string;
  readonly labelKey: TranslationKey;
}

@Component({
  selector: 'mc-image-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './image-grid.component.html',
  styleUrl: './image-grid.component.css',
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
  readonly reorder = output<{ from: string; to: string }>();

  protected readonly densityOptions: readonly DensityOption[] = [
    { value: 'compact', glyph: '▪', labelKey: 'images.images.density.compact' },
    { value: 'cozy', glyph: '▦', labelKey: 'images.images.density.cozy' },
    { value: 'large', glyph: '▣', labelKey: 'images.images.density.large' },
  ];

  protected readonly density = signal<Density>('cozy');

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly dragOverState = { value: false };
  protected dragOver(): boolean {
    return this.dragOverState.value;
  }

  protected setDensity(value: Density): void {
    this.density.set(value);
  }

  // why: cap ratio so panorámicas extremas no rompen el row y verticales finitas
  //      no se vuelven una cinta. Ratio 0 (sin dims) cae a 1.
  protected ratioFor(img: GalleryImage): number {
    if (img.width <= 0 || img.height <= 0) return 1;
    const r = img.width / img.height;
    return Math.min(3, Math.max(0.5, r));
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
    if (hasInternalDnd(event)) return;
    event.preventDefault();
    this.dragOverState.value = true;
  }
  protected onDragLeave(): void {
    this.dragOverState.value = false;
  }
  protected onDrop(event: DragEvent): void {
    if (hasInternalDnd(event)) return;
    event.preventDefault();
    this.dragOverState.value = false;
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length > 0) this.addFiles.emit(images);
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
