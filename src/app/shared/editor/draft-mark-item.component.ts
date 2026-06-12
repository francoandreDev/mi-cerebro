// 13d-iii — dumb row for a pending draft mark. Renders the category
// chip, the timestamp, and accept/reject buttons. All state lives in the
// container; this component just emits intent.

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { markCategory, type MarkCategory } from '@core/versioning/draft-apply';
import type { DiffMark } from '@core/versioning/drafts.types';

@Component({
  selector: 'mc-draft-mark-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="row-head">
      <span class="chip" [attr.data-cat]="category()">{{ chipLabel() }}</span>
      <time class="time">{{ formatTime(mark().createdAt) }}</time>
      <span class="spacer"></span>
      <button
        type="button"
        class="primary small"
        (click)="accept.emit(mark().id)"
        [attr.aria-label]="t('drafts.actions.accept')"
      >
        ✓ {{ t('drafts.actions.accept') }}
      </button>
      <button
        type="button"
        class="ghost small"
        (click)="reject.emit(mark().id)"
        [attr.aria-label]="t('drafts.actions.reject')"
      >
        ✕ {{ t('drafts.actions.reject') }}
      </button>
    </header>
    @if (category() !== 'insert') {
      <p class="preview before">
        <span class="label">{{ t('drafts.preview.before') }}</span>
        <span class="text">{{ beforeText() || empty() }}</span>
      </p>
    }
    @if (category() !== 'delete') {
      <p class="preview after">
        <span class="label">{{ t('drafts.preview.after') }}</span>
        <span class="text">{{ afterText() || empty() }}</span>
      </p>
    }
  `,
  styleUrl: './draft-mark-item.component.scss',
})
export class DraftMarkItemComponent {
  readonly mark = input.required<DiffMark>();
  readonly accept = output<string>();
  readonly reject = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly category = computed<MarkCategory>(() => markCategory(this.mark()));
  protected readonly beforeText = computed(() => docToText(this.mark().before));
  protected readonly afterText = computed(() => docToText(this.mark().after));

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected empty(): string {
    return this.t('drafts.preview.empty');
  }

  protected chipLabel(): string {
    switch (this.category()) {
      case 'insert':
        return this.t('drafts.category.insert');
      case 'delete':
        return this.t('drafts.category.delete');
      default:
        return this.t('drafts.category.mutate');
    }
  }

  protected formatTime(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

function docToText(doc: JSONContent): string {
  const parts: string[] = [];
  const walk = (n: JSONContent): void => {
    if (typeof n.text === 'string') parts.push(n.text);
    for (const c of n.content ?? []) walk(c);
  };
  walk(doc);
  return parts.join('').trim();
}
