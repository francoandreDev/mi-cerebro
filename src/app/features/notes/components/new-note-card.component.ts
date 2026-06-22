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
  selector: 'mc-new-note-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <form class="card" (submit)="onSubmit($event)">
      <label class="row">
        <mc-icon name="plus" class="icon mc-anim-pulse" aria-hidden="true" />
        <input
          #input
          type="text"
          class="input"
          [attr.aria-label]="t('notes.wall.newAria')"
          [placeholder]="t('notes.wall.newPlaceholder')"
          [disabled]="busy()"
          autocomplete="off"
        />
      </label>
      <button
        type="submit"
        class="submit"
        [attr.aria-label]="t('notes.wall.newSubmit')"
        [disabled]="busy()"
      >
        <mc-icon name="arrow-right" />
      </button>
    </form>
  `,
  styles: `
    :host {
      display: block;
      break-inside: avoid;
      margin-bottom: var(--mc-space-3);
    }
    .card {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      padding: var(--mc-space-3);
      background: var(--mc-bg-elevated);
      border: 1px dashed var(--mc-accent-primary);
      border-radius: var(--mc-radius-md);
    }
    .row {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      min-width: 0;
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
export class NewNoteCardComponent {
  readonly busy = input<boolean>(false);
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
