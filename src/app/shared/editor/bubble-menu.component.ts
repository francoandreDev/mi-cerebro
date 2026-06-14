// 13f — Floating bubble menu that appears anchored above the editor's
// current text selection in the combined view. Offers exactly two
// actions: "Proponer cambio" (start a draft session) and "Comentar"
// (open the comment popover). Positioning is computed by the host
// editor and passed in via `position`; this component is purely
// presentational.

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

export interface BubblePosition {
  readonly top: number;
  readonly left: number;
}

@Component({
  selector: 'mc-bubble-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="bubble"
      role="toolbar"
      [attr.aria-label]="t('editor.view.combined')"
      [style.top.px]="position().top"
      [style.left.px]="position().left"
    >
      <button type="button" class="action" (click)="propose.emit()">
        <mc-icon name="note-pencil" /> {{ t('editor.bubble.propose') }}
      </button>
      <button type="button" class="action" (click)="comment.emit()">
        <mc-icon name="chat-circle" /> {{ t('editor.bubble.comment') }}
      </button>
    </div>
  `,
  styleUrl: './bubble-menu.component.scss',
})
export class BubbleMenuComponent {
  readonly position = input.required<BubblePosition>();
  readonly propose = output<void>();
  readonly comment = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
