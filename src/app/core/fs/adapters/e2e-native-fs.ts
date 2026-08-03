import { Injectable } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { NativeFs, NativeFsStat } from '../native-fs';
import type { PermissionState } from '../fs.types';
import { isPathRef, type NativeDirRef, type PathDirRef } from '../native-fs.types';
import { classifyFsError } from './native-fs-errors';

// why: variants.io.ts's isNotFound() (and any other adapter-agnostic
//      "was this a missing file or a corrupt one" check) narrows on
//      `DOMException('...', 'NotFoundError')` — the shape every real
//      adapter's underlying API throws for a missing entry. Without this,
//      a fresh e2e workspace with no variants.json yet would surface as
//      "corrupt file" (MCB-VER-006) instead of silently falling back to
//      defaults, same class of bug the real adapters don't have.
function notFound(name: string): DOMException {
  return new DOMException(`not found: ${name}`, 'NotFoundError');
}

// why: e2e-only adapter (see native-fs.providers.ts, gated behind
//      `window.__E2E_FS__`) so Playwright smoke tests never hit the real
//      showDirectoryPicker() — there's no way to automate a native OS
//      dialog. Mirrors CapacitorNativeFs's PathDirRef + fixed-root
//      approach (no picker, auto-adopt) instead of BrowserNativeFs's
//      FsDirectoryHandle approach, since PathDirRef is plain data and
//      round-trips through HandleStore's IndexedDB fine.
const E2E_ROOT = '/e2e-root';

interface FsNode {
  kind: 'file' | 'dir';
  content: string | Blob | ArrayBuffer;
  mtimeMs: number;
  children: Set<string>;
}

function makeDirNode(): FsNode {
  return { kind: 'dir', content: '', mtimeMs: Date.now(), children: new Set() };
}

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function toPathRef(path: string): PathDirRef {
  return { kind: 'path', path, name: basename(path) };
}

function assertPathRef(ref: NativeDirRef): PathDirRef {
  if (!isPathRef(ref)) {
    throw new AppError(ERROR_CODES.FS_007, {
      severity: 'fatal',
      context: { reason: 'E2eNativeFs received a browser handle ref' },
    });
  }
  return ref;
}

async function toText(content: string | Blob | ArrayBuffer): Promise<string> {
  if (typeof content === 'string') return content;
  if (content instanceof Blob) return content.text();
  return new TextDecoder().decode(content);
}

function contentSize(content: string | Blob | ArrayBuffer): number {
  if (typeof content === 'string') return new TextEncoder().encode(content).length;
  if (content instanceof Blob) return content.size;
  return content.byteLength;
}

// why: module-level (not instance) so it survives across every injection of
//      this root-provided service within one page load, matching what a
//      real on-disk folder would do — reset only happens on a full reload,
//      which is what "starting a new Playwright test" naturally gives us.
const tree = new Map<string, FsNode>();

@Injectable({ providedIn: 'root' })
export class E2eNativeFs implements NativeFs {
  isSupported(): boolean {
    return true;
  }

  async pickDirectory(): Promise<NativeDirRef | null> {
    if (!tree.has(E2E_ROOT)) tree.set(E2E_ROOT, makeDirNode());
    return toPathRef(E2E_ROOT);
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPersistentStorage(): Promise<boolean> {
    return true;
  }

  private resolve(path: string): FsNode {
    const node = tree.get(path);
    if (!node) {
      throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { path } });
    }
    return node;
  }

  private childPath(parent: NativeDirRef, name: string): string {
    return `${assertPathRef(parent).path}/${name}`;
  }

  async getOrCreateDir(parent: NativeDirRef, name: string): Promise<NativeDirRef> {
    const path = this.childPath(parent, name);
    if (!tree.has(path)) {
      tree.set(path, makeDirNode());
      this.resolve(assertPathRef(parent).path).children.add(name);
    }
    return toPathRef(path);
  }

  async getDir(parent: NativeDirRef, name: string): Promise<NativeDirRef | null> {
    const path = this.childPath(parent, name);
    const node = tree.get(path);
    return node && node.kind === 'dir' ? toPathRef(path) : null;
  }

  async hasEntry(parent: NativeDirRef, name: string): Promise<boolean> {
    return tree.has(this.childPath(parent, name));
  }

  async isEmpty(ref: NativeDirRef): Promise<boolean> {
    return this.resolve(assertPathRef(ref).path).children.size === 0;
  }

  async stat(parent: NativeDirRef, name: string): Promise<NativeFsStat | null> {
    const node = tree.get(this.childPath(parent, name));
    if (!node) return null;
    return {
      kind: node.kind,
      size: node.kind === 'file' ? contentSize(node.content) : 0,
      mtimeMs: node.mtimeMs,
    };
  }

  async readFile(parent: NativeDirRef, name: string): Promise<File> {
    const node = tree.get(this.childPath(parent, name));
    if (!node || node.kind !== 'file') {
      throw classifyFsError(notFound(name), { name, op: 'read' }, ERROR_CODES.FS_003);
    }
    return new File([node.content as BlobPart], name, { lastModified: node.mtimeMs });
  }

  async readJson<T>(parent: NativeDirRef, name: string): Promise<T> {
    const node = tree.get(this.childPath(parent, name));
    if (!node || node.kind !== 'file') {
      throw classifyFsError(notFound(name), { name, op: 'read' }, ERROR_CODES.FS_003);
    }
    return JSON.parse(await toText(node.content)) as T;
  }

  async fileSize(parent: NativeDirRef, name: string): Promise<number | null> {
    const node = tree.get(this.childPath(parent, name));
    return node && node.kind === 'file' ? contentSize(node.content) : null;
  }

  private writeFile(
    parent: NativeDirRef,
    name: string,
    content: string | Blob | ArrayBuffer,
  ): void {
    const path = this.childPath(parent, name);
    const existing = tree.get(path);
    tree.set(path, {
      kind: 'file',
      content,
      mtimeMs: Date.now(),
      children: existing?.children ?? new Set(),
    });
    this.resolve(assertPathRef(parent).path).children.add(name);
  }

  async writeFileAtomic(parent: NativeDirRef, name: string, contents: string): Promise<void> {
    this.writeFile(parent, name, contents);
  }

  async writeFileAtomicBinary(
    parent: NativeDirRef,
    name: string,
    data: Blob | ArrayBuffer,
  ): Promise<void> {
    this.writeFile(parent, name, data);
  }

  async *listFiles(parent: NativeDirRef, suffix?: string): AsyncIterable<string> {
    const dir = this.resolve(assertPathRef(parent).path);
    for (const name of dir.children) {
      const node = tree.get(this.childPath(parent, name));
      if (node?.kind !== 'file') continue;
      if (suffix && !name.endsWith(suffix)) continue;
      yield name;
    }
  }

  async *listSubdirs(parent: NativeDirRef): AsyncIterable<string> {
    const dir = this.resolve(assertPathRef(parent).path);
    for (const name of dir.children) {
      const node = tree.get(this.childPath(parent, name));
      if (node?.kind === 'dir') yield name;
    }
  }

  async removeEntry(
    parent: NativeDirRef,
    name: string,
    options: { recursive?: boolean } = {},
  ): Promise<void> {
    const path = this.childPath(parent, name);
    const node = tree.get(path);
    if (!node) return;
    if (node.kind === 'dir' && node.children.size > 0 && !options.recursive) {
      throw new AppError(ERROR_CODES.FS_001, {
        severity: 'error',
        context: { reason: 'not empty', name },
      });
    }
    this.removeSubtree(path, node);
    this.resolve(assertPathRef(parent).path).children.delete(name);
  }

  private removeSubtree(path: string, node: FsNode): void {
    if (node.kind === 'dir') {
      for (const child of node.children) {
        const childPath = `${path}/${child}`;
        const childNode = tree.get(childPath);
        if (childNode) this.removeSubtree(childPath, childNode);
      }
    }
    tree.delete(path);
  }

  async moveFile(
    parent: NativeDirRef,
    name: string,
    destParent: NativeDirRef,
    destName?: string,
  ): Promise<void> {
    const srcPath = this.childPath(parent, name);
    const node = tree.get(srcPath);
    if (!node || node.kind !== 'file') {
      throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { name } });
    }
    const finalName = destName ?? name;
    tree.delete(srcPath);
    this.resolve(assertPathRef(parent).path).children.delete(name);
    tree.set(this.childPath(destParent, finalName), node);
    this.resolve(assertPathRef(destParent).path).children.add(finalName);
  }
}
