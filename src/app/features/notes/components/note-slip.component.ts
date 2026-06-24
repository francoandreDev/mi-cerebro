import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { NoteSummary } from '../models/note.types';

@Component({
  selector: 'mc-note-slip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, McDatePipe, TagChipComponent],
  template: `
    <article
      class="slip"
      role="article"
      tabindex="0"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(note().id)"
      (keydown.enter)="open.emit(note().id)"
      (keydown.space)="onSpace($event)"
    >
      <div class="body">
        <div class="text">
          <h3 class="title">{{ displayTitle() }}</h3>
          @if (note().preview) {
            <p class="preview">{{ note().preview }}</p>
          } @else {
            <p class="preview muted">{{ t('notes.wall.noPreview') }}</p>
          }
          @if (resolvedTags().length) {
            <div class="tags">
              @for (tag of resolvedTags(); track tag.id) {
                <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
              }
            </div>
          }
        </div>
        <div class="meta">
          <time class="time">{{ note().updatedAt | mcDate: true }}</time>
          <button
            type="button"
            class="delete"
            [attr.aria-label]="ariaDelete()"
            (click)="onDeleteClick($event)"
          >
            <mc-icon name="trash" />
          </button>
        </div>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    @keyframes slip-drop {
      0% {
        transform: translateY(-14px) scaleY(0.94);
        opacity: 0;
      }
      55% {
        transform: translateY(2px) scaleY(1.01);
        opacity: 1;
      }
      100% {
        transform: translateY(0) scaleY(1);
        opacity: 1;
      }
    }
    .slip {
      display: block;
      position: relative;
      background: var(--mc-bg-elevated);
      border-inline: 1px solid var(--mc-border-default);
      border-bottom: 1px dashed color-mix(in srgb, var(--mc-border-default) 80%, transparent);
      cursor: pointer;
      transform-origin: top center;
      animation: slip-drop 240ms cubic-bezier(0.22, 1.2, 0.36, 1) both;
      transition:
        background 120ms ease,
        box-shadow 120ms ease;
    }
    .slip::before,
    .slip::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: 10px;
      background-image: radial-gradient(
        circle at 5px 50%,
        var(--mc-bg-primary) 2.2px,
        transparent 2.4px
      );
      background-size: 10px 14px;
      background-repeat: repeat-y;
    }
    .slip::before {
      left: 0;
    }
    .slip::after {
      right: 0;
    }
    .slip:hover {
      background: color-mix(in srgb, var(--mc-bg-elevated) 92%, var(--mc-accent-primary));
    }
    .slip:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: -2px;
    }
    .body {
      display: flex;
      gap: var(--mc-space-3);
      align-items: flex-start;
      padding: var(--mc-space-3) calc(var(--mc-space-3) + 10px);
    }
    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .title {
      margin: 0;
      font-size: var(--mc-font-size-base);
      font-weight: 600;
      color: var(--mc-fg-primary);
      font-family: var(--mc-font-mono, ui-monospace, 'Courier New', monospace);
      overflow-wrap: anywhere;
    }
    .preview {
      margin: 0;
      font-size: var(--mc-font-size-sm);
      color: var(--mc-fg-secondary);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .preview.muted {
      color: var(--mc-fg-muted);
      font-style: italic;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 2px;
    }
    .meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--mc-space-1);
      flex-shrink: 0;
    }
    .time {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-muted);
      font-family: var(--mc-font-mono, ui-monospace, 'Courier New', monospace);
      white-space: nowrap;
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
    .slip:hover .delete,
    .slip:focus-within .delete {
      opacity: 1;
    }
    .delete:hover,
    .delete:focus-visible {
      color: var(--mc-state-danger, #d04a4a);
    }
  `,
})
export class NoteSlipComponent {
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
