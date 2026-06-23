import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-chalk-new-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <form class="entry" [class.hero]="hero()" (submit)="onSubmit($event)">
      @if (hero()) {
        <h2 class="headline">{{ t('lists.board.emptyHeadline') }}</h2>
        <p class="hint">{{ t('lists.board.emptyHint') }}</p>
      }
      <label class="row">
        <mc-icon name="plus" class="plus" aria-hidden="true" />
        <input
          #input
          type="text"
          class="input"
          [attr.aria-label]="t('lists.board.newAria')"
          [placeholder]="t('lists.board.newPlaceholder')"
          [disabled]="busy()"
          autocomplete="off"
        />
        <button
          type="submit"
          class="submit"
          [attr.aria-label]="t('lists.board.newSubmit')"
          [disabled]="busy()"
        >
          <mc-icon name="arrow-right" />
        </button>
      </label>
    </form>
  `,
  styles: `
    :host {
      display: block;
      break-inside: avoid;
      margin-bottom: var(--mc-space-5);
    }
    .entry {
      padding: var(--mc-space-2);
      border-top: 1px dashed var(--mc-chalk-muted, #8a8e7a);
      border-bottom: 1px dashed var(--mc-chalk-muted, #8a8e7a);
    }
    .entry.hero {
      border: 1px dashed var(--mc-chalk-muted, #8a8e7a);
      border-radius: var(--mc-radius-sm);
      padding: var(--mc-space-5);
      text-align: center;
      max-width: 560px;
      margin-inline: auto;
    }
    .headline {
      margin: 0 0 var(--mc-space-2);
      font-family: 'Caveat', 'Kalam', 'Comic Sans MS', cursive;
      font-weight: 600;
      font-size: clamp(2rem, 3vw, 2.6rem);
      color: var(--mc-chalk-title, #f1f5d8);
    }
    .hint {
      margin: 0 0 var(--mc-space-3);
      color: var(--mc-chalk-muted, #8a8e7a);
      font-size: var(--mc-font-size-sm);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
    }
    .plus {
      color: var(--mc-chalk-muted, #8a8e7a);
    }
    .input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: 0;
      color: var(--mc-chalk-title, #f1f5d8);
      font-family: 'Caveat', 'Kalam', 'Comic Sans MS', cursive;
      font-size: 1.3rem;
      padding: 2px 0;
    }
    .input::placeholder {
      color: var(--mc-chalk-muted, #8a8e7a);
      font-style: italic;
    }
    .input:focus {
      outline: none;
    }
    .submit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--mc-chalk-title, #f1f5d8);
      border: 1px solid var(--mc-chalk-muted, #8a8e7a);
      border-radius: var(--mc-radius-sm);
      width: 28px;
      height: 28px;
      cursor: pointer;
    }
    .submit:hover {
      border-color: var(--mc-chalk-title, #f1f5d8);
    }
    .submit:disabled {
      opacity: 0.5;
      cursor: progress;
    }
  `,
})
export class ChalkNewEntryComponent {
  readonly busy = input<boolean>(false);
  readonly hero = input<boolean>(false);
  readonly create = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const el = this.inputRef().nativeElement;
    const value = el.value.trim();
    this.create.emit(value);
    el.value = '';
  }
}
