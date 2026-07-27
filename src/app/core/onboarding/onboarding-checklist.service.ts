import { Injectable, computed, inject, signal } from '@angular/core';

import { SettingsService } from '@core/settings/settings.service';
import { hasSeenTutorial } from '@core/tutorials/tutorial-storage';
import { TutorialService } from '@core/tutorials/tutorial.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { NotesService } from '@features/notes/services/notes.service';

import { loadOnboardingDismissed, saveOnboardingDismissed } from './onboarding-storage';
import type { OnboardingStep } from './onboarding.types';

// why: features/home must not import from features/notes|goals (rule 10) —
//      same reasoning as core/dashboard/dashboard.service.ts. This core
//      service injects the feature services directly (the lint gate only
//      restricts imports from inside features/**) and exposes plain
//      OnboardingStep view-models the dumb home component can render.
const HOME_FLOW_TUTORIAL_IDS = ['flow-project', 'flow-daily'] as const;

@Injectable({ providedIn: 'root' })
export class OnboardingChecklistService {
  private readonly notes = inject(NotesService);
  private readonly goals = inject(GoalsService);
  private readonly settings = inject(SettingsService);
  private readonly tutorials = inject(TutorialService);

  private readonly dismissedSignal = signal<boolean>(loadOnboardingDismissed());
  readonly dismissed = this.dismissedSignal.asReadonly();

  readonly items = computed<readonly OnboardingStep[]>(() => {
    // why: hasSeenTutorial() reads localStorage, not a signal — reading
    //      tutorials.active() here gives the computed a real dependency
    //      that flips (to null) right when a flow tutorial finishes, so
    //      "Recorré un flujo típico" flips to done without a new signal.
    this.tutorials.active();
    return [
      {
        id: 'first-note',
        titleKey: 'home.onboarding.note.title',
        descriptionKey: 'home.onboarding.note.description',
        icon: 'note-pencil',
        route: '/notes',
        done: this.notes.summaries().length >= 1,
      },
      {
        id: 'pick-theme',
        titleKey: 'home.onboarding.theme.title',
        descriptionKey: 'home.onboarding.theme.description',
        icon: 'palette',
        route: '/settings',
        done: this.hasCustomTheme(),
      },
      {
        id: 'first-goal',
        titleKey: 'home.onboarding.goal.title',
        descriptionKey: 'home.onboarding.goal.description',
        icon: 'target',
        route: '/goals',
        done: this.goals.summaries().length >= 1,
      },
      {
        id: 'try-flow',
        titleKey: 'home.onboarding.flow.title',
        descriptionKey: 'home.onboarding.flow.description',
        icon: 'sparkle',
        route: '/',
        done: HOME_FLOW_TUTORIAL_IDS.some((id) => hasSeenTutorial(id)),
      },
    ];
  });

  readonly completedCount = computed(() => this.items().filter((item) => item.done).length);
  readonly allDone = computed(() => this.completedCount() === this.items().length);
  readonly visible = computed(() => !this.dismissedSignal());

  dismiss(): void {
    this.dismissedSignal.set(true);
    saveOnboardingDismissed(true);
  }

  private hasCustomTheme(): boolean {
    const theme = this.settings.state().theme;
    return (
      theme.override !== 'auto' ||
      theme.customBgHue !== undefined ||
      theme.customBgSatLevel !== undefined ||
      theme.customAccentId !== undefined
    );
  }
}
