import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import * as THREE from 'three';

import { NgtArgs, extend } from 'angular-three';
import { getFrameLayout } from '@shared/utils/museum-asymmetry';

import type { GalleryImage } from '../models/gallery.types';
import {
  EYE_HEIGHT,
  FRAME_MAX_SIZE,
  ROOM_DEPTH,
  ROOM_HEIGHT,
  roomWidth,
} from './museum-scene.constants';

extend(THREE);

export interface PaintingView {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
}

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

const textureFor = (url: string): THREE.Texture => {
  let tex = textureCache.get(url);
  if (!tex) {
    tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, tex);
  }
  return tex;
};

@Component({
  selector: 'mc-museum-scene-contents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './museum-scene-contents.component.html',
})
export class MuseumSceneContentsComponent {
  readonly images = input.required<readonly GalleryImage[]>();
  readonly urls = input.required<Record<string, string>>();

  readonly open = output<string>();
  readonly hoverChange = output<string | null>();

  protected readonly Math = Math;
  protected readonly halfPi = Math.PI / 2;
  protected readonly halfPiNeg = -Math.PI / 2;
  protected readonly wallColor = '#e6dbc8';
  protected readonly floorColor = '#8c6c46';

  protected readonly width = computed(() => roomWidth(this.images().length));
  protected readonly depth = ROOM_DEPTH;
  protected readonly height = ROOM_HEIGHT;

  protected readonly paintings = computed<readonly PaintingView[]>(() => {
    const list = this.images();
    const urls = this.urls();
    const total = this.width();
    const spacing = total / Math.max(list.length, 1);
    const start = -total / 2 + spacing / 2;
    return list.map((image, i) => {
      const layout = getFrameLayout(image.id);
      const max = FRAME_MAX_SIZE[layout.size];
      const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 1;
      const w = ratio >= 1 ? max : max * ratio;
      const h = ratio >= 1 ? max / ratio : max;
      return {
        id: image.id,
        label: stripExt(image.originalName),
        url: urls[image.id] ?? '',
        x: start + i * spacing,
        y: EYE_HEIGHT + layout.offsetY / 60,
        z: -this.depth / 2 + 0.06,
        width: w,
        height: h,
      };
    });
  });

  protected textureFor(url: string): THREE.Texture | null {
    return url ? textureFor(url) : null;
  }

  protected onOpen(id: string): void {
    this.open.emit(id);
  }

  protected onEnter(id: string): void {
    this.hoverChange.emit(id);
  }

  protected onLeave(): void {
    this.hoverChange.emit(null);
  }
}

const stripExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};
