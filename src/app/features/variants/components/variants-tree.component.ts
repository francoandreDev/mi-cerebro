// Left pane of /variants: hierarchical tree, search box and "+ Nueva"
// CTA. Dumb component — receives the tree projection and emits which
// variant the user picked. Filter state lives here because no one else
// needs it (container only consumes the filtered list via the projection).

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Variant } from '@core/versioning/variants.types';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { IconComponent } from '@shared/icon/icon.component';

import type { VariantTreeNode } from '../utils/variant-tree';

@Component({
  selector: 'mc-variants-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BgColorDirective, IconComponent],
  template: `
    <header class="tree-head">
      <div class="search-wrap">
        <mc-icon name="magnifying-glass" class="search-icon" />
        <input
          type="search"
          class="search"
          [ngModel]="query()"
          (ngModelChange)="queryChange.emit($event)"
          [placeholder]="t('variants.filters.search.placeholder')"
          [attr.aria-label]="t('variants.filters.search')"
        />
      </div>
      <button
        type="button"
        class="primary new mc-hover-grow"
        (click)="createNew.emit()"
        [disabled]="busy()"
      >
        <mc-icon name="plus" />
        <span>{{ t('variants.action.new') }}</span>
      </button>
    </header>

    @if (matchedTree().length === 0) {
      <p class="empty">
        <mc-icon name="magnifying-glass" class="mc-anim-pulse" />
        <span>{{ t('variants.filters.empty') }}</span>
      </p>
    } @else {
      <ul class="rows" role="tree" [attr.aria-label]="t('variants.page.title')">
        @for (node of matchedTree(); track node.variant.id) {
          <li
            role="treeitem"
            [attr.aria-level]="node.depth + 1"
            [attr.aria-selected]="node.variant.id === selectedId()"
            class="row"
            [class.is-active]="node.variant.id === activeId()"
            [class.is-selected]="node.variant.id === selectedId()"
            [class.is-dormant]="dormantIds().has(node.variant.id)"
          >
            <button
              type="button"
              class="row-btn"
              [attr.aria-label]="t('variants.tree.row.aria', { name: node.variant.name })"
              (click)="pick.emit(node.variant.id)"
            >
              <span class="connector" aria-hidden="true">{{ node.connector }}</span>
              <span class="swatch" [mcBgColor]="node.variant.color"></span>
              <span class="name">{{ node.variant.name }}</span>
              <span class="trail">
                @if (node.variant.id === activeId()) {
                  <span class="badge">{{ t('variants.badge.active') }}</span>
                }
                @if (dormantIds().has(node.variant.id)) {
                  <span class="badge muted">{{ t('variants.badge.dormant') }}</span>
                }
              </span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './variants-tree.component.css',
})
export class VariantsTreeComponent {
  private readonly i18n = inject(I18nService);

  readonly tree = input.required<readonly VariantTreeNode[]>();
  readonly activeId = input<string | null>(null);
  readonly selectedId = input<string | null>(null);
  readonly dormantIds = input.required<ReadonlySet<string>>();
  readonly query = input.required<string>();
  readonly busy = input<boolean>(false);

  readonly pick = output<string>();
  readonly queryChange = output<string>();
  readonly createNew = output<void>();

  protected readonly matchedTree = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.tree();
    return this.tree().filter((n) => {
      const v = n.variant;
      return v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q);
    });
  });

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected variantKey(v: Variant): string {
    return v.id;
  }
}
