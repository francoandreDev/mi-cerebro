import type { GoalPriority, GoalSummary } from '../models/goal.types';
import { isGoalDormant } from '../models/goal.types';

export type StarState = 'completed' | 'overdue' | 'soon' | 'active';

export interface StarVm {
  readonly key: string;
  readonly goalId: string;
  readonly stepId: string | null;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly opacity: number;
  readonly glow: number;
  readonly done: boolean;
  readonly dim: boolean;
  readonly pulsing: boolean;
  readonly dormant: boolean;
  readonly state: StarState;
  readonly title: string;
  readonly goalTitle: string;
}

export interface LinkVm {
  readonly goalId: string;
  readonly a: string;
  readonly b: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly dim: boolean;
}

const SIZE_BY_PRIORITY: Record<GoalPriority, number> = { low: 14, med: 20, high: 30 };

export interface StarFilterState {
  readonly query: string;
  readonly tagIds: ReadonlySet<string>;
  readonly hideCompleted: boolean;
}

// why: docs/evolution.md idea 3 — extraído de goals-wall.container.ts (§4.4
//      límite duro de 300 líneas) al mismo tiempo que se le sumó el flag
//      `dormant`, ya que había que reescribir el bloque igual.
export const buildStars = (
  goals: readonly GoalSummary[],
  filters: StarFilterState,
  todayIso: string,
  centerOf: (goal: { id: string; wallCenter?: { x: number; y: number } }) => {
    cx: number;
    cy: number;
  },
  labels: { untitled: string; stepPlaceholder: string },
  dormantThresholdDays: number,
  nowMs: number,
): readonly StarVm[] => {
  const q = normTitle(filters.query.trim());
  const out: StarVm[] = [];
  for (const goal of goals) {
    const matchesQuery = !q || normTitle(goal.title).includes(q);
    const matchesTags = filters.tagIds.size === 0 || goal.tags.some((id) => filters.tagIds.has(id));
    const matchesDone = !filters.hideCompleted || !goal.completed;
    const dim = !(matchesQuery && matchesTags && matchesDone);
    const days = daysUntil(goal.deadline, todayIso);
    const overdue = !goal.completed && days !== null && days < 0;
    const soon = !goal.completed && days !== null && days >= 0 && days <= 7;
    const dormant = isGoalDormant(goal.completed, goal.lastProgressAt, dormantThresholdDays, nowMs);
    const state: StarState = goal.completed
      ? 'completed'
      : overdue
        ? 'overdue'
        : soon
          ? 'soon'
          : 'active';
    const base = SIZE_BY_PRIORITY[goal.priority];
    const { cx, cy } = centerOf(goal);
    const steps = goal.steps;
    const goalTitle = goal.title || labels.untitled;
    if (steps.length === 0) {
      out.push({
        key: `g:${goal.id}`,
        goalId: goal.id,
        stepId: null,
        x: cx,
        y: cy,
        size: base,
        opacity: goal.completed ? 0.5 : 0.95,
        glow: base * 1.2,
        done: goal.completed,
        dim,
        pulsing: soon || overdue,
        dormant,
        state,
        title: goalTitle,
        goalTitle,
      });
      continue;
    }
    const stepSize = Math.round(base * 0.72);
    for (const step of steps) {
      // why: el editor guarda x/y absolutos (0-100) del lienzo de la meta;
      //      en el wall el centro de cada constelación es (cx, cy), así que
      //      mapeamos (x-50, y-50) y lo escalamos a la sub-región típica
      //      (~±12 de stepOffset) para que el orden relativo del editor se
      //      refleje en el wall. Sin x/y → fallback hash determinístico.
      const hasPos = typeof step.x === 'number' && typeof step.y === 'number';
      const dx = hasPos ? (step.x! - 50) * 0.25 : stepOffset(step.id, steps.length).dx;
      const dy = hasPos ? (step.y! - 50) * 0.25 : stepOffset(step.id, steps.length).dy;
      const done = goal.completed || step.done;
      out.push({
        key: `s:${goal.id}:${step.id}`,
        goalId: goal.id,
        stepId: step.id,
        x: cx + dx,
        y: cy + dy,
        size: done ? Math.round(stepSize * 0.85) : stepSize,
        opacity: done ? 0.42 : 0.95,
        glow: stepSize * (done ? 0.8 : 1.3),
        done,
        dim,
        pulsing: !done && (soon || overdue),
        dormant,
        state,
        title: step.title || labels.stepPlaceholder,
        goalTitle,
      });
    }
  }
  return out;
};

// why: MST por goal sobre sus steps → dibuja la "forma" de la constelación.
export const buildConstellationLinks = (stars: readonly StarVm[]): readonly LinkVm[] => {
  const byGoal = new Map<string, StarVm[]>();
  for (const star of stars) {
    if (star.stepId === null) continue;
    let arr = byGoal.get(star.goalId);
    if (!arr) {
      arr = [];
      byGoal.set(star.goalId, arr);
    }
    arr.push(star);
  }
  const out: LinkVm[] = [];
  for (const [goalId, members] of byGoal) {
    if (members.length < 2) continue;
    const inTree = new Set<string>([members[0]!.stepId!]);
    while (inTree.size < members.length) {
      let best: { a: StarVm; b: StarVm; d: number } | null = null;
      for (const a of members) {
        if (!inTree.has(a.stepId!)) continue;
        for (const b of members) {
          if (inTree.has(b.stepId!)) continue;
          const dx = a.x - b.x,
            dy = a.y - b.y,
            d = dx * dx + dy * dy;
          if (!best || d < best.d) best = { a, b, d };
        }
      }
      if (!best) break;
      inTree.add(best.b.stepId!);
      out.push({
        goalId,
        a: best.a.stepId!,
        b: best.b.stepId!,
        x1: best.a.x,
        y1: best.a.y,
        x2: best.b.x,
        y2: best.b.y,
        dim: best.a.dim || best.b.dim,
      });
    }
  }
  return out;
};

// why: djb2 hash → posición estable por id sin guardar coordenadas.
export const hashStr = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
};

export const normTitle = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const constellationCenter = (goalId: string): { cx: number; cy: number } => {
  const h = hashStr(goalId);
  const a = h & 0xffff;
  const b = (h >>> 16) & 0xffff;
  // why: 18% padding por lado para que el cluster no clipee con bordes.
  return {
    cx: 18 + (a / 0xffff) * 64,
    cy: 18 + (b / 0xffff) * 64,
  };
};

export const stepOffset = (stepId: string, total: number): { dx: number; dy: number } => {
  const h = hashStr(stepId);
  const a = h & 0xffff;
  const b = (h >>> 16) & 0xffff;
  const angle = (a / 0xffff) * Math.PI * 2;
  // why: radio crece (suave) con cantidad de pasos para que clusters chicos
  //      sean compactos y los grandes ganen aire. Cap a ~12% del cielo.
  const rMax = 4 + Math.min(total, 8);
  const rMin = 2.5;
  const r = rMin + (b / 0xffff) * (rMax - rMin);
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
};

export const daysUntil = (deadline: string | null, todayIso: string): number | null => {
  if (!deadline) return null;
  const a = Date.parse(deadline + 'T00:00:00');
  const b = Date.parse(todayIso + 'T00:00:00');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
};
