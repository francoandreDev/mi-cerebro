import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { extractEntityId } from '@core/routing/entity-slug';
import { SettingsService } from '@core/settings/settings.service';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';

import { GoalEditorPaneComponent, type SaveStatus } from '../components/goal-editor-pane.component';
import {
  GOAL_KIND,
  isGoalDormant,
  type Goal,
  type GoalPriority,
  type GoalStep,
} from '../models/goal.types';
import { GoalsService } from '../services/goals.service';

@Component({
  selector: 'mc-goals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoalEditorPaneComponent, LockBannerComponent, IconComponent],
  templateUrl: './goals.container.html',
  styleUrl: './goals.container.css',
})
export class GoalsContainer {
  readonly id = input<string | undefined>(undefined);

  private readonly goalsService = inject(GoalsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly settings = inject(SettingsService);

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<Goal | null>(null);
  protected readonly status = signal<SaveStatus>('saved');
  protected readonly lock = new EntityLockController(GOAL_KIND, this.active);

  protected readonly dormant = computed(() => {
    const goal = this.active();
    if (!goal) return false;
    return isGoalDormant(
      goal.completed,
      goal.lastProgressAt,
      this.settings.state().goals.dormantThresholdDays,
      Date.now(),
    );
  });

  constructor() {
    effect(() => {
      const raw = this.id();
      const wanted = raw ? extractEntityId(raw) : undefined;
      const current = this.active();
      if (!wanted) {
        if (current) this.active.set(null);
        return;
      }
      if (current?.id === wanted) return;
      void this.loadGoal(wanted);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected async onBackToIndex(): Promise<void> {
    await this.router.navigate(['/goals']);
  }

  protected onTitleChange(title: string): void {
    this.patch((current) => ({ ...current, title }));
  }

  protected onBodyChange(body: JSONContent): void {
    this.patch((current) => ({ ...current, body }));
  }

  protected onCompletedChange(completed: boolean): void {
    this.patch((current) => ({ ...current, completed }));
  }

  protected onDeadlineChange(deadline: string | null): void {
    this.patch((current) => ({ ...current, deadline }));
  }

  protected onPriorityChange(priority: GoalPriority): void {
    this.patch((current) => ({ ...current, priority }));
  }

  protected onReminderEnabledChange(enabled: boolean): void {
    this.patch((current) => ({ ...current, reminder: { enabled } }));
  }

  protected onStepsChange(steps: readonly GoalStep[]): void {
    this.patch((current) => ({ ...current, steps }));
  }

  protected async onAddTag(label: string): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      const tag = await this.tagsService.touch(label);
      if (current.tags.includes(tag.id)) return;
      const next = { ...current, tags: [...current.tags, tag.id] };
      this.active.set(next);
      this.scheduleSave(next);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected onRemoveTag(id: string): void {
    this.patch((current) => {
      if (!current.tags.includes(id)) return current;
      return { ...current, tags: current.tags.filter((t) => t !== id) };
    });
  }

  protected async onDelete(): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const ok = confirm(
      this.t('goals.deleteConfirm').replace(
        '{title}',
        current.title || this.t('goals.untitledTitle'),
      ),
    );
    if (!ok) return;
    try {
      await this.goalsService.deleteToTrash(current.id);
      await this.autosave.clear(current.id);
      this.active.set(null);
      await this.router.navigate(['/goals']);
    } catch (e) {
      this.errors.report(e);
    }
  }

  private patch(mutate: (current: Goal) => Goal): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = mutate(current);
    if (next === current) return;
    this.active.set(next);
    this.scheduleSave(next);
  }

  private async loadGoal(id: string): Promise<void> {
    try {
      const goal = await this.goalsService.read(id);
      this.active.set(goal);
      this.status.set('saved');
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
    }
  }

  private scheduleSave(goal: Goal): void {
    this.status.set('unsaved');
    this.autosave.schedule<Goal>(goal.id, GOAL_KIND, () => goal, {
      onFlush: async (payload) => {
        this.status.set('saving');
        try {
          await this.goalsService.save(payload);
          await this.autosave.clear(payload.id);
          this.status.set('saved');
        } catch (e) {
          this.errors.report(this.withReauthIfNeeded(e, () => this.scheduleSave(payload)));
          this.status.set('unsaved');
        }
      },
    });
  }

  private withReauthIfNeeded(error: unknown, retry?: () => void): unknown {
    return withReauthIfNeeded(error, () => this.workspace.reauthorize(), retry);
  }
}
