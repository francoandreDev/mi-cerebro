import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Tag } from '@core/tags/tag.types';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

// why: read-only twin of features/notes/components/note-slip.component.ts
//      for the cross-tag view (features/tags/tag-detail) — same visual
//      (sticky note with pin holes), primitive inputs instead of
//      NoteSummary so shared/ stays free of @features imports
//      (docs/proyecto/reglas.md §4.2.10), no delete affordance since this
//      view never mutates.
@Component({
  selector: 'mc-note-slip-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [McDatePipe, TagChipComponent],
  template: `
    <article
      class="slip"
      role="article"
      tabindex="0"
      [attr.aria-label]="displayTitle()"
      (click)="open.emit(id())"
      (keydown.enter)="open.emit(id())"
      (keydown.space)="onSpace($event)"
    >
      <div class="body">
        <div class="text">
          <h3 class="title">{{ displayTitle() }}</h3>
          @if (preview()) {
            <p class="preview">{{ preview() }}</p>
          }
          @if (resolvedTags().length) {
            <div class="tags">
              @for (tag of resolvedTags(); track tag.id) {
                <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
              }
            </div>
          }
        </div>
        <time class="time">{{ updatedAt() | mcDate: true }}</time>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .slip {
      display: block;
      position: relative;
      background: var(--mc-bg-elevated);
      border-inline: 1px solid var(--mc-border-default);
      border-bottom: 1px dashed color-mix(in srgb, var(--mc-border-default) 80%, transparent);
      cursor: pointer;
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
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 2px;
    }
    .time {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-muted);
      font-family: var(--mc-font-mono, ui-monospace, 'Courier New', monospace);
      white-space: nowrap;
      flex-shrink: 0;
    }
  `,
})
export class NoteSlipCardComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly untitledLabel = input.required<string>();
  readonly preview = input<string>('');
  readonly updatedAt = input.required<string>();
  readonly tagIds = input.required<readonly string[]>();
  readonly availableTags = input.required<readonly Tag[]>();

  readonly open = output<string>();

  protected readonly displayTitle = computed(() => this.title() || this.untitledLabel());
  protected readonly resolvedTags = computed<readonly Tag[]>(() => {
    const byId = new Map(this.availableTags().map((t) => [t.id, t] as const));
    return this.tagIds()
      .map((id) => byId.get(id))
      .filter((t): t is Tag => t !== undefined);
  });

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.open.emit(this.id());
  }
}
