import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { FilterDirection } from './tree.types';

const DIRECTIONS: readonly FilterDirection[] = ['general', 'up', 'down'];

@Component({
  selector: 'mc-tree-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <input
        #input
        type="text"
        class="input"
        [value]="query()"
        [placeholder]="t('tree.filter.placeholder')"
        [attr.aria-label]="t('tree.filter.placeholder')"
        (input)="onInput($event)"
        (keydown)="onKey($event)"
      />
      <div class="dir" role="radiogroup" [attr.aria-label]="t('tree.direction.label')">
        @for (d of directions; track d) {
          <button
            type="button"
            class="dir-btn"
            role="radio"
            [attr.aria-checked]="direction() === d"
            [class.active]="direction() === d"
            [title]="t(dirLabelKey(d))"
            (click)="directionChange.emit(d)"
          >
            {{ dirIcon(d) }}
          </button>
        }
      </div>
    </div>
    @if (matchCount() > 0) {
      <p class="count" aria-live="polite">
        {{ t('tree.matches.count').replace('{n}', matchCount().toString()) }}
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: var(--mc-space-2) var(--mc-space-3);
      border-bottom: 1px solid var(--mc-border-default);
    }
    .row {
      display: flex;
      gap: var(--mc-space-2);
      align-items: center;
    }
    .input {
      flex: 1;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      padding: var(--mc-space-1) var(--mc-space-2);
      color: var(--mc-fg-primary);
    }
    .input:focus {
      outline: 2px solid var(--mc-accent-primary);
    }
    .dir {
      display: flex;
      gap: 2px;
    }
    .dir-btn {
      background: transparent;
      border: 1px solid var(--mc-border-default);
      color: var(--mc-fg-muted);
      padding: 2px 6px;
      border-radius: var(--mc-radius-sm);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
    }
    .dir-btn.active {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      border-color: var(--mc-accent-primary);
    }
    .count {
      margin: var(--mc-space-1) 0 0;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
    }
  `,
})
export class TreeFilterComponent {
  readonly query = input<string>('');
  readonly direction = input<FilterDirection>('general');
  readonly matchCount = input<number>(0);
  readonly queryChange = output<string>();
  readonly directionChange = output<FilterDirection>();
  readonly next = output<void>();
  readonly prev = output<void>();
  readonly activateFirst = output<void>();
  readonly clear = output<void>();

  protected readonly directions = DIRECTIONS;
  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected dirIcon(d: FilterDirection): string {
    return d === 'up' ? '↑' : d === 'down' ? '↓' : '↕';
  }

  protected dirLabelKey(d: FilterDirection): TranslationKey {
    return `tree.direction.${d}` as TranslationKey;
  }

  focus(): void {
    this.inputEl().nativeElement.focus();
    this.inputEl().nativeElement.select();
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.queryChange.emit(value);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.next.emit();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.prev.emit();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.activateFirst.emit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.clear.emit();
    }
  }

  // why: global shortcuts to focus the filter ("/" or Ctrl+P). Skip when the
  //      user is typing into another input/textarea/contenteditable so we
  //      don't hijack the note editor.
  @HostListener('window:keydown', ['$event'])
  protected onGlobalKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const inField =
      target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
    if (event.ctrlKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.focus();
      return;
    }
    if (event.key === '/' && !inField) {
      event.preventDefault();
      this.focus();
    }
  }
}
