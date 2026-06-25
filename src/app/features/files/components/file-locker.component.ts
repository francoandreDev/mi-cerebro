import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { colorForId, type Tag } from '@core/tags/tag.types';

import type { FileCollectionSummary } from '../models/file-collection.types';

@Component({
  selector: 'mc-file-locker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="locker"
      [class.open]="isOpen()"
      [style.--mc-locker-color]="color()"
      [attr.aria-label]="openAria()"
      [attr.aria-expanded]="isOpen()"
      (click)="open.emit(summary().id)"
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
      <span class="meta">
        <span class="count">{{ summary().itemCount }}</span>
        <span class="count-label">{{ countLabel() }}</span>
      </span>
    </button>
  `,
  styleUrl: './file-locker.component.css',
})
export class FileLockerComponent {
  readonly summary = input.required<FileCollectionSummary>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly number = input.required<number>();
  readonly isOpen = input<boolean>(false);
  readonly open = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly displayTitle = computed(() => this.summary().title || this.untitledLabel());
  protected readonly paddedNumber = computed(() => String(this.number()).padStart(2, '0'));
  protected readonly countLabel = computed(() =>
    this.summary().itemCount === 1 ? this.t('files.wall.itemOne') : this.t('files.wall.itemMany'),
  );
  protected readonly openAria = computed(() =>
    this.t('files.wall.openAria')
      .replace('{n}', this.paddedNumber())
      .replace('{title}', this.displayTitle()),
  );
  protected readonly color = computed(() => {
    const tagIds = this.summary().tags;
    if (tagIds.length > 0) {
      const byId = new Map(this.availableTags().map((t) => [t.id, t] as const));
      for (const id of tagIds) {
        const tag = byId.get(id);
        if (tag) return tag.color;
      }
    }
    return colorForId(this.summary().id);
  });
}
