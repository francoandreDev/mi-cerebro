import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { ListSummary } from '../models/list.types';

@Component({
  selector: 'mc-list-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
  template: `
    <article
      class="card"
      role="article"
      tabindex="0"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(list().id)"
      (keydown.enter)="open.emit(list().id)"
      (keydown.space)="onSpace($event)"
    >
      <header class="head">
        <h2 class="title">
          <mc-icon name="list-bullets" class="title-icon" aria-hidden="true" />
          <span class="title-text">{{ displayTitle() }}</span>
        </h2>
        <button
          type="button"
          class="delete mc-hover-wiggle"
          [attr.aria-label]="ariaDelete()"
          (click)="onDeleteClick($event)"
        >
          <mc-icon name="trash" />
        </button>
      </header>
      @if (list().previewItems.length) {
        <ul class="items">
          @for (item of list().previewItems; track $index) {
            <li class="item">{{ item }}</li>
          }
        </ul>
        @if (extraCount() > 0) {
          <p class="more">{{ moreLabel() }}</p>
        }
      } @else {
        <p class="empty">{{ t('lists.shelf.cardEmpty') }}</p>
      }
      @if (resolvedTags().length) {
        <footer class="foot">
          @for (tag of resolvedTags(); track tag.id) {
            <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
          }
        </footer>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
      padding: var(--mc-space-3);
      min-height: 180px;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-lg, 12px);
      cursor: pointer;
      transition:
        transform 140ms ease,
        box-shadow 140ms ease,
        border-color 140ms ease;
    }
    .card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.1);
      border-color: var(--mc-accent-primary);
    }
    .card:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: 2px;
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--mc-space-2);
    }
    .title {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      margin: 0;
      font-size: var(--mc-font-size-lg);
      font-weight: 600;
      color: var(--mc-fg-primary);
      min-width: 0;
    }
    .title-icon {
      color: var(--mc-accent-primary);
      flex-shrink: 0;
    }
    .title-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .delete {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: var(--mc-radius-sm);
      opacity: 0;
      transition:
        opacity 120ms ease,
        color 120ms ease;
      flex-shrink: 0;
    }
    .card:hover .delete,
    .card:focus-within .delete {
      opacity: 1;
    }
    .delete:hover,
    .delete:focus-visible {
      color: var(--mc-state-danger, #d04a4a);
    }
    .items {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .item {
      position: relative;
      padding-left: 14px;
      color: var(--mc-fg-secondary);
      font-size: var(--mc-font-size-sm);
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item::before {
      content: '';
      position: absolute;
      left: 2px;
      top: 0.55em;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--mc-accent-primary);
      opacity: 0.7;
    }
    .more {
      margin: 0;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
      font-style: italic;
    }
    .empty {
      margin: 0;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      font-style: italic;
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: auto;
    }
  `,
})
export class ListCardComponent {
  readonly list = input.required<ListSummary>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
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
  protected readonly extraCount = computed(
    () => this.list().itemCount - this.list().previewItems.length,
  );
  protected readonly moreLabel = computed(() =>
    this.t('lists.shelf.moreItems').replace('{count}', String(this.extraCount())),
  );
  protected readonly ariaOpen = computed(() =>
    this.t('lists.shelf.openAria').replace('{title}', this.displayTitle()),
  );
  protected readonly ariaDelete = computed(() =>
    this.t('lists.shelf.deleteAria').replace('{title}', this.displayTitle()),
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
