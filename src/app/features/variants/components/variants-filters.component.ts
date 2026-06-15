// Dumb filter bar for /variants. Owns no state; the container holds
// the source signals and pushes values down through inputs.

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Variant } from '@core/versioning/variants.types';

export type StateFilter = 'all' | 'active' | 'principal' | 'dormant';

@Component({
  selector: 'mc-variants-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="filters">
      <label class="field">
        <span>{{ t('variants.filters.search') }}</span>
        <input
          type="search"
          [ngModel]="query()"
          (ngModelChange)="queryChange.emit($event)"
          [placeholder]="t('variants.filters.search.placeholder')"
          [attr.aria-label]="t('variants.filters.search')"
        />
      </label>
      <label class="field">
        <span>{{ t('variants.filters.state') }}</span>
        <select
          [ngModel]="state()"
          (ngModelChange)="stateChange.emit($event)"
          [attr.aria-label]="t('variants.filters.state')"
        >
          <option value="all">{{ t('variants.filters.state.all') }}</option>
          <option value="active">{{ t('variants.filters.state.active') }}</option>
          <option value="principal">{{ t('variants.filters.state.principal') }}</option>
          <option value="dormant">{{ t('variants.filters.state.dormant') }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('variants.filters.parent') }}</span>
        <select
          [ngModel]="parent()"
          (ngModelChange)="parentChange.emit($event)"
          [attr.aria-label]="t('variants.filters.parent')"
        >
          <option value="all">{{ t('variants.filters.parent.all') }}</option>
          @for (p of parents(); track p.id) {
            <option [value]="p.id">{{ p.name }}</option>
          }
        </select>
      </label>
      <button type="button" class="ghost" (click)="clear.emit()" [disabled]="!hasActive()">
        {{ t('variants.filters.clear') }}
      </button>
      @if (matched() !== total()) {
        <p class="filters-summary">
          {{ t('variants.filters.summary', { n: matched(), total: total() }) }}
        </p>
      }
    </div>
  `,
  styleUrl: '../containers/variants.container.css',
})
export class VariantsFiltersComponent {
  private readonly i18n = inject(I18nService);

  readonly query = input.required<string>();
  readonly state = input.required<StateFilter>();
  readonly parent = input.required<string>();
  readonly parents = input.required<readonly Variant[]>();
  readonly hasActive = input.required<boolean>();
  readonly matched = input.required<number>();
  readonly total = input.required<number>();

  readonly queryChange = output<string>();
  readonly stateChange = output<StateFilter>();
  readonly parentChange = output<string>();
  readonly clear = output<void>();

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
