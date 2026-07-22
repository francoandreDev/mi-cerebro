import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { HOME_GROUPS } from '@core/home-content/home-content';

import type { TutorialDefinition, TutorialPlacement } from './tutorial.types';

export interface StepAnchorOverride {
  /** 1-based step number (matches home.entity.<key>.step.N) to re-anchor. */
  readonly step: number;
  readonly anchorSelector: string;
  readonly placement?: TutorialPlacement;
}

// why: home-content.ts is the single source of truth for "what does this
//      section do" copy (already written, already vetted) — this builder
//      turns a HomeCard's steps into a TutorialDefinition instead of each
//      feature re-typing near-duplicate TutorialStep boilerplate 17 times.
//      `defaultAnchor` covers steps with no distinct real element (first
//      contact / an element gated behind an interaction that hasn't
//      happened yet); `overrides` point a specific step at the actual
//      element its text describes when one exists and is always rendered
//      — reusing one anchor for every step regardless of what the text
//      says was the mistake this param fixes.
export function buildEntityTutorial(
  cardKey: string,
  defaultAnchor: string,
  overrides?: readonly StepAnchorOverride[],
  defaultPlacement?: TutorialPlacement,
): TutorialDefinition {
  const card = HOME_GROUPS.flatMap((g) => g.cards).find((c) => c.key === cardKey);
  if (!card) {
    throw new AppError(ERROR_CODES.UI_002, {
      severity: 'fatal',
      recoverable: false,
      context: { cardKey },
    });
  }
  return {
    id: cardKey,
    steps: card.steps.map((bodyKey, i) => {
      const override = overrides?.find((o) => o.step === i + 1);
      const placement = override?.placement ?? defaultPlacement;
      return {
        anchorSelector: override?.anchorSelector ?? defaultAnchor,
        titleKey: card.title,
        bodyKey,
        ...(placement ? { placement } : {}),
      };
    }),
  };
}
