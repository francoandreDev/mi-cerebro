import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';

import type { ListSummary } from '../models/list.types';

interface Segment {
  readonly text: string;
  readonly hit: boolean;
}

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const splitHighlight = (text: string, query: string): readonly Segment[] => {
  if (!query) return [{ text, hit: false }];
  const haystack = norm(text);
  const needle = norm(query);
  if (!haystack.includes(needle)) return [{ text, hit: false }];
  const out: Segment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) {
      out.push({ text: text.slice(cursor), hit: false });
      break;
    }
    if (idx > cursor) out.push({ text: text.slice(cursor, idx), hit: false });
    out.push({ text: text.slice(idx, idx + needle.length), hit: true });
    cursor = idx + needle.length;
  }
  return out;
};

@Component({
  selector: 'mc-chalk-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <article
      class="entry"
      [class.dim]="dim()"
      [class.matched]="matched() && !!query()"
      role="article"
      tabindex="0"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(list().id)"
      (keydown.enter)="open.emit(list().id)"
      (keydown.space)="onSpace($event)"
    >
      <header class="head">
        <h3 class="title">
          @for (seg of titleSegments(); track $index) {
            @if (seg.hit) {
              <mark>{{ seg.text }}</mark>
            } @else {
              <span>{{ seg.text }}</span>
            }
          }
        </h3>
        @if (resolvedTags().length) {
          <span class="tags" aria-hidden="true">
            @for (tag of resolvedTags(); track tag.id) {
              <span class="tag-dot" [style.background]="tag.color" [attr.title]="tag.label"></span>
            }
          </span>
        }
        <button
          type="button"
          class="delete"
          [attr.aria-label]="ariaDelete()"
          (click)="onDeleteClick($event)"
        >
          <mc-icon name="trash" />
        </button>
      </header>
      @if (list().previewItems.length) {
        <ul class="items">
          @for (segs of itemSegments(); track $index) {
            <li class="item">
              <span class="bullet" aria-hidden="true">·</span>
              @for (seg of segs; track $index) {
                @if (seg.hit) {
                  <mark>{{ seg.text }}</mark>
                } @else {
                  <span>{{ seg.text }}</span>
                }
              }
            </li>
          }
        </ul>
        @if (extraCount() > 0) {
          <p class="more">{{ moreLabel() }}</p>
        }
      } @else {
        <p class="empty">{{ t('lists.board.cardEmpty') }}</p>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      break-inside: avoid;
      margin-bottom: var(--mc-space-5);
    }
    .entry {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
      padding: var(--mc-space-2) var(--mc-space-2) var(--mc-space-3);
      border-radius: var(--mc-radius-sm);
      cursor: pointer;
      transition:
        opacity 160ms ease,
        background 120ms ease;
    }
    .entry:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    .entry:focus-visible {
      outline: 2px dashed var(--mc-fg-secondary);
      outline-offset: 2px;
    }
    .entry.dim {
      opacity: 0.28;
    }
    .entry.matched {
      background: rgba(255, 255, 255, 0.05);
    }
    .head {
      display: flex;
      align-items: baseline;
      gap: var(--mc-space-2);
      min-width: 0;
    }
    .title {
      flex: 1;
      margin: 0;
      font-family: 'Caveat', 'Kalam', 'Comic Sans MS', cursive;
      font-weight: 600;
      font-size: clamp(1.4rem, 1.6vw, 1.75rem);
      line-height: 1.15;
      color: var(--mc-chalk-title, #f1f5d8);
      letter-spacing: 0.01em;
      min-width: 0;
      word-break: break-word;
    }
    .title mark {
      background: var(--mc-chalk-mark, #f5d36a);
      color: #1b1b1b;
      padding: 0 2px;
      border-radius: 2px;
    }
    .tags {
      display: inline-flex;
      gap: 3px;
      flex-shrink: 0;
    }
    .tag-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
    }
    .delete {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 2px 4px;
      border-radius: var(--mc-radius-sm);
      opacity: 0;
      transition:
        opacity 120ms ease,
        color 120ms ease;
      flex-shrink: 0;
    }
    .entry:hover .delete,
    .entry:focus-within .delete {
      opacity: 0.7;
    }
    .delete:hover,
    .delete:focus-visible {
      opacity: 1;
      color: var(--mc-state-danger, #d04a4a);
    }
    .items {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .item {
      display: flex;
      gap: 6px;
      color: var(--mc-chalk-body, #d4d8c6);
      font-size: var(--mc-font-size-sm);
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item mark {
      background: var(--mc-chalk-mark, #f5d36a);
      color: #1b1b1b;
      padding: 0 2px;
      border-radius: 2px;
    }
    .bullet {
      color: var(--mc-chalk-muted, #8a8e7a);
      flex-shrink: 0;
    }
    .more,
    .empty {
      margin: 2px 0 0;
      color: var(--mc-chalk-muted, #8a8e7a);
      font-size: var(--mc-font-size-xs);
      font-style: italic;
    }
  `,
})
export class ChalkEntryComponent {
  readonly list = input.required<ListSummary>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly query = input<string>('');
  readonly open = output<string>();
  readonly remove = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly displayTitle = computed(() => this.list().title || this.untitledLabel());

  protected readonly resolvedTags = computed(() => {
    const byId = new Map(this.availableTags().map((t) => [t.id, t] as const));
    return this.list()
      .tags.map((id) => byId.get(id))
      .filter((t): t is Tag => t !== undefined);
  });

  protected readonly titleSegments = computed(() =>
    splitHighlight(this.displayTitle(), this.query()),
  );

  protected readonly itemSegments = computed(() =>
    this.list().previewItems.map((item) => splitHighlight(item, this.query())),
  );

  protected readonly matched = computed(() => {
    const q = this.query().trim();
    if (!q) return false;
    if (this.titleSegments().some((s) => s.hit)) return true;
    return this.itemSegments().some((segs) => segs.some((s) => s.hit));
  });

  protected readonly dim = computed(() => !!this.query().trim() && !this.matched());

  protected readonly extraCount = computed(
    () => this.list().itemCount - this.list().previewItems.length,
  );
  protected readonly moreLabel = computed(() =>
    this.t('lists.board.moreItems').replace('{count}', String(this.extraCount())),
  );
  protected readonly ariaOpen = computed(() =>
    this.t('lists.board.openAria').replace('{title}', this.displayTitle()),
  );
  protected readonly ariaDelete = computed(() =>
    this.t('lists.board.deleteAria').replace('{title}', this.displayTitle()),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.open.emit(this.list().id);
  }

  protected onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.list().id);
  }
}
