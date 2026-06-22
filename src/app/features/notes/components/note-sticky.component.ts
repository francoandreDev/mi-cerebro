import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { NoteSummary } from '../models/note.types';

@Component({
  selector: 'mc-note-sticky',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, McDatePipe, TagChipComponent],
  template: `
    <article
      class="sticky"
      role="article"
      tabindex="0"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(note().id)"
      (keydown.enter)="open.emit(note().id)"
      (keydown.space)="onSpace($event)"
    >
      <header class="head">
        <h3 class="title">{{ displayTitle() }}</h3>
        <button
          type="button"
          class="delete mc-hover-wiggle"
          [attr.aria-label]="ariaDelete()"
          (click)="onDeleteClick($event)"
        >
          <mc-icon name="trash" />
        </button>
      </header>
      @if (note().preview) {
        <p class="preview">{{ note().preview }}</p>
      } @else {
        <p class="preview muted">{{ t('notes.wall.noPreview') }}</p>
      }
      <footer class="foot">
        @if (resolvedTags().length) {
          <div class="tags">
            @for (tag of resolvedTags(); track tag.id) {
              <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
            }
          </div>
        }
        <time class="time">{{ note().updatedAt | mcDate: true }}</time>
      </footer>
    </article>
  `,
  styles: `
    :host {
      display: block;
      break-inside: avoid;
      margin-bottom: var(--mc-space-3);
    }
    .sticky {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
      padding: var(--mc-space-3);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      cursor: pointer;
      transition:
        transform 120ms ease,
        box-shadow 120ms ease,
        border-color 120ms ease;
    }
    .sticky:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
      border-color: var(--mc-accent-primary);
    }
    .sticky:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: 2px;
    }
    .head {
      display: flex;
      align-items: flex-start;
      gap: var(--mc-space-2);
    }
    .title {
      flex: 1;
      margin: 0;
      font-size: var(--mc-font-size-lg);
      font-weight: 600;
      color: var(--mc-fg-primary);
      overflow-wrap: anywhere;
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
    }
    .sticky:hover .delete,
    .sticky:focus-within .delete {
      opacity: 1;
    }
    .delete:hover,
    .delete:focus-visible {
      color: var(--mc-state-danger, #d04a4a);
    }
    .preview {
      margin: 0;
      font-size: var(--mc-font-size-sm);
      color: var(--mc-fg-secondary);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 6;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .preview.muted {
      color: var(--mc-fg-muted);
      font-style: italic;
    }
    .foot {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .time {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-muted);
    }
  `,
})
export class NoteStickyComponent {
  readonly note = input.required<NoteSummary>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly open = output<string>();
  readonly remove = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly displayTitle = computed(() => this.note().title || this.untitledLabel());
  protected readonly resolvedTags = computed(() => {
    const byId = new Map(this.availableTags().map((t) => [t.id, t] as const));
    return this.note()
      .tags.map((id) => byId.get(id))
      .filter((t): t is Tag => t !== undefined);
  });
  protected readonly ariaOpen = computed(() =>
    this.t('notes.wall.openAria').replace('{title}', this.displayTitle()),
  );
  protected readonly ariaDelete = computed(() =>
    this.t('notes.wall.deleteAria').replace('{title}', this.displayTitle()),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.open.emit(this.note().id);
  }

  protected onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.note().id);
  }
}
