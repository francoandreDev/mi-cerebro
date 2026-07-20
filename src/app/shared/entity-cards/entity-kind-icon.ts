import type { IconName } from '@shared/icon/icons.data';

// why: small icon-per-kind lookup shared by any cross-entity display (trash
//      filter chips, calendar kind cards, history polaroids) — kept as plain
//      data instead of a service since it's a pure constant with no state.
const ENTITY_KIND_ICON: Readonly<Record<string, IconName>> = {
  note: 'note',
  task: 'check-square',
  goal: 'target',
  list: 'list-bullets',
  writing: 'pen-nib',
  book: 'books',
  image: 'image-square',
  file: 'folder',
  reminder: 'bell',
};

const FALLBACK_ICON: IconName = 'tag';

export const entityKindIcon = (kind: string): IconName => ENTITY_KIND_ICON[kind] ?? FALLBACK_ICON;
