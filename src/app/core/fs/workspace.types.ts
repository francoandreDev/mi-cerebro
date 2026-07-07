// why: not every state is reachable on every platform (18e). Reachability:
//   - browser: all states — real picker, real permission model (FS Access
//     API can silently downgrade a granted permission), arbitrary folder
//     so 'foreign-folder' applies.
//   - tauri: same as browser except 'needs-permission' — TauriNativeFs's
//     queryPermission/requestPermission always resolve 'granted' (no
//     runtime prompt; access is scoped ahead of time via capabilities), so
//     that state is structurally unreachable even though the picker and
//     'foreign-folder' still apply.
//   - capacitor: only 'checking' | 'unsupported' | 'initializing' | 'ready'.
//     No picker (fixed Documents/mi-cerebro folder) and no permission
//     model, so 'needs-root', 'needs-permission' and 'foreign-folder' are
//     unreachable — WorkspaceService.bootstrap() adopts the fixed folder
//     directly.
export type WorkspaceState =
  | 'checking'
  | 'unsupported'
  | 'needs-root'
  | 'needs-permission'
  | 'foreign-folder'
  | 'initializing'
  | 'ready';

export type FolderKind = 'empty' | 'mi-cerebro' | 'foreign';

export const WORKSPACE_SCHEMA_VERSION = 1;

export const WORKSPACE_DIRS = [
  '.mi-cerebro',
  'notes',
  'tasks',
  'goals',
  'lists',
  'writings',
  'images',
  'files',
  'music',
] as const;

export const WORKSPACE_MARKER = '.mi-cerebro';
export const WORKSPACE_CONFIG_FILE = 'config.json';
