import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsLockService } from '@core/fs/fs-lock.service';
import { IdbService } from '@core/idb/idb.service';
import type { DraftRecord } from '@core/idb/idb.types';

import {
  DEFAULT_DEBOUNCE_MS,
  type AutosaveOptions,
  type DraftPayloadFactory,
  type OnFlushFn,
} from './autosave.types';

interface PendingEntry<P> {
  readonly kind: string;
  readonly factory: DraftPayloadFactory<P>;
  readonly onFlush: OnFlushFn<P> | undefined;
  timer: ReturnType<typeof setTimeout> | null;
}

@Injectable({ providedIn: 'root' })
export class AutosaveService {
  private readonly idb = inject(IdbService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fsLock = inject(FsLockService);

  private readonly pending = new Map<string, PendingEntry<unknown>>();

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationStart => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.flushAll());

    if (typeof document !== 'undefined') {
      const onHidden = () => {
        if (document.visibilityState === 'hidden') void this.flushAll();
      };
      const onBeforeUnload = () => void this.flushAll();
      document.addEventListener('visibilitychange', onHidden);
      window.addEventListener('beforeunload', onBeforeUnload);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('visibilitychange', onHidden);
        window.removeEventListener('beforeunload', onBeforeUnload);
      });
    }
  }

  schedule<P>(
    id: string,
    kind: string,
    factory: DraftPayloadFactory<P>,
    optionsOrDebounce: AutosaveOptions<P> | number = DEFAULT_DEBOUNCE_MS,
  ): void {
    const options: AutosaveOptions<P> =
      typeof optionsOrDebounce === 'number' ? { debounceMs: optionsOrDebounce } : optionsOrDebounce;
    const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

    const existing = this.pending.get(id);
    if (existing?.timer) clearTimeout(existing.timer);

    const entry: PendingEntry<P> = {
      kind,
      factory,
      onFlush: options.onFlush,
      timer: setTimeout(() => void this.flush(id), debounceMs),
    };
    this.pending.set(id, entry as PendingEntry<unknown>);
  }

  async flush(id: string): Promise<void> {
    const entry = this.pending.get(id);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.pending.delete(id);

    const payload = entry.factory();
    const record: DraftRecord = {
      id,
      kind: entry.kind,
      payload,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.idb.set('drafts', id, record);
    } catch (cause) {
      throw new AppError(ERROR_CODES.AUT_001, {
        severity: 'warning',
        cause,
        context: { id, kind: entry.kind },
        recoverable: true,
      });
    }

    // why: onFlush typically writes the entity JSON to the FS Access
    //      workspace. Serialize via FsLockService so it doesn't race
    //      with autocommit (which reads + writes .git/ under the same
    //      handle). The IDB draft above doesn't need the lock.
    if (entry.onFlush) {
      const cb = entry.onFlush;
      await this.fsLock.withLock(async () => {
        await cb(payload);
      });
    }
  }

  async flushAll(): Promise<void> {
    const ids = [...this.pending.keys()];
    await Promise.allSettled(ids.map((id) => this.flush(id)));
  }

  async recover<P>(id: string): Promise<DraftRecord<P> | undefined> {
    try {
      return await this.idb.get<DraftRecord<P>>('drafts', id);
    } catch (cause) {
      throw new AppError(ERROR_CODES.AUT_002, {
        severity: 'warning',
        cause,
        context: { id },
        recoverable: true,
      });
    }
  }

  async list(): Promise<readonly string[]> {
    return this.idb.keys('drafts');
  }

  async clear(id: string): Promise<void> {
    const entry = this.pending.get(id);
    if (entry?.timer) clearTimeout(entry.timer);
    this.pending.delete(id);
    await this.idb.delete('drafts', id);
  }
}
