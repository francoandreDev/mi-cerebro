import { Injectable, computed, inject } from '@angular/core';

import { GoalsService } from '@features/goals/services/goals.service';
import { NotesService } from '@features/notes/services/notes.service';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { TasksService } from '@features/tasks/services/tasks.service';

import type { CalendarEvent, CalendarFilters } from './calendar-event.types';

// why: lives in core/ instead of features/calendar to expose a read-only
//      derivation of date-bearing entities without making calendar import
//      a sibling feature. Feature owners stay sources of truth; this
//      service only projects their summaries into a date-indexed shape.
@Injectable({ providedIn: 'root' })
export class CalendarEventsService {
  private readonly tasks = inject(TasksService);
  private readonly goals = inject(GoalsService);
  private readonly reminders = inject(RemindersService);
  private readonly notes = inject(NotesService);

  readonly events = computed<readonly CalendarEvent[]>(() => {
    const out: CalendarEvent[] = [];
    for (const t of this.tasks.summaries()) {
      for (const due of t.dueDates) {
        const date = isoDay(due);
        if (!date) continue;
        out.push({
          id: `task:${t.id}:${date}`,
          entityId: t.id,
          kind: 'task',
          title: t.title,
          date,
          tags: t.tags,
          done: t.done,
        });
      }
    }
    for (const g of this.goals.summaries()) {
      if (!g.deadline) continue;
      const date = isoDay(g.deadline);
      if (!date) continue;
      out.push({
        id: `goal:${g.id}`,
        entityId: g.id,
        kind: 'goal',
        title: g.title,
        date,
        tags: g.tags,
        done: g.completed,
      });
    }
    for (const r of this.reminders.summaries()) {
      const date = isoDay(r.dueAt);
      if (!date) continue;
      out.push({
        id: `reminder:${r.id}`,
        entityId: r.id,
        kind: 'reminder',
        title: r.title,
        date,
        tags: [],
        done: r.done,
      });
    }
    for (const n of this.notes.summaries()) {
      if (!n.scheduledFor) continue;
      const date = isoDay(n.scheduledFor);
      if (!date) continue;
      out.push({
        id: `note:${n.id}`,
        entityId: n.id,
        kind: 'note',
        title: n.title,
        date,
        tags: n.tags,
        done: false,
      });
    }
    out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
    return out;
  });

  readonly eventsByDay = computed<ReadonlyMap<string, readonly CalendarEvent[]>>(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of this.events()) {
      const bucket = map.get(e.date) ?? [];
      bucket.push(e);
      map.set(e.date, bucket);
    }
    return map;
  });

  filter(events: readonly CalendarEvent[], filters: CalendarFilters): readonly CalendarEvent[] {
    return events.filter((e) => {
      if (!filters.kinds.has(e.kind)) return false;
      if (filters.tagIds.size === 0) return true;
      return e.tags.some((t) => filters.tagIds.has(t));
    });
  }
}

const isoDay = (raw: string): string | null => {
  if (raw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};
