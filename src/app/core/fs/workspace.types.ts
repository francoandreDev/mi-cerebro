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
