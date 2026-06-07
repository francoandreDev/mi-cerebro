import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { WorkspaceService } from '@core/fs/workspace.service';

import { ForeignFolderModalComponent } from '../components/foreign-folder-modal.component';
import { LoadingScreenComponent } from '../components/loading-screen.component';
import { PermissionBannerComponent } from '../components/permission-banner.component';
import { UnsupportedBrowserComponent } from '../components/unsupported-browser.component';
import { WelcomeCardComponent } from '../components/welcome-card.component';

@Component({
  selector: 'mc-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ForeignFolderModalComponent,
    LoadingScreenComponent,
    PermissionBannerComponent,
    UnsupportedBrowserComponent,
    WelcomeCardComponent,
  ],
  template: `
    @switch (state()) {
      @case ('checking') {
        <mc-loading-screen messageKey="app.loading" />
      }
      @case ('unsupported') {
        <mc-unsupported-browser />
      }
      @case ('needs-root') {
        <mc-welcome-card (choose)="onChoose()" />
      }
      @case ('foreign-folder') {
        <mc-welcome-card (choose)="onChoose()" />
        <mc-foreign-folder-modal
          [folderName]="workspace.rootName()"
          (confirm)="onConfirmForeign()"
          (chooseOther)="onCancelForeign()"
        />
      }
      @case ('needs-permission') {
        <mc-permission-banner [folderName]="workspace.rootName()" (reauth)="onReauth()" />
      }
      @case ('initializing') {
        <mc-loading-screen messageKey="onboarding.initializing" />
      }
    }
  `,
})
export class OnboardingContainer {
  protected readonly workspace = inject(WorkspaceService);
  private readonly errors = inject(ErrorService);

  protected readonly state = this.workspace.state;

  async onChoose(): Promise<void> {
    try {
      await this.workspace.chooseRoot();
    } catch (e) {
      this.errors.report(e);
    }
  }

  async onConfirmForeign(): Promise<void> {
    try {
      await this.workspace.confirmInitInForeign();
    } catch (e) {
      this.errors.report(e);
    }
  }

  onCancelForeign(): void {
    this.workspace.cancelForeign();
  }

  async onReauth(): Promise<void> {
    try {
      await this.workspace.reauthorize();
    } catch (e) {
      this.errors.report(e);
    }
  }
}
