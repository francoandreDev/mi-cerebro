import type { FsDirectoryHandle } from './fs.types';

// why: browser holds an opaque FsDirectoryHandle (structured-clone-able,
//      IndexedDB-storable); Tauri/Capacitor only have absolute/relative
//      paths. NativeDirRef is a union rather than a wrapper so existing
//      browser-only call sites (WorkspaceService, GitFsAdapter,
//      ExportZipService — migrated in 18d/18e) keep compiling unchanged
//      against the FsDirectoryHandle arm; only the native adapters
//      construct/consume the PathDirRef arm.
export interface PathDirRef {
  readonly kind: 'path';
  readonly path: string;
  readonly name: string;
}

export type NativeDirRef = FsDirectoryHandle | PathDirRef;

export function isPathRef(ref: NativeDirRef): ref is PathDirRef {
  return typeof ref === 'object' && ref !== null && (ref as PathDirRef).kind === 'path';
}

export function isBrowserRef(ref: NativeDirRef): ref is FsDirectoryHandle {
  return !isPathRef(ref);
}
