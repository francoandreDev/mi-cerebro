import { entitySlugSegment, extractEntityId } from '@core/routing/entity-slug';

import type { EntityKind } from './search.types';

// why: maps `SearchKind` ↔ Angular router URL. Lives in core so features
//      never import each other's routes. Reminder has no detail view, so
//      `routeFor` returns the index and `parseDetailUrl` ignores it. Track
//      and playlist have no `/music/:id` detail route either (Music isn't
//      an entity-kind, see docs/sistema/musica.md) — both resolve to the
//      `/music` index, same treatment as reminder.
const ROUTES: Readonly<Record<string, readonly string[]>> = {
  note: ['/notes'],
  task: ['/tasks'],
  goal: ['/goals'],
  list: ['/lists'],
  writing: ['/writings'],
  book: ['/books'],
  image: ['/images'],
  file: ['/files'],
  reminder: ['/reminders'],
  track: ['/music'],
  playlist: ['/music'],
};

const SEGMENT_TO_KIND: Readonly<Record<string, EntityKind>> = {
  notes: 'note',
  tasks: 'task',
  goals: 'goal',
  lists: 'list',
  writings: 'writing',
  books: 'book',
  images: 'image',
  files: 'file',
};

export function routeFor(kind: EntityKind, id: string, title = ''): readonly string[] {
  const base = ROUTES[kind];
  if (!base) return ['/notes'];
  if (kind === 'reminder' || kind === 'track' || kind === 'playlist') return base;
  return [...base, entitySlugSegment(title, id)];
}

export interface DetailRouteRef {
  readonly kind: EntityKind;
  readonly id: string;
}

// why: extracts {kind, id} from a router URL like `/tasks/abc` or
//      `/books/abc/chapter-1`. Returns null for index routes, unknown
//      first segments, or kinds without a detail view (reminder).
export function parseDetailUrl(url: string): DetailRouteRef | null {
  const path = url.split('?')[0]?.split('#')[0] ?? '';
  const parts = path.split('/').filter((s) => s.length > 0);
  const first = parts[0];
  const segment = parts[1];
  if (!first || !segment) return null;
  const kind = SEGMENT_TO_KIND[first];
  if (!kind) return null;
  return { kind, id: extractEntityId(segment) };
}
