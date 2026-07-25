import type { TranslationKey } from '@core/i18n/i18n.types';
import type { IconName } from '@shared/icon/icons.data';

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right';

// why: a step can ask the user to actually perform the gesture it
//      describes instead of just reading it and clicking "Siguiente" — the
//      overlay listens for this DOM event (capture phase, so it sees it
//      even if the target element stops propagation) and treats it as
//      "practiced" once it matches. `selector` defaults to the step's own
//      `anchorSelector` (the thing being spotlighted is usually the thing
//      to interact with); `key`/`ctrlOrMeta` narrow a `keydown` to a
//      specific shortcut (e.g. Ctrl+K, "?"). `icon` names the *purpose* of
//      the gesture (create/move/search/delete/...) using the app's own
//      icon set, drawn inside the pulsing marker — so the marker itself
//      teaches what the action is for even with the text stripped away,
//      instead of always showing the same generic tap cursor.
export interface TutorialStepAction {
  readonly event: 'click' | 'submit' | 'keydown' | 'dragstart';
  readonly selector?: string;
  readonly key?: string;
  readonly ctrlOrMeta?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly icon?: IconName;
}

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
  /** When set, the overlay waits for this real interaction and auto-advances once practiced. */
  readonly action?: TutorialStepAction;
  /**
   * When true, a step whose anchorSelector isn't found in the live DOM is
   * skipped automatically instead of leaving the card floating at (0,0) —
   * for steps that describe a gesture on an entity the user may not have
   * created yet (a note, a writing, a book, a gallery).
   */
  readonly skipIfMissing?: boolean;
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
