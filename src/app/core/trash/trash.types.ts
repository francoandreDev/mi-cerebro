export type TrashKind = 'note' | 'task' | 'goal' | 'list' | 'writing' | 'book' | 'image' | 'file';

export type TrashEntryShape = 'file' | 'directory';

export interface TrashEntry {
  readonly filename: string;
  readonly parentPath: readonly string[];
  readonly id: string;
  readonly kind: TrashKind;
  readonly title: string;
  readonly deletedAt: string;
  readonly shape: TrashEntryShape;
}

export const TRASH_META_DIR = '.mi-cerebro';
export const TRASH_SUBDIR = 'trash';
export const TRASH_FILE_SUFFIX = '.json';

export const KIND_DIRS: Record<TrashKind, string> = {
  note: 'notes',
  task: 'tasks',
  goal: 'goals',
  list: 'lists',
  writing: 'writings',
  book: 'books',
  image: 'images',
  file: 'files',
};
