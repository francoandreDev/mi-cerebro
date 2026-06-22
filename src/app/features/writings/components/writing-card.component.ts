import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { WritingSummary } from '../models/writing.types';

@Component({
  selector: 'mc-writing-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
  template: `
    <article
      class="card"
      role="article"
      tabindex="0"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(writing().id)"
      (keydown.enter)="open.emit(writing().id)"
      (keydown.space)="onSpace($event)"
    >
      <header class="head">
        <h2 class="title">{{ displayTitle() }}</h2>
        <button
          type="button"
          class="delete mc-hover-wiggle"
          [attr.aria-label]="ariaDelete()"
          (click)="onDeleteClick($event)"
        >
          <mc-icon name="trash" />
        </button>
      </header>
      @if (writing().preview) {
        <p class="preview">{{ writing().preview }}</p>
      } @else {
        <p class="empty">{{ t('writings.shelf.cardEmpty') }}</p>
      }
      <footer class="foot">
        <span class="meta">
          <span class="words">{{ wordsLabel() }}</span>
          <span class="dot" aria-hidden="true">·</span>
          <span class="ago">{{ ago() }}</span>
        </span>
        @if (resolvedTags().length) {
          <span class="tags">
            @for (tag of resolvedTags(); track tag.id) {
              <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
            }
          </span>
        }
      </footer>
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
      padding: var(--mc-space-4);
      min-height: 200px;
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
      margin: 0;
      font-family: var(--mc-font-serif, Georgia, 'Times New Roman', serif);
      font-size: clamp(1.25rem, 1.6vw, 1.6rem);
      font-weight: 600;
      line-height: 1.2;
      color: var(--mc-fg-primary);
      min-width: 0;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
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
    .preview {
      margin: 0;
      color: var(--mc-fg-secondary);
      font-size: var(--mc-font-size-sm);
      line-height: 1.45;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
    }
    .empty {
      margin: 0;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      font-style: italic;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mc-space-2);
      margin-top: auto;
      flex-wrap: wrap;
    }
    .meta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
    }
    .tags {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
})
export class WritingCardComponent {
  readonly writing = input.required<WritingSummary>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly ago = input.required<string>();
  readonly open = output<string>();
  readonly remove = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly displayTitle = computed(() => this.writing().title || this.untitledLabel());
  protected readonly resolvedTags = computed(() => {
    const byId = new Map(this.availableTags().map((tag) => [tag.id, tag] as const));
    return this.writing()
      .tags.map((id) => byId.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  });
  protected readonly wordsLabel = computed(() => {
    const n = this.writing().wordCount;
    if (n === 0) return this.t('writings.shelf.wordsZero');
    if (n === 1) return this.t('writings.shelf.wordsOne');
    return this.t('writings.shelf.words').replace('{n}', String(n));
  });
  protected readonly ariaOpen = computed(() =>
    this.t('writings.shelf.openAria').replace('{title}', this.displayTitle()),
  );
  protected readonly ariaDelete = computed(() =>
    this.t('writings.shelf.deleteAria').replace('{title}', this.displayTitle()),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.open.emit(this.writing().id);
  }

  protected onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.writing().id);
  }
}
