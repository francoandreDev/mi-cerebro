import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { WritingSummary } from '../models/writing.types';

@Component({
  selector: 'mc-writing-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
  template: `
    <div
      class="row"
      role="button"
      tabindex="0"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(writing().id)"
      (keydown.enter)="open.emit(writing().id)"
      (keydown.space)="onSpace($event)"
    >
      <div class="main">
        <h3 class="title">{{ displayTitle() }}</h3>
        @if (writing().preview) {
          <p class="preview">{{ writing().preview }}</p>
        }
      </div>
      @if (resolvedTags().length) {
        <span class="tags">
          @for (tag of resolvedTags(); track tag.id) {
            <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
          }
        </span>
      }
      <span class="meta">
        <span class="words">{{ wordsLabel() }}</span>
        <span class="ago">{{ ago() }}</span>
      </span>
      <button
        type="button"
        class="delete mc-hover-wiggle"
        [attr.aria-label]="ariaDelete()"
        (click)="onDeleteClick($event)"
      >
        <mc-icon name="trash" />
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto auto;
      align-items: center;
      gap: var(--mc-space-3);
      padding: var(--mc-space-2) var(--mc-space-3);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md, 8px);
      cursor: pointer;
      transition:
        border-color 140ms ease,
        background 140ms ease;
    }
    .row:hover {
      border-color: var(--mc-accent-primary);
      background: color-mix(in srgb, var(--mc-accent-primary) 4%, var(--mc-bg-elevated));
    }
    .row:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: 1px;
    }
    .main {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title {
      margin: 0;
      font-family: var(--mc-font-serif, Georgia, 'Times New Roman', serif);
      font-size: var(--mc-font-size-base);
      font-weight: 600;
      color: var(--mc-fg-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .preview {
      margin: 0;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tags {
      display: inline-flex;
      flex-wrap: nowrap;
      gap: 4px;
      max-width: 220px;
      overflow: hidden;
    }
    .meta {
      display: inline-flex;
      align-items: center;
      gap: var(--mc-space-2);
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
      white-space: nowrap;
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
    }
    .row:hover .delete,
    .row:focus-within .delete {
      opacity: 1;
    }
    .delete:hover,
    .delete:focus-visible {
      color: var(--mc-state-danger, #d04a4a);
    }
    @media (max-width: 720px) {
      .row {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .tags,
      .meta {
        display: none;
      }
    }
  `,
})
export class WritingRowComponent {
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
