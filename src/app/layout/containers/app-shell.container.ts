import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ContinuityService } from '@core/continuity/continuity.service';
import { DragAutoScrollService } from '@core/dnd/drag-auto-scroll.service';
import { ErrorService } from '@core/errors/error.service';
import { FocusModeService } from '@core/focus-mode/focus-mode.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { QuickCaptureService } from '@core/intents/quick-capture.service';
import { GoalDormantRemindersSyncService } from '@core/reminders/goal-dormant-reminders-sync.service';
import { GoalRemindersSyncService } from '@core/reminders/goal-reminders-sync.service';
import { TaskRemindersSyncService } from '@core/reminders/task-reminders-sync.service';
import { WritingRemindersSyncService } from '@core/reminders/writing-reminders-sync.service';
import { SettingsService } from '@core/settings/settings.service';
import { KeyboardHelpDialogComponent } from '@core/shortcuts/keyboard-help-dialog.component';
import { ThemeService } from '@core/theme/theme.service';
import { registerHomeFlowTutorials } from '@core/tutorials/home-flows.tutorial';
import { AutocommitService } from '@core/versioning/autocommit.service';
import { AutoPushService } from '@core/versioning/auto-push.service';
import { CompactionSchedulerService } from '@core/versioning/compaction-scheduler.service';
import { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { VariantsService } from '@core/versioning/variants.service';
import { OnboardingContainer } from '@features/onboarding/containers/onboarding.container';
import { ReminderToastContainer } from '@features/reminders/containers/reminder-toast.container';
import { CommandPaletteContainer } from '@features/search/containers/command-palette.container';

import { PageHelpControlComponent } from '@layout/components/page-help-control.component';
import { RemoteDivergenceBannerComponent } from '@layout/components/remote-divergence-banner.component';
import { QuickCaptureDialogComponent } from '@shared/quick-capture/quick-capture-dialog.component';
import { TutorialOverlayComponent } from '@shared/tutorial-overlay/tutorial-overlay.component';

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
    ReminderToastContainer,
    MiniPlayerContainer,
    VariantSwitchOverlayContainer,
    RemoteDivergenceBannerComponent,
    KeyboardHelpDialogComponent,
    QuickCaptureDialogComponent,
    TutorialOverlayComponent,
    PageHelpControlComponent,
  ],
  template: `
    @if (workspace.isReady()) {
      @if (!focusMode.active()) {
        <mc-remote-divergence-banner />
      }
      <div class="shell">
        @if (!focusMode.active()) {
          <mc-workspace-sidebar />
        }
        <main class="content">
          <router-outlet />
        </main>
      </div>
      <mc-command-palette />
      <mc-keyboard-help-dialog />
      <mc-tutorial-overlay />
      @if (!focusMode.active()) {
        <mc-page-help-control />
      }
      <mc-quick-capture-dialog
        [visible]="quickCapture.open()"
        (submitted)="quickCapture.capture($event)"
        (cancelled)="quickCapture.closeDialog()"
      />
      @if (!focusMode.active()) {
        <mc-reminder-toast />
        <mc-mini-player />
      }
      <mc-variant-switch-overlay />
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
      height: calc(100vh - var(--mc-mini-player-h, 0px));
    }
    .content {
      flex: 1;
      min-width: 0;
      overflow: auto;
    }
    @media (max-width: 480px) {
      .shell {
        flex-direction: column;
      }
      .content {
        order: 1;
        min-height: 0;
      }
      mc-workspace-sidebar {
        order: 2;
        flex: 0 0 auto;
      }
    }
  `,
})
export class AppShellContainer {
  // why: instantiate so theme is applied before first paint.
  protected readonly theme = inject(ThemeService);
  protected readonly workspace = inject(WorkspaceService);
  protected readonly focusMode = inject(FocusModeService);
  // why: instantiate eagerly so Alt+Shift+N works everywhere, not just
  //      once a container that happens to inject it renders.
  protected readonly quickCapture = inject(QuickCaptureService);
  private readonly errors = inject(ErrorService);
  private readonly autocommit = inject(AutocommitService);
  // why: instantiate AutoPushService eagerly so its effect on
  //      autocommit.lastCommitAt is registered before the first commit.
  private readonly autoPush = inject(AutoPushService);
  // why: instantiate eagerly so the workspace-ready effect inside the
  //      scheduler fires once permissions are granted.
  private readonly compactionScheduler = inject(CompactionSchedulerService);
  private readonly variantsService = inject(VariantsService);
  private readonly switchVariant = inject(SwitchVariantService);
  private readonly settings = inject(SettingsService);
  private readonly continuity = inject(ContinuityService);
  private readonly dragAutoScroll = inject(DragAutoScrollService);
  // why: instantiate eagerly so its effect on goals/reminders summaries
  //      starts watching at boot; otherwise no consumer would pull it in.
  private readonly goalRemindersSync = inject(GoalRemindersSyncService);
  // why: same reasoning — eager instantiation so the dormancy-edge effect
  //      watches from boot.
  private readonly goalDormantRemindersSync = inject(GoalDormantRemindersSyncService);
  // why: §14 extension — same eager-instantiation reasoning, now for tasks
  //      and writings with a deadline.
  private readonly taskRemindersSync = inject(TaskRemindersSyncService);
  private readonly writingRemindersSync = inject(WritingRemindersSyncService);

  constructor() {
    registerHomeFlowTutorials();
    this.continuity.start();
    this.dragAutoScroll.start();
    this.autoPush.start();
    this.compactionScheduler.start();
    void this.goalRemindersSync;
    void this.goalDormantRemindersSync;
    void this.taskRemindersSync;
    void this.writingRemindersSync;
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
