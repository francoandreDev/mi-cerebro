import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  signal,
} from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TrashService } from '@core/trash/trash.service';
import type { TrashEntry, TrashKind, TrashPreview } from '@core/trash/trash.types';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import { TrashCardContentComponent } from '../components/trash-card-content.component';
import { TrashCardComponent } from '../components/trash-card.component';
import { TrashFilterBarComponent } from '../components/trash-filter-bar.component';
import { TrashCoverUrlCache } from './trash-cover-url-cache';

const KINDS: readonly TrashKind[] = [
  'note',
  'task',
  'goal',
  'list',
  'writing',
  'book',
  'image',
  'file',
  'reminder',
  'track',
  'playlist',
];

interface CardState {
  readonly status: 'loading' | 'ready' | 'missing';
  readonly preview: TrashPreview | null;
  readonly thumbUrls: readonly string[];
}

const EMPTY_STATE: CardState = { status: 'loading', preview: null, thumbUrls: [] };

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Component({
  selector: 'mc-trash',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    IconComponent,
    TrashFilterBarComponent,
    TrashCardComponent,
    TrashCardContentComponent,
    McDatePipe,
  ],
  templateUrl: './trash.container.html',
  styleUrl: './trash.container.css',
})
export class TrashContainer {
  private readonly trash = inject(TrashService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);
  private readonly coverUrls = new TrashCoverUrlCache();

  protected readonly entries = this.trash.entries;
  protected readonly isEmpty = computed(() => this.entries().length === 0);
  protected readonly activeKind = signal<TrashKind | null>(null);
  protected readonly query = signal<string>('');
  protected readonly viewing = signal<TrashEntry | null>(null);
  protected readonly confirm = new ConfirmController();

  protected readonly counts = computed<Readonly<Record<TrashKind, number>>>(() => {
    const acc = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<TrashKind, number>;
    for (const e of this.entries()) acc[e.kind]++;
    return acc;
  });

  protected readonly visible = computed<readonly TrashEntry[]>(() => {
    const kind = this.activeKind();
    const q = norm(this.query().trim());
    let list = this.entries();
    if (kind) list = list.filter((e) => e.kind === kind);
    if (q) list = list.filter((e) => norm(e.title || '').includes(q));
    return list;
  });

  protected readonly noMatch = computed(() => !this.isEmpty() && this.visible().length === 0);

  private readonly previewCache = signal<ReadonlyMap<string, CardState>>(new Map());

  constructor() {
    void this.trash.refresh().catch((e: unknown) => this.errors.report(e));
    effect(() => {
      for (const entry of this.visible()) {
        if (!this.previewCache().has(this.entryKey(entry))) {
          void this.loadPreview(entry);
        }
      }
    });
    inject(DestroyRef).onDestroy(() => this.coverUrls.revokeAll());
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected entryKey(entry: TrashEntry): string {
    return `${entry.parentPath.join('/')}/${entry.filename}`;
  }

  protected kindLabel(entry: TrashEntry): string {
    return this.t(`trash.kind.${entry.kind}` as TranslationKey);
  }

  protected entryTitle(entry: TrashEntry): string {
    return entry.title || this.t('trash.untitledTitle');
  }

  protected cardState(entry: TrashEntry): CardState {
    return this.previewCache().get(this.entryKey(entry)) ?? EMPTY_STATE;
  }

  protected onSelectKind(kind: TrashKind | null): void {
    this.activeKind.set(kind);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }

  protected clearQuery(): void {
    this.query.set('');
  }

  protected onView(entry: TrashEntry): void {
    this.viewing.set(entry);
  }

  protected closeView(): void {
    this.viewing.set(null);
  }

  protected factLabel(key: string): string {
    return this.t(key as TranslationKey);
  }

  protected factValue(value: string): string {
    if (value.startsWith('trash.preview.status.')) return this.t(value as TranslationKey);
    return value;
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.viewing()) {
      event.preventDefault();
      this.closeView();
    }
  }

  protected async onRestore(entry: TrashEntry): Promise<void> {
    try {
      await this.trash.restore(entry);
      this.coverUrls.revoke(this.entryKey(entry));
      if (this.viewing() && this.entryKey(this.viewing()!) === this.entryKey(entry)) {
        this.closeView();
      }
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onPurge(entry: TrashEntry): void {
    const label = this.entryTitle(entry);
    this.confirm.ask(
      {
        title: this.t('trash.confirm.purge.title'),
        message: this.t('trash.purgeConfirm').replace('{title}', label),
        confirmLabel: this.t('trash.confirm.purge.confirm'),
        cancelLabel: this.t('trash.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.trash.purge(entry);
          this.coverUrls.revoke(this.entryKey(entry));
          if (this.viewing() && this.entryKey(this.viewing()!) === this.entryKey(entry)) {
            this.closeView();
          }
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected onEmpty(): void {
    this.confirm.ask(
      {
        title: this.t('trash.confirm.empty.title'),
        message: this.t('trash.emptyConfirm'),
        confirmLabel: this.t('trash.confirm.empty.confirm'),
        cancelLabel: this.t('trash.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.trash.empty();
          this.closeView();
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  private async loadPreview(entry: TrashEntry): Promise<void> {
    const key = this.entryKey(entry);
    this.setState(key, { status: 'loading', preview: null, thumbUrls: [] });
    try {
      const preview = await this.trash.loadPreview(entry);
      this.setState(
        key,
        preview
          ? { status: 'ready', preview, thumbUrls: [] }
          : { status: 'missing', preview: null, thumbUrls: [] },
      );
      if (preview && entry.kind === 'image') void this.loadCovers(entry);
    } catch (e) {
      this.errors.report(e);
      this.setState(key, { status: 'missing', preview: null, thumbUrls: [] });
    }
  }

  private async loadCovers(entry: TrashEntry): Promise<void> {
    const key = this.entryKey(entry);
    try {
      const blobs = await this.trash.loadGalleryCovers(entry);
      if (!this.previewCache().has(key)) return;
      const urls = this.coverUrls.set(key, blobs);
      this.setState(key, { ...this.cardState(entry), thumbUrls: urls });
    } catch (e) {
      this.errors.report(e);
    }
  }

  private setState(key: string, state: CardState): void {
    this.previewCache.update((m) => {
      const next = new Map(m);
      next.set(key, state);
      return next;
    });
  }
}
