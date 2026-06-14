// 13g-ii — Side-by-side preview of the selected draft mark. Renders the
// `before` and `after` JSONContent blocks as plain text paragraphs, with
// big accept/reject buttons below. Pure dumb component: receives the mark
// and emits the user's intent.

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { markCategory } from '@core/versioning/draft-apply';
import type { DiffMark } from '@core/versioning/drafts.types';

@Component({
  selector: 'mc-draft-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mark(); as m) {
      <p class="hint">{{ t('drafts.preview.pickSide') }}</p>
      <div class="columns">
        @if (showBefore()) {
          <button
            type="button"
            class="column before"
            [disabled]="busy()"
            [attr.aria-label]="t('drafts.preview.keepBefore')"
            (click)="reject.emit(m.id)"
          >
            <header class="col-head">{{ t('drafts.preview.beforeColumn') }}</header>
            <div class="body">
              @for (line of beforeLines(); track $index) {
                <p>{{ line || empty() }}</p>
              } @empty {
                <p class="muted">{{ empty() }}</p>
              }
            </div>
          </button>
        }
        @if (showAfter()) {
          <button
            type="button"
            class="column after"
            [disabled]="busy()"
            [attr.aria-label]="t('drafts.preview.keepAfter')"
            (click)="accept.emit(m.id)"
          >
            <header class="col-head">{{ t('drafts.preview.afterColumn') }}</header>
            <div class="body">
              @for (line of afterLines(); track $index) {
                <p>{{ line || empty() }}</p>
              } @empty {
                <p class="muted">{{ empty() }}</p>
              }
            </div>
          </button>
        }
      </div>
    } @else {
      <p class="empty">{{ t('drafts.preview.selectOne') }}</p>
    }
  `,
  styleUrl: './draft-preview.component.scss',
})
export class DraftPreviewComponent {
  readonly mark = input<DiffMark | null>(null);
  readonly busy = input<boolean>(false);
  readonly accept = output<string>();
  readonly reject = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly showBefore = computed(() => {
    const m = this.mark();
    return !!m && markCategory(m) !== 'insert';
  });
  protected readonly showAfter = computed(() => {
    const m = this.mark();
    return !!m && markCategory(m) !== 'delete';
  });
  protected readonly beforeLines = computed(() => {
    const m = this.mark();
    return m ? docToLines(m.before) : [];
  });
  protected readonly afterLines = computed(() => {
    const m = this.mark();
    return m ? docToLines(m.after) : [];
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected empty(): string {
    return this.t('drafts.preview.empty');
  }
}

function docToLines(doc: JSONContent): readonly string[] {
  const blocks = doc.content ?? [];
  if (blocks.length === 0) return [textOf(doc).trim()].filter((s) => s.length > 0);
  return blocks.map((b) => textOf(b).trim());
}

function textOf(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textOf).join('');
}
