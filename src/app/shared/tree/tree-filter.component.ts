import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TreeFilterFocusService } from '@core/shortcuts/tree-filter-focus.service';

import type { FilterDirection } from './tree.types';

const DIRECTIONS: readonly FilterDirection[] = ['general', 'up', 'down'];

let listboxIdCounter = 0;

export interface FilterMatchEntry {
  readonly id: string;
  readonly label: string;
  readonly breadcrumb: string;
}

@Component({
  selector: 'mc-tree-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <input
        #input
        type="text"
        class="input"
        role="combobox"
        aria-autocomplete="list"
        [attr.aria-controls]="hasDropdown() ? listboxId : null"
        [attr.aria-expanded]="hasDropdown()"
        [attr.aria-activedescendant]="activeOptionId()"
        [value]="query()"
        [placeholder]="placeholder() || t('tree.filter.placeholder')"
        [attr.aria-label]="placeholder() || t('tree.filter.placeholder')"
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
    @if (hasDropdown()) {
      <ul
        class="matches"
        role="listbox"
        [id]="listboxId"
        [attr.aria-label]="t('tree.filter.matches.listLabel')"
      >
        @for (m of matches(); track m.id; let i = $index) {
          <li
            class="match-option"
            role="option"
            [id]="optionId(m.id)"
            [attr.aria-selected]="m.id === activeMatchId()"
            [class.active]="m.id === activeMatchId()"
            (mousedown)="onMatchMouseDown($event, m.id)"
          >
            <span class="match-label">{{ m.label }}</span>
            <span class="match-breadcrumb">{{
              m.breadcrumb || t('tree.filter.matches.noBreadcrumb')
            }}</span>
          </li>
        }
      </ul>
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
    .matches {
      list-style: none;
      margin: var(--mc-space-1) 0 0;
      padding: 0;
      max-height: 200px;
      overflow-y: auto;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
    }
    .match-option {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--mc-space-1) var(--mc-space-2);
      cursor: pointer;
      border-bottom: 1px solid var(--mc-border-subtle, var(--mc-border-default));
    }
    .match-option:last-child {
      border-bottom: 0;
    }
    .match-option:hover {
      background: var(--mc-bg-base);
    }
    .match-option.active {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
    }
    .match-option.active .match-breadcrumb {
      color: var(--mc-accent-fg);
      opacity: 0.85;
    }
    .match-label {
      font-size: var(--mc-font-size-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .match-breadcrumb {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class TreeFilterComponent {
  readonly query = input<string>('');
  readonly direction = input<FilterDirection>('general');
  readonly matchCount = input<number>(0);
  readonly placeholder = input<string>('');
  readonly matches = input<readonly FilterMatchEntry[]>([]);
  readonly activeMatchId = input<string | null>(null);
  readonly queryChange = output<string>();
  readonly directionChange = output<FilterDirection>();
  readonly next = output<void>();
  readonly prev = output<void>();
  readonly activateFirst = output<void>();
  readonly clear = output<void>();
  readonly chooseMatch = output<string>();

  protected readonly directions = DIRECTIONS;
  protected readonly listboxId = `tree-filter-matches-${listboxIdCounter++}`;
  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly i18n = inject(I18nService);
  private readonly focusShortcut = inject(TreeFilterFocusService);

  protected readonly hasDropdown = computed(
    () => this.query().trim() !== '' && this.matches().length > 0,
  );
  protected readonly activeOptionId = computed<string | null>(() => {
    const id = this.activeMatchId();
    return id && this.hasDropdown() ? this.optionId(id) : null;
  });

  protected optionId(id: string): string {
    return `${this.listboxId}-${id}`;
  }

  protected onMatchMouseDown(event: MouseEvent, id: string): void {
    event.preventDefault();
    this.chooseMatch.emit(id);
  }

  constructor() {
    this.focusShortcut.setHandler(() => this.focus());
    inject(DestroyRef).onDestroy(() => this.focusShortcut.setHandler(null));
  }

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
}
