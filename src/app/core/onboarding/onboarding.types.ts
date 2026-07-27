import type { TranslationKey } from '@core/i18n/i18n.types';
import type { IconName } from '@shared/icon/icons.data';

export type OnboardingStepId = 'first-note' | 'pick-theme' | 'first-goal' | 'try-flow';

// why: view-model the dumb OnboardingChecklistComponent renders — same
//      dependency-inversion shape as core/dashboard/dashboard.types.ts:
//      features/home cannot import NotesService/GoalsService (they live in
//      other features, rule 10), so OnboardingChecklistService projects
//      their state into this core-side type instead.
export interface OnboardingStep {
  readonly id: OnboardingStepId;
  readonly titleKey: TranslationKey;
  readonly descriptionKey: TranslationKey;
  readonly icon: IconName;
  readonly route: string;
  readonly done: boolean;
}
