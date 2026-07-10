import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

// why: fallback card for kinds whose own visual component is too coupled to
//      page-specific state to reuse (tasks: plant-card needs a garden
//      bucket/growth-stage; images: a real cover thumbnail needs async blob
//      URL loading, see PROYECTO.md §4.1.3b incident). Used by the cross-tag
//      view (features/tags/containers/tag-detail.container) for those two
//      kinds only — every other kind reuses its own native card.
@Component({
  selector: 'mc-tagged-generic-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
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
      <mc-icon [name]="icon()" class="card-icon" />
      <div class="text">
        <h3 class="title">{{ displayTitle() }}</h3>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
        @if (resolvedTags().length) {
          <div class="tags">
            @for (tag of resolvedTags(); track tag.id) {
              <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
            }
          </div>
        }
      </div>
    </article>
  `,
  styleUrl: './tagged-generic-card.component.css',
})
export class TaggedGenericCardComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly untitledLabel = input.required<string>();
  readonly subtitle = input<string>('');
  readonly icon = input.required<IconName>();
  readonly tagIds = input.required<readonly string[]>();
  readonly availableTags = input.required<readonly Tag[]>();

  readonly open = output<string>();

  protected readonly displayTitle = computed(() => this.title() || this.untitledLabel());
  protected readonly resolvedTags = computed<readonly Tag[]>(() => {
    const available = this.availableTags();
    return this.tagIds()
      .map((id) => available.find((t) => t.id === id))
      .filter((t): t is Tag => t !== undefined);
  });

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.open.emit(this.id());
  }
}
