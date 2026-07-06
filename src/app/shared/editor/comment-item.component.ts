// Single comment row inside the panel. Dumb: only renders attrs and
// emits intent. Used both by the active list and the orphan list.

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Comment } from '@core/versioning/comments.types';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-comment-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <header class="row-head">
      <span class="chip" [attr.data-type]="comment().anchorType">{{ chipLabel() }}</span>
      <time class="time">{{ formatTime(comment().createdAt) }}</time>
      <button
        type="button"
        class="icon danger"
        (click)="onDelete($event)"
        [attr.aria-label]="t('comments.actions.delete')"
      >
        <mc-icon name="x" />
      </button>
    </header>
    <p class="body">{{ bodyText() }}</p>
  `,
  styleUrl: './comment-item.component.scss',
})
export class CommentItemComponent {
  readonly comment = input.required<Comment>();
  readonly delete = output<string>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected chipLabel(): string {
    switch (this.comment().anchorType) {
      case 'entity':
        return this.t('comments.anchor.entity');
      case 'range':
        return this.t('comments.anchor.range');
      default:
        return this.t('comments.anchor.block');
    }
  }

  protected formatTime(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ');
  }

  protected bodyText(): string {
    return docToText(this.comment().body);
  }

  protected onDelete(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.comment().id);
  }
}

function docToText(doc: JSONContent): string {
  if (!doc) return '';
  const parts: string[] = [];
  const walk = (n: JSONContent): void => {
    if (typeof n.text === 'string') parts.push(n.text);
    for (const c of n.content ?? []) walk(c);
  };
  walk(doc);
  return parts.join('').trim();
}
