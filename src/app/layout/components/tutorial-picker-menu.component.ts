import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

export interface TutorialFlowOption {
  readonly id: string;
  readonly labelKey?: TranslationKey;
}

// why: dumb popover for PageHelpControlComponent — only rendered when a
//      page has more than one registered TutorialDefinition (see
//      TutorialService.tutorialsForPage). Single-flow pages never mount
//      this, so their ✨ button keeps starting its tutorial directly.
@Component({
  selector: 'mc-tutorial-picker-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="backdrop"
      [attr.aria-label]="t('common.close')"
      (click)="dismiss.emit()"
    ></button>
    <ul class="menu" role="menu">
      @for (flow of flows(); track flow.id) {
        <li role="none">
          <button type="button" role="menuitem" (click)="pick.emit(flow.id)">
            <mc-icon name="sparkle" aria-hidden="true" />
            <span>{{ flow.labelKey ? t(flow.labelKey) : flow.id }}</span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 61;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      border: none;
      padding: 0;
      background: transparent;
      cursor: pointer;
    }
    .menu {
      position: absolute;
      right: var(--mc-space-4, 16px);
      bottom: calc(var(--mc-mini-player-h, 0px) + var(--mc-space-4, 16px) + 2.75rem);
      margin: 0;
      padding: var(--mc-space-2, 8px);
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1, 4px);
      min-width: 220px;
      border-radius: var(--mc-radius-md);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default, var(--mc-border));
      box-shadow: var(--mc-shadow-md, 0 4px 16px rgba(0, 0, 0, 0.3));
    }
    .menu button {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2, 8px);
      width: 100%;
      padding: var(--mc-space-2, 8px) var(--mc-space-3, 12px);
      border: 0;
      border-radius: var(--mc-radius-sm);
      background: transparent;
      color: var(--mc-fg-default);
      text-align: left;
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
    }
    .menu button:hover {
      background: var(--mc-bg-hover);
    }
  `,
})
export class TutorialPickerMenuComponent {
  readonly flows = input.required<readonly TutorialFlowOption[]>();
  readonly pick = output<string>();
  readonly dismiss = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
