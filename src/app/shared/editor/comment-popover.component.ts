// 13f — Popover that hosts the create/edit UI for a single comment.
// Replaces the bottom-of-panel form: it floats anchored to a position
// supplied by the host (next to the cloud icon or to the user's
// selection). All persistence is delegated to the host via outputs;
// this component is pure UI.

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

export interface PopoverPosition {
  readonly top: number;
  readonly left: number;
}

@Component({
  selector: 'mc-comment-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="popover"
      role="dialog"
      [attr.aria-label]="t('comments.popover.title')"
      [style.top.px]="position().top"
      [style.left.px]="position().left"
    >
      <header class="head">
        <h4>{{ t('comments.popover.title') }}</h4>
        <button
          type="button"
          class="icon"
          (click)="dismiss.emit()"
          [attr.aria-label]="t('common.close')"
        >
          <mc-icon name="x" />
        </button>
      </header>
      <textarea
        rows="3"
        [value]="body()"
        [placeholder]="t('comments.popover.placeholder')"
        (input)="onInput($event)"
      ></textarea>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <footer class="actions">
        @if (editing()) {
          <button type="button" class="ghost danger" (click)="remove.emit()" [disabled]="busy()">
            {{ t('comments.actions.delete') }}
          </button>
        }
        <span class="spacer"></span>
        <button type="button" class="ghost" (click)="dismiss.emit()" [disabled]="busy()">
          {{ t('comments.form.cancel') }}
        </button>
        <button type="button" class="primary" (click)="save.emit()" [disabled]="busy()">
          {{ t('comments.form.save') }}
        </button>
      </footer>
    </div>
  `,
  styleUrl: './comment-popover.component.scss',
})
export class CommentPopoverComponent {
  readonly position = input.required<PopoverPosition>();
  readonly body = input<string>('');
  readonly error = input<string>('');
  readonly busy = input<boolean>(false);
  readonly editing = input<boolean>(false);
  readonly bodyChange = output<string>();
  readonly save = output<void>();
  readonly dismiss = output<void>();
  readonly remove = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.bodyChange.emit(target.value);
  }
}
