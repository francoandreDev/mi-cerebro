import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { DashboardService } from '@core/dashboard/dashboard.service';
import {
  dashboardEntryRoute,
  type DashboardGoalItem,
  type DashboardRecentEntry,
  type DashboardTaskItem,
} from '@core/dashboard/dashboard.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { TagsService } from '@core/tags/tags.service';

import { DashboardGoalsWidgetComponent } from '../components/dashboard-goals-widget.component';
import { DashboardRecentWidgetComponent } from '../components/dashboard-recent-widget.component';
import { DashboardRemindersWidgetComponent } from '../components/dashboard-reminders-widget.component';
import { DashboardTasksWidgetComponent } from '../components/dashboard-tasks-widget.component';

@Component({
  selector: 'mc-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DashboardTasksWidgetComponent,
    DashboardGoalsWidgetComponent,
    DashboardRemindersWidgetComponent,
    DashboardRecentWidgetComponent,
  ],
  templateUrl: './dashboard.container.html',
  styleUrl: './dashboard.container.css',
})
export class DashboardContainer {
  private readonly dashboard = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly tagsService = inject(TagsService);

  protected readonly todayTasks = this.dashboard.todayTasks;
  protected readonly activeGoals = this.dashboard.activeGoals;
  protected readonly upcomingReminders = this.dashboard.upcomingReminders;
  protected readonly recentEntries = this.dashboard.recentEntries;
  protected readonly availableTags = this.tagsService.tags;

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
}
