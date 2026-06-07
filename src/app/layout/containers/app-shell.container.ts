import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import { ThemeService } from '@core/theme/theme.service';
import { OnboardingContainer } from '@features/onboarding/containers/onboarding.container';
import { CommandPaletteContainer } from '@features/search/containers/command-palette.container';

import { ErrorDisplayContainer } from './error-display.container';

@Component({
  selector: 'mc-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ErrorDisplayContainer, OnboardingContainer, CommandPaletteContainer],
  template: `
    @if (workspace.isReady()) {
      <main class="content">
        <router-outlet />
      </main>
      <mc-command-palette />
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
    .content {
      padding: var(--mc-space-5);
    }
  `,
})
export class AppShellContainer {
  // why: instantiate so theme is applied before first paint.
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  protected readonly workspace = inject(WorkspaceService);
  private readonly errors = inject(ErrorService);

  constructor() {
    this.workspace.bootstrap().catch((e: unknown) => this.errors.report(e));
  }
}
