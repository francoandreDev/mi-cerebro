import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Tag } from '@core/tags/tag.types';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

// why: read-only twin of features/writings/components/writing-card.component.ts
//      for the cross-tag view (features/tags/tag-detail) — same typographic
//      card visual, primitive inputs instead of WritingSummary so shared/
//      stays free of @features imports (PROYECTO.md §4.2.10), no delete
//      affordance since this view never mutates.
@Component({
  selector: 'mc-writing-card-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagChipComponent, McDatePipe],
  template: `
    <article
      class="card"
      role="article"
      tabindex="0"
      [attr.aria-label]="displayTitle()"
      (click)="open.emit(id())"
      (keydown.enter)="open.emit(id())"
      (keydown.space)="onSpace($event)"
    >
      <h2 class="title">{{ displayTitle() }}</h2>
      @if (preview()) {
        <p class="preview">{{ preview() }}</p>
      }
      <footer class="foot">
        <span class="meta">
          <span class="words">{{ wordsLabel() }}</span>
          <span class="dot" aria-hidden="true">·</span>
          <span class="ago">{{ updatedAt() | mcDate: true }}</span>
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
      min-height: 160px;
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
export class WritingCardPreviewComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly untitledLabel = input.required<string>();
  readonly preview = input<string>('');
  readonly wordsLabel = input.required<string>();
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
