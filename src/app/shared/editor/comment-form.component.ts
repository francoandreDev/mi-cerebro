// Create-comment form rendered inside the panel. Dumb: parent owns the
// signals (anchorType, anchor, body, error, saving) and the action
// outputs let the parent drive the persistence flow.

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { CommentAnchorType } from '@core/versioning/comments.types';

import type { BlockSummary } from './block-summaries';

@Component({
  selector: 'mc-comment-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="onSubmit($event)" novalidate>
      <fieldset>
        <legend>{{ t('comments.form.anchor.label') }}</legend>
        <label class="radio">
          <input
            type="radio"
            name="anchorType"
            value="entity"
            [checked]="anchorType() === 'entity'"
            (change)="anchorTypeChange.emit('entity')"
          />
          {{ t('comments.form.anchor.entity') }}
        </label>
        <label class="radio">
          <input
            type="radio"
            name="anchorType"
            value="block"
            [checked]="anchorType() === 'block'"
            [disabled]="blocks().length === 0"
            (change)="anchorTypeChange.emit('block')"
          />
          {{ t('comments.form.anchor.block') }}
        </label>
        @if (anchorType() === 'block') {
          <label class="field">
            <span>{{ t('comments.form.block.label') }}</span>
            <select
              [value]="anchor()"
              (change)="onAnchorChange($event)"
              [attr.aria-label]="t('comments.form.block.label')"
            >
              <option value="">{{ t('comments.form.block.placeholder') }}</option>
              @for (b of blocks(); track b.blockId) {
                <option [value]="b.blockId">{{ blockOptionLabel(b) }}</option>
              }
            </select>
          </label>
        }
      </fieldset>
      <label class="field">
        <span>{{ t('comments.form.body.label') }}</span>
        <textarea
          rows="3"
          [value]="body()"
          (input)="onBodyChange($event)"
          [placeholder]="t('comments.form.body.placeholder')"
          [attr.aria-label]="t('comments.form.body.label')"
        ></textarea>
      </label>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        <button type="button" class="ghost" (click)="cancelForm.emit()">
          {{ t('comments.form.cancel') }}
        </button>
        <button type="submit" class="primary" [disabled]="saving()">
          {{ t('comments.form.save') }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './comment-form.component.scss',
})
export class CommentFormComponent {
  readonly blocks = input.required<readonly BlockSummary[]>();
  readonly anchorType = input.required<CommentAnchorType>();
  readonly anchor = input.required<string>();
  readonly body = input.required<string>();
  readonly error = input<string>('');
  readonly saving = input<boolean>(false);
  readonly anchorTypeChange = output<CommentAnchorType>();
  readonly anchorChange = output<string>();
  readonly bodyChange = output<string>();
  readonly submitForm = output<void>();
  readonly cancelForm = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected blockOptionLabel(b: BlockSummary): string {
    const preview = b.preview || this.t('comments.block.preview.empty');
    return `${b.type}: ${preview}`;
  }

  protected onAnchorChange(ev: Event): void {
    this.anchorChange.emit((ev.target as HTMLSelectElement).value);
  }

  protected onBodyChange(ev: Event): void {
    this.bodyChange.emit((ev.target as HTMLTextAreaElement).value);
  }

  protected onSubmit(ev: Event): void {
    ev.preventDefault();
    this.submitForm.emit();
  }
}
