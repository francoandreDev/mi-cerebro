import { entitySlugSegment } from '@core/routing/entity-slug';

// why: features/dashboard must not import @features/{tasks,goals,reminders}
//      models directly (no-restricted-imports enforces rule 10 on
//      src/app/features/**). These view-model shapes are the projection
//      dashboard widgets consume; DashboardService maps the real summaries
//      into them.
export interface DashboardTaskItem {
  readonly id: string;
  readonly title: string;
  readonly dueDate: string | null;
  readonly overdue: boolean;
  readonly tags: readonly string[];
}

export interface DashboardGoalItem {
  readonly id: string;
  readonly title: string;
  readonly deadline: string | null;
  readonly stepsDone: number;
  readonly stepsTotal: number;
  readonly tags: readonly string[];
  readonly dormant: boolean;
}

export interface DashboardReminderItem {
  readonly id: string;
  readonly title: string;
  readonly nextPingAt: string;
}

export type DashboardEntryKind = 'note' | 'writing' | 'list' | 'book-chapter';

export type DashboardResurfaceMode = 'random' | 'related';

export interface DashboardRecentEntry {
  readonly id: string;
  readonly kind: DashboardEntryKind;
  readonly title: string;
  readonly preview: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  // why: only set for kind 'book-chapter' — the detail route needs both the
  //      book and chapter id (/books/:bookId/:chapterId), unlike the other
  //      three kinds which resolve from a single id.
  readonly bookId?: string;
}

const ENTRY_ROUTE_BASE: Record<Exclude<DashboardEntryKind, 'book-chapter'>, string> = {
  note: '/notes',
  writing: '/writings',
  list: '/lists',
};

// why: book/chapter segments accept a bare id with no slug (extractEntityId
//      falls back to the whole segment when there's no slug prefix — same
//      mechanism that keeps pre-§20c bookmark links working), so this
//      doesn't need the book's own title, which DashboardRecentEntry doesn't
//      carry.
export const dashboardEntryRoute = (entry: DashboardRecentEntry): readonly string[] => {
  if (entry.kind === 'book-chapter') {
    return ['/books', entry.bookId ?? '', entry.id];
  }
  return [ENTRY_ROUTE_BASE[entry.kind], entitySlugSegment(entry.title, entry.id)];
};
