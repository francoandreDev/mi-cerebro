import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TagsService } from '@core/tags/tags.service';

import { HarvestBasketComponent } from '../components/harvest-basket.component';
import { PlantCardComponent } from '../components/plant-card.component';
import { PlanterComponent } from '../components/planter.component';
import type { PlantStage } from '../components/plant-glyphs';
import type { TaskSummary } from '../models/task.types';
import { type Bucket, bucketTasks } from '../services/task-buckets';
import { TasksService } from '../services/tasks.service';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STAGE_BY_BUCKET: Record<Bucket, PlantStage> = {
  today: 'bloom',
  week: 'sprout',
  backlog: 'seed',
};
const WILT_THRESHOLD_DAYS = 3;
const NIGHT_KEY = 'mc.tasks.garden.night';
const WATERING_KEY = 'mc.tasks.garden.watering';

@Component({
  selector: 'mc-tasks-garden',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlanterComponent, PlantCardComponent, HarvestBasketComponent],
  templateUrl: './tasks-garden.container.html',
  styleUrl: './tasks-garden.container.css',
})
export class TasksGardenContainer {
  private readonly tasksService = inject(TasksService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly STAGE_BY_BUCKET = STAGE_BY_BUCKET;
  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.tasksService.summaries;
  protected readonly query = signal<string>('');
  protected readonly creating = signal<boolean>(false);
  protected readonly night = signal<boolean>(readBool(NIGHT_KEY));
  protected readonly watering = signal<boolean>(readBool(WATERING_KEY));
  protected readonly dragOverBucket = signal<Bucket | null>(null);
  protected readonly announce = signal<string>('');
  private readonly draggingId = signal<string | null>(null);

  protected readonly untitledLabel = computed(() => this.t('tasks.untitledTitle'));

  protected readonly filtered = computed<readonly TaskSummary[]>(() => {
    const q = norm(this.query().trim());
    if (!q) return this.summaries();
    return this.summaries().filter((s) => norm(s.title).includes(q));
  });

  protected readonly buckets = computed(() => bucketTasks(this.filtered(), new Date()));

  protected readonly pending = computed(() => ({
    today: this.buckets().today.filter((e) => !e.summary.done),
    week: this.buckets().week.filter((e) => !e.summary.done),
    backlog: this.buckets().backlog.filter((e) => !e.summary.done),
  }));

  protected readonly harvested = computed<readonly TaskSummary[]>(() => {
    return this.buckets()
      .today.filter((e) => e.summary.done)
      .map((e) => e.summary)
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  protected readonly counts = computed(() =>
    this.t('tasks.garden.counts')
      .replace('{today}', String(this.pending().today.length))
      .replace('{week}', String(this.pending().week.length))
      .replace('{backlog}', String(this.pending().backlog.length)),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected wiltDaysFor(s: TaskSummary): number {
    if (!s.enteredHoyAt) return 0;
    const ms = Date.now() - new Date(s.enteredHoyAt).getTime();
    const days = Math.floor(ms / 86_400_000);
    return Math.max(0, days - WILT_THRESHOLD_DAYS);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }

  protected onClearQuery(): void {
    this.query.set('');
  }

  protected onToggleNight(): void {
    const next = !this.night();
    this.night.set(next);
    persistBool(NIGHT_KEY, next);
  }

  protected onToggleWatering(): void {
    const next = !this.watering();
    this.watering.set(next);
    persistBool(WATERING_KEY, next);
  }

  protected onOpen(id: string): void {
    void this.router.navigate(['/tasks', id]);
  }

  protected onOpenPatio(): void {
    void this.router.navigate(['/tasks', 'patio']);
  }

  protected readonly devMode = isDevMode();

  protected async onDevAgeOne(): Promise<void> {
    const candidate =
      this.pending().today[0] ?? this.pending().week[0] ?? this.pending().backlog[0];
    if (!candidate) return;
    try {
      await this.workspace.ensureWritable();
      await this.tasksService.devAgeAndHarvest(candidate.summary.id, 20);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected onComposeSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = form.elements.namedItem('title') as HTMLInputElement | null;
    if (!input) return;
    const value = input.value.trim();
    if (value === '') return;
    void this.create(value);
    input.value = '';
  }

  private async create(title: string): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const task = await this.tasksService.create(title);
      // why: por default, lo nuevo cae a SEMANA — no obstruye el cantero de HOY
      //      con cosas no priorizadas todavía.
      await this.tasksService.transplant(task.id, 'week');
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected onDragStart(event: DragEvent, id: string): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
    this.draggingId.set(id);
  }

  protected onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOverBucket.set(null);
  }

  protected onDragEnter(bucket: Bucket): void {
    this.dragOverBucket.set(bucket);
  }

  protected onDragLeaveBucket(bucket: Bucket): void {
    if (this.dragOverBucket() === bucket) this.dragOverBucket.set(null);
  }

  protected async onDrop(bucket: Bucket): Promise<void> {
    const id = this.draggingId();
    this.dragOverBucket.set(null);
    this.draggingId.set(null);
    if (!id) return;
    await this.applyTransplant(id, bucket);
  }

  protected async onTransplant(event: { id: string; bucket: Bucket }): Promise<void> {
    await this.applyTransplant(event.id, event.bucket);
  }

  private async applyTransplant(id: string, bucket: Bucket): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      await this.tasksService.transplant(id, bucket);
      const summary = this.summaries().find((s) => s.id === id);
      const title = summary?.title || this.untitledLabel();
      const stage = this.t(`tasks.garden.planter${cap(bucket)}` as TranslationKey);
      this.announce.set(
        this.t('tasks.garden.aria.transplanted')
          .replace('{title}', title)
          .replace('{stage}', stage),
      );
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onHarvest(id: string): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      await this.tasksService.harvest(id);
      const summary = this.summaries().find((s) => s.id === id);
      const title = summary?.title || this.untitledLabel();
      this.announce.set(this.t('tasks.garden.aria.harvested').replace('{title}', title));
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onDelete(id: string): Promise<void> {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.untitledLabel();
    if (!confirm(this.t('tasks.deleteConfirm').replace('{title}', label))) return;
    try {
      await this.tasksService.deleteToTrash(id);
      await this.autosave.clear(id);
    } catch (e) {
      this.errors.report(e);
    }
  }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const readBool = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const persistBool = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore quota */
  }
};
