import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Tag } from '@core/tags/tag.types';
import { BgColorDirective } from '@shared/directives/bg-color.directive';

@Component({
  selector: 'mc-tag-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BgColorDirective],
  template: `
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
  readonly remove = output<void>();

  protected readonly label = computed(() => this.tag()?.label ?? this.fallbackLabel());
  protected readonly color = computed(() => this.tag()?.color ?? 'var(--mc-fg-muted)');
}
