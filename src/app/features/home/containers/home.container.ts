import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ContinuityService } from '@core/continuity/continuity.service';
import {
  HOME_GROUPS,
  HOME_WORKFLOWS_FUTURE,
  HOME_WORKFLOWS_TODAY,
} from '@core/home-content/home-content';
import type { HomeCard, HomeGroup, HomeWorkflow } from '@core/home-content/home-content';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TutorialService } from '@core/tutorials/tutorial.service';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './home.container.html',
  styleUrl: './home.container.css',
})
export class HomeContainer {
  private readonly i18n = inject(I18nService);
  private readonly continuity = inject(ContinuityService);
  private readonly router = inject(Router);

  protected readonly groups: readonly HomeGroup[] = HOME_GROUPS;
  protected readonly workflowsToday: readonly HomeWorkflow[] = HOME_WORKFLOWS_TODAY;
  protected readonly workflowsFuture: readonly HomeWorkflow[] = HOME_WORKFLOWS_FUTURE;

  protected readonly resumeRoute = computed<string | null>(() => {
    const last = this.continuity.getLastRoute();
    if (!last || last === '/' || last === '') return null;
    return last;
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected resumeLabel(): string {
    const route = this.resumeRoute();
    if (!route) return '';
    return this.i18n.t('home.resume.button', { route });
  }

  protected open(card: HomeCard): void {
    void this.router.navigateByUrl(card.route);
  }

  protected resume(): void {
    const route = this.resumeRoute();
    if (route) void this.router.navigateByUrl(route);
  }

  // why: capture/writing already play out entirely inside one page, so
  //      "Recorrer" for those just starts that page's own tutorial instead
  //      of duplicating the same steps as a separate flow definition.
  private readonly tutorials = inject(TutorialService);
  private static readonly WORKFLOW_TUTORIAL_ID: Readonly<Record<string, string>> = {
    capture: 'notes',
    writing: 'writings',
    project: 'flow-project',
    daily: 'flow-daily',
  };

  protected startWorkflow(workflow: HomeWorkflow): void {
    const id = HomeContainer.WORKFLOW_TUTORIAL_ID[workflow.key];
    if (id) this.tutorials.start(id);
  }
}
