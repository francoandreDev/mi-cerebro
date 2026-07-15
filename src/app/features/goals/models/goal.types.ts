import type { JSONContent } from '@tiptap/core';

export const GOAL_SCHEMA_VERSION = 8;
export const GOAL_KIND = 'goal';
export const GOALS_DIR = 'goals';
export const GOAL_FILE_SUFFIX = '.json';

export type GoalPriority = 'low' | 'med' | 'high';
export const GOAL_PRIORITIES: readonly GoalPriority[] = ['low', 'med', 'high'];
export const DEFAULT_GOAL_PRIORITY: GoalPriority = 'med';

export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly tags: readonly string[];
  // why: single horizon — §13 frames goals as "tenés X tiempo para…",
  //      a single deadline. Optional because not every goal has a date.
  readonly deadline: string | null;
  readonly completed: boolean;
  // why: §13 — priority shapes star size in the constellation wall and
  //      orders triage when many goals share the same horizon.
  readonly priority: GoalPriority;
  // why: §13 — manual 0–100 progress. Invariant: completed ⇒ progress=100.
  //      Service enforces on save; migration backfills from completed.
  readonly progress: number;
  // why: §14 — auto-generates a Reminder per goal with deadline, cadence
  //      derived from proximity (see core/reminders/goal-cadence.utils).
  //      Toggle lives on the goal; cadence is fixed for now (YAGNI).
  readonly reminder: GoalReminderConfig;
  // why: §13 — sub-pasos del objetivo. Cada step = una estrella de la
  //      constelación en /goals. Cuando hay ≥1 step, progress se deriva
  //      (done/total*100); con cero steps, progress sigue siendo manual.
  readonly steps: readonly GoalStep[];
  // why: §13 — centro de la constelación en el wall si el usuario la arrastró;
  //      ausente cae al hash determinístico de `constellationCenter(goal.id)`.
  readonly wallCenter?: { readonly x: number; readonly y: number };
  // why: docs/evolution.md idea 3 — "acompañamiento adaptativo". Distinto de
  //      `updatedAt` (que cualquier edición toca, incluso título/tags):
  //      sólo se mueve cuando `progress`, `completed` o el done-state de los
  //      `steps` cambian. `updatedAt` mide "cuándo se tocó la meta";
  //      `lastProgressAt` mide "cuándo avanzó de verdad" — es la señal de
  //      dormancia, no la de edición.
  readonly lastProgressAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly position?: string;
  readonly [key: string]: unknown;
}

export interface GoalReminderConfig {
  readonly enabled: boolean;
}

export const DEFAULT_GOAL_REMINDER: GoalReminderConfig = { enabled: false };

export interface GoalStep {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  // why: §13 — el editor permite "sembrar" pasos clickeando el lienzo;
  //      x/y en % del canvas persisten esa posición. Si están ausentes,
  //      la wall/editor caen al fallback hash-based determinístico.
  readonly x?: number;
  readonly y?: number;
}

export const newGoalStep = (title = '', x?: number, y?: number): GoalStep => {
  const base: GoalStep = { id: crypto.randomUUID(), title, done: false };
  if (typeof x === 'number' && typeof y === 'number') return { ...base, x, y };
  return base;
};

export const deriveProgressFromSteps = (steps: readonly GoalStep[]): number | null => {
  if (steps.length === 0) return null;
  const done = steps.reduce((n, s) => n + (s.done ? 1 : 0), 0);
  return Math.round((done / steps.length) * 100);
};

export interface GoalSummary {
  readonly id: string;
  readonly title: string;
  readonly deadline: string | null;
  readonly completed: boolean;
  readonly priority: GoalPriority;
  readonly progress: number;
  readonly reminder: GoalReminderConfig;
  readonly lastProgressAt: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly position: string;
  // why: wall renderiza una constelación por meta; necesita las estrellas
  //      (pasos) sin abrir el archivo completo de cada goal. Lista plana
  //      con `id/title/done` por step — basta para posicionar, dibujar y
  //      togglear desde la wall.
  readonly steps: readonly GoalStep[];
  readonly stepsTotal: number;
  readonly stepsDone: number;
  readonly wallCenter?: { readonly x: number; readonly y: number };
}

export const clampProgress = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
};

export const isGoalPriority = (v: unknown): v is GoalPriority =>
  v === 'low' || v === 'med' || v === 'high';

// why: docs/evolution.md idea 3. `completed` goals are exempt — dormancy
//      is about goals dying quietly, not about goals that already finished.
export const isGoalDormant = (
  completed: boolean,
  lastProgressAt: string,
  thresholdDays: number,
  nowMs: number,
): boolean => {
  if (completed) return false;
  const activityMs = Date.parse(lastProgressAt);
  if (Number.isNaN(activityMs)) return false;
  return nowMs - activityMs > thresholdDays * 86_400_000;
};

export const emptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
