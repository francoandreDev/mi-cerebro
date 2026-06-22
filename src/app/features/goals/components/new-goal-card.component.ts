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
  selector: 'mc-new-goal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <form class="card" [class.hero]="hero()" (submit)="onSubmit($event)">
      @if (hero()) {
        <h2 class="headline">{{ t('goals.wall.emptyHeadline') }}</h2>
        <p class="hint">{{ t('goals.wall.emptyHint') }}</p>
      }
      <label class="row">
        <mc-icon name="plus" class="icon mc-anim-pulse" aria-hidden="true" />
        <input
          #input
          type="text"
          class="input"
          [attr.aria-label]="t('goals.wall.newAria')"
          [placeholder]="t('goals.wall.newPlaceholder')"
          [disabled]="busy()"
          autocomplete="off"
        />
        <button
          type="submit"
          class="submit"
          [attr.aria-label]="t('goals.wall.newSubmit')"
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
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
      padding: var(--mc-space-4);
      min-height: 220px;
      background: var(--mc-bg-elevated);
      border: 1px dashed var(--mc-accent-primary);
      border-radius: var(--mc-radius-lg, 12px);
      justify-content: center;
    }
    .card.hero {
      min-height: 280px;
      align-items: center;
      text-align: center;
      padding: var(--mc-space-5);
    }
    .headline {
      margin: 0;
      font-size: clamp(1.8rem, 3vw, 2.6rem);
      font-weight: 700;
      color: var(--mc-fg-primary);
    }
    .hint {
      margin: 0;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      min-width: 0;
      width: 100%;
    }
    .card.hero .row {
      max-width: 520px;
      margin-top: var(--mc-space-2);
    }
    .icon {
      color: var(--mc-accent-primary);
    }
    .input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-base);
      padding: var(--mc-space-1) 0;
    }
    .input:focus {
      outline: none;
    }
    .submit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--mc-accent-primary);
      color: var(--mc-fg-on-accent, #fff);
      border: 0;
      border-radius: var(--mc-radius-sm);
      width: 32px;
      height: 32px;
      cursor: pointer;
    }
    .submit:disabled {
      opacity: 0.5;
      cursor: progress;
    }
  `,
})
export class NewGoalCardComponent {
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
