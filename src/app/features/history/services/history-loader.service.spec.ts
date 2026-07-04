// Fase 1 gate: loader por resolución. Ejercitamos loadWindow en cada
// resolución + memoización del origin-map con VersioningService/
// MilestoneService/VariantsService stubs (no repo real — el objetivo es
// blindar el contrato del loader, no re-testear isomorphic-git).

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MilestoneService } from '@core/versioning/milestone.service';
import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';
import { VariantsService } from '@core/versioning/variants.service';
import { VersioningService } from '@core/versioning/versioning.service';

import { HistoryLoader, type WindowResolution } from './history-loader.service';

interface Summary {
  readonly oid: string;
  readonly message: string;
  readonly authorTimestamp: number;
}

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

function summary(oid: string, message: string, offsetDays = 0): Summary {
  return { oid, message, authorTimestamp: T0 - offsetDays * DAY };
}

function makeVariant(id: string, parentId: string | null = null): Variant {
  return {
    id,
    name: id === PRINCIPAL_VARIANT_ID ? 'Principal' : id,
    color: '#000',
    protected: id === PRINCIPAL_VARIANT_ID,
    lastActivityAt: T0,
    state: 'active',
    parentId,
    forkOid: null,
    refs: {
      main: `refs/heads/mc/${id}/main`,
      comments: `refs/heads/mc/${id}/comments`,
      draft: `refs/heads/mc/${id}/draft`,
    },
  };
}

describe('HistoryLoader', () => {
  let loader: HistoryLoader;
  let log: ReturnType<typeof vi.fn>;
  let listVariants: ReturnType<typeof vi.fn>;
  let getActive: ReturnType<typeof vi.fn>;
  let listMilestones: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    log = vi.fn(async (_depth: number, _refs?: readonly string[]) => [] as Summary[]);
    listVariants = vi.fn(async () => [makeVariant(PRINCIPAL_VARIANT_ID)]);
    getActive = vi.fn(() => makeVariant(PRINCIPAL_VARIANT_ID));
    listMilestones = vi.fn(async () => []);

    TestBed.configureTestingModule({
      providers: [
        HistoryLoader,
        { provide: VersioningService, useValue: { log } },
        { provide: VariantsService, useValue: { list: listVariants, getActive } },
        { provide: MilestoneService, useValue: { list: listMilestones } },
      ],
    });
    loader = TestBed.inject(HistoryLoader);
  });

  describe('loadWindow', () => {
    it('summary → parses kinds + merge trailer from commit messages', async () => {
      log.mockResolvedValueOnce([
        summary('a', 'auto: 3 notes, 1 task (2026-06-14) [timer]'),
        summary(
          'b',
          'merge: notes/x.json (from "X" into "Y")\n\nMerge-Group: g-42\nMerge-From: x\nMerge-Into: y',
          1,
        ),
        summary('c', 'manual: hand-written commit', 2),
      ]);

      const result = await loader.loadWindow({ resolution: 'summary' });

      expect(result.resolution).toBe('summary');
      expect(result.commits).toHaveLength(3);
      expect(result.commits[0]!.kinds).toEqual(expect.arrayContaining(['note', 'task']));
      expect(result.commits[1]!.mergeGroup).toEqual({
        id: 'g-42',
        fromName: 'X',
        intoName: 'Y',
      });
      expect(result.commits[2]!.kinds).toEqual([]);
      expect(result.commits[2]!.mergeGroup).toBeNull();
      expect(result.aggregate).toEqual([]);
    });

    it('summary → uses active variant refs by default', async () => {
      log.mockResolvedValueOnce([]);
      await loader.loadWindow({ resolution: 'summary' });
      const refs = log.mock.calls[0]![1];
      expect(refs).toEqual([
        `mc/${PRINCIPAL_VARIANT_ID}/main`,
        `mc/${PRINCIPAL_VARIANT_ID}/comments`,
        `mc/${PRINCIPAL_VARIANT_ID}/draft`,
      ]);
    });

    it('aggregate → buckets commits by day with faceta mix', async () => {
      log.mockResolvedValueOnce([
        summary('a', 'auto: 1 note (2026-06-14) [timer]', 0),
        summary('b', 'auto: 1 task (2026-06-14) [timer]', 0),
        summary('c', 'auto [comentarios]: X (1 comentario)', 1),
        summary('d', 'auto [borrador]: Y (2 cambios)', 1),
        summary('e', 'manual', 2),
      ]);

      const result = await loader.loadWindow({ resolution: 'aggregate' });

      expect(result.aggregate).toHaveLength(3);
      expect(result.aggregate[0]!.count).toBe(2);
      expect(result.aggregate[0]!.byFacet).toEqual({ main: 2, comments: 0, draft: 0 });
      expect(result.aggregate[1]!.byFacet).toEqual({ main: 0, comments: 1, draft: 1 });
      expect(result.aggregate[2]!.byFacet).toEqual({ main: 1, comments: 0, draft: 0 });
    });

    it('respects since/until range filter', async () => {
      log.mockResolvedValueOnce([
        summary('a', 'manual', 0),
        summary('b', 'manual', 3),
        summary('c', 'manual', 10),
      ]);
      const since = new Date(T0 - 5 * DAY);
      const result = await loader.loadWindow({ resolution: 'summary', since });
      expect(result.commits.map((c) => c.oid)).toEqual(['a', 'b']);
    });

    it('detail resolution throws — per-oid diff is HistoryDiffService', async () => {
      // why: 'detail' is excluded from WindowResolution at compile time; this simulates
      // an untyped caller (e.g. a template binding) passing it through at runtime.
      await expect(
        loader.loadWindow({ resolution: 'detail' as unknown as WindowResolution }),
      ).rejects.toThrow(/MCB-VER-028/);
    });
  });

  describe('ensureOriginMap', () => {
    it('memoizes concurrent callers — one BFS pass per depth', async () => {
      listVariants.mockResolvedValue([
        makeVariant(PRINCIPAL_VARIANT_ID),
        makeVariant('sibling', PRINCIPAL_VARIANT_ID),
      ]);
      log.mockResolvedValue([summary('shared-oid', 'x')]);

      await Promise.all([loader.ensureOriginMap(50), loader.ensureOriginMap(50)]);
      // 2 variants × 1 log call each = 2, not 4
      expect(log).toHaveBeenCalledTimes(2);
    });

    it('first-writer-wins over lineage order — parent claims the oid', async () => {
      listVariants.mockResolvedValue([
        makeVariant(PRINCIPAL_VARIANT_ID),
        makeVariant('child', PRINCIPAL_VARIANT_ID),
      ]);
      log.mockImplementation(async (_depth: number, refs?: readonly string[]) => {
        const first = refs?.[0] ?? '';
        // Both refs contain the shared oid; principal is walked first.
        if (first.includes(PRINCIPAL_VARIANT_ID)) return [summary('shared', 'x')];
        if (first.includes('child')) return [summary('shared', 'x'), summary('only-child', 'y')];
        return [];
      });

      await loader.ensureOriginMap(50);

      expect(loader.originByOid().get('shared')).toBe(PRINCIPAL_VARIANT_ID);
      expect(loader.originByOid().get('only-child')).toBe('child');
    });

    it('invalidate → next call runs a fresh BFS', async () => {
      await loader.ensureOriginMap(50);
      const before = log.mock.calls.length;
      loader.invalidateOriginMap();
      await loader.ensureOriginMap(50);
      expect(log.mock.calls.length).toBeGreaterThan(before);
    });
  });

  describe('loadMilestones', () => {
    it('delegates to MilestoneService.list', async () => {
      listMilestones.mockResolvedValueOnce([{ name: 'v1', oid: 'abc', message: 'first release' }]);
      const ms = await loader.loadMilestones();
      expect(ms).toHaveLength(1);
      expect(ms[0]!.name).toBe('v1');
    });
  });
});
