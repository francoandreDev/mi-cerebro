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
import { GoalRemindersSyncService } from '@core/reminders/goal-reminders-sync.service';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import type {
  Recurrence,
  RecurrenceUnit,
  Reminder,
  ReminderSummary,
} from '../models/reminder.types';
import { RemindersService } from '../services/reminders.service';
import { bucketOf, type BucketKey } from '../utils/buckets';
import { recallPaloma } from '../utils/paloma-flight';
import { parseQuickAdd } from '../utils/parse-due';

type RecurrencePreset = 'none' | RecurrenceUnit;

interface Paloma {
  readonly summary: ReminderSummary;
  readonly bucket: BucketKey;
  readonly door: 0 | 1 | 2 | 3; // cage door openness (0 = closed, 3 = wide open at fire time)
  readonly ringColor: string; // CSS color for recurrence ring (or transparent)
  readonly fromGoal: boolean;
}

interface PendingUndo {
  readonly reminder: Reminder;
  readonly title: string;
}

const UNDO_TIMEOUT_MS = 6000;

const RING_COLORS: Record<RecurrenceUnit, string> = {
  day: '#c8553d',
  week: '#e3a93a',
  month: '#5b9279',
  year: '#6b73a8',
};

const DOOR_BY_BUCKET: Record<BucketKey, 0 | 1 | 2 | 3> = {
  overdue: 0, // overdue lives on the perch, cage no longer relevant
  today: 3, // wide open — about to fly
  tomorrow: 2,
  thisWeek: 1,
  later: 0,
  undated: 0,
  done: 0,
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
  private readonly goalSync = inject(GoalRemindersSyncService);
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
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly quickAdd = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly showRegistry = signal(false);
  protected readonly editing = signal<EditingState | null>(null);
  protected readonly undo = signal<PendingUndo | null>(null);

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

  protected readonly filteredActive = computed<readonly ReminderSummary[]>(() => {
    const q = this.query().trim().toLowerCase();
    const from = parseDay(this.fromDate());
    const to = parseDay(this.toDate(), 1); // inclusive end-of-day
    return this.summaries().filter((r) => {
      if (r.done) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (from !== null || to !== null) {
        const t = parseLocalMs(r.dueAt);
        if (t === null) return false;
        if (from !== null && t < from) return false;
        if (to !== null && t >= to) return false;
      }
      return true;
    });
  });

  protected readonly inNichos = computed<readonly Paloma[]>(() =>
    this.filteredActive()
      .filter((r) => bucketOf(r) !== 'overdue')
      .map((r) => toPaloma(r)),
  );

  protected readonly onPerch = computed<readonly Paloma[]>(() =>
    this.filteredActive()
      .filter((r) => bucketOf(r) === 'overdue')
      .map((r) => toPaloma(r)),
  );

  protected readonly registry = computed<readonly ReminderSummary[]>(() => {
    const q = this.query().trim().toLowerCase();
    return this.summaries().filter((r) => r.done && (!q || r.title.toLowerCase().includes(q)));
  });

  protected readonly selected = computed<ReminderSummary | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.summaries().find((r) => r.id === id) ?? null;
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }

  protected onFromDate(value: string): void {
    this.fromDate.set(value);
  }

  protected onToDate(value: string): void {
    this.toDate.set(value);
  }

  protected onClearDateRange(): void {
    this.fromDate.set('');
    this.toDate.set('');
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

  protected onSelectPaloma(p: Paloma): void {
    // why: if a messenger paloma is perched at the rail bell waiting after
    //      firing, clicking its (now empty) cage recalls it home instead of
    //      opening the detail panel. Reminders only auto-return on user call.
    if (recallPaloma(p.summary.id)) return;
    this.selectedId.set(p.summary.id);
    this.editing.set({
      title: p.summary.title,
      dueAt: p.summary.dueAt,
      recurrence: presetOf(p.summary.recurrence),
      every: p.summary.recurrence?.every ?? 1,
      paused: p.summary.paused,
      readOnlyTitle: p.fromGoal,
    });
  }

  protected onCloseDetail(): void {
    this.selectedId.set(null);
    this.editing.set(null);
  }

  protected onEditField<K extends keyof EditingState>(key: K, value: EditingState[K]): void {
    this.editing.update((curr) => (curr ? { ...curr, [key]: value } : curr));
  }

  protected onEditRecurrence(value: string): void {
    this.onEditField('recurrence', value as RecurrencePreset);
  }

  protected onEditEvery(value: string): void {
    const n = Math.max(1, Math.floor(Number(value) || 1));
    this.onEditField('every', n);
  }

  protected async onSaveEdit(): Promise<void> {
    const id = this.selectedId();
    const draft = this.editing();
    if (!id || !draft) return;
    try {
      await this.workspace.ensureWritable();
      const current = await this.reminders.read(id);
      const recurrence: Recurrence | null =
        draft.recurrence === 'none' ? null : { every: draft.every, unit: draft.recurrence };
      await this.reminders.save({
        ...current,
        title: draft.readOnlyTitle ? current.title : draft.title,
        dueAt: draft.dueAt,
        paused: draft.paused,
        recurrence,
      });
      this.onCloseDetail();
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onTogglePaused(summary: ReminderSummary): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const current = await this.reminders.read(summary.id);
      await this.reminders.save({ ...current, paused: !current.paused });
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onTakeNote(summary: ReminderSummary): Promise<void> {
    // why: "tomar el papelito" = marcar como hecho. Recurrent reminders
    //      roll forward via the cadence service the next time they fire;
    //      one-shots stay in the registry.
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
      await this.reminders.save({ ...current, dueAt: toLocalIso(next) });
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onDuplicate(summary: ReminderSummary): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const current = await this.reminders.read(summary.id);
      await this.reminders.create(current.title, current.dueAt, undefined, {
        recurrence: current.recurrence,
        paused: current.paused,
      });
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onDelete(summary: ReminderSummary): Promise<void> {
    if (summary.sourceKind === 'goal' && summary.sourceId !== null) {
      const ok = confirm(
        this.t('reminders.deleteGoalConfirm').replace(
          '{title}',
          summary.title || this.t('reminders.untitled'),
        ),
      );
      if (!ok) return;
      try {
        await this.workspace.ensureWritable();
        await this.goalSync.disableForGoal(summary.sourceId);
        this.onCloseDetail();
      } catch (e) {
        this.errors.report(this.withReauth(e));
      }
      return;
    }
    try {
      const current = await this.reminders.read(summary.id);
      await this.reminders.deleteToTrash(summary.id);
      this.scheduleUndo({ reminder: current, title: current.title });
      this.onCloseDetail();
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

  protected onToggleRegistry(): void {
    this.showRegistry.update((v) => !v);
  }

  protected bucketLabel(key: BucketKey): string {
    return this.t(`reminders.bucket.${key}` as TranslationKey);
  }

  protected asInput(event: Event): HTMLInputElement {
    return event.target as HTMLInputElement;
  }

  protected focusQuickAdd(): void {
    queueMicrotask(() => this.quickAddInput?.nativeElement.focus());
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

interface EditingState {
  readonly title: string;
  readonly dueAt: string;
  readonly recurrence: RecurrencePreset;
  readonly every: number;
  readonly paused: boolean;
  readonly readOnlyTitle: boolean;
}

const toPaloma = (r: ReminderSummary): Paloma => {
  const b = bucketOf(r);
  const ringColor = r.recurrence ? RING_COLORS[r.recurrence.unit] : 'transparent';
  return {
    summary: r,
    bucket: b,
    door: r.paused ? 0 : DOOR_BY_BUCKET[b],
    ringColor,
    fromGoal: r.sourceKind === 'goal',
  };
};

const presetOf = (rec: Recurrence | null): RecurrencePreset => (rec === null ? 'none' : rec.unit);

const parseDay = (raw: string, addDays = 0): number | null => {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const d = new Date(+m[1]!, +m[2]! - 1, +m[3]! + addDays, 0, 0, 0, 0);
  return d.getTime();
};

const parseLocalMs = (iso: string): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

const pad = (n: number): string => n.toString().padStart(2, '0');

const toLocalIso = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
