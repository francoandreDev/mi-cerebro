import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-note-compose',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <form class="carriage" (submit)="onSubmit($event)">
      <span class="margin-bar" aria-hidden="true"></span>
      <input
        #input
        type="text"
        class="keys"
        [attr.aria-label]="t('notes.wall.newAria')"
        [placeholder]="t('notes.wall.newPlaceholder')"
        [disabled]="busy()"
        autocomplete="off"
      />
      <button
        type="submit"
        class="return"
        [attr.aria-label]="t('notes.wall.newSubmit')"
        [disabled]="busy()"
      >
        <mc-icon name="arrow-right" />
      </button>
    </form>
    <div class="platen" aria-hidden="true">
      <div class="teeth"></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--mc-bg-primary);
      padding-bottom: 2px;
    }
    .carriage {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      padding: var(--mc-space-3) var(--mc-space-3) var(--mc-space-3) var(--mc-space-4);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md) var(--mc-radius-md) 0 0;
      box-shadow: 0 1px 0 var(--mc-border-default);
      position: relative;
    }
    .margin-bar {
      position: absolute;
      left: var(--mc-space-2);
      top: 8px;
      bottom: 8px;
      width: 3px;
      border-radius: 2px;
      background: var(--mc-accent-primary);
      opacity: 0.5;
    }
    .keys {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-lg);
      font-family: var(--mc-font-mono, ui-monospace, 'Courier New', monospace);
      letter-spacing: 0.01em;
      padding: var(--mc-space-1) 0;
    }
    .keys:focus {
      outline: none;
    }
    .keys::placeholder {
      color: var(--mc-fg-muted);
      font-style: italic;
    }
    .return {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--mc-accent-primary);
      color: var(--mc-fg-on-accent, #fff);
      border: 0;
      border-radius: var(--mc-radius-sm);
      width: 36px;
      height: 36px;
      cursor: pointer;
      transition: transform 80ms ease;
    }
    .return:active:not(:disabled) {
      transform: translateY(1px);
    }
    .return:disabled {
      opacity: 0.5;
      cursor: progress;
    }
    .platen {
      height: 10px;
      background: linear-gradient(
        180deg,
        var(--mc-bg-elevated) 0%,
        color-mix(in srgb, var(--mc-bg-elevated) 70%, var(--mc-border-default)) 100%
      );
      border-inline: 1px solid var(--mc-border-default);
      position: relative;
    }
    .teeth {
      position: absolute;
      inset: auto 0 -2px 0;
      height: 6px;
      background-image: radial-gradient(
        circle at 4px 1px,
        var(--mc-bg-primary) 1.6px,
        transparent 1.8px
      );
      background-size: 8px 6px;
      background-repeat: repeat-x;
    }
  `,
})
export class NoteComposeComponent {
  readonly busy = input<boolean>(false);
  readonly create = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');

  focus(): void {
    this.inputRef().nativeElement.focus();
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const el = this.inputRef().nativeElement;
    const value = el.value.trim();
    this.create.emit(value);
    el.value = '';
    el.focus();
  }
}
