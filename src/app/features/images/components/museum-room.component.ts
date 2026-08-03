import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import { FRAME_WIDTH_PX, type FrameSize, getFrameLayout } from '@shared/utils/museum-asymmetry';

import type { GalleryImage } from '../models/gallery.types';
import { MuseumScene3dComponent } from './museum-scene-3d.component';

export type MuseumRoomMode = 'full' | 'preview';
export type MuseumRoomView = '3d' | 'list';

interface FrameView {
  readonly image: GalleryImage;
  readonly url: string;
  readonly width: number;
  readonly offsetY: number;
  readonly size: FrameSize;
  readonly label: string;
  readonly indexLabel: string;
}

@Component({
  selector: 'mc-museum-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MuseumScene3dComponent],
  templateUrl: './museum-room.component.html',
  styleUrl: './museum-room.component.css',
})
export class MuseumRoomComponent {
  readonly images = input.required<readonly GalleryImage[]>();
  readonly urls = input.required<Record<string, string>>();
  readonly cuartoIndex = input<number>(0);
  readonly cuartos = input<number>(1);
  readonly mode = input<MuseumRoomMode>('full');
  readonly editable = input<boolean>(true);

  readonly open = output<string>();
  readonly remove = output<string>();
  readonly addFiles = output<readonly File[]>();
  readonly nextCuarto = output<void>();
  readonly prevCuarto = output<void>();

  private readonly i18n = inject(I18nService);

  // why: preview cards (gallery index) never render the WebGL canvas — one
  //      context per card would be wasteful — so the toggle only exists in
  //      full mode. List view doubles as the keyboard/screen-reader fallback
  //      for the 3D room (§4.13): same buttons the 2D museum always had.
  protected readonly view = signal<MuseumRoomView>('3d');

  protected readonly hasPrev = computed(() => this.cuartoIndex() > 0);
  protected readonly hasNext = computed(() => this.cuartoIndex() < this.cuartos() - 1);
  protected readonly isEmpty = computed(() => this.images().length === 0);

  protected readonly frames = computed<readonly FrameView[]>(() => {
    const list = this.images();
    const urls = this.urls();
    const total = list.length;
    return list.map((image, i) => {
      const layout = getFrameLayout(image.id);
      return {
        image,
        url: urls[image.id] ?? '',
        width: FRAME_WIDTH_PX[layout.size],
        offsetY: layout.offsetY,
        size: layout.size,
        label: stripExt(image.originalName),
        indexLabel: this.t('images.museum.frameOfTotal', { n: i + 1, total }),
      };
    });
  });

  protected readonly cuartoLabel = computed(() =>
    this.t('images.museum.cuarto', { n: this.cuartoIndex() + 1, total: this.cuartos() }),
  );

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected onOpen(id: string): void {
    this.open.emit(id);
  }

  protected onRemove(event: Event, id: string): void {
    event.stopPropagation();
    this.remove.emit(id);
  }

  protected onRemoveId(id: string): void {
    this.remove.emit(id);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length > 0) this.addFiles.emit(images);
  }

  protected onPick(): void {
    const el = document.querySelector<HTMLInputElement>('mc-museum-room input[type="file"]');
    el?.click();
  }

  protected onPickerChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    const files = el.files ? Array.from(el.files) : [];
    if (files.length > 0) this.addFiles.emit(files);
    el.value = '';
  }

  protected onNext(): void {
    this.nextCuarto.emit();
  }
  protected onPrev(): void {
    this.prevCuarto.emit();
  }

  protected onSetView(view: MuseumRoomView): void {
    this.view.set(view);
  }
}

const stripExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};
