import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import { GoalPosterComponent } from '../components/goal-poster.component';
import { NewGoalCardComponent } from '../components/new-goal-card.component';
import type { GoalSummary } from '../models/goal.types';
import { GoalsService } from '../services/goals.service';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Component({
  selector: 'mc-goals-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent, GoalPosterComponent, NewGoalCardComponent],
  templateUrl: './goals-wall.container.html',
  styleUrl: './goals-wall.container.css',
})
export class GoalsWallContainer {
  private readonly goalsService = inject(GoalsService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.goalsService.summaries;
  protected readonly query = signal<string>('');
  protected readonly activeTagIds = signal<ReadonlySet<string>>(new Set());
  protected readonly hideCompleted = signal<boolean>(false);
  protected readonly creating = signal<boolean>(false);

  protected readonly today = signal<string>(new Date().toISOString().slice(0, 10));

  protected readonly untitledLabel = computed(() => this.t('goals.untitledTitle'));

  protected readonly availableTags = computed<readonly Tag[]>(() => {
    const used = new Set<string>();
    for (const s of this.summaries()) for (const id of s.tags) used.add(id);
    return this.tags().filter((t) => used.has(t.id));
  });

  protected readonly visible = computed<readonly GoalSummary[]>(() => {
    const q = norm(this.query().trim());
    const tagSet = this.activeTagIds();
    const hideDone = this.hideCompleted();
    return this.summaries().filter((g) => {
      if (hideDone && g.completed) return false;
      if (tagSet.size > 0 && !g.tags.some((id) => tagSet.has(id))) return false;
      if (!q) return true;
      return norm(g.title).includes(q);
    });
  });

  protected readonly hasFilter = computed(
    () => this.query().trim() !== '' || this.activeTagIds().size > 0 || this.hideCompleted(),
  );
  protected readonly empty = computed(() => this.summaries().length === 0 && !this.hasFilter());
  protected readonly noMatch = computed(
    () => this.hasFilter() && this.visible().length === 0 && this.summaries().length > 0,
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onOpen(id: string): void {
    void this.router.navigate(['/goals', id]);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }

  protected onClearQuery(): void {
    this.query.set('');
  }

  protected onToggleTag(id: string): void {
    this.activeTagIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected onToggleHideCompleted(): void {
    this.hideCompleted.update((v) => !v);
  }

  protected onClearFilters(): void {
    this.query.set('');
    this.activeTagIds.set(new Set());
    this.hideCompleted.set(false);
  }

  protected isTagActive(id: string): boolean {
    return this.activeTagIds().has(id);
  }

  protected async onCreate(title: string): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const goal = await this.goalsService.create(title);
      await this.router.navigate(['/goals', goal.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected async onToggleCompleted(id: string): Promise<void> {
    try {
      const goal = await this.goalsService.read(id);
      await this.goalsService.save({ ...goal, completed: !goal.completed });
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onDelete(id: string): Promise<void> {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.untitledLabel();
    if (!confirm(this.t('goals.deleteConfirm').replace('{title}', label))) return;
    try {
      await this.goalsService.deleteToTrash(id);
      await this.autosave.clear(id);
    } catch (e) {
      this.errors.report(e);
    }
  }
}
