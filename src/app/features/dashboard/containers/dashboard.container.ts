import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { DashboardService } from '@core/dashboard/dashboard.service';
import {
  dashboardEntryRoute,
  type DashboardGoalItem,
  type DashboardRecentEntry,
  type DashboardResurfaceMode,
  type DashboardTaskItem,
} from '@core/dashboard/dashboard.types';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { TagsService } from '@core/tags/tags.service';

import { DashboardGoalsWidgetComponent } from '../components/dashboard-goals-widget.component';
import { DashboardRecentWidgetComponent } from '../components/dashboard-recent-widget.component';
import { DashboardRemindersWidgetComponent } from '../components/dashboard-reminders-widget.component';
import { DashboardResurfaceWidgetComponent } from '../components/dashboard-resurface-widget.component';
import { DashboardTasksWidgetComponent } from '../components/dashboard-tasks-widget.component';
import { registerDashboardTutorial } from './dashboard.tutorial';

@Component({
  selector: 'mc-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DashboardTasksWidgetComponent,
    DashboardGoalsWidgetComponent,
    DashboardRemindersWidgetComponent,
    DashboardRecentWidgetComponent,
    DashboardResurfaceWidgetComponent,
  ],
  templateUrl: './dashboard.container.html',
  styleUrl: './dashboard.container.css',
})
export class DashboardContainer {
  private readonly dashboard = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly tagsService = inject(TagsService);
  private readonly errors = inject(ErrorService);
  private readonly workspace = inject(WorkspaceService);

  protected readonly todayTasks = this.dashboard.todayTasks;
  protected readonly activeGoals = this.dashboard.activeGoals;
  protected readonly upcomingReminders = this.dashboard.upcomingReminders;
  protected readonly recentEntries = this.dashboard.recentEntries;
  protected readonly resurfaceEntries = this.dashboard.resurfaceEntries;
  protected readonly resurfaceMode = this.dashboard.resurfaceMode;
  protected readonly resurfaceRelatedAvailable = this.dashboard.resurfaceRelatedAvailable;
  protected readonly availableTags = this.tagsService.tags;

  constructor() {
    registerDashboardTutorial();
    // why: lazy-loads BooksService.chaptersIndex — only /dashboard pays the
    //      N x listChapters() cost, not app boot (see
    //      docs/deferred/dashboard-evolution.md decision log). Nothing else
    //      calls this path, so a rejection (e.g. a dropped FS permission)
    //      must be caught here or it silently vanishes as an unhandled
    //      promise rejection (regla 28 — "nada falla en silencio").
    this.dashboard.ensureChaptersIndexLoaded().catch((e: unknown) => {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onOpenTask(task: DashboardTaskItem): void {
    void this.router.navigate(['/tasks', entitySlugSegment(task.title, task.id)]);
  }

  protected onOpenGoal(goal: DashboardGoalItem): void {
    void this.router.navigate(['/goals', entitySlugSegment(goal.title, goal.id)]);
  }

  protected onViewAllReminders(): void {
    void this.router.navigate(['/reminders']);
  }

  protected onOpenEntry(entry: DashboardRecentEntry): void {
    void this.router.navigate(dashboardEntryRoute(entry));
  }

  protected onShuffleResurface(): void {
    this.dashboard.reshuffleResurface();
  }

  protected onDismissResurfaceEntry(entry: DashboardRecentEntry): void {
    this.dashboard.dismissResurfaceEntry(entry.id);
  }

  protected onResurfaceModeChange(mode: DashboardResurfaceMode): void {
    this.dashboard.setResurfaceMode(mode);
  }
}
