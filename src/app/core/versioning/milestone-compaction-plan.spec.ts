import { describe, expect, it } from 'vitest';

import { buildMilestoneCompactionPlan } from './milestone-compaction-plan';
import type { CommitSummary } from './versioning.service';

const NOW = Date.UTC(2026, 5, 20, 12, 0, 0);
const DAY = 86_400_000;

interface MakeCommit {
  readonly oid: string;
  readonly daysAgo: number;
  readonly message?: string;
}

function c({ oid, daysAgo, message }: MakeCommit): CommitSummary {
  return {
    oid,
    message: message ?? 'auto: test commit',
    authorTimestamp: NOW - daysAgo * DAY,
    parents: [],
  };
}

// why: el input del planner es newest-first (misma convención que git.log
//      y CompactionPlanInput). Los tests declaran los oids en ese orden.
describe('buildMilestoneCompactionPlan', () => {
  it('rango desde root: fusiona todo hasta el milestone en un grupo con label', () => {
    const commits = [
      c({ oid: 'X', daysAgo: 1 }), // milestone (más nuevo)
      c({ oid: 'b', daysAgo: 2 }),
      c({ oid: 'a', daysAgo: 3 }), // root
    ];
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids: new Set(),
      milestoneOid: 'X',
      milestoneLabel: 'borrador-3',
    });
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.oids).toEqual(['a', 'b', 'X']);
    expect(plan.fuseGroups[0]!.label).toBe('borrador-3');
    expect(plan.preservedOids).toEqual([]);
  });

  it('milestone previo existente: sólo el rango entre ambos se fusiona', () => {
    const commits = [
      c({ oid: 'X', daysAgo: 1 }), // nuevo milestone
      c({ oid: 'c', daysAgo: 2 }),
      c({ oid: 'PREV', daysAgo: 3 }), // milestone existente
      c({ oid: 'a', daysAgo: 4 }),
    ];
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids: new Set(['PREV']),
      milestoneOid: 'X',
      milestoneLabel: 'cap-4',
    });
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.oids).toEqual(['c', 'X']);
    expect(plan.fuseGroups[0]!.label).toBe('cap-4');
    expect([...plan.preservedOids].sort()).toEqual(['PREV', 'a']);
  });

  it('barrera interna (before-restore) parte en dos grupos; sólo el terminal lleva label', () => {
    const commits = [
      c({ oid: 'X', daysAgo: 1 }),
      c({ oid: 'd', daysAgo: 2 }),
      c({ oid: 'R', daysAgo: 3, message: 'before-restore: snapshot deadbeef' }),
      c({ oid: 'b', daysAgo: 4 }),
      c({ oid: 'a', daysAgo: 5 }),
    ];
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids: new Set(),
      milestoneOid: 'X',
      milestoneLabel: 'hito',
    });
    expect(plan.fuseGroups).toHaveLength(2);
    // Grupo anterior (sin label) — auto-batch.
    expect(plan.fuseGroups[0]!.oids).toEqual(['a', 'b']);
    expect(plan.fuseGroups[0]!.label).toBeUndefined();
    // Grupo terminal (con label).
    expect(plan.fuseGroups[1]!.oids).toEqual(['d', 'X']);
    expect(plan.fuseGroups[1]!.label).toBe('hito');
    // La barrera se preserva intacta.
    expect(plan.preservedOids).toContain('R');
  });

  it('milestone al lado inmediato de otro milestone: grupo de 1 aún se relabela', () => {
    const commits = [c({ oid: 'X', daysAgo: 1 }), c({ oid: 'PREV', daysAgo: 2 })];
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids: new Set(['PREV']),
      milestoneOid: 'X',
      milestoneLabel: 'cierre',
    });
    // why: el grupo terminal, aunque tenga 1 solo commit, se rewrite'a
    //      para que el subject sea el nombre del milestone. Sin esta
    //      excepción, marcar un milestone sobre un commit "solitario"
    //      nunca dejaría el nombre en el log.
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.oids).toEqual(['X']);
    expect(plan.fuseGroups[0]!.label).toBe('cierre');
    expect(plan.preservedOids).toEqual(['PREV']);
  });

  it('grupo intermedio de 1 se preserva (no se relabela)', () => {
    const commits = [
      c({ oid: 'X', daysAgo: 1 }),
      c({ oid: 'c', daysAgo: 2 }),
      c({ oid: 'R', daysAgo: 3, message: 'before-restore: snapshot x' }),
      c({ oid: 'a', daysAgo: 4 }), // solitario entre root y barrera
    ];
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids: new Set(),
      milestoneOid: 'X',
      milestoneLabel: 'hito',
    });
    // 'a' solo antes de R: preservado, no fusiona.
    // R: barrera, preservado.
    // [c, X]: grupo terminal con label.
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.oids).toEqual(['c', 'X']);
    expect(plan.fuseGroups[0]!.label).toBe('hito');
    expect([...plan.preservedOids].sort()).toEqual(['R', 'a']);
  });

  it('milestone oid no encontrado en el log: plan vacío, todo preservado', () => {
    const commits = [c({ oid: 'a', daysAgo: 1 }), c({ oid: 'b', daysAgo: 2 })];
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids: new Set(),
      milestoneOid: 'MISSING',
      milestoneLabel: 'x',
    });
    expect(plan.fuseGroups).toEqual([]);
    expect([...plan.preservedOids].sort()).toEqual(['a', 'b']);
  });

  it('milestone es el root del log: grupo de 1 con label', () => {
    const commits = [c({ oid: 'a', daysAgo: 1 })];
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids: new Set(),
      milestoneOid: 'a',
      milestoneLabel: 'inicio',
    });
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.oids).toEqual(['a']);
    expect(plan.fuseGroups[0]!.label).toBe('inicio');
  });

  it('commits posteriores al milestone quedan intactos', () => {
    const commits = [
      c({ oid: 'newer2', daysAgo: 0 }),
      c({ oid: 'newer1', daysAgo: 1 }),
      c({ oid: 'X', daysAgo: 2 }),
      c({ oid: 'a', daysAgo: 3 }),
    ];
    const plan = buildMilestoneCompactionPlan({
      commits,
      tagOids: new Set(),
      milestoneOid: 'X',
      milestoneLabel: 'hito',
    });
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.oids).toEqual(['a', 'X']);
    expect(plan.preservedOids).toContain('newer1');
    expect(plan.preservedOids).toContain('newer2');
  });
});
