import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { Tag } from '@core/tags/tag.types';
import { tagHexFor } from '@core/theme/theme-palette';
import { ThemeService } from '@core/theme/theme.service';
import { BgColorDirective } from '@shared/directives/bg-color.directive';

@Component({
  selector: 'mc-tag-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BgColorDirective],
  template: `
    @if (dotClickable()) {
      <span class="chip" [class.small]="size() === 'small'" [class.compact]="compact()">
        <button
          type="button"
          class="dot dot-btn"
          [mcBgColor]="color()"
          [attr.aria-label]="'change color for ' + label()"
          (click)="dotClick.emit()"
        ></button>
        <span class="label">{{ label() }}</span>
        @if (removable()) {
          <button
            type="button"
            class="remove"
            [attr.aria-label]="'remove ' + label()"
            (click)="remove.emit()"
          >
            ×
          </button>
        }
      </span>
    } @else {
      <span class="chip" [class.small]="size() === 'small'" [class.compact]="compact()">
        <span class="dot" [mcBgColor]="color()"></span>
        <span class="label">{{ label() }}</span>
        @if (removable()) {
          <button
            type="button"
            class="remove"
            [attr.aria-label]="'remove ' + label()"
            (click)="remove.emit()"
          >
            ×
          </button>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--mc-space-1);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-pill, 999px);
      padding: 2px 8px;
      font-size: var(--mc-font-size-sm);
      color: var(--mc-fg-primary);
      max-width: 100%;
    }
    .chip.small {
      font-size: var(--mc-font-size-xs);
      padding: 1px 6px;
    }
    .chip.compact .label {
      max-width: 9ch;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-btn {
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    .dot-btn:focus-visible {
      outline: 2px solid var(--mc-focus-ring, currentColor);
      outline-offset: 1px;
    }
    .label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .remove {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 0 2px;
      font-size: 1em;
      line-height: 1;
    }
    .remove:hover {
      color: var(--mc-state-danger);
    }
  `,
})
export class TagChipComponent {
  readonly tag = input<Tag | null>(null);
  readonly fallbackLabel = input<string>('?');
  readonly size = input<'normal' | 'small'>('normal');
  readonly compact = input<boolean>(false);
  readonly removable = input<boolean>(false);
  readonly dotClickable = input<boolean>(false);
  readonly remove = output<void>();
  readonly dotClick = output<void>();

  private readonly theme = inject(ThemeService);

  protected readonly label = computed(() => this.tag()?.label ?? this.fallbackLabel());
  protected readonly color = computed(() => {
    const t = this.tag();
    if (!t) return 'var(--mc-fg-muted)';
    const swatchHex = tagHexFor(this.theme.resolved(), t.colorSwatchId);
    return swatchHex ?? t.color;
  });
}
