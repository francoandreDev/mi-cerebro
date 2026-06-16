import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { EntityKind } from '@core/search/search.types';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';

const URL_SEGMENT_TO_KIND: Readonly<Record<string, EntityKind>> = {
  notes: 'note',
  tasks: 'task',
  goals: 'goal',
  lists: 'list',
  writings: 'writing',
  books: 'book',
  images: 'image',
  files: 'file',
  reminders: 'reminder',
};

export interface CreationRequest {
  readonly kind: EntityKind;
  readonly requestedAt: number;
}

@Injectable({ providedIn: 'root' })
export class CreationIntentService {
  private readonly router = inject(Router);
  private readonly shortcuts = inject(ShortcutsService);

  private readonly requestedSignal = signal<CreationRequest | null>(null);
  readonly requestedCreate = computed(() => this.requestedSignal());

  constructor() {
    const dispose = this.shortcuts.register({
      combo: 'Ctrl+N',
      labelKey: 'shortcuts.create',
      scope: 'global',
      handler: () => this.requestFromUrl(),
    });
    inject(DestroyRef).onDestroy(dispose);
  }

  request(kind: EntityKind): void {
    this.requestedSignal.set({ kind, requestedAt: Date.now() });
  }

  private requestFromUrl(): void {
    const first = this.router.url.split('?')[0]?.split('#')[0]?.split('/').filter(Boolean)[0];
    if (!first) return;
    const kind = URL_SEGMENT_TO_KIND[first];
    if (!kind) return;
    this.request(kind);
  }
}
