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
import { MC_INTERNAL_DND_TYPE, hasInternalDnd } from '@shared/utils/dnd';

import type { ChapterSummary } from '../models/book.types';
import { ChapterRowComponent } from './chapter-row.component';

@Component({
  selector: 'mc-chapter-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChapterRowComponent],
  template: `
    @if (collapsed()) {
      <button
        type="button"
        class="rail"
        [attr.aria-label]="t('books.chapters.expand')"
        [title]="t('books.chapters.expand')"
        (click)="toggleCollapsed()"
      >
        »
      </button>
    } @else {
      <header class="header">
        <h3>{{ countLabel() }}</h3>
        <div class="header-ops">
          @if (editable()) {
            <button
              type="button"
              class="primary"
              (click)="addChapter.emit()"
              [attr.aria-label]="t('books.chapters.new')"
              [title]="t('books.chapters.new')"
            >
              +
            </button>
          }
          <button
            type="button"
            class="ghost"
            [attr.aria-label]="t('books.chapters.collapse')"
            [title]="t('books.chapters.collapse')"
            (click)="toggleCollapsed()"
          >
            «
          </button>
        </div>
      </header>
      <input
        type="search"
        class="filter"
        [placeholder]="t('books.chapters.filterPlaceholder')"
        [attr.aria-label]="t('books.chapters.filterPlaceholder')"
        [value]="query()"
        (input)="onQuery($event)"
      />
      @if (chapters().length === 0) {
        <div class="empty">
          <p>{{ t('books.chapters.empty') }}</p>
          @if (editable()) {
            <button type="button" class="primary cta" (click)="addChapter.emit()">
              + {{ t('books.chapters.new') }}
            </button>
          }
        </div>
      } @else if (filtered().length === 0) {
        <p class="empty">{{ t('books.chapters.filterNoMatch') }}</p>
      } @else {
        <ul class="list">
          @for (item of filtered(); track item.ch.id) {
            <li
              class="li"
              [class.drop-target]="dropTargetId() === item.ch.id"
              [class.dragging]="draggingId() === item.ch.id"
              [attr.draggable]="editable() ? true : null"
              (dragstart)="onDragStart($event, item.ch.id)"
              (dragover)="onDragOver($event, item.ch.id)"
              (dragleave)="onDragLeave(item.ch.id)"
              (drop)="onDrop($event, item.ch.id)"
              (dragend)="onDragEnd()"
            >
              <mc-chapter-row
                [chapter]="item.ch"
                [index]="item.index"
                [total]="chapters().length"
                [selected]="item.ch.id === activeId()"
                [editable]="editable()"
                (activate)="selectChapter.emit(item.ch.id)"
                (moveUp)="moveUp.emit(item.ch.id)"
                (moveDown)="moveDown.emit(item.ch.id)"
                (remove)="removeChapter.emit(item.ch.id)"
              />
            </li>
          }
        </ul>
      }
    }
  `,
  styleUrl: './chapter-list.component.css',
  host: {
    '[class.collapsed]': 'collapsed()',
  },
})
export class ChapterListComponent {
  readonly chapters = input.required<readonly ChapterSummary[]>();
  readonly activeId = input<string | null>(null);
  readonly editable = input<boolean>(true);
  readonly collapsed = input<boolean>(false);

  readonly selectChapter = output<string>();
  readonly moveUp = output<string>();
  readonly moveDown = output<string>();
  readonly addChapter = output<void>();
  readonly removeChapter = output<string>();
  readonly reorder = output<{ from: string; to: string }>();
  readonly collapsedChange = output<boolean>();

  protected readonly query = signal<string>('');
  protected readonly draggingId = signal<string | null>(null);
  protected readonly dropTargetId = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.chapters();
    if (q === '') return list.map((ch, index) => ({ ch, index }));
    return list
      .map((ch, index) => ({ ch, index }))
      .filter(({ ch }) => (ch.title || '').toLowerCase().includes(q));
  });

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected countLabel(): string {
    const n = this.chapters().length;
    return n === 1
      ? this.t('books.chapters.countOne')
      : this.t('books.chapters.countMany', { count: n });
  }
  protected onQuery(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }
  protected toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed());
  }

  protected onDragStart(event: DragEvent, id: string): void {
    if (!this.editable() || !event.dataTransfer) return;
    event.dataTransfer.setData(MC_INTERNAL_DND_TYPE, id);
    event.dataTransfer.effectAllowed = 'move';
    this.draggingId.set(id);
  }
  protected onDragOver(event: DragEvent, id: string): void {
    if (!this.editable() || !event.dataTransfer) return;
    if (!hasInternalDnd(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (this.dropTargetId() !== id) this.dropTargetId.set(id);
  }
  protected onDragLeave(id: string): void {
    if (this.dropTargetId() === id) this.dropTargetId.set(null);
  }
  protected onDrop(event: DragEvent, to: string): void {
    if (!this.editable() || !event.dataTransfer) return;
    const from = event.dataTransfer.getData(MC_INTERNAL_DND_TYPE);
    if (!from) return;
    event.preventDefault();
    event.stopPropagation();
    this.dropTargetId.set(null);
    this.draggingId.set(null);
    if (from !== to) this.reorder.emit({ from, to });
  }
  protected onDragEnd(): void {
    this.draggingId.set(null);
    this.dropTargetId.set(null);
  }
}
