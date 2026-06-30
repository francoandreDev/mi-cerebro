import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ContinuityService } from '@core/continuity/continuity.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import { HOME_GROUPS, HOME_WORKFLOWS_FUTURE, HOME_WORKFLOWS_TODAY } from '../home.content';
import type { HomeCard, HomeGroup, HomeWorkflow } from '../home.content';

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
}
