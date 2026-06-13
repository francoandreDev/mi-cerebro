import { ChangeDetectionStrategy, Component, inject, isDevMode } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { SettingsService } from '@core/settings/settings.service';
import { ThemeService } from '@core/theme/theme.service';
import { AutocommitService } from '@core/versioning/autocommit.service';
import { AutoPushService } from '@core/versioning/auto-push.service';
import { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { VariantsService } from '@core/versioning/variants.service';
import { GoalReminderContainer } from '@features/goals/containers/goal-reminder.container';
import { OnboardingContainer } from '@features/onboarding/containers/onboarding.container';
import { ReminderToastContainer } from '@features/reminders/containers/reminder-toast.container';
import { CommandPaletteContainer } from '@features/search/containers/command-palette.container';

import { RemoteDivergenceBannerComponent } from '@layout/components/remote-divergence-banner.component';

import { DevVariantsPanelContainer } from './dev-variants-panel.container';
import { DevVersioningPanelContainer } from './dev-versioning-panel.container';
import { VariantSwitchOverlayContainer } from './variant-switch-overlay.container';
import { ErrorDisplayContainer } from './error-display.container';
import { MiniPlayerContainer } from './mini-player.container';
import { WorkspaceSidebarContainer } from './workspace-sidebar.container';

@Component({
  selector: 'mc-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    ErrorDisplayContainer,
    OnboardingContainer,
    CommandPaletteContainer,
    WorkspaceSidebarContainer,
    GoalReminderContainer,
    ReminderToastContainer,
    MiniPlayerContainer,
    VariantSwitchOverlayContainer,
    DevVersioningPanelContainer,
    DevVariantsPanelContainer,
    RemoteDivergenceBannerComponent,
  ],
  template: `
    @if (workspace.isReady()) {
      <mc-remote-divergence-banner />
      <div class="shell">
        <mc-workspace-sidebar />
        <main class="content">
          <router-outlet />
        </main>
      </div>
      <mc-command-palette />
      <mc-goal-reminder />
      <mc-reminder-toast />
      <mc-mini-player />
      <mc-variant-switch-overlay />
      @if (isDev) {
        <mc-dev-versioning-panel />
        <mc-dev-variants-panel />
      }
    } @else {
      <mc-onboarding />
    }
    <mc-error-display />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--mc-bg-base);
      color: var(--mc-fg-primary);
    }
    .shell {
      display: flex;
      height: 100vh;
    }
    .content {
      flex: 1;
      min-width: 0;
      overflow: auto;
    }
  `,
})
export class AppShellContainer {
  // why: instantiate so theme is applied before first paint.
  protected readonly theme = inject(ThemeService);
  protected readonly workspace = inject(WorkspaceService);
  protected readonly isDev = isDevMode();
  private readonly errors = inject(ErrorService);
  private readonly autocommit = inject(AutocommitService);
  // why: instantiate AutoPushService eagerly so its effect on
  //      autocommit.lastCommitAt is registered before the first commit.
  private readonly autoPush = inject(AutoPushService);
  private readonly variantsService = inject(VariantsService);
  private readonly switchVariant = inject(SwitchVariantService);
  private readonly settings = inject(SettingsService);

  constructor() {
    this.autoPush.start();
    this.workspace
      .bootstrap()
      .then(async () => {
        if (!this.workspace.isReady()) return;
        this.autocommit.start();
        // why: load variants.json before alignWithGit so it knows
        //      what activeId to align HEAD to (covers crash mid-switch).
        await this.variantsService.refresh();
        await this.switchVariant.bootstrap();
        await this.variantsService.refreshActivity(
          this.settings.state().variants.dormantThresholdDays,
        );
      })
      .catch((e: unknown) => this.errors.report(e));
  }
}
