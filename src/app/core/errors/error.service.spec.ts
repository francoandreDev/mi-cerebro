import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { IdbService } from '@core/idb/idb.service';
import type { LoggedErrorRecord } from '@core/idb/idb.types';

import { AppError } from './app-error';
import { ERROR_CODES } from './error.codes';
import { ErrorService } from './error.service';

class IdbStub {
  readonly store = new Map<string, readonly LoggedErrorRecord[]>();
  async get<T>(_s: string, k: string): Promise<T | undefined> {
    return this.store.get(k) as T | undefined;
  }
  async set<T>(_s: string, k: string, v: T): Promise<void> {
    this.store.set(k, v as unknown as readonly LoggedErrorRecord[]);
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

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ErrorService', () => {
  let svc: ErrorService;
  let idb: IdbStub;

  beforeEach(() => {
    idb = new IdbStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: IdbService, useValue: idb }],
    });
    svc = TestBed.inject(ErrorService);
  });

  it('persists a reported error to the IndexedDB log', async () => {
    svc.report(new AppError(ERROR_CODES.SYS_001, { severity: 'warning' }));
    await flushMicrotasks();

    const log = await svc.recentLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.code).toBe(ERROR_CODES.SYS_001);
  });

  it('caps the log at 50 entries, dropping the oldest first', async () => {
    for (let i = 0; i < 55; i++) {
      svc.report(new AppError(ERROR_CODES.SYS_001, { severity: 'info', context: { i } }));
    }
    await flushMicrotasks();

    const log = await svc.recentLog();
    expect(log).toHaveLength(50);
    // recentLog() returns newest first — the oldest 5 (i=0..4) were dropped.
    expect(log[log.length - 1]?.context).toBe(JSON.stringify({ i: 5 }));
    expect(log[0]?.context).toBe(JSON.stringify({ i: 54 }));
  });

  it('does not throw when persisting fails', async () => {
    idb.set = () => Promise.reject(new Error('boom'));
    expect(() => svc.report(new AppError(ERROR_CODES.SYS_001, { severity: 'info' }))).not.toThrow();
    await flushMicrotasks();
  });
});
