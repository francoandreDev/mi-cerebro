import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

@Component({
  selector: 'mc-notes-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
  template: `
    <div class="row">
      <div class="search" data-tutorial="notes-search">
        <mc-icon name="magnifying-glass" class="search-icon" aria-hidden="true" />
        <input
          type="search"
          class="search-input"
          [value]="query()"
          [attr.aria-label]="t('notes.wall.searchAria')"
          [placeholder]="t('notes.wall.searchPlaceholder')"
          (input)="onQueryInput($event)"
        />
        @if (query()) {
          <button
            type="button"
            class="search-clear mc-hover-wiggle"
            [attr.aria-label]="t('notes.wall.searchClear')"
            (click)="queryChange.emit('')"
          >
            <mc-icon name="x" />
          </button>
        }
      </div>
      @if (activeTagIds().size || query()) {
        <button
          type="button"
          class="clear mc-hover-wiggle"
          [attr.aria-label]="t('notes.wall.filtersClear')"
          (click)="clear.emit()"
        >
          <mc-icon name="x" />
          <span>{{ t('notes.wall.filtersClear') }}</span>
        </button>
      }
    </div>
    @if (tags().length) {
      <div class="tags" role="group" [attr.aria-label]="t('notes.wall.tagsLabel')">
        @for (tag of tags(); track tag.id) {
          <button
            type="button"
            class="tag-button"
            [class.active]="isActive(tag.id)"
            [attr.aria-pressed]="isActive(tag.id)"
            (click)="toggleTag.emit(tag.id)"
          >
            <mc-tag-chip [tag]="tag" size="small" />
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
    }
    .search {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: var(--mc-space-2);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      padding: var(--mc-space-1) var(--mc-space-2);
    }
    .search:focus-within {
      border-color: var(--mc-accent-primary);
    }
    .search-icon {
      color: var(--mc-fg-muted);
    }
    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-base);
      min-width: 0;
    }
    .search-input:focus {
      outline: none;
    }
    .search-clear,
    .clear {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
      padding: 2px 4px;
      border-radius: var(--mc-radius-sm);
    }
    .clear {
      border: 1px solid var(--mc-border-default);
      padding: 4px 8px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag-button {
      background: transparent;
      border: 0;
      padding: 0;
      cursor: pointer;
      border-radius: var(--mc-radius-pill, 999px);
      opacity: 0.65;
      transition:
        opacity 120ms ease,
        transform 120ms ease;
    }
    .tag-button:hover {
      opacity: 1;
    }
    .tag-button.active {
      opacity: 1;
      transform: scale(1.04);
      outline: 2px solid var(--mc-accent-primary);
      outline-offset: 1px;
    }
    .tag-button:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: 1px;
    }
  `,
})
export class NotesFilterBarComponent {
  readonly tags = input.required<readonly Tag[]>();
  readonly activeTagIds = input.required<ReadonlySet<string>>();
  readonly query = input.required<string>();
  readonly toggleTag = output<string>();
  readonly queryChange = output<string>();
  readonly clear = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected isActive(id: string): boolean {
    return this.activeTagIds().has(id);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.queryChange.emit(target.value);
  }
}
