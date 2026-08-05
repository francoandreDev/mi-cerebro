import { Injectable } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import { IDB_STORES, type IdbStore } from './idb.types';

const DB_NAME = 'mc-app';
const DB_VERSION = 2;

@Injectable({ providedIn: 'root' })
export class IdbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async get<T>(store: IdbStore, key: string): Promise<T | undefined> {
    const db = await this.openDb();
    return this.runTx<T | undefined>(db, store, 'readonly', (s) => s.get(key));
  }

  async set<T>(store: IdbStore, key: string, value: T): Promise<void> {
    const db = await this.openDb();
    await this.runTx(db, store, 'readwrite', (s) => s.put(value, key));
  }

  async delete(store: IdbStore, key: string): Promise<void> {
    const db = await this.openDb();
    await this.runTx(db, store, 'readwrite', (s) => s.delete(key));
  }

  async keys(store: IdbStore): Promise<readonly string[]> {
    const db = await this.openDb();
    const raw = await this.runTx<IDBValidKey[]>(db, store, 'readonly', (s) => s.getAllKeys());
    return raw.map((k) => String(k));
  }

  async clear(store: IdbStore): Promise<void> {
    const db = await this.openDb();
    await this.runTx(db, store, 'readwrite', (s) => s.clear());
  }

  private openDb(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of IDB_STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(
          new AppError(ERROR_CODES.IDB_001, {
            severity: 'error',
            cause: req.error,
            recoverable: false,
          }),
        );
      req.onblocked = () =>
        reject(new AppError(ERROR_CODES.IDB_001, { severity: 'error', recoverable: false }));
    });
    return this.dbPromise;
  }

  private runTx<T>(
    db: IDBDatabase,
    store: IdbStore,
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = op(tx.objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      const fail = (cause: unknown) =>
        reject(
          new AppError(ERROR_CODES.IDB_002, {
            severity: 'error',
            cause,
            context: { store, mode },
          }),
        );
      req.onerror = () => fail(req.error);
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error);
    });
  }
}
