import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

@Component({
  selector: 'mc-quick-capture-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // why: render fuera del flujo para no afectar el layout del padre.
  host: { style: 'display: contents' },
  imports: [TagPickerComponent],
  template: `
    @if (visible()) {
      <button
        type="button"
        class="backdrop"
        [attr.aria-label]="t('common.cancel')"
        (click)="onCancel()"
      ></button>
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId">
        <h3 [id]="titleId">{{ t('quickCapture.title') }}</h3>
        <textarea
          #textarea
          rows="4"
          [placeholder]="t('quickCapture.placeholder')"
          (keydown.escape)="onCancel()"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        <mc-tag-picker
          class="context-tags"
          [availableTags]="availableTags()"
          [selectedIds]="contextTagIds()"
          (addTag)="addTag.emit($event)"
          (removeTag)="removeTag.emit($event)"
        />
        <p class="hint">{{ t('quickCapture.hint') }}</p>
      </div>
    }
  `,
  styleUrl: './quick-capture-dialog.component.css',
})
export class QuickCaptureDialogComponent {
  readonly visible = input(false);
  readonly availableTags = input<readonly Tag[]>([]);
  readonly contextTagIds = input<readonly string[]>([]);
  readonly submitted = output<string>();
  readonly cancelled = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  protected readonly titleId = 'mc-quick-capture-title';
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly i18n = inject(I18nService);

  constructor() {
    effect(() => {
      if (this.visible()) queueMicrotask(() => this.textarea()?.nativeElement.focus());
    });
  }

  protected t(key: string): string {
    return this.i18n.t(key as TranslationKey);
  }

  protected onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) return;
    keyEvent.preventDefault();
    const value = this.textarea()?.nativeElement.value ?? '';
    this.clear();
    this.submitted.emit(value);
  }

  protected onCancel(): void {
    this.clear();
    this.cancelled.emit();
  }

  private clear(): void {
    const el = this.textarea()?.nativeElement;
    if (el) el.value = '';
  }
}
