export type TrashKind =
  | 'note'
  | 'task'
  | 'goal'
  | 'list'
  | 'writing'
  | 'book'
  | 'image'
  | 'file'
  | 'reminder'
  | 'track'
  | 'playlist';

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

export interface TrashPreviewFact {
  readonly labelKey: string;
  readonly value: string;
}

export interface TrashPreview {
  readonly excerpt: string | null;
  readonly tags: readonly string[];
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly facts: readonly TrashPreviewFact[];
  readonly accent: string | null;
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
  reminder: 'reminders',
  // why: track/playlist restore is bespoke (like book/image/file) since both
  //      live nested under `music/`, not directly under the workspace root —
  //      these entries only exist to satisfy Record<TrashKind, string>.
  track: 'music-tracks',
  playlist: 'music-playlists',
};
