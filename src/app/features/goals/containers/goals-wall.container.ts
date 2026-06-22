import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { GoalPriority, GoalSummary } from '../models/goal.types';
import { GoalsService } from '../services/goals.service';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// why: djb2 hash → stable star position per goal id without storing coords.
const hashStr = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
};

export interface StarVm {
  readonly goal: GoalSummary;
  readonly x: number; // % horizontal (0–100)
  readonly y: number; // % vertical (0–100)
  readonly size: number; // px diameter
  readonly opacity: number; // 0–1, derived from progress
  readonly glow: number; // px glow radius
  readonly dim: boolean; // filter state — outside current filter
  readonly pulsing: boolean; // deadline ≤7d ahead, not completed
  readonly overdue: boolean;
  readonly state: 'completed' | 'overdue' | 'soon' | 'active';
  readonly progressDisplay: number;
}

export interface LinkVm {
  readonly a: string;
  readonly b: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly dim: boolean;
}

const SIZE_BY_PRIORITY: Record<GoalPriority, number> = { low: 12, med: 18, high: 26 };

@Component({
  selector: 'mc-goals-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
  templateUrl: './goals-wall.container.html',
  styleUrl: './goals-wall.container.css',
})
export class GoalsWallContainer {
  private readonly goalsService = inject(GoalsService);
  private readonly tagsService = inject(TagsService);
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
  protected readonly newTitle = signal<string>('');

  protected readonly today = signal<string>(new Date().toISOString().slice(0, 10));

  protected readonly untitledLabel = computed(() => this.t('goals.untitledTitle'));

  protected readonly availableTags = computed<readonly Tag[]>(() => {
    const used = new Set<string>();
    for (const s of this.summaries()) for (const id of s.tags) used.add(id);
    return this.tags().filter((t) => used.has(t.id));
  });

  protected readonly empty = computed(() => this.summaries().length === 0);

  protected readonly hasFilter = computed(
    () => this.query().trim() !== '' || this.activeTagIds().size > 0 || this.hideCompleted(),
  );

  protected readonly allDim = computed(
    () => this.stars().length > 0 && this.stars().every((s) => s.dim),
  );

  protected readonly stars = computed<readonly StarVm[]>(() => {
    const q = norm(this.query().trim());
    const tagSet = this.activeTagIds();
    const hideDone = this.hideCompleted();
    const today = this.today();
    return this.summaries().map((goal) => {
      const { x, y } = position(goal.id);
      const matchesQuery = !q || norm(goal.title).includes(q);
      const matchesTags = tagSet.size === 0 || goal.tags.some((id) => tagSet.has(id));
      const matchesDone = !hideDone || !goal.completed;
      const dim = !(matchesQuery && matchesTags && matchesDone);
      const days = daysUntil(goal.deadline, today);
      const overdue = !goal.completed && days !== null && days < 0;
      const soon = !goal.completed && days !== null && days >= 0 && days <= 7;
      const state: StarVm['state'] = goal.completed
        ? 'completed'
        : overdue
          ? 'overdue'
          : soon
            ? 'soon'
            : 'active';
      const progress = goal.completed ? 100 : goal.progress;
      const opacity = 0.35 + (progress / 100) * 0.65;
      const size = SIZE_BY_PRIORITY[goal.priority];
      return {
        goal,
        x,
        y,
        size,
        opacity,
        glow: size * (0.5 + (progress / 100) * 1.2),
        dim,
        pulsing: soon || overdue,
        overdue,
        state,
        progressDisplay: progress,
      };
    });
  });

  protected readonly links = computed<readonly LinkVm[]>(() => {
    const list = this.stars();
    const out: LinkVm[] = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (!shareTag(a.goal.tags, b.goal.tags)) continue;
        out.push({
          a: a.goal.id,
          b: b.goal.id,
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          dim: a.dim || b.dim,
        });
      }
    }
    return out;
  });

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

  protected onNewTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.newTitle.set(target.value);
  }

  protected async onCreateSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.creating()) return;
    const title = this.newTitle().trim();
    if (!title) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const goal = await this.goalsService.create(title);
      this.newTitle.set('');
      await this.router.navigate(['/goals', goal.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected ariaLabelFor(star: StarVm): string {
    const title = star.goal.title || this.untitledLabel();
    return this.t('goals.wall.openAria').replace('{title}', title);
  }
}

const position = (id: string): { x: number; y: number } => {
  const h = hashStr(id);
  const a = h & 0xffff;
  const b = (h >>> 16) & 0xffff;
  // why: pad 6/8% off the edges so stars never clip and titles fit.
  return {
    x: 6 + (a / 0xffff) * 88,
    y: 8 + (b / 0xffff) * 84,
  };
};

const daysUntil = (deadline: string | null, todayIso: string): number | null => {
  if (!deadline) return null;
  const a = Date.parse(deadline + 'T00:00:00');
  const b = Date.parse(todayIso + 'T00:00:00');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
};

const shareTag = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  for (const t of b) if (set.has(t)) return true;
  return false;
};
