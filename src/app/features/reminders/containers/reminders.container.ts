import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { CreationIntentService } from '@core/intents/creation-intent.service';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import type { Reminder, ReminderSummary } from '../models/reminder.types';
import { RemindersService } from '../services/reminders.service';

interface DraftPatch {
  readonly id: string;
  readonly title?: string;
  readonly dueAt?: string;
}

@Component({
  selector: 'mc-reminders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [McDatePipe, IconComponent],
  templateUrl: './reminders.container.html',
  styleUrl: './reminders.container.css',
})
export class RemindersContainer {
  private readonly reminders = inject(RemindersService);
  private readonly workspace = inject(WorkspaceService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly creationIntent = inject(CreationIntentService);
  private lastCreationAt = 0;

  constructor() {
    effect(() => {
      const req = this.creationIntent.requestedCreate();
      if (!req || req.kind !== 'reminder') return;
      if (req.requestedAt <= this.lastCreationAt) return;
      this.lastCreationAt = req.requestedAt;
      void this.onCreate();
    });
  }

  protected readonly summaries = this.reminders.summaries;
  protected readonly editingId = signal<string | null>(null);
  protected readonly draft = signal<DraftPatch | null>(null);

  protected readonly pending = computed(() => this.summaries().filter((r) => !r.done));
  protected readonly done = computed(() => this.summaries().filter((r) => r.done));

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected async onCreate(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const reminder = await this.reminders.create('');
      this.startEdit(reminder);
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected onEdit(summary: ReminderSummary): void {
    this.editingId.set(summary.id);
    this.draft.set({ id: summary.id, title: summary.title, dueAt: summary.dueAt });
  }

  protected onTitleInput(id: string, value: string): void {
    this.draft.update((d) => (d?.id === id ? { ...d, title: value } : d));
  }

  protected onDueInput(id: string, value: string): void {
    this.draft.update((d) => (d?.id === id ? { ...d, dueAt: value } : d));
  }

  protected async onSaveEdit(): Promise<void> {
    const patch = this.draft();
    if (!patch) return;
    try {
      await this.workspace.ensureWritable();
      const current = await this.reminders.read(patch.id);
      await this.reminders.save({
        ...current,
        title: patch.title ?? current.title,
        dueAt: patch.dueAt ?? current.dueAt,
      });
      this.cancelEdit();
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.draft.set(null);
  }

  protected async onToggleDone(summary: ReminderSummary): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const current = await this.reminders.read(summary.id);
      await this.reminders.save({ ...current, done: !current.done });
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onDelete(summary: ReminderSummary): Promise<void> {
    if (!confirm(this.t('reminders.deleteConfirm').replace('{title}', summary.title || '—')))
      return;
    try {
      await this.reminders.deleteToTrash(summary.id);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected asInput(target: EventTarget | null): HTMLInputElement {
    return target as HTMLInputElement;
  }

  private startEdit(reminder: Reminder): void {
    this.editingId.set(reminder.id);
    this.draft.set({ id: reminder.id, title: reminder.title, dueAt: reminder.dueAt });
  }

  private withReauth(e: unknown): unknown {
    return withReauthIfNeeded(e, () => this.workspace.reauthorize());
  }
}
