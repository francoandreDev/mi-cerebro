import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import type * as THREE from 'three';
import type { NgtState } from 'angular-three';
import { NgtCanvas } from 'angular-three/dom';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { GalleryImage } from '../models/gallery.types';
import { MuseumSceneContentsComponent } from './museum-scene-contents.component';
import {
  EYE_HEIGHT,
  LOOK_SENSITIVITY,
  MAX_PITCH,
  ROOM_DEPTH,
  ROOM_MARGIN,
  WALK_SPEED,
  roomWidth,
} from './museum-scene.constants';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const DRAG_CLICK_THRESHOLD_PX = 6;

@Component({
  selector: 'mc-museum-scene-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgtCanvas, MuseumSceneContentsComponent],
  templateUrl: './museum-scene-3d.component.html',
  styleUrl: './museum-scene-3d.component.css',
})
export class MuseumScene3dComponent {
  readonly images = input.required<readonly GalleryImage[]>();
  readonly urls = input.required<Record<string, string>>();
  readonly editable = input<boolean>(true);

  readonly open = output<string>();
  readonly remove = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  protected readonly cameraConfig = {
    position: [0, EYE_HEIGHT, ROOM_DEPTH / 2 - 0.6] as [number, number, number],
    fov: 62,
  };

  protected readonly hoveredId = signal<string | null>(null);
  protected readonly hoveredLabel = computed(() => {
    const id = this.hoveredId();
    if (!id) return '';
    return this.images().find((i) => i.id === id)?.originalName ?? '';
  });

  private camera: THREE.Camera | null = null;
  private readonly keys = new Set<string>();
  private dragging = false;
  private dragDistance = 0;
  private lastPointer = { x: 0, y: 0 };
  private yaw = Math.PI;
  private pitch = 0;
  private rafId = 0;
  private lastFrameAt = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopLoop());
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onCreated(state: NgtState): void {
    this.camera = state.camera;
    this.applyCameraLook();
    this.startLoop();
  }

  protected onOpen(id: string): void {
    if (this.dragDistance > DRAG_CLICK_THRESHOLD_PX) return;
    this.open.emit(id);
  }

  protected onHover(id: string | null): void {
    this.hoveredId.set(id);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (MOVE_KEYS.has(key)) {
      this.keys.add(key);
      event.preventDefault();
      return;
    }
    if ((key === 'delete' || key === 'backspace') && this.editable() && this.hoveredId()) {
      event.preventDefault();
      this.remove.emit(this.hoveredId() as string);
    }
  }

  protected onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.key.toLowerCase());
  }

  protected onPointerDown(event: PointerEvent): void {
    this.dragging = true;
    this.dragDistance = 0;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.host().nativeElement.setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.dragDistance += Math.abs(dx) + Math.abs(dy);
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = clamp(this.pitch - dy * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
  }

  protected onPointerUp(event: PointerEvent): void {
    this.dragging = false;
    this.host().nativeElement.releasePointerCapture(event.pointerId);
  }

  private startLoop(): void {
    this.lastFrameAt = performance.now();
    const tick = (now: number): void => {
      const dt = clamp((now - this.lastFrameAt) / 1000, 0, 0.1);
      this.lastFrameAt = now;
      this.stepMovement(dt);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private stepMovement(dt: number): void {
    const camera = this.camera;
    if (!camera) return;
    const { forward, strafe } = this.readMoveAxes();
    if (forward !== 0 || strafe !== 0) this.moveCamera(camera, forward, strafe, dt);
    this.applyCameraLook();
  }

  private readMoveAxes(): { forward: number; strafe: number } {
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) forward += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) forward -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) strafe += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) strafe -= 1;
    return { forward, strafe };
  }

  private moveCamera(camera: THREE.Camera, forward: number, strafe: number, dt: number): void {
    const len = Math.hypot(forward, strafe) || 1;
    const nForward = forward / len;
    const nStrafe = strafe / len;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const dx = (fx * nForward + rx * nStrafe) * WALK_SPEED * dt;
    const dz = (fz * nForward + rz * nStrafe) * WALK_SPEED * dt;
    const halfWidth = roomWidth(this.images().length) / 2 - ROOM_MARGIN / 2;
    const halfDepth = ROOM_DEPTH / 2 - 0.5;
    camera.position.x = clamp(camera.position.x + dx, -halfWidth, halfWidth);
    camera.position.z = clamp(camera.position.z + dz, -halfDepth, halfDepth);
  }

  private applyCameraLook(): void {
    if (!this.camera) return;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
