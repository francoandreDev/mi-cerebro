import { describe, expect, it } from 'vitest';

import type { GoalSummary } from '../models/goal.types';
import { buildConstellationLinks, buildStars } from './goal-wall-layout.utils';

const NOW = Date.parse('2026-07-15T12:00:00.000Z');
const DAY_MS = 86_400_000;
const daysAgoIso = (days: number): string => new Date(NOW - days * DAY_MS).toISOString();

const goal = (overrides: Partial<GoalSummary>): GoalSummary => ({
  id: 'g1',
  title: 'Goal',
  deadline: null,
  completed: false,
  priority: 'med',
  progress: 0,
  reminder: { enabled: false, notifyOnDormant: false },
  lastProgressAt: daysAgoIso(0),
  updatedAt: daysAgoIso(0),
  tags: [],
  folder: '',
  position: '0',
  steps: [],
  stepsTotal: 0,
  stepsDone: 0,
  ...overrides,
});

const noFilter = { query: '', tagIds: new Set<string>(), hideCompleted: false };
const centerOf = () => ({ cx: 50, cy: 50 });
const labels = { untitled: 'Sin título', stepPlaceholder: '' };

describe('buildStars', () => {
  it('flags the solitary star as dormant when past the threshold', () => {
    const g = goal({ lastProgressAt: daysAgoIso(30) });
    const [star] = buildStars([g], noFilter, '2026-07-15', centerOf, labels, 14, NOW);
    expect(star?.dormant).toBe(true);
  });

  it('propagates dormant to every step-star of the same goal', () => {
    const g = goal({
      lastProgressAt: daysAgoIso(30),
      steps: [
        { id: 's1', title: 'a', done: false },
        { id: 's2', title: 'b', done: true },
      ],
    });
    const stars = buildStars([g], noFilter, '2026-07-15', centerOf, labels, 14, NOW);
    expect(stars).toHaveLength(2);
    expect(stars.every((s) => s.dormant)).toBe(true);
  });

  it('never flags a completed goal as dormant regardless of age', () => {
    const g = goal({ completed: true, lastProgressAt: daysAgoIso(400) });
    const [star] = buildStars([g], noFilter, '2026-07-15', centerOf, labels, 14, NOW);
    expect(star?.dormant).toBe(false);
  });

  it('is not dormant when activity is within the threshold', () => {
    const g = goal({ lastProgressAt: daysAgoIso(3) });
    const [star] = buildStars([g], noFilter, '2026-07-15', centerOf, labels, 14, NOW);
    expect(star?.dormant).toBe(false);
  });
});

describe('buildConstellationLinks', () => {
  it('builds one link per extra step beyond the first (MST edge count)', () => {
    const g = goal({
      steps: [
        { id: 's1', title: 'a', done: false },
        { id: 's2', title: 'b', done: false },
        { id: 's3', title: 'c', done: false },
      ],
    });
    const stars = buildStars([g], noFilter, '2026-07-15', centerOf, labels, 14, NOW);
    const links = buildConstellationLinks(stars);
    expect(links).toHaveLength(2);
  });

  it('produces no links for a goal without steps', () => {
    const g = goal({});
    const stars = buildStars([g], noFilter, '2026-07-15', centerOf, labels, 14, NOW);
    expect(buildConstellationLinks(stars)).toHaveLength(0);
  });
});
