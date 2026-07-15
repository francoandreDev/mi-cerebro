import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import { FsStub, WorkspaceStub } from '@core/fs/fs.stub';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GOAL_KIND, newGoalStep } from '../models/goal.types';
import { GoalsService } from './goals.service';

describe('GoalsService', () => {
  let svc: GoalsService;
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
    svc = TestBed.inject(GoalsService);
  });

  it('creates a goal with completed=false and null deadline', async () => {
    const goal = await svc.create('Aprender ruso');
    expect(goal.completed).toBe(false);
    expect(goal.deadline).toBeNull();
    expect(goal.schemaVersion).toBe(8);
    expect(goal.steps).toEqual([]);
    expect(goal.priority).toBe('med');
    expect(goal.progress).toBe(0);
    expect(goal.reminder).toEqual({ enabled: false });
    expect(goal.position).toBeTypeOf('string');
    const goals = fs.root.dirs.get('goals')!;
    expect(goals.files.has('aprender-ruso.json')).toBe(true);
  });

  it('save persists deadline and bumps updatedAt', async () => {
    const goal = await svc.create('Algo');
    const original = goal.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const saved = await svc.save({ ...goal, deadline: '2026-12-31' });
    expect(saved.deadline).toBe('2026-12-31');
    expect(saved.updatedAt > original).toBe(true);
  });

  it('refresh sorts by position ascending (creation order by default)', async () => {
    const a = await svc.create('A');
    const b = await svc.create('B');
    const c = await svc.create('C');
    await svc.save({ ...a, deadline: '2026-07-10' });
    await svc.save({ ...b, deadline: '2026-06-20' });
    await svc.save({ ...c, completed: true });
    const list = await svc.refresh();
    expect(list.map((s) => s.title)).toEqual(['A', 'B', 'C']);
  });

  it('setPosition reorders summaries', async () => {
    const a = await svc.create('A');
    const b = await svc.create('B');
    await svc.setPosition(b.id, '0A');
    const list = await svc.refresh();
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
  });

  it('deleteToTrash moves the file under .mi-cerebro/trash/YYYY/MM/DD/', async () => {
    const goal = await svc.create('X');
    await svc.deleteToTrash(goal.id);
    expect(fs.root.dirs.get('goals')!.files.size).toBe(0);
    let cursor = fs.root.dirs.get('.mi-cerebro')!.dirs.get('trash')!;
    while (cursor.dirs.size === 1) cursor = [...cursor.dirs.values()][0]!;
    expect(cursor.files.size).toBe(1);
  });

  it('registers goal kind in MigrationsService at construct', async () => {
    await svc.create('x');
    expect(GOAL_KIND).toBe('goal');
  });

  it('save forces progress to 100 when completed=true', async () => {
    const goal = await svc.create('X');
    const saved = await svc.save({ ...goal, completed: true, progress: 30 });
    expect(saved.progress).toBe(100);
  });

  it('save clamps progress to [0, 100] when not completed', async () => {
    const goal = await svc.create('X');
    const low = await svc.save({ ...goal, progress: -10 });
    expect(low.progress).toBe(0);
    const high = await svc.save({ ...goal, progress: 150 });
    expect(high.progress).toBe(100);
  });

  it('derives progress from steps when present (overrides manual progress)', async () => {
    const goal = await svc.create('Aprender ruso');
    const s1 = newGoalStep('Alfabeto');
    const s2 = newGoalStep('Saludos');
    const s3 = newGoalStep('100 palabras');
    const s4 = newGoalStep('Conversación básica');
    const saved = await svc.save({
      ...goal,
      progress: 7,
      steps: [{ ...s1, done: true }, { ...s2, done: true }, s3, s4],
    });
    expect(saved.progress).toBe(50);
  });

  it('keeps manual progress when goal has no steps', async () => {
    const goal = await svc.create('X');
    const saved = await svc.save({ ...goal, progress: 42, steps: [] });
    expect(saved.progress).toBe(42);
  });

  it('completed=true forces progress to 100 even with partial steps', async () => {
    const goal = await svc.create('X');
    const saved = await svc.save({
      ...goal,
      completed: true,
      steps: [newGoalStep('a'), newGoalStep('b')],
    });
    expect(saved.progress).toBe(100);
  });

  it('summary exposes stepsTotal and stepsDone', async () => {
    const goal = await svc.create('X');
    const a = newGoalStep('a');
    const b = newGoalStep('b');
    await svc.save({ ...goal, steps: [{ ...a, done: true }, b] });
    const list = await svc.refresh();
    const s = list.find((x) => x.id === goal.id)!;
    expect(s.stepsTotal).toBe(2);
    expect(s.stepsDone).toBe(1);
  });

  it('bumps lastProgressAt when progress changes, not on title-only edits', async () => {
    const goal = await svc.create('X');
    const original = goal.lastProgressAt;
    await new Promise((r) => setTimeout(r, 5));
    const retitled = await svc.save({ ...goal, title: 'Y' });
    expect(retitled.lastProgressAt).toBe(original);
    const progressed = await svc.save({ ...retitled, progress: 40 });
    expect(progressed.lastProgressAt > original).toBe(true);
  });

  it('bumps lastProgressAt when a step toggles, not when only its title changes', async () => {
    const goal = await svc.create('X');
    const step = newGoalStep('a');
    const withStep = await svc.save({ ...goal, steps: [step] });
    const original = withStep.lastProgressAt;
    await new Promise((r) => setTimeout(r, 5));
    const retitledStep = await svc.save({
      ...withStep,
      steps: [{ ...step, title: 'renamed' }],
    });
    expect(retitledStep.lastProgressAt).toBe(original);
    const toggled = await svc.toggleStep(goal.id, step.id);
    expect(toggled.lastProgressAt > original).toBe(true);
  });
});
