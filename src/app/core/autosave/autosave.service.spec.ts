import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IdbService } from '@core/idb/idb.service';
import type { DraftRecord } from '@core/idb/idb.types';

import { AutosaveService } from './autosave.service';

class IdbStub {
  readonly store = new Map<string, DraftRecord>();
  async set(_s: string, k: string, v: DraftRecord): Promise<void> {
    this.store.set(k, v);
  }
  async get<T>(_s: string, k: string): Promise<T | undefined> {
    return this.store.get(k) as T | undefined;
  }
  async delete(_s: string, k: string): Promise<void> {
    this.store.delete(k);
  }
  async keys(_s: string): Promise<readonly string[]> {
    return [...this.store.keys()];
  }
  async clear(_s: string): Promise<void> {
    this.store.clear();
  }
}

describe('AutosaveService', () => {
  let svc: AutosaveService;
  let idb: IdbStub;

  beforeEach(() => {
    vi.useFakeTimers();
    idb = new IdbStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: IdbService, useValue: idb }],
    });
    svc = TestBed.inject(AutosaveService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes draft after debounce window', async () => {
    svc.schedule('n1', 'note', () => ({ body: 'hello' }), 1000);
    await vi.advanceTimersByTimeAsync(999);
    expect(idb.store.has('n1')).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(idb.store.has('n1')).toBe(true);
    const rec = idb.store.get('n1');
    expect(rec?.kind).toBe('note');
    expect(rec?.payload).toEqual({ body: 'hello' });
  });

  it('debounces rapid schedule calls into one write', async () => {
    svc.schedule('n1', 'note', () => ({ v: 1 }), 1000);
    await vi.advanceTimersByTimeAsync(500);
    svc.schedule('n1', 'note', () => ({ v: 2 }), 1000);
    await vi.advanceTimersByTimeAsync(500);
    expect(idb.store.has('n1')).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(idb.store.get('n1')?.payload).toEqual({ v: 2 });
  });

  it('flush(id) writes immediately and cancels pending timer', async () => {
    svc.schedule('n1', 'note', () => ({ body: 'x' }), 5000);
    await svc.flush('n1');
    expect(idb.store.get('n1')?.payload).toEqual({ body: 'x' });
  });

  it('flushAll drains every pending draft', async () => {
    svc.schedule('a', 'note', () => 1, 5000);
    svc.schedule('b', 'task', () => 2, 5000);
    await svc.flushAll();
    expect(idb.store.size).toBe(2);
  });

  it('recover returns the persisted draft', async () => {
    svc.schedule('n1', 'note', () => 'payload', 0);
    await svc.flush('n1');
    const rec = await svc.recover<string>('n1');
    expect(rec?.payload).toBe('payload');
  });

  it('clear removes a draft and cancels its pending timer', async () => {
    svc.schedule('n1', 'note', () => 'x', 10000);
    await svc.clear('n1');
    expect(idb.store.has('n1')).toBe(false);
  });
});
