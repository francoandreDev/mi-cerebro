export type CalendarEventKind = 'task' | 'goal' | 'reminder';

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

export const ALL_CALENDAR_KINDS: readonly CalendarEventKind[] = ['task', 'goal', 'reminder'];

export const eventRoute = (event: CalendarEvent): readonly string[] => {
  if (event.kind === 'task') return ['/tasks', event.entityId];
  if (event.kind === 'goal') return ['/goals', event.entityId];
  return ['/reminders'];
};
