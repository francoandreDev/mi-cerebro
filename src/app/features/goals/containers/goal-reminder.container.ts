import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import type { GoalSummary } from '../models/goal.types';
import { GoalsService } from '../services/goals.service';

// why: a gentle nudge on navigation, not every time. Showing on every
//      route change would be noise; 1-in-N keeps it surprising but rare.
const SHOW_PROBABILITY = 0.25;
const SOON_DAYS = 7;

@Component({
  selector: 'mc-goal-reminder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [McDatePipe],
  template: `
    @if (visible(); as goal) {
      <div class="banner" role="status">
        <div class="text">
          <strong>{{ t('goals.reminder.title') }}:</strong>
          <span class="title">{{ goal.title || t('goals.untitledTitle') }}</span>
          @if (goal.deadline) {
            <span class="meta" [class.overdue]="isOverdue(goal.deadline)">
              {{
                isOverdue(goal.deadline) ? t('goals.reminder.overdue') : t('goals.reminder.dueSoon')
              }}
              · {{ goal.deadline | mcDate }}
            </span>
          }
        </div>
        <div class="actions">
          <button type="button" class="primary" (click)="open(goal)">
            {{ t('goals.reminder.open') }}
          </button>
          <button type="button" class="ghost" (click)="dismiss()">
            {{ t('goals.reminder.dismiss') }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './goal-reminder.container.css',
})
export class GoalReminderContainer {
  private readonly goals = inject(GoalsService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  private readonly current = signal<GoalSummary | null>(null);
  // why: track which goal IDs we already nudged in this session so the
  //      banner doesn't repeat the same one back to back.
  private readonly shownIds = new Set<string>();

  protected readonly visible = computed(() => this.current());

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.maybeShow());
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected isOverdue(date: string): boolean {
    return date < new Date().toISOString().slice(0, 10);
  }

  protected dismiss(): void {
    this.current.set(null);
  }

  protected async open(goal: GoalSummary): Promise<void> {
    this.current.set(null);
    await this.router.navigate(['/goals', goal.id]);
  }

  private maybeShow(): void {
    if (this.router.url.startsWith('/goals')) return;
    if (Math.random() > SHOW_PROBABILITY) return;
    const candidate = this.pick();
    if (!candidate) return;
    this.shownIds.add(candidate.id);
    this.current.set(candidate);
  }

  private pick(): GoalSummary | null {
    const all = this.goals.summaries().filter((g) => !g.completed);
    if (all.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const soon = sevenDaysOut(today);
    const overdue = all.filter((g) => g.deadline !== null && g.deadline < today);
    const dueSoon = all.filter(
      (g) => g.deadline !== null && g.deadline >= today && g.deadline <= soon,
    );
    const pool = overdue.length > 0 ? overdue : dueSoon.length > 0 ? dueSoon : all;
    const fresh = pool.filter((g) => !this.shownIds.has(g.id));
    const effective = fresh.length > 0 ? fresh : pool;
    return effective[Math.floor(Math.random() * effective.length)] ?? null;
  }
}

const sevenDaysOut = (todayIso: string): string => {
  const d = new Date(todayIso);
  d.setDate(d.getDate() + SOON_DAYS);
  return d.toISOString().slice(0, 10);
};
