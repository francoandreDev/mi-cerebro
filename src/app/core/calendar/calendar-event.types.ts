export type CalendarEventKind = 'task' | 'goal';

export interface CalendarEvent {
  readonly id: string;
  readonly entityId: string;
  readonly kind: CalendarEventKind;
  readonly title: string;
  readonly date: string;
  readonly tags: readonly string[];
  readonly done: boolean;
}

export interface CalendarFilters {
  readonly kinds: ReadonlySet<CalendarEventKind>;
  readonly tagIds: ReadonlySet<string>;
}

export const ALL_CALENDAR_KINDS: readonly CalendarEventKind[] = ['task', 'goal'];

export const eventRoute = (event: CalendarEvent): readonly string[] =>
  event.kind === 'task' ? ['/tasks', event.entityId] : ['/goals', event.entityId];
