import { describe, expect, it } from 'vitest';

import {
  computeDensity,
  computePanoramaGeometry,
  computeStratumLayers,
  panoramaFossils,
} from './strata.utils';
import type { DayAggregate } from './history-loader.service';
import type { CommitBucket, CommitEntry, MilestoneEntry } from './history.types';

function commit(oid: string, message: string): CommitEntry {
  return {
    oid,
    shortOid: oid.slice(0, 7),
    message,
    date: new Date(0),
    kinds: [],
    mergeGroup: null,
  };
}

function bucket(commits: readonly CommitEntry[]): CommitBucket {
  return {
    id: 'today',
    items: commits.map((c) => ({ kind: 'commit', entry: c })),
  };
}

describe('computeDensity', () => {
  it('counts commits and classifies facet mix by message', () => {
    const b = bucket([
      commit('a', 'auto: 3 notes'),
      commit('b', 'auto [comentarios]: something'),
      commit('c', 'auto [borrador]: other'),
      commit('d', 'manual: whatever'),
    ]);
    const d = computeDensity(b, new Map());
    expect(d.totalCount).toBe(4);
    expect(d.facetMix.main).toBe(2);
    expect(d.facetMix.comments).toBe(1);
    expect(d.facetMix.draft).toBe(1);
  });

  it('counts merge-group and auto-group members towards density', () => {
    const b: CommitBucket = {
      id: 'today',
      items: [
        {
          kind: 'auto-group',
          id: 'auto:a',
          fingerprint: 'main::note',
          latest: commit('a', 'auto: 1 note'),
          members: [
            commit('a', 'auto: 1 note'),
            commit('b', 'auto: 1 note'),
            commit('c', 'auto: 1 note'),
          ],
        },
      ],
    };
    const d = computeDensity(b, new Map());
    expect(d.totalCount).toBe(3);
    expect(d.facetMix.main).toBe(3);
  });

  it('thickness scales log with piso 20px and techo 96px', () => {
    const oneCommit = computeDensity(bucket([commit('a', 'manual: x')]), new Map());
    expect(oneCommit.thicknessPx).toBeGreaterThanOrEqual(20);

    const five = bucket(Array.from({ length: 5 }, (_, i) => commit(`c${i}`, 'manual: x')));
    const twoHundred = bucket(Array.from({ length: 200 }, (_, i) => commit(`c${i}`, 'manual: x')));
    const thin = computeDensity(five, new Map()).thicknessPx;
    const thick = computeDensity(twoHundred, new Map()).thicknessPx;
    expect(thin).toBeLessThan(thick);
    expect(thick).toBeLessThanOrEqual(96);
    // gate del plan: 5 vs 200 se ven claramente distintos.
    expect(thick - thin).toBeGreaterThanOrEqual(30);
  });

  it('does not exceed the piso/techo on empty and huge buckets', () => {
    const empty = computeDensity(bucket([]), new Map());
    expect(empty.thicknessPx).toBe(20);
    const huge = bucket(Array.from({ length: 5000 }, (_, i) => commit(`c${i}`, 'manual: x')));
    expect(computeDensity(huge, new Map()).thicknessPx).toBeLessThanOrEqual(96);
  });

  it('collects fossils from milestones anchored on any commit inside the bucket', () => {
    const b = bucket([commit('a', 'manual: x'), commit('b', 'manual: y')]);
    const ms: MilestoneEntry = { name: 'v1', oid: 'b', message: '' };
    const d = computeDensity(b, new Map([['b', [ms]]]));
    expect(d.fossils).toHaveLength(1);
    expect(d.fossils[0]!.name).toBe('v1');
  });
});

function day(dayStart: number, main = 0, comments = 0, draft = 0): DayAggregate {
  return {
    dayStart,
    count: main + comments + draft,
    byFacet: { main, comments, draft },
  };
}

describe('computePanoramaGeometry', () => {
  it('scales columns log with a piso mínimo y respeta el techo', () => {
    const days = [day(1, 1), day(2, 5), day(3, 200)];
    const geo = computePanoramaGeometry(days, { height: 220 });
    const heights = geo.columns.map((c) => c.totalHeight);
    // orden ascendente por dayStart → 1, 5, 200
    expect(heights[0]!).toBeGreaterThanOrEqual(2);
    expect(heights[1]!).toBeGreaterThan(heights[0]!);
    expect(heights[2]!).toBeGreaterThan(heights[1]!);
    expect(heights[2]!).toBeLessThanOrEqual(220);
    // gate: 1 vs 200 commits/día se distingue con margen holgado.
    expect(heights[2]! - heights[0]!).toBeGreaterThanOrEqual(60);
  });

  it('emits three stacked bands as smooth Bezier silhouettes (contains C commands)', () => {
    const days = [day(1, 2, 1, 1), day(2, 4, 2, 2), day(3, 3, 1, 1), day(4, 5, 2, 1)];
    const geo = computePanoramaGeometry(days, { columnWidth: 10 });
    // cada faceta emite un path con curvas Bezier (C) — silueta continua, no rects.
    expect(geo.paths.main).toMatch(/^M[\d.]+,[\d.]+/);
    expect(geo.paths.main).toContain('C');
    expect(geo.paths.comments).toContain('C');
    expect(geo.paths.draft).toContain('C');
    // path cerrado (termina en Z)
    expect(geo.paths.main.endsWith('Z')).toBe(true);
    // stacking bottom-up: pico de draft (top) queda arriba (y menor) que pico de main
    // usando la columna 3 (index 2, count=5, más alta):
    const col = geo.columns[3]!;
    expect(col.peakY).toBeLessThan(geo.horizonY - 5); // hay altura visible
  });

  it('resuelve la X de cada fósil por dayStart de su commit, clavado sobre el pico', () => {
    const days = [day(1000, 3), day(2000, 5)];
    const geo = computePanoramaGeometry(days, { columnWidth: 10 });
    const fossils = panoramaFossils(geo, [
      { oid: 'a', name: 'v1', dayStart: 2000 },
      { oid: 'b', name: 'orphan', dayStart: 9999 },
    ]);
    expect(fossils).toHaveLength(1);
    expect(fossils[0]!.name).toBe('v1');
    // segunda columna: centro en x = 1*cw + cw/2 = 15
    expect(fossils[0]!.x).toBe(15);
    // banderín clavado arriba del pico de esa columna
    const col = geo.columns[1]!;
    expect(fossils[0]!.y).toBeLessThan(col.peakY);
  });

  it('devuelve geometría vacía sin columnas cuando no hay aggregates', () => {
    const geo = computePanoramaGeometry([]);
    expect(geo.columns).toHaveLength(0);
    expect(geo.paths.main).toBe('');
    expect(geo.width).toBe(0);
  });
});

describe('computeStratumLayers', () => {
  it('emite tres franjas apiladas top-down con altura proporcional al mix', () => {
    // 6 main, 3 comments, 1 draft → 60/30/10.
    const commits = [
      ...Array.from({ length: 6 }, (_, i) => commit(`m${i}`, 'manual: x')),
      ...Array.from({ length: 3 }, (_, i) => commit(`c${i}`, 'auto [comentarios]: y')),
      commit('d0', 'auto [borrador]: z'),
    ];
    const layers = computeStratumLayers(bucket(commits), new Map());
    expect(layers.totalCount).toBe(10);
    expect(layers.layers).toHaveLength(3);
    // top-down: draft → comments → main
    expect(layers.layers[0]!.facet).toBe('draft');
    expect(layers.layers[1]!.facet).toBe('comments');
    expect(layers.layers[2]!.facet).toBe('main');
    expect(layers.layers[0]!.heightPct).toBeCloseTo(10, 1);
    expect(layers.layers[1]!.heightPct).toBeCloseTo(30, 1);
    expect(layers.layers[2]!.heightPct).toBeGreaterThanOrEqual(59);
    // apiladas sin gaps
    expect(layers.layers[0]!.yPct).toBe(0);
    expect(layers.layers[1]!.yPct).toBeCloseTo(10, 1);
    expect(layers.layers[2]!.yPct).toBeCloseTo(40, 1);
  });

  it('omite franjas de facetas con cero commits', () => {
    const commits = [commit('a', 'manual: x'), commit('b', 'manual: y')];
    const layers = computeStratumLayers(bucket(commits), new Map());
    expect(layers.layers).toHaveLength(1);
    expect(layers.layers[0]!.facet).toBe('main');
    expect(layers.layers[0]!.heightPct).toBeCloseTo(100, 1);
  });

  it('ancla fósiles en la Y de su faceta y en la X cronológica (viejo→izq, nuevo→der)', () => {
    const commits = [
      commit('newest', 'manual: x'),
      commit('mid', 'auto [comentarios]: y'),
      commit('oldest', 'manual: z'),
    ];
    const ms: MilestoneEntry = { name: 'v1', oid: 'mid', message: '' };
    const layers = computeStratumLayers(bucket(commits), new Map([['mid', [ms]]]));
    expect(layers.fossils).toHaveLength(1);
    const f = layers.fossils[0]!;
    expect(f.facet).toBe('comments');
    // idx 1 de 3 → xPct ~= 50 (centro)
    expect(f.xPct).toBeGreaterThan(40);
    expect(f.xPct).toBeLessThan(60);
    // Y cae dentro de la banda de comentarios (que va desde 0 hasta 1/3 aprox, más el draft si hay)
    // acá no hay drafts → comments es la primera franja (y=0), main abajo.
    expect(f.yPct).toBeGreaterThan(0);
    expect(f.yPct).toBeLessThan(50);
  });

  it('para un solo commit centra el fósil en xPct=50', () => {
    const commits = [commit('a', 'manual: x')];
    const ms: MilestoneEntry = { name: 'solo', oid: 'a', message: '' };
    const layers = computeStratumLayers(bucket(commits), new Map([['a', [ms]]]));
    expect(layers.fossils).toHaveLength(1);
    expect(layers.fossils[0]!.xPct).toBe(50);
  });

  it('bucket vacío no rompe: sin capas, sin fósiles', () => {
    const layers = computeStratumLayers(bucket([]), new Map());
    expect(layers.totalCount).toBe(0);
    expect(layers.layers).toHaveLength(0);
    expect(layers.fossils).toHaveLength(0);
  });
});
