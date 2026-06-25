import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';

import type { TaskSummary } from '../models/task.types';
import { PLANT_GLYPHS, type HarvestedShape } from './plant-glyphs';

@Component({
  selector: 'mc-harvested-plant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="plant"
      [class.plant--tree]="shape() === 'tree'"
      [attr.aria-label]="ariaLabel()"
      (click)="open.emit(summary().id)"
    >
      <span class="glyph" [style.color]="color()" [innerHTML]="glyph()"></span>
      <span class="label">{{ summary().title || untitledLabel() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    .plant {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: var(--mc-space-2);
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--mc-fg-primary);
      font: inherit;
    }
    .plant:focus-visible {
      outline: 2px solid var(--mc-focus-ring);
      outline-offset: 2px;
      border-radius: var(--mc-radius-sm);
    }
    .glyph {
      display: block;
      width: 44px;
      height: 44px;
    }
    .plant--tree .glyph {
      width: 64px;
      height: 64px;
    }
    .label {
      font-size: var(--mc-font-size-xs);
      text-align: center;
      max-width: 12ch;
      overflow-wrap: anywhere;
      color: var(--mc-fg-muted);
    }
  `,
})
export class HarvestedPlantComponent {
  readonly summary = input.required<TaskSummary>();
  readonly shape = input.required<HarvestedShape>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly longevityDays = input<number>(0);

  readonly open = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly glyph = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(PLANT_GLYPHS[this.shape()]),
  );

  protected readonly color = computed(() => {
    const id = this.summary().tags[0];
    if (id === undefined) return 'var(--mc-garden-petal-default)';
    const tag = this.availableTags().find((t) => t.id === id);
    if (!tag) return 'var(--mc-garden-petal-default)';
    return `color-mix(in srgb, ${tag.color} 80%, white)`;
  });

  protected readonly ariaLabel = computed(() =>
    this.t('tasks.patio.openAria').replace('{title}', this.summary().title || this.untitledLabel()),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
