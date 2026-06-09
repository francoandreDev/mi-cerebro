import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { ThemeService } from '@core/theme/theme.service';
import { GoalReminderContainer } from '@features/goals/containers/goal-reminder.container';
import { OnboardingContainer } from '@features/onboarding/containers/onboarding.container';
import { CommandPaletteContainer } from '@features/search/containers/command-palette.container';

import { ErrorDisplayContainer } from './error-display.container';
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
  ],
  template: `
    @if (workspace.isReady()) {
      <div class="shell">
        <mc-workspace-sidebar />
        <main class="content">
          <router-outlet />
        </main>
      </div>
      <mc-command-palette />
      <mc-goal-reminder />
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
  private readonly errors = inject(ErrorService);

  constructor() {
    this.workspace.bootstrap().catch((e: unknown) => this.errors.report(e));
  }
}
