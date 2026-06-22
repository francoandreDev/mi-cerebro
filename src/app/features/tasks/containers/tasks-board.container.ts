import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';

import { TaskColumnComponent } from '../components/task-column.component';
import type { Task, TaskSummary } from '../models/task.types';
import { sortDueDates } from '../models/task.types';
import { type Bucket, bucketTasks, bucketToDueDate } from '../services/task-buckets';
import { TasksService } from '../services/tasks.service';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Component({
  selector: 'mc-tasks-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TaskColumnComponent],
  templateUrl: './tasks-board.container.html',
  styleUrl: './tasks-board.container.css',
})
export class TasksBoardContainer {
  private readonly tasksService = inject(TasksService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.tasksService.summaries;
  protected readonly query = signal<string>('');
  protected readonly hideDone = signal<boolean>(false);
  protected readonly creating = signal<boolean>(false);

  protected readonly untitledLabel = computed(() => this.t('tasks.untitledTitle'));

  protected readonly filtered = computed<readonly TaskSummary[]>(() => {
    const q = norm(this.query().trim());
    if (!q) return this.summaries();
    return this.summaries().filter((s) => norm(s.title).includes(q));
  });

  protected readonly buckets = computed(() => bucketTasks(this.filtered(), new Date()));

  protected readonly empty = computed(
    () => this.summaries().length === 0 && this.query().trim() === '',
  );
  protected readonly noMatch = computed(
    () => this.summaries().length > 0 && this.filtered().length === 0,
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }

  protected onClearQuery(): void {
    this.query.set('');
  }

  protected onToggleHideDone(): void {
    this.hideDone.update((v) => !v);
  }

  protected onOpen(id: string): void {
    void this.router.navigate(['/tasks', id]);
  }

  protected async onCreate(event: { bucket: Bucket; title: string }): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const task = await this.tasksService.create(event.title);
      const dueDates = bucketToDueDate(event.bucket, new Date());
      if (dueDates.length > 0) {
        await this.tasksService.save({ ...task, dueDates });
      }
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected async onToggleDone(id: string): Promise<void> {
    try {
      const task = await this.tasksService.read(id);
      await this.tasksService.save({ ...task, done: !task.done });
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onMoveTask(event: { id: string; bucket: Bucket }): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const task = await this.tasksService.read(event.id);
      const dueDates = sortDueDates(bucketToDueDate(event.bucket, new Date()));
      const next: Task = { ...task, dueDates };
      await this.tasksService.save(next);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onDelete(id: string): Promise<void> {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.t('tasks.untitledTitle');
    if (!confirm(this.t('tasks.deleteConfirm').replace('{title}', label))) return;
    try {
      await this.tasksService.deleteToTrash(id);
      await this.autosave.clear(id);
    } catch (e) {
      this.errors.report(e);
    }
  }
}
