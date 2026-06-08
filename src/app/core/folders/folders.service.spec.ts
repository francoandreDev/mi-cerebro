import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import { FsStub, WorkspaceStub } from '@core/fs/fs.stub';
import { WorkspaceService } from '@core/fs/workspace.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';

import { FoldersService } from './folders.service';

describe('FoldersService', () => {
  let folders: FoldersService;
  let notes: NotesService;
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
    folders = TestBed.inject(FoldersService);
    notes = TestBed.inject(NotesService);
    TestBed.inject(TasksService);
    TestBed.inject(GoalsService);
  });

  it('creates a folder under the kind root', async () => {
    await folders.createFolder('note', '', 'Inbox');
    const notesDir = fs.root.dirs.get('notes')!;
    expect(notesDir.dirs.has('inbox')).toBe(true);
  });

  it('creates nested folders by parent path', async () => {
    await folders.createFolder('note', '', 'inbox');
    await folders.createFolder('note', 'inbox', 'sub');
    const sub = fs.root.dirs.get('notes')!.dirs.get('inbox')!.dirs.get('sub');
    expect(sub).toBeDefined();
  });

  it('renameFolder moves contents to new sibling name', async () => {
    await folders.createFolder('note', '', 'inbox');
    await notes.create('Hola', 'inbox');
    await folders.renameFolder('note', 'inbox', 'archivo');
    const notesDir = fs.root.dirs.get('notes')!;
    expect(notesDir.dirs.has('inbox')).toBe(false);
    expect(notesDir.dirs.get('archivo')!.files.has('hola.json')).toBe(true);
  });

  it('moveFolder reparents the folder with its contents', async () => {
    await folders.createFolder('note', '', 'inbox');
    await folders.createFolder('note', '', 'archive');
    await notes.create('Hola', 'inbox');
    await folders.moveFolder('note', 'inbox', 'archive');
    const notesDir = fs.root.dirs.get('notes')!;
    expect(notesDir.dirs.has('inbox')).toBe(false);
    const archive = notesDir.dirs.get('archive')!;
    expect(archive.dirs.get('inbox')!.files.has('hola.json')).toBe(true);
  });

  it('deleteFolder sends all entities to trash recursively and removes dir', async () => {
    await folders.createFolder('note', '', 'inbox');
    await folders.createFolder('note', 'inbox', 'deep');
    await notes.create('A', 'inbox');
    await notes.create('B', 'inbox/deep');
    await folders.deleteFolder('note', 'inbox');
    const notesDir = fs.root.dirs.get('notes')!;
    expect(notesDir.dirs.has('inbox')).toBe(false);
    const trash = fs.root.dirs.get('.mi-cerebro')!.dirs.get('trash')!;
    let cursor = trash;
    while (cursor.dirs.size === 1 && cursor.files.size === 0) {
      cursor = [...cursor.dirs.values()][0]!;
    }
    expect(cursor.files.size).toBe(2);
  });
});
