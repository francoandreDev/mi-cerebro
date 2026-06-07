// File System Access API surface that the app relies on.
// The DOM lib exposes the handle types but not the permission methods
// and showDirectoryPicker, so we narrow them here once.

export type PermissionState = 'granted' | 'denied' | 'prompt';

export interface FsPermissionDescriptor {
  readonly mode?: 'read' | 'readwrite';
}

export interface FsDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(descriptor?: FsPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FsPermissionDescriptor): Promise<PermissionState>;
}

export interface FsFileHandle extends FileSystemFileHandle {
  queryPermission(descriptor?: FsPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FsPermissionDescriptor): Promise<PermissionState>;
  // why: Chromium ships FileSystemHandle.move (FS Access API) since v110;
  //      we require Chromium so this is safe to rely on for atomic rename.
  move(newName: string): Promise<void>;
  move(parent: FileSystemDirectoryHandle, newName?: string): Promise<void>;
}

export interface ShowDirectoryPickerOptions {
  readonly id?: string;
  readonly mode?: 'read' | 'readwrite';
  readonly startIn?: 'documents' | 'desktop' | 'downloads' | 'music' | 'pictures' | 'videos';
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: ShowDirectoryPickerOptions) => Promise<FsDirectoryHandle>;
  }
}
