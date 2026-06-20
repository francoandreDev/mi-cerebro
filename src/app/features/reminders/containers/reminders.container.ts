import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  type ElementRef,
} from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { CreationIntentService } from '@core/intents/creation-intent.service';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import type { Reminder, ReminderSummary } from '../models/reminder.types';
import { RemindersService } from '../services/reminders.service';
import { PENDING_BUCKETS, bucketOf, groupByBucket, type BucketKey } from '../utils/buckets';
import { parseQuickAdd } from '../utils/parse-due';

type FilterKey = 'all' | BucketKey;

interface BucketView {
  readonly key: BucketKey;
  readonly items: readonly ReminderSummary[];
}

interface PendingUndo {
  readonly reminder: Reminder;
  readonly title: string;
}

const UNDO_TIMEOUT_MS = 6000;

const FILTER_ICONS: Record<FilterKey | 'done', IconName> = {
  all: 'flag',
  overdue: 'alarm',
  today: 'hourglass-medium',
  tomorrow: 'sun-horizon',
  thisWeek: 'calendar-blank',
  later: 'calendar-check',
  undated: 'circle-dashed',
  done: 'check',
};

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
  private readonly shortcuts = inject(ShortcutsService);
  private readonly destroyRef = inject(DestroyRef);
  private lastCreationAt = 0;
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('quickAddInput')
  private quickAddInput?: ElementRef<HTMLInputElement>;
  @ViewChild('searchInput')
  private searchInput?: ElementRef<HTMLInputElement>;

  protected readonly summaries = this.reminders.summaries;
  protected readonly query = signal('');
  protected readonly filter = signal<FilterKey>('all');
  protected readonly showDone = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editDue = signal('');
  protected readonly quickAdd = signal('');
  protected readonly undo = signal<PendingUndo | null>(null);
  protected readonly filterChips: readonly FilterKey[] = ['all', ...PENDING_BUCKETS];

  constructor() {
    effect(() => {
      const req = this.creationIntent.requestedCreate();
      if (!req || req.kind !== 'reminder') return;
      if (req.requestedAt <= this.lastCreationAt) return;
      this.lastCreationAt = req.requestedAt;
      this.focusQuickAdd();
    });
    this.registerShortcuts();
  }

  protected readonly counts = computed<ReadonlyMap<FilterKey, number>>(() => {
    const map = new Map<FilterKey, number>();
    map.set('all', this.summaries().filter((r) => !r.done).length);
    const grouped = groupByBucket(this.summaries());
    for (const k of PENDING_BUCKETS) map.set(k, grouped.get(k)?.length ?? 0);
    map.set('done', grouped.get('done')?.length ?? 0);
    return map;
  });

  protected readonly filteredPending = computed<readonly ReminderSummary[]>(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.summaries().filter((r) => {
      if (r.done) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (f === 'all') return true;
      return bucketOf(r) === f;
    });
  });

  protected readonly buckets = computed<readonly BucketView[]>(() => {
    const grouped = groupByBucket(this.filteredPending());
    return PENDING_BUCKETS.flatMap((k) => {
      const items = grouped.get(k);
      return items && items.length > 0 ? [{ key: k, items }] : [];
    });
  });

  protected readonly doneItems = computed<readonly ReminderSummary[]>(() => {
    const q = this.query().trim().toLowerCase();
    return this.summaries().filter((r) => r.done && (!q || r.title.toLowerCase().includes(q)));
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }

  protected onFilter(key: FilterKey): void {
    this.filter.set(key);
  }

  protected onToggleDoneSection(): void {
    this.showDone.update((v) => !v);
  }

  protected onQuickAddInput(value: string): void {
    this.quickAdd.set(value);
  }

  protected async onQuickAddSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const raw = this.quickAdd().trim();
    if (!raw) return;
    const parsed = parseQuickAdd(raw);
    try {
      await this.workspace.ensureWritable();
      await this.reminders.create(parsed.title, parsed.dueAt);
      this.quickAdd.set('');
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected onStartEdit(summary: ReminderSummary): void {
    this.editingId.set(summary.id);
    this.editTitle.set(summary.title);
    this.editDue.set(summary.dueAt);
    queueMicrotask(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.row.editing .title-input');
      inputs[0]?.focus();
      inputs[0]?.select();
    });
  }

  protected onEditTitle(value: string): void {
    this.editTitle.set(value);
  }

  protected onEditDue(value: string): void {
    this.editDue.set(value);
  }

  protected async onSaveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    try {
      await this.workspace.ensureWritable();
      const current = await this.reminders.read(id);
      await this.reminders.save({
        ...current,
        title: this.editTitle(),
        dueAt: this.editDue(),
      });
      this.cancelEdit();
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
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

  protected async onSnooze(summary: ReminderSummary, hours: number): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const current = await this.reminders.read(summary.id);
      const base = new Date(current.dueAt);
      const next = Number.isNaN(base.getTime()) ? new Date() : base;
      next.setTime(next.getTime() + hours * 3600_000);
      const pad = (n: number): string => n.toString().padStart(2, '0');
      const iso = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
      await this.reminders.save({ ...current, dueAt: iso });
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onDelete(summary: ReminderSummary): Promise<void> {
    try {
      const current = await this.reminders.read(summary.id);
      await this.reminders.deleteToTrash(summary.id);
      this.scheduleUndo({ reminder: current, title: current.title });
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onUndo(): Promise<void> {
    const pending = this.undo();
    if (!pending) return;
    this.clearUndoTimer();
    this.undo.set(null);
    try {
      await this.workspace.ensureWritable();
      await this.reminders.restore(pending.reminder);
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected onDismissUndo(): void {
    this.clearUndoTimer();
    this.undo.set(null);
  }

  protected bucketLabel(key: BucketKey): string {
    return this.t(`reminders.bucket.${key}` as TranslationKey);
  }

  protected filterLabel(key: FilterKey): string {
    if (key === 'all') return this.t('reminders.filter.all');
    return this.bucketLabel(key);
  }

  protected iconFor(key: FilterKey | 'done'): IconName {
    return FILTER_ICONS[key];
  }

  protected isOverdue(summary: ReminderSummary): boolean {
    return !summary.done && bucketOf(summary) === 'overdue';
  }

  protected asInput(event: Event): HTMLInputElement {
    return event.target as HTMLInputElement;
  }

  private scheduleUndo(undo: PendingUndo): void {
    this.clearUndoTimer();
    this.undo.set(undo);
    this.undoTimer = setTimeout(() => {
      this.undo.set(null);
      this.undoTimer = null;
    }, UNDO_TIMEOUT_MS);
  }

  private clearUndoTimer(): void {
    if (this.undoTimer !== null) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
  }

  protected focusQuickAdd(): void {
    queueMicrotask(() => this.quickAddInput?.nativeElement.focus());
  }

  private focusSearch(): void {
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  private registerShortcuts(): void {
    const unregN = this.shortcuts.register({
      combo: 'n',
      labelKey: 'reminders.new',
      scope: 'editable-safe',
      handler: () => this.focusQuickAdd(),
    });
    const unregSlash = this.shortcuts.register({
      combo: '/',
      labelKey: 'reminders.shortcuts.search',
      scope: 'editable-safe',
      handler: () => this.focusSearch(),
    });
    this.destroyRef.onDestroy(() => {
      unregN();
      unregSlash();
      this.clearUndoTimer();
    });
  }

  private withReauth(e: unknown): unknown {
    return withReauthIfNeeded(e, () => this.workspace.reauthorize());
  }
}
