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
  /**
   * A power-user gesture, keyboard shortcut, or action not required for a
   * first real use of the page. Absent = `'basico'`. `start(id, 'auto')`
   * filters these out; `start(id, 'manual')` (the default, used by the
   * "Guía de la página" button and cross-page flows) runs the full sequence.
   */
  readonly tier?: 'basico' | 'avanzado';
  /**
   * Optional deeper content on the *same* anchor as this step — for a
   * gesture that already has its own step but deserves more explanation
   * (e.g. what each button in a toolbar does) without fragmenting into a
   * new step or moving the spotlight. Use a new step instead when the
   * extra content lives on a *different* element.
   */
  readonly moreDetail?: { readonly titleKey?: TranslationKey; readonly bodyKey: TranslationKey };
}

export interface TutorialDefinition {
  /** Unique key for this flow — used for start(id) and seen-tracking. */
  readonly id: string;
  /**
   * Groups definitions for the page-help picker — matches the route slug
   * (see routePageId). Distinct from `id` because a page can register
   * several flows (one per tab, one cross-tab, etc.); most pages today
   * still have exactly one definition, where `pageId === id`.
   */
  readonly pageId: string;
  /**
   * Short name shown in the picker when a page has more than one
   * definition. Unused (and safe to omit) when `pageId` has a single
   * registered definition — the ✨ button starts it directly, no picker.
   */
  readonly labelKey?: TranslationKey;
  readonly steps: readonly TutorialStep[];
}

export interface TutorialActiveState {
  readonly definition: TutorialDefinition;
  readonly stepIndex: number;
}
