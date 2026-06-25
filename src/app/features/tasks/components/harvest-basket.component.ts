import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { TaskSummary } from '../models/task.types';

@Component({
  selector: 'mc-harvest-basket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="basket" [attr.aria-label]="ariaLabel()">
      <span class="checks" aria-hidden="true">
        @for (item of recent(); track item.id) {
          <span class="check">✓</span>
        }
      </span>
      <span class="label">{{ label() }}</span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .basket {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      padding: var(--mc-space-2) var(--mc-space-3);
      background: var(--mc-garden-planter-wood-fg);
      color: var(--mc-garden-planter-wood-bg);
      border-radius: var(--mc-radius-sm);
      font-family: var(--mc-font-mono);
      font-size: var(--mc-font-size-xs);
    }
    .checks {
      display: inline-flex;
      gap: 2px;
    }
    .check {
      font-weight: 700;
    }
  `,
})
export class HarvestBasketComponent {
  readonly harvested = input.required<readonly TaskSummary[]>();

  private readonly i18n = inject(I18nService);

  protected readonly recent = computed(() => this.harvested().slice(0, 3));

  protected readonly label = computed(() => {
    const n = this.harvested().length;
    const base = this.t('tasks.garden.harvestBasket');
    if (n === 0) return base;
    return `${base} · ${this.t('tasks.garden.harvestCount').replace('{n}', String(n))}`;
  });

  protected readonly ariaLabel = computed(() => this.label());

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
