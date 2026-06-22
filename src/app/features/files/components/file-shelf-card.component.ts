import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { FileCollectionSummary } from '../models/file-collection.types';

// why: deterministic hash so the pin colour stays stable per collection without
//      persisting anything to disk.
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const PIN_HUES = [4, 38, 130, 205, 280, 340] as const;

@Component({
  selector: 'mc-file-shelf-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagChipComponent],
  template: `
    <button
      type="button"
      class="folder"
      [style.--mc-pin-hue]="pinHue() + 'deg'"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(summary().id)"
    >
      <span class="pin" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="9" r="6" class="pin-head" />
          <ellipse cx="14" cy="7" rx="1.7" ry="1" class="pin-shine" />
          <path d="M12 14 L12 22" class="pin-needle" />
        </svg>
      </span>
      <span class="tab">
        <span class="tab-title">{{ displayTitle() }}</span>
      </span>
      <span class="body">
        <span class="count">{{ summary().itemCount }}</span>
        <span class="count-label">{{ countLabel() }}</span>
        @if (resolvedTags().length) {
          <span class="tags">
            @for (tag of resolvedTags(); track tag.id) {
              <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
            }
          </span>
        }
      </span>
      <span class="dog-ear" aria-hidden="true"></span>
    </button>
  `,
  styleUrl: './file-shelf-card.component.css',
})
export class FileShelfCardComponent {
  readonly summary = input.required<FileCollectionSummary>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly open = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly displayTitle = computed(() => this.summary().title || this.untitledLabel());
  protected readonly resolvedTags = computed(() => {
    const byId = new Map(this.availableTags().map((t) => [t.id, t] as const));
    return this.summary()
      .tags.map((id) => byId.get(id))
      .filter((t): t is Tag => t !== undefined);
  });
  protected readonly countLabel = computed(() =>
    this.summary().itemCount === 1 ? this.t('files.shelf.itemOne') : this.t('files.shelf.itemMany'),
  );
  protected readonly ariaOpen = computed(() =>
    this.t('files.shelf.openAria').replace('{title}', this.displayTitle()),
  );
  protected readonly pinHue = computed(() => {
    const idx = hash(this.summary().id) % PIN_HUES.length;
    return PIN_HUES[idx] ?? PIN_HUES[0];
  });
}
