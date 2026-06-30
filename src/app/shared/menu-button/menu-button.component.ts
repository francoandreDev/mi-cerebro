import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface MenuOption {
  readonly key: string;
  readonly label: string;
}

@Component({
  selector: 'mc-menu-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="variant() === 'ghost' ? 'trigger ghost' : 'trigger primary'"
      [attr.aria-haspopup]="'menu'"
      [attr.aria-expanded]="open()"
      (click)="toggle($event)"
    >
      <span>{{ label() }}</span>
      <span class="chev">▾</span>
    </button>
    @if (open()) {
      <ul class="menu" role="menu">
        @for (opt of options(); track opt.key) {
          <li role="none">
            <button type="button" role="menuitem" class="item" (click)="pick(opt.key, $event)">
              {{ opt.label }}
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }
    .trigger {
      display: inline-flex;
      align-items: center;
      gap: var(--mc-space-1);
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      font-size: var(--mc-font-size-sm);
      cursor: pointer;
    }
    .trigger.primary {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      border: none;
      font-weight: 600;
    }
    .trigger.ghost {
      background: transparent;
      color: var(--mc-fg-muted);
      border: 1px dashed var(--mc-border-default);
    }
    .trigger.ghost:hover {
      color: var(--mc-fg-primary);
      border-color: var(--mc-accent-primary);
    }
    .chev {
      font-size: 0.7rem;
      opacity: 0.7;
    }
    .menu {
      position: absolute;
      top: calc(100% + 2px);
      left: 0;
      min-width: 160px;
      margin: 0;
      padding: var(--mc-space-1) 0;
      list-style: none;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      z-index: 100;
    }
    .item {
      display: block;
      width: 100%;
      padding: var(--mc-space-1) var(--mc-space-3);
      background: transparent;
      border: none;
      text-align: left;
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-sm);
      cursor: pointer;
    }
    .item:hover {
      background: var(--mc-bg-base);
    }
  `,
})
export class MenuButtonComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly MenuOption[]>();
  readonly variant = input<'primary' | 'ghost'>('primary');
  readonly choose = output<string>();

  protected readonly open = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  protected pick(key: string, event: Event): void {
    event.stopPropagation();
    this.open.set(false);
    this.choose.emit(key);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocClick(event: Event): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.open.set(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEsc(event: Event): void {
    if (this.open()) {
      event.preventDefault();
      this.open.set(false);
    }
  }
}
