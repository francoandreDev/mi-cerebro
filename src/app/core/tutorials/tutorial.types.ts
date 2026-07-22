import type { TranslationKey } from '@core/i18n/i18n.types';

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TutorialStep {
  /** CSS selector matched against the live DOM to find the element to spotlight. */
  readonly anchorSelector: string;
  readonly titleKey: TranslationKey;
  readonly bodyKey: TranslationKey;
  readonly placement?: TutorialPlacement;
  /**
   * Route to navigate to before activating this step (e.g. '/writings').
   * Only set on steps that belong to a cross-page flow — single-page
   * tutorials omit it and stay on whatever route they were started from.
   */
  readonly route?: string;
}

export interface TutorialDefinition {
  /** Page id — matches the route slug this tutorial belongs to (see routePageId). */
  readonly id: string;
  readonly steps: readonly TutorialStep[];
}

export interface TutorialActiveState {
  readonly definition: TutorialDefinition;
  readonly stepIndex: number;
}
