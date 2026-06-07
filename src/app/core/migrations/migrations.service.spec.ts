import { TestBed } from '@angular/core/testing';

import type { AppError } from '@core/errors/app-error';

import type { VersionedEntity } from './migration.types';
import { MigrationsService } from './migrations.service';

type Note = VersionedEntity & { readonly title: string; readonly tags?: readonly string[] };

const note = (schemaVersion: number, title: string, extra: Record<string, unknown> = {}): Note =>
  ({ schemaVersion, title, ...extra }) as Note;

describe('MigrationsService', () => {
  let svc: MigrationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(MigrationsService);
  });

  it('returns data unchanged when no registration for kind', async () => {
    const data = note(0, 'a');
    expect(await svc.migrate('note', data)).toBe(data);
  });

  it('runs a chain v0 -> v1 -> v2', async () => {
    svc.register({
      kind: 'note',
      latest: 2,
      steps: [
        { from: 0, to: 1, run: (d) => ({ ...d, schemaVersion: 1, tags: [] }) },
        {
          from: 1,
          to: 2,
          run: (d) => ({ ...d, schemaVersion: 2, title: String(d['title']).toUpperCase() }),
        },
      ],
    });

    const out = await svc.migrate<Note>('note', note(0, 'hello'));
    expect(out.schemaVersion).toBe(2);
    expect(out.title).toBe('HELLO');
    expect(out.tags).toEqual([]);
  });

  it('skips steps below current version', async () => {
    let v0Ran = false;
    svc.register({
      kind: 'note',
      latest: 2,
      steps: [
        {
          from: 0,
          to: 1,
          run: (d) => {
            v0Ran = true;
            return { ...d, schemaVersion: 1 };
          },
        },
        { from: 1, to: 2, run: (d) => ({ ...d, schemaVersion: 2 }) },
      ],
    });
    await svc.migrate('note', note(1, 'x'));
    expect(v0Ran).toBe(false);
  });

  it('throws MIG-002 when data version is newer than latest', async () => {
    svc.register({
      kind: 'note',
      latest: 1,
      steps: [{ from: 0, to: 1, run: (d) => ({ ...d, schemaVersion: 1 }) }],
    });
    try {
      await svc.migrate('note', note(5, 'x'));
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as AppError).code).toBe('MCB-MIG-002');
    }
  });

  it('throws MIG-001 when a step throws', async () => {
    svc.register({
      kind: 'note',
      latest: 1,
      steps: [
        {
          from: 0,
          to: 1,
          run: () => {
            throw new Error('boom');
          },
        },
      ],
    });
    try {
      await svc.migrate('note', note(0, 'x'));
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as AppError).code).toBe('MCB-MIG-001');
    }
  });

  it('rejects non-contiguous registration', () => {
    expect(() =>
      svc.register({
        kind: 'note',
        latest: 2,
        steps: [{ from: 0, to: 2, run: (d) => d }],
      }),
    ).toThrowError(/MCB-MIG-001/);
  });

  it('calls backup before applying steps', async () => {
    const calls: string[] = [];
    svc.setBackupFn(async () => {
      calls.push('backup');
    });
    svc.register({
      kind: 'note',
      latest: 1,
      steps: [
        {
          from: 0,
          to: 1,
          run: (d) => {
            calls.push('step');
            return { ...d, schemaVersion: 1 };
          },
        },
      ],
    });
    await svc.migrate('note', note(0, 'x'));
    expect(calls).toEqual(['backup', 'step']);
  });

  it('skips backup when already at latest', async () => {
    let backupCalls = 0;
    svc.setBackupFn(async () => {
      backupCalls++;
    });
    svc.register({
      kind: 'note',
      latest: 1,
      steps: [{ from: 0, to: 1, run: (d) => ({ ...d, schemaVersion: 1 }) }],
    });
    await svc.migrate('note', note(1, 'x'));
    expect(backupCalls).toBe(0);
  });
});
