// 13d-iii — Drafts side panel mounted by EditorComponent. Mirror of
// CommentsPanelContainer in shape: reads the marks file on entity change,
// persists accept/reject via DraftsService.save, and (for accept) emits
// the mutated doc back to the editor + asks AutocommitService to land a
// commit prefixed `accept-draft:` on main.

import type { JSONContent } from '@tiptap/core';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { AutocommitService } from '@core/versioning/autocommit.service';
import { applyMarkToDoc } from '@core/versioning/draft-apply';
import { DraftsService } from '@core/versioning/drafts.service';
import type { DiffMark } from '@core/versioning/drafts.types';
import { IconComponent } from '@shared/icon/icon.component';

import { DraftPreviewComponent } from './draft-preview.component';
import { DraftsListComponent } from './drafts-list.component';

@Component({
  selector: 'mc-drafts-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DraftPreviewComponent, DraftsListComponent, IconComponent],
  template: `
    <header class="head">
      <h3 id="mc-drafts-title">{{ t('drafts.title') }} ({{ count() }})</h3>
      <button
        type="button"
        class="icon"
        (click)="closed.emit()"
        [attr.aria-label]="t('drafts.close')"
      >
        <mc-icon name="x" />
      </button>
    </header>

    @if (loading()) {
      <p class="muted">{{ t('drafts.loading') }}</p>
    } @else if (marks().length === 0) {
      <div class="empty">
        <strong>{{ t('drafts.empty.title') }}</strong>
        <p class="muted">{{ t('drafts.empty.hint') }}</p>
      </div>
    } @else {
      <div class="bulk" role="group">
        <button type="button" class="primary small" (click)="onAcceptAll()" [disabled]="busy()">
          <mc-icon name="check" /> {{ t('drafts.actions.acceptAll') }}
        </button>
        <button type="button" class="ghost small" (click)="onRejectAll()" [disabled]="busy()">
          <mc-icon name="x" /> {{ t('drafts.actions.rejectAll') }}
        </button>
      </div>
      <div class="split">
        <mc-drafts-list
          class="pane left"
          [marks]="marks()"
          [selectedId]="selectedId()"
          (pick)="onSelect($event)"
        />
        <mc-draft-preview
          class="pane right"
          [mark]="selectedMark()"
          [busy]="busy()"
          (accept)="onAccept($event)"
          (reject)="onReject($event)"
        />
      </div>
    }
  `,
  styleUrl: './drafts-panel.container.scss',
})
export class DraftsPanelContainer {
  readonly entityId = input.required<string>();
  readonly entityTitle = input<string>('');
  readonly value = input<JSONContent | null>(null);
  readonly closed = output<void>();
  readonly applyToDoc = output<JSONContent>();
  readonly marksChange = output<readonly DiffMark[]>();

  private readonly i18n = inject(I18nService);
  private readonly drafts = inject(DraftsService);
  private readonly autocommit = inject(AutocommitService);
  private readonly errors = inject(ErrorService);
  private readonly injector = inject(Injector);

  private readonly all = signal<readonly DiffMark[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly marks = computed(() => this.all());
  protected readonly count = computed(() => this.all().length);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedMark = computed<DiffMark | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.all().find((m) => m.id === id) ?? null;
  });

  constructor() {
    effect(
      () => {
        const id = this.entityId();
        this.selectedId.set(null);
        if (!id) {
          this.all.set([]);
          this.marksChange.emit([]);
          return;
        }
        void this.loadFor(id);
      },
      { injector: this.injector },
    );
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSelect(id: string): void {
    this.selectedId.set(id);
  }

  protected async onAccept(id: string): Promise<void> {
    const mark = this.all().find((m) => m.id === id);
    if (!mark) return;
    await this.applyMarks([mark]);
  }

  protected async onReject(id: string): Promise<void> {
    const next = this.all().filter((m) => m.id !== id);
    await this.persist(next);
  }

  protected async onAcceptAll(): Promise<void> {
    const list = this.all();
    if (list.length === 0) return;
    if (!this.confirmIf('drafts.confirm.acceptAll', list.length)) return;
    await this.applyMarks(list);
  }

  protected async onRejectAll(): Promise<void> {
    const list = this.all();
    if (list.length === 0) return;
    if (!this.confirmIf('drafts.confirm.rejectAll', list.length)) return;
    await this.persist([]);
  }

  // why: optimistic — update the visible list + emit the mutated doc right
  //      away so the user sees the change instantly. Persistence and the
  //      `accept-draft:` autocommit run in background; on failure we revert
  //      the list (the doc is already in the host's hands, can't undo
  //      without echoing back) and surface the error.
  private async applyMarks(toApply: readonly DiffMark[]): Promise<void> {
    const baseDoc = this.value();
    if (!baseDoc) return;
    let nextDoc: JSONContent = baseDoc;
    for (const m of toApply) {
      nextDoc = applyMarkToDoc(nextDoc, m);
    }
    const previous = this.all();
    const remaining = previous.filter((m) => !toApply.includes(m));
    this.applyToDoc.emit(nextDoc);
    this.all.set(remaining);
    this.syncSelection(remaining);
    this.marksChange.emit(remaining);
    this.busy.set(true);
    try {
      await this.drafts.save(this.entityId(), this.entityTitle(), remaining);
      const message = formatAcceptMessage(this.entityTitle() || this.entityId(), toApply.length);
      await this.autocommit.commitNow('accept-draft', message);
    } catch (err) {
      this.all.set(previous);
      this.marksChange.emit(previous);
      this.errors.report(err);
    } finally {
      this.busy.set(false);
    }
  }

  private async persist(next: readonly DiffMark[]): Promise<void> {
    const previous = this.all();
    this.all.set(next);
    this.syncSelection(next);
    this.marksChange.emit(next);
    this.busy.set(true);
    try {
      await this.drafts.save(this.entityId(), this.entityTitle(), next);
    } catch (err) {
      this.all.set(previous);
      this.marksChange.emit(previous);
      this.errors.report(err);
    } finally {
      this.busy.set(false);
    }
  }

  private async loadFor(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const file = await this.drafts.read(id);
      if (this.entityId() === id) {
        this.all.set(file.marks);
        this.syncSelection(file.marks);
        this.marksChange.emit(file.marks);
      }
    } catch (err) {
      this.errors.report(err);
      if (this.entityId() === id) {
        this.all.set([]);
        this.syncSelection([]);
        this.marksChange.emit([]);
      }
    } finally {
      if (this.entityId() === id) this.loading.set(false);
    }
  }

  private syncSelection(list: readonly DiffMark[]): void {
    const id = this.selectedId();
    if (id && !list.some((m) => m.id === id)) this.selectedId.set(null);
  }

  private confirmIf(key: TranslationKey, n?: number): boolean {
    if (typeof confirm !== 'function') return true;
    const msg = n === undefined ? this.t(key) : this.t(key).replace('{n}', String(n));
    return confirm(msg);
  }
}

function formatAcceptMessage(label: string, count: number): string {
  const suffix = count === 1 ? '1 cambio' : `${count} cambios`;
  return `accept-draft: ${label} (${suffix})`;
}
