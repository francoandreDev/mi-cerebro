import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

export type ChalkAxis = 'alpha' | 'tag';

export interface RailGroup {
  readonly key: string;
  readonly label: string;
  readonly color?: string | undefined;
  readonly empty?: boolean | undefined;
}

@Component({
  selector: 'mc-chalk-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="rail" [attr.aria-label]="t('lists.board.railAria')">
      <div
        class="axis"
        data-tutorial="lists-shelf-axis"
        role="group"
        [attr.aria-label]="t('lists.board.axisToggleAria')"
      >
        <button
          type="button"
          class="axis-btn"
          [class.on]="axis() === 'alpha'"
          (click)="onAxis('alpha')"
        >
          {{ t('lists.board.axisAlpha') }}
        </button>
        <button
          type="button"
          class="axis-btn"
          [class.on]="axis() === 'tag'"
          (click)="onAxis('tag')"
        >
          {{ t('lists.board.axisTag') }}
        </button>
      </div>
      <ul class="jumpers">
        @for (g of groups(); track g.key) {
          <li>
            <button
              type="button"
              class="jumper"
              [class.active]="g.key === activeKey()"
              [class.empty]="g.empty"
              [attr.aria-label]="jumpAria(g.label)"
              [attr.aria-current]="g.key === activeKey() ? 'true' : null"
              (click)="jump.emit(g.key)"
            >
              @if (g.color) {
                <span class="dot" [style.background]="g.color" aria-hidden="true"></span>
              }
              <span class="label">{{ g.label }}</span>
            </button>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      position: sticky;
      top: 0;
      align-self: flex-start;
      max-height: 100vh;
      overflow-y: auto;
      padding: var(--mc-space-2) var(--mc-space-1);
      border-right: 1px solid rgba(255, 255, 255, 0.06);
    }
    .rail {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-3);
      min-width: 64px;
    }
    .axis {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-bottom: var(--mc-space-2);
      border-bottom: 1px dashed var(--mc-chalk-muted, #8a8e7a);
    }
    .axis-btn {
      background: transparent;
      border: 0;
      color: var(--mc-chalk-muted, #8a8e7a);
      font-family: 'Caveat', 'Kalam', cursive;
      font-size: 1.05rem;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: var(--mc-radius-sm);
    }
    .axis-btn.on {
      color: var(--mc-chalk-title, #f1f5d8);
      background: rgba(255, 255, 255, 0.06);
    }
    .axis-btn:focus-visible {
      outline: 2px dashed var(--mc-chalk-title, #f1f5d8);
      outline-offset: 1px;
    }
    .jumpers {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .jumper {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      background: transparent;
      border: 0;
      cursor: pointer;
      padding: 3px 6px;
      border-radius: var(--mc-radius-sm);
      color: var(--mc-chalk-title, #f1f5d8);
      font-family: 'Caveat', 'Kalam', cursive;
      font-size: 1.1rem;
      line-height: 1;
      text-align: left;
    }
    .jumper.empty {
      color: var(--mc-chalk-muted, #8a8e7a);
      opacity: 0.45;
      cursor: default;
    }
    .jumper:hover:not(.empty) {
      background: rgba(255, 255, 255, 0.06);
    }
    .jumper.active {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .jumper:focus-visible {
      outline: 2px dashed var(--mc-chalk-title, #f1f5d8);
      outline-offset: 1px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
    }
    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
  `,
})
export class ChalkRailComponent {
  readonly axis = input.required<ChalkAxis>();
  readonly groups = input.required<readonly RailGroup[]>();
  readonly activeKey = input<string | null>(null);
  readonly axisChange = output<ChalkAxis>();
  readonly jump = output<string>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected jumpAria(label: string): string {
    return this.t('lists.board.jumpTo').replace('{label}', label);
  }

  protected onAxis(next: ChalkAxis): void {
    if (next !== this.axis()) this.axisChange.emit(next);
  }
}
