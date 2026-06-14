// 13f — Dumb toolbar for the editor. Holds the image-picker trigger, the
// view segmented control (clean | combined), the index popover toggles
// (comments / drafts), and the session status flags. All state lives in
// the host editor; this component is pure UI.

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

export type EditorView = 'clean' | 'combined';

@Component({
  selector: 'mc-editor-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="toolbar">
      @if (editable() && hasGalleries()) {
        <button
          type="button"
          class="ghost"
          (click)="openPicker.emit()"
          [attr.aria-label]="t('editor.insertImage')"
        >
          <mc-icon name="image" /> {{ t('editor.insertImage') }}
        </button>
      }
      @if (commentsAvailable()) {
        <div class="view-toggle" role="group" [attr.aria-label]="t('editor.view.label')">
          <button
            type="button"
            [class.active]="view() === 'clean'"
            [attr.aria-pressed]="view() === 'clean'"
            [attr.aria-label]="t('editor.view.clean.aria')"
            (click)="setView.emit('clean')"
          >
            {{ t('editor.view.clean') }}
          </button>
          <button
            type="button"
            [class.active]="view() === 'combined'"
            [attr.aria-pressed]="view() === 'combined'"
            [attr.aria-label]="t('editor.view.combined.aria')"
            (click)="setView.emit('combined')"
          >
            {{ t('editor.view.combined') }}
          </button>
        </div>
      }
      @if (commentsAvailable() && view() === 'combined') {
        <button
          type="button"
          class="ghost"
          (click)="toggleCommentsIndex.emit()"
          [attr.aria-pressed]="commentsIndexOpen()"
          [attr.aria-label]="t('editor.index.comments.aria')"
        >
          <mc-icon name="chat-circle" /> {{ t('comments.title') }}
        </button>
        <button
          type="button"
          class="ghost"
          (click)="toggleDraftsIndex.emit()"
          [attr.aria-pressed]="draftsIndexOpen()"
          [attr.aria-label]="t('editor.index.drafts.aria')"
        >
          <mc-icon name="clipboard-text" /> {{ t('drafts.title') }}
        </button>
      }
      @if (sessionActive()) {
        <span class="session-flag" role="status" aria-live="polite">
          <mc-icon name="note-pencil" /> {{ t('editor.session.active') }}
        </span>
      }
      @if (lastSaveCount() !== null) {
        <span class="saved-flash" role="status" aria-live="polite">
          <mc-icon name="check" /> {{ t('editor.session.saved') }} ({{ lastSaveCount() }})
        </span>
      }
    </div>
  `,
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  readonly editable = input<boolean>(true);
  readonly hasGalleries = input<boolean>(false);
  readonly commentsAvailable = input<boolean>(false);
  readonly view = input.required<EditorView>();
  readonly commentsIndexOpen = input<boolean>(false);
  readonly draftsIndexOpen = input<boolean>(false);
  readonly sessionActive = input<boolean>(false);
  readonly lastSaveCount = input<number | null>(null);

  readonly openPicker = output<void>();
  readonly setView = output<EditorView>();
  readonly toggleCommentsIndex = output<void>();
  readonly toggleDraftsIndex = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
