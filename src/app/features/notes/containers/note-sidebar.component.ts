import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { filterTree } from '@shared/tree/filter';
import { TreeFilterComponent } from '@shared/tree/tree-filter.component';
import { TreeComponent } from '@shared/tree/tree.component';
import type { FilterDirection, TreeNode, TreeNodeBadge } from '@shared/tree/tree.types';

import type { NoteSummary } from '../models/note.types';

const NOTES_ROOT_ID = 'group:notes';

@Component({
  selector: 'mc-note-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeFilterComponent, TreeComponent],
  template: `
    <header class="bar">
      <h2 class="title">{{ t('notes.title') }}</h2>
      <button type="button" class="primary" (click)="create.emit()">
        {{ t('notes.new') }}
      </button>
    </header>
    <mc-tree-filter
      [query]="query()"
      [direction]="direction()"
      [matchCount]="result().matches.length"
      (queryChange)="onQuery($event)"
      (directionChange)="onDirection($event)"
      (next)="onNext()"
      (prev)="onPrev()"
      (activateFirst)="onActivateFirst()"
      (clear)="onClear()"
    />
    <mc-tree
      [nodes]="treeRoots()"
      [visible]="result().visible"
      [matchedIds]="matchedIds()"
      [autoExpand]="result().autoExpand"
      [selectedId]="selectedId()"
      [emptyKey]="emptyKey()"
      (chooseNode)="chooseNote.emit($event)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      width: 280px;
      border-right: 1px solid var(--mc-border-default);
      background: var(--mc-bg-surface);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--mc-space-3);
      border-bottom: 1px solid var(--mc-border-default);
    }
    .title {
      font-size: var(--mc-font-size-lg);
      margin: 0;
    }
    .primary {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      font-weight: 600;
    }
  `,
})
export class NoteSidebarComponent {
  readonly notes = input.required<readonly NoteSummary[]>();
  readonly tags = input<readonly Tag[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly chooseNote = output<string>();
  readonly create = output<void>();

  private readonly i18n = inject(I18nService);

  protected readonly query = signal('');
  protected readonly direction = signal<FilterDirection>('general');
  private readonly cursor = signal(0);

  private readonly tagsById = computed(() => {
    const map = new Map<string, Tag>();
    for (const t of this.tags()) map.set(t.id, t);
    return map;
  });

  protected readonly treeRoots = computed<readonly TreeNode[]>(() => {
    const items = this.notes();
    const lookup = this.tagsById();
    const children: TreeNode[] = items.map((n) => ({
      id: n.id,
      label: n.title || this.i18n.t('notes.untitledTitle'),
      kind: 'note',
      badges: this.badgesFor(n.tags, lookup),
    }));
    return [{ id: NOTES_ROOT_ID, label: this.i18n.t('notes.title'), kind: 'group', children }];
  });

  private badgesFor(
    ids: readonly string[],
    lookup: ReadonlyMap<string, Tag>,
  ): readonly TreeNodeBadge[] {
    const out: TreeNodeBadge[] = [];
    for (const id of ids) {
      const tag = lookup.get(id);
      if (tag) out.push({ id: tag.id, label: tag.label, color: tag.color });
    }
    return out;
  }

  protected readonly result = computed(() =>
    filterTree(this.treeRoots(), this.query(), this.selectedId(), this.direction()),
  );

  protected readonly matchedIds = computed(() => new Set(this.result().matches.map((m) => m.id)));

  protected readonly emptyKey = computed<TranslationKey>(() =>
    this.query().trim() === '' ? 'notes.empty' : 'tree.noMatches',
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.cursor.set(0);
  }

  protected onDirection(d: FilterDirection): void {
    this.direction.set(d);
    this.cursor.set(0);
  }

  protected onNext(): void {
    const total = this.result().matches.length;
    if (total === 0) return;
    this.cursor.update((c) => (c + 1) % total);
    this.jumpToCursor();
  }

  protected onPrev(): void {
    const total = this.result().matches.length;
    if (total === 0) return;
    this.cursor.update((c) => (c - 1 + total) % total);
    this.jumpToCursor();
  }

  protected onActivateFirst(): void {
    const match = this.result().matches[this.cursor()];
    if (match) this.chooseNote.emit(match.id);
  }

  protected onClear(): void {
    if (this.query() === '') return;
    this.query.set('');
    this.cursor.set(0);
  }

  private jumpToCursor(): void {
    const match = this.result().matches[this.cursor()];
    if (match) this.chooseNote.emit(match.id);
  }
}
