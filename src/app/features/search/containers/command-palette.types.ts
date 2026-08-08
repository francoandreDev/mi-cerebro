import type { TranslationKey } from '@core/i18n/i18n.types';
import type { EntityKind, SearchSnippet } from '@core/search/search.types';

export const KIND_TITLE_KEY: Readonly<Record<string, TranslationKey>> = {
  note: 'notes.title',
  task: 'tasks.title',
  goal: 'goals.title',
  list: 'lists.title',
  writing: 'writings.title',
  book: 'books.title',
  image: 'images.title',
  file: 'files.title',
  reminder: 'reminders.title',
  track: 'music.library',
  playlist: 'music.playlists',
  comment: 'search.kind.comment',
  draft: 'search.kind.draft',
  commit: 'search.kind.commit',
};

export interface EntityItem {
  readonly type: 'entity';
  readonly id: string;
  readonly kind: EntityKind;
  readonly title: string;
  readonly snippet: SearchSnippet;
}

export interface QueryItem {
  readonly type: 'query';
  readonly id: string;
  readonly text: string;
}

export interface TagViewItem {
  readonly type: 'tagView';
  readonly tagId: string;
  readonly label: string;
}

export type PaletteItem = EntityItem | QueryItem | TagViewItem;
