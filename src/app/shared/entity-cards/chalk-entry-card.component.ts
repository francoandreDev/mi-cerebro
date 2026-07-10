import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Tag } from '@core/tags/tag.types';

// why: read-only twin of features/lists/components/chalk-entry.component.ts
//      for the cross-tag view (features/tags/tag-detail) — same chalkboard
//      visual, primitive inputs instead of ListSummary so shared/ stays
//      free of @features imports (PROYECTO.md §4.2.10). Drops the
//      query/highlight and delete affordances — this view never mutates
//      and has no search box of its own.
@Component({
  selector: 'mc-chalk-entry-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="entry"
      role="article"
      tabindex="0"
      [attr.aria-label]="displayTitle()"
      (click)="open.emit(id())"
      (keydown.enter)="open.emit(id())"
      (keydown.space)="onSpace($event)"
    >
      <header class="head">
        <h3 class="title">{{ displayTitle() }}</h3>
        @if (resolvedTags().length) {
          <span class="tags" aria-hidden="true">
            @for (tag of resolvedTags(); track tag.id) {
              <span class="tag-dot" [style.background]="tag.color" [attr.title]="tag.label"></span>
            }
          </span>
        }
      </header>
      @if (previewItems().length) {
        <ul class="items">
          @for (item of previewItems(); track $index) {
            <li class="item"><span class="bullet" aria-hidden="true">·</span>{{ item }}</li>
          }
        </ul>
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
      transition: background 120ms ease;
    }
    .entry:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    .entry:focus-visible {
      outline: 2px dashed var(--mc-fg-secondary);
      outline-offset: 2px;
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
    .bullet {
      color: var(--mc-chalk-muted, #8a8e7a);
      flex-shrink: 0;
    }
  `,
})
export class ChalkEntryCardComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly untitledLabel = input.required<string>();
  readonly previewItems = input<readonly string[]>([]);
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
