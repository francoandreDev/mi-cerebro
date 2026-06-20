import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-calendar-tag-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="active">
      <mc-icon name="funnel" class="filter-icon" />
      <span class="label">{{ t('calendar.filters.tag') }}</span>
      @for (tag of activeTags(); track tag.id) {
        <button
          type="button"
          class="chip active mc-anim-pop"
          (click)="toggleTag.emit(tag.id)"
          [attr.aria-label]="'Quitar ' + tag.label"
        >
          <mc-icon name="tag" />
          {{ tag.label }}
          <mc-icon name="x" class="x" />
        </button>
      }
      <button
        type="button"
        class="trigger"
        [class.has-active]="selected().size > 0"
        (click)="onToggleOpen()"
        [attr.aria-expanded]="open()"
      >
        <mc-icon name="plus" />
        @if (selected().size === 0) {
          {{ t('calendar.filters.tag') }}
        } @else {
          más
        }
        <mc-icon name="caret-down" class="caret" />
      </button>
      @if (selected().size > 0) {
        <button type="button" class="ghost tiny" (click)="clearTags.emit()">
          <mc-icon name="broom" />
          {{ t('calendar.filters.clear') }}
        </button>
      }
    </div>
    @if (open()) {
      <div class="popover" role="dialog">
        <input
          #q
          type="search"
          class="search"
          [placeholder]="t('calendar.filters.tag')"
          [value]="query()"
          (input)="onQuery(q.value)"
        />
        @if (filtered().length === 0) {
          <p class="empty">{{ t('calendar.day.empty') }}</p>
        } @else {
          <ul>
            @for (tag of filtered(); track tag.id) {
              <li>
                <button
                  type="button"
                  class="row"
                  [class.on]="selected().has(tag.id)"
                  (click)="toggleTag.emit(tag.id)"
                >
                  <mc-icon
                    [name]="selected().has(tag.id) ? 'check-square' : 'circle-dashed'"
                    class="check"
                  />
                  <span class="name">{{ tag.label }}</span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }
    .active {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--mc-space-1);
    }
    .filter-icon {
      color: var(--mc-fg-muted);
    }
    .label {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
      margin-right: var(--mc-space-1);
    }
    .ghost.tiny {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .chip {
      background: var(--mc-bg-elevated);
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
      padding: 2px var(--mc-space-2);
      border-radius: var(--mc-radius-pill);
      cursor: pointer;
      font-size: var(--mc-font-size-xs);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .chip.active {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      border-color: var(--mc-accent-primary);
    }
    .chip .x {
      opacity: 0.7;
      font-size: var(--mc-font-size-sm);
      line-height: 1;
    }
    .chip:hover .x {
      opacity: 1;
    }
    .trigger {
      background: transparent;
      color: var(--mc-fg-primary);
      border: 1px dashed var(--mc-border-default);
      padding: 2px var(--mc-space-2);
      border-radius: var(--mc-radius-pill);
      cursor: pointer;
      font-size: var(--mc-font-size-xs);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .trigger:hover {
      background: var(--mc-bg-hover);
    }
    .trigger.has-active {
      border-style: solid;
    }
    .caret {
      color: var(--mc-fg-muted);
    }
    .ghost.tiny {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      font-size: var(--mc-font-size-xs);
      padding: 0 var(--mc-space-1);
      text-decoration: underline;
    }
    .popover {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 20;
      background: var(--mc-bg-base);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      padding: var(--mc-space-1);
      max-height: 280px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .search {
      background: var(--mc-bg-surface);
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-sm);
      padding: var(--mc-space-1) var(--mc-space-2);
      font-size: var(--mc-font-size-sm);
      margin-bottom: var(--mc-space-1);
    }
    .empty {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
      padding: var(--mc-space-2);
      margin: 0;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      width: 100%;
      background: transparent;
      border: 0;
      padding: var(--mc-space-1) var(--mc-space-2);
      cursor: pointer;
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-sm);
      border-radius: var(--mc-radius-sm);
      text-align: left;
    }
    .row:hover {
      background: var(--mc-bg-hover);
    }
    .row.on {
      color: var(--mc-accent-primary);
    }
    .check {
      width: 1ch;
      color: var(--mc-accent-primary);
    }
    .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class CalendarTagFilterComponent {
  readonly tags = input<readonly Tag[]>([]);
  readonly selected = input.required<ReadonlySet<string>>();
  readonly toggleTag = output<string>();
  readonly clearTags = output<void>();

  private readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly query = signal('');

  protected readonly activeTags = computed<readonly Tag[]>(() => {
    const sel = this.selected();
    return this.tags().filter((t) => sel.has(t.id));
  });

  protected readonly filtered = computed<readonly Tag[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.tags();
    if (!q) return all;
    return all.filter((t) => t.label.toLowerCase().includes(q));
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onToggleOpen(): void {
    this.open.update((v) => !v);
  }

  protected onQuery(value: string): void {
    this.query.set(value);
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.open.set(false);
  }
}
