import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorService } from '@core/errors/error.service';

import type { Note } from '@features/notes/models/note.types';
import { emptyDoc } from '@features/notes/models/note.types';
import { NotesService } from '@features/notes/services/notes.service';

import { QuickCaptureService } from './quick-capture.service';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: '',
    body: emptyDoc(),
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: 1,
    ...overrides,
  };
}

describe('QuickCaptureService', () => {
  let notes: { create: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let errors: { report: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    notes = {
      create: vi.fn(async (title: string) => makeNote({ title })),
      save: vi.fn(async (note: Note) => note),
    };
    errors = { report: vi.fn() };
    router = { navigate: vi.fn(async () => true) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: NotesService, useValue: notes },
        { provide: ErrorService, useValue: errors },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('creates a note with only a title when the text is a single line', async () => {
    const service = TestBed.inject(QuickCaptureService);
    await service.capture('idea suelta');
    expect(notes.create).toHaveBeenCalledWith('idea suelta', '');
    expect(notes.save).not.toHaveBeenCalled();
    expect(errors.report).toHaveBeenCalledOnce();
  });

  it('splits the first line as title and the rest as body paragraphs', async () => {
    const service = TestBed.inject(QuickCaptureService);
    await service.capture('título\nprimer párrafo\nsegundo párrafo');
    expect(notes.create).toHaveBeenCalledWith('título', '');
    expect(notes.save).toHaveBeenCalledOnce();
    const saved = notes.save.mock.calls[0]![0] as Note;
    expect(saved.body.content).toHaveLength(2);
    expect(saved.body.content?.[0]?.content?.[0]?.text).toBe('primer párrafo');
  });

  it('ignores blank lines when building body paragraphs', async () => {
    const service = TestBed.inject(QuickCaptureService);
    await service.capture('título\n\n  \ncontenido real');
    const saved = notes.save.mock.calls[0]![0] as Note;
    expect(saved.body.content).toHaveLength(1);
    expect(saved.body.content?.[0]?.content?.[0]?.text).toBe('contenido real');
  });

  it('does nothing for empty input', async () => {
    const service = TestBed.inject(QuickCaptureService);
    await service.capture('   \n  ');
    expect(notes.create).not.toHaveBeenCalled();
    expect(errors.report).not.toHaveBeenCalled();
  });

  it('closes the dialog and reports the error if creation fails', async () => {
    notes.create.mockRejectedValueOnce(new Error('disk full'));
    const service = TestBed.inject(QuickCaptureService);
    service.openDialog();
    await service.capture('idea');
    expect(service.open()).toBe(false);
    expect(errors.report).toHaveBeenCalledOnce();
  });

  it('navigates to the created note when the toast action runs', async () => {
    const service = TestBed.inject(QuickCaptureService);
    await service.capture('idea suelta');
    const reported = errors.report.mock.calls[0]![0];
    await reported.actions[0].run();
    expect(router.navigate).toHaveBeenCalledWith(['/notes', expect.stringContaining('note-1')]);
  });
});
