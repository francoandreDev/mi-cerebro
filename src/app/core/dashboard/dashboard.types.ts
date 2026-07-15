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

export type DashboardEntryKind = 'note' | 'writing' | 'list';

export interface DashboardRecentEntry {
  readonly id: string;
  readonly kind: DashboardEntryKind;
  readonly title: string;
  readonly preview: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
}

const ENTRY_ROUTE_BASE: Record<DashboardEntryKind, string> = {
  note: '/notes',
  writing: '/writings',
  list: '/lists',
};

export const dashboardEntryRoute = (entry: DashboardRecentEntry): readonly string[] => [
  ENTRY_ROUTE_BASE[entry.kind],
  entitySlugSegment(entry.title, entry.id),
];
