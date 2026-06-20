import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';

import { TaskEditorPaneComponent, type SaveStatus } from '../components/task-editor-pane.component';
import { TASK_KIND, sortDueDates, type Task } from '../models/task.types';
import { TasksService } from '../services/tasks.service';

@Component({
  selector: 'mc-tasks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TaskEditorPaneComponent, LockBannerComponent, IconComponent],
  templateUrl: './tasks.container.html',
  styleUrl: './tasks.container.css',
})
export class TasksContainer {
  readonly id = input<string | undefined>(undefined);

  private readonly tasksService = inject(TasksService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<Task | null>(null);
  protected readonly status = signal<SaveStatus>('saved');
  protected readonly lock = new EntityLockController(TASK_KIND, this.active);

  constructor() {
    effect(() => {
      const wanted = this.id();
      const current = this.active();
      if (!wanted) {
        if (current) this.active.set(null);
        return;
      }
      if (current?.id === wanted) return;
      void this.loadTask(wanted);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onTitleChange(title: string): void {
    this.patch((current) => ({ ...current, title }));
  }

  protected onBodyChange(body: JSONContent): void {
    this.patch((current) => ({ ...current, body }));
  }

  protected onDoneChange(done: boolean): void {
    this.patch((current) => ({ ...current, done }));
  }

  protected onAddDueDate(date: string): void {
    this.patch((current) => {
      if (current.dueDates.includes(date)) return current;
      return { ...current, dueDates: sortDueDates([...current.dueDates, date]) };
    });
  }

  protected onRemoveDueDate(date: string): void {
    this.patch((current) => ({
      ...current,
      dueDates: current.dueDates.filter((d) => d !== date),
    }));
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
      this.t('tasks.deleteConfirm').replace(
        '{title}',
        current.title || this.t('tasks.untitledTitle'),
      ),
    );
    if (!ok) return;
    try {
      await this.tasksService.deleteToTrash(current.id);
      await this.autosave.clear(current.id);
      this.active.set(null);
      await this.router.navigate(['/tasks']);
    } catch (e) {
      this.errors.report(e);
    }
  }

  private patch(mutate: (current: Task) => Task): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = mutate(current);
    if (next === current) return;
    this.active.set(next);
    this.scheduleSave(next);
  }

  private async loadTask(id: string): Promise<void> {
    try {
      const task = await this.tasksService.read(id);
      this.active.set(task);
      this.status.set('saved');
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
    }
  }

  private scheduleSave(task: Task): void {
    this.status.set('unsaved');
    this.autosave.schedule<Task>(task.id, TASK_KIND, () => task, {
      onFlush: async (payload) => {
        this.status.set('saving');
        try {
          await this.tasksService.save(payload);
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
