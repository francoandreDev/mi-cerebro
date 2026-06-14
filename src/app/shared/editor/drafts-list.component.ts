// 13g-ii — Compact list of pending draft marks used by the side-by-side
// drafts panel. Each row shows category chip + 1-line preview and
// highlights the selected mark; clicking emits `select(id)`.

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { markCategory, type MarkCategory } from '@core/versioning/draft-apply';
import type { DiffMark } from '@core/versioning/drafts.types';

@Component({
  selector: 'mc-drafts-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="list" role="listbox" [attr.aria-label]="t('drafts.title')">
      @for (m of marks(); track m.id) {
        <li>
          <button
            type="button"
            role="option"
            class="row"
            [class.selected]="m.id === selectedId()"
            [attr.aria-selected]="m.id === selectedId()"
            (click)="pick.emit(m.id)"
          >
            <span class="chip" [attr.data-cat]="categoryOf(m)">{{ chipLabel(m) }}</span>
            <span class="text">{{ rowText(m) }}</span>
          </button>
        </li>
      }
    </ul>
  `,
  styleUrl: './drafts-list.component.scss',
})
export class DraftsListComponent {
  readonly marks = input.required<readonly DiffMark[]>();
  readonly selectedId = input<string | null>(null);
  readonly pick = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly emptyText = computed(() => this.i18n.t('drafts.preview.empty'));

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected categoryOf(mark: DiffMark): MarkCategory {
    return markCategory(mark);
  }

  protected chipLabel(mark: DiffMark): string {
    switch (markCategory(mark)) {
      case 'insert':
        return this.t('drafts.category.insert');
      case 'delete':
        return this.t('drafts.category.delete');
      default:
        return this.t('drafts.category.mutate');
    }
  }

  protected rowText(mark: DiffMark): string {
    const cat = markCategory(mark);
    const source = cat === 'delete' ? mark.before : mark.after;
    return firstLine(source) || this.emptyText();
  }
}

function firstLine(doc: JSONContent): string {
  const parts: string[] = [];
  const walk = (n: JSONContent): void => {
    if (typeof n.text === 'string') parts.push(n.text);
    for (const c of n.content ?? []) walk(c);
  };
  walk(doc);
  return parts.join('').trim().replace(/\s+/g, ' ').slice(0, 80);
}
