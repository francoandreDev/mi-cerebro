import { Injectable } from '@angular/core';

import type { NativeDirRef } from './native-fs.types';

// why: full IdbService lands in step 4; for now we only need the root handle,
//      so a tiny dedicated DB avoids pulling in idb-keyval until then.
const DB_NAME = 'mc-fs';
const STORE = 'handles';
const ROOT_KEY = 'root';

@Injectable({ providedIn: 'root' })
export class HandleStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async getRoot(): Promise<NativeDirRef | null> {
    const db = await this.openDb();
    return this.runTx<NativeDirRef | null>(db, 'readonly', (store) => store.get(ROOT_KEY));
  }

  async setRoot(handle: NativeDirRef): Promise<void> {
    const db = await this.openDb();
    await this.runTx(db, 'readwrite', (store) => store.put(handle, ROOT_KEY));
  }

  async clearRoot(): Promise<void> {
    const db = await this.openDb();
    await this.runTx(db, 'readwrite', (store) => store.delete(ROOT_KEY));
  }

  private openDb(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  private runTx<T>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }
}
