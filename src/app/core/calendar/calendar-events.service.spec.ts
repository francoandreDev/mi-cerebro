import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { GoalsService } from '@features/goals/services/goals.service';
import { NotesService } from '@features/notes/services/notes.service';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { TasksService } from '@features/tasks/services/tasks.service';

import { CalendarEventsService } from './calendar-events.service';

describe('CalendarEventsService', () => {
  let svc: CalendarEventsService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TasksService,
          useValue: { summaries: signal([]) },
        },
        {
          provide: GoalsService,
          useValue: { summaries: signal([]) },
        },
        {
          provide: RemindersService,
          useValue: { summaries: signal([]) },
        },
        {
          provide: NotesService,
          useValue: {
            summaries: signal([
              {
                id: 'n1',
                title: 'Con fecha',
                updatedAt: '2026-08-01T00:00:00.000Z',
                tags: ['t1'],
                folder: '',
                position: '0',
                preview: '',
                scheduledFor: '2026-08-01',
              },
              {
                id: 'n2',
                title: 'Sin fecha',
                updatedAt: '2026-08-01T00:00:00.000Z',
                tags: [],
                folder: '',
                position: '1',
                preview: '',
                scheduledFor: null,
              },
            ]),
          },
        },
      ],
    });
    svc = TestBed.inject(CalendarEventsService);
  });

  it('projects only notes with scheduledFor into events', () => {
    const events = svc.events();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'note',
      entityId: 'n1',
      title: 'Con fecha',
      date: '2026-08-01',
      tags: ['t1'],
      done: false,
    });
  });

  it('indexes the note event under its day in eventsByDay', () => {
    const byDay = svc.eventsByDay();
    expect(byDay.get('2026-08-01')?.map((e) => e.id)).toEqual(['note:n1']);
  });
});
