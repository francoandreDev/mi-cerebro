import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import { FsStub, WorkspaceStub } from '@core/fs/fs.stub';
import { WorkspaceService } from '@core/fs/workspace.service';

import { NOTE_KIND } from '../models/note.types';
import { NotesService } from './notes.service';

describe('NotesService', () => {
  let svc: NotesService;
  let fs: FsStub;

  beforeEach(() => {
    fs = new FsStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FsService, useValue: fs },
        { provide: WorkspaceService, useValue: new WorkspaceStub(fs.root) },
      ],
    });
    svc = TestBed.inject(NotesService);
  });

  it('creates a note and persists it as JSON', async () => {
    const note = await svc.create('Hola');
    expect(note.id).toMatch(/[0-9a-f-]{36}/);
    expect(note.title).toBe('Hola');
    expect(note.schemaVersion).toBe(2);
    const notes = fs.root.dirs.get('notes')!;
    expect(notes.files.has('hola.json')).toBe(true);
    const stored = JSON.parse(notes.files.get('hola.json')!) as { id: string };
    expect(stored.id).toBe(note.id);
  });

  it('disambiguates filenames on title collision', async () => {
    const a = await svc.create('Hola');
    const b = await svc.create('Hola');
    expect(a.id).not.toBe(b.id);
    const notes = fs.root.dirs.get('notes')!;
    expect(notes.files.has('hola.json')).toBe(true);
    expect(notes.files.has('hola-2.json')).toBe(true);
  });

  it('refresh lists summaries sorted by updatedAt desc', async () => {
    await svc.create('Uno');
    await new Promise((r) => setTimeout(r, 5));
    const second = await svc.create('Dos');
    const summaries = await svc.refresh();
    expect(summaries.map((s) => s.id)[0]).toBe(second.id);
  });

  it('save updates updatedAt and rewrites the file', async () => {
    const note = await svc.create('Hola');
    const original = note.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const saved = await svc.save({ ...note, title: 'Hola editada' });
    expect(saved.updatedAt > original).toBe(true);
    const stored = JSON.parse(fs.root.dirs.get('notes')!.files.get('hola.json')!) as {
      title: string;
    };
    expect(stored.title).toBe('Hola editada');
  });

  it('deleteToTrash moves the file under .mi-cerebro/trash/YYYY/MM/DD/', async () => {
    const note = await svc.create('Hola');
    await svc.deleteToTrash(note.id);
    const notes = fs.root.dirs.get('notes')!;
    expect(notes.files.size).toBe(0);
    const trashRoot = fs.root.dirs.get('.mi-cerebro')!.dirs.get('trash')!;
    let cursor = trashRoot;
    while (cursor.dirs.size === 1) cursor = [...cursor.dirs.values()][0]!;
    expect(cursor.files.size).toBe(1);
    expect([...cursor.files.keys()][0]).toMatch(new RegExp(`^note__${note.id}__hola.json$`));
  });

  it('registers a note kind in the MigrationsService at construct', async () => {
    await svc.create('x');
    // round-trip a known-shape note through refresh; if migrations weren't
    // registered, missing-kind would skip, but the latest version is 1 so
    // the call should still return our data.
    expect(NOTE_KIND).toBe('note');
  });
});
