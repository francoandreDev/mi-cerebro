import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { colorForId, type Tag } from '@core/tags/tag.types';

// why: read-only twin of features/files/components/file-locker.component.ts
//      for the cross-tag view (features/tags/tag-detail) — same locker
//      visual, primitive inputs instead of FileCollectionSummary so
//      shared/ stays free of @features imports (PROYECTO.md §4.2.10). No
//      `isOpen`/inline expand — this view always navigates away on click.
@Component({
  selector: 'mc-file-locker-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="locker"
      [style.--mc-locker-color]="color()"
      [attr.aria-label]="displayTitle()"
      (click)="open.emit(id())"
    >
      <span class="door" aria-hidden="true">
        <span class="vents">
          <span class="vent"></span><span class="vent"></span><span class="vent"></span>
        </span>
        <span class="plate">{{ paddedNumber() }}</span>
        <span class="handle"></span>
        <span class="hinge top"></span>
        <span class="hinge bottom"></span>
        <span class="placard">{{ displayTitle() }}</span>
      </span>
    </button>
  `,
  styleUrl: './file-locker-card.component.css',
})
export class FileLockerCardComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly untitledLabel = input.required<string>();
  readonly number = input.required<number>();
  readonly tagIds = input.required<readonly string[]>();
  readonly availableTags = input.required<readonly Tag[]>();

  readonly open = output<string>();

  protected readonly displayTitle = computed(() => this.title() || this.untitledLabel());
  protected readonly paddedNumber = computed(() => String(this.number()).padStart(2, '0'));
  protected readonly color = computed(() => {
    const tagIds = this.tagIds();
    if (tagIds.length > 0) {
      const byId = new Map(this.availableTags().map((t) => [t.id, t] as const));
      for (const id of tagIds) {
        const tag = byId.get(id);
        if (tag) return tag.color;
      }
    }
    return colorForId(this.id());
  });
}
