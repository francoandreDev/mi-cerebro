import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import { CommandPaletteService } from '@core/search/command-palette.service';
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
      <button
        type="button"
        class="search-fab"
        [attr.aria-label]="i18n.t('palette.openButton')"
        [title]="i18n.t('palette.openButton')"
        (click)="palette.show()"
      >
        🔍
      </button>
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
    .search-fab {
      position: fixed;
      top: var(--mc-space-3);
      right: var(--mc-space-3);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--mc-border);
      background: var(--mc-bg-elevated);
      color: var(--mc-fg-primary);
      cursor: pointer;
      font-size: 1.1rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 900;
    }
    .search-fab:hover {
      background: var(--mc-bg-base);
    }
  `,
})
export class AppShellContainer {
  // why: instantiate so theme is applied before first paint.
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  protected readonly workspace = inject(WorkspaceService);
  protected readonly palette = inject(CommandPaletteService);
  private readonly errors = inject(ErrorService);

  constructor() {
    this.workspace.bootstrap().catch((e: unknown) => this.errors.report(e));
  }
}
