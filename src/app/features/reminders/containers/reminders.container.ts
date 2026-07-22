import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
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
import { GoalDormantRemindersSyncService } from '@core/reminders/goal-dormant-reminders-sync.service';
import { GoalRemindersSyncService } from '@core/reminders/goal-reminders-sync.service';
import { TaskRemindersSyncService } from '@core/reminders/task-reminders-sync.service';
import { WritingRemindersSyncService } from '@core/reminders/writing-reminders-sync.service';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import type { ShortcutBinding } from '@core/shortcuts/shortcuts.types';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';
import { createListCursor } from '@shared/utils/list-cursor';

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
import { MONDAY, SATURDAY, nextWeekdayAfter } from '../utils/snooze-presets';
import { registerRemindersTutorial } from './reminders.tutorial';

type RecurrencePreset = 'none' | RecurrenceUnit;

interface Paloma {
  readonly summary: ReminderSummary;
  readonly bucket: BucketKey;
  readonly door: 0 | 1 | 2 | 3; // cage door openness (0 = closed, 3 = wide open at fire time)
  readonly ringColor: string; // CSS color for recurrence ring (or transparent)
  // why: true for any auto-derived reminder (goal, goal-dormant, task,
  //      writing) — title is synced from the source entity, so it's
  //      read-only in the detail editor and gets a badge dot in the wall.
  readonly fromSource: boolean;
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
  imports: [McDatePipe, IconComponent, ConfirmDialogComponent],
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
  private readonly goalDormantSync = inject(GoalDormantRemindersSyncService);
  private readonly taskSync = inject(TaskRemindersSyncService);
  private readonly writingSync = inject(WritingRemindersSyncService);
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
  protected readonly overflowOpenId = signal<string | null>(null);
  protected readonly editing = signal<EditingState | null>(null);
  protected readonly undo = signal<PendingUndo | null>(null);
  protected readonly cursor = createListCursor();
  protected readonly confirm = new ConfirmController();

  constructor() {
    effect(() => {
      const req = this.creationIntent.requestedCreate();
      if (!req || req.kind !== 'reminder') return;
      if (req.requestedAt <= this.lastCreationAt) return;
      this.lastCreationAt = req.requestedAt;
      this.focusQuickAdd();
    });
    effect(() => {
      const id = this.cursor.focusedId();
      if (!id) return;
      queueMicrotask(() => {
        document
          .querySelector(`[data-paloma-id="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
    this.registerShortcuts();
    registerRemindersTutorial();
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

  // why: J/K cursor order — nichos first, then perch — mirrors the visual
  //      reading order of the palomar wall (top-down, then the overdue rail).
  protected readonly rowIds = computed<readonly string[]>(() => [
    ...this.inNichos().map((p) => p.summary.id),
    ...this.onPerch().map((p) => p.summary.id),
  ]);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  // why: "delete" on a source-derived reminder really means "turn off the
  //      toggle on the source entity" — the sync service is what actually
  //      deletes the Reminder, on its next tick. One table instead of one
  //      near-identical `if` branch per sourceKind avoids the copy-paste
  //      drift that was pushing `onDelete` past the complexity/line budget.
  private sourceDisableConfig(
    sourceKind: ReminderSummary['sourceKind'],
  ): { confirmKey: TranslationKey; disable: (id: string) => Promise<void> } | null {
    if (sourceKind === 'goal') {
      return {
        confirmKey: 'reminders.deleteGoalConfirm',
        disable: (id) => this.goalSync.disableForGoal(id),
      };
    }
    if (sourceKind === 'goal-dormant') {
      return {
        confirmKey: 'reminders.deleteGoalDormantConfirm',
        disable: (id) => this.goalDormantSync.disableForGoal(id),
      };
    }
    if (sourceKind === 'task') {
      return {
        confirmKey: 'reminders.deleteTaskConfirm',
        disable: (id) => this.taskSync.disableForTask(id),
      };
    }
    if (sourceKind === 'writing') {
      return {
        confirmKey: 'reminders.deleteWritingConfirm',
        disable: (id) => this.writingSync.disableForWriting(id),
      };
    }
    return null;
  }

  protected sourceBadgeLabel(sourceKind: ReminderSummary['sourceKind']): string {
    if (sourceKind === 'goal' || sourceKind === 'goal-dormant')
      return this.t('reminders.sourceGoalBadge');
    if (sourceKind === 'task') return this.t('reminders.sourceTaskBadge');
    if (sourceKind === 'writing') return this.t('reminders.sourceWritingBadge');
    return '';
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
      readOnlyTitle: p.fromSource,
      sourceKind: p.summary.sourceKind,
    });
  }

  protected onCloseDetail(): void {
    this.selectedId.set(null);
    this.editing.set(null);
    this.overflowOpenId.set(null);
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
    this.overflowOpenId.set(null);
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

  protected async onSnoozeToWeekday(summary: ReminderSummary, targetDow: number): Promise<void> {
    this.overflowOpenId.set(null);
    try {
      await this.workspace.ensureWritable();
      const current = await this.reminders.read(summary.id);
      const base = new Date(current.dueAt);
      const from = Number.isNaN(base.getTime()) ? new Date() : base;
      const next = nextWeekdayAfter(from, targetDow);
      await this.reminders.save({ ...current, dueAt: toLocalIso(next) });
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected onSnoozeNextMonday(summary: ReminderSummary): Promise<void> {
    return this.onSnoozeToWeekday(summary, MONDAY);
  }

  protected onSnoozeWeekend(summary: ReminderSummary): Promise<void> {
    return this.onSnoozeToWeekday(summary, SATURDAY);
  }

  protected toggleOverflow(id: string): void {
    this.overflowOpenId.set(this.overflowOpenId() === id ? null : id);
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(event: MouseEvent): void {
    const openId = this.overflowOpenId();
    if (openId === null) return;
    const target = event.target as Element;
    const wrap = target.closest?.('.overflow-wrap');
    if (wrap?.getAttribute('data-overflow-for') !== openId) {
      this.overflowOpenId.set(null);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onOverflowEscape(event: Event): void {
    if (this.overflowOpenId() !== null) {
      event.preventDefault();
      this.overflowOpenId.set(null);
    }
  }

  protected async onDuplicate(summary: ReminderSummary): Promise<void> {
    this.overflowOpenId.set(null);
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

  protected onDelete(summary: ReminderSummary): void {
    this.overflowOpenId.set(null);
    const source = summary.sourceId === null ? null : this.sourceDisableConfig(summary.sourceKind);
    if (source !== null && summary.sourceId !== null) {
      const sourceId = summary.sourceId;
      this.confirm.ask(
        {
          title: this.t('reminders.confirm.disable.title'),
          message: this.t(source.confirmKey).replace(
            '{title}',
            summary.title || this.t('reminders.untitled'),
          ),
          confirmLabel: this.t('reminders.confirm.disable.confirm'),
          cancelLabel: this.t('reminders.confirm.cancel'),
          tone: 'danger',
        },
        async () => {
          try {
            await this.workspace.ensureWritable();
            await source.disable(sourceId);
            this.onCloseDetail();
          } catch (e) {
            this.errors.report(this.withReauth(e));
          }
        },
      );
      return;
    }
    void this.deletePlain(summary);
  }

  private async deletePlain(summary: ReminderSummary): Promise<void> {
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

  private focusedSummary(): ReminderSummary | null {
    const id = this.cursor.focusedId();
    if (!id) return null;
    return this.summaries().find((r) => r.id === id) ?? null;
  }

  private focusedPaloma(): Paloma | null {
    const id = this.cursor.focusedId();
    if (!id) return null;
    return [...this.inNichos(), ...this.onPerch()].find((p) => p.summary.id === id) ?? null;
  }

  private registerShortcuts(): void {
    const bindings: readonly Omit<ShortcutBinding, 'scope'>[] = [
      { combo: 'n', labelKey: 'reminders.new', handler: () => this.focusQuickAdd() },
      { combo: '/', labelKey: 'reminders.shortcuts.search', handler: () => this.focusSearch() },
      {
        combo: 'j',
        labelKey: 'reminders.shortcuts.next',
        handler: () => this.cursor.move(1, this.rowIds()),
      },
      {
        combo: 'k',
        labelKey: 'reminders.shortcuts.prev',
        handler: () => this.cursor.move(-1, this.rowIds()),
      },
      {
        combo: 'e',
        labelKey: 'reminders.shortcuts.open',
        handler: () => {
          const p = this.focusedPaloma();
          if (p) this.onSelectPaloma(p);
        },
      },
      {
        combo: ' ',
        labelKey: 'reminders.shortcuts.toggleDone',
        handler: () => {
          const s = this.focusedSummary();
          if (s) void this.onTakeNote(s);
        },
      },
      {
        combo: 'Delete',
        labelKey: 'reminders.shortcuts.delete',
        handler: () => {
          const s = this.focusedSummary();
          if (s) void this.onDelete(s);
        },
      },
    ];
    const unregs = bindings.map((b) => this.shortcuts.register({ ...b, scope: 'editable-safe' }));
    this.destroyRef.onDestroy(() => {
      unregs.forEach((unreg) => unreg());
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
  readonly sourceKind: ReminderSummary['sourceKind'];
}

const toPaloma = (r: ReminderSummary): Paloma => {
  const b = bucketOf(r);
  const ringColor = r.recurrence ? RING_COLORS[r.recurrence.unit] : 'transparent';
  return {
    summary: r,
    bucket: b,
    door: r.paused ? 0 : DOOR_BY_BUCKET[b],
    ringColor,
    fromSource: r.sourceKind != null,
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
