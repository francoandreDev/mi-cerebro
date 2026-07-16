import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { FocusModeService } from '@core/focus-mode/focus-mode.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { EditorComponent } from '@shared/editor/editor.component';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { Writing } from '../models/writing.types';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-writing-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent, TagPickerComponent, IconComponent],
  templateUrl: './writing-editor-pane.component.html',
  styleUrl: './writing-editor-pane.component.css',
})
export class WritingEditorPaneComponent {
  readonly writing = input.required<Writing>();
  readonly status = input<SaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly editable = input<boolean>(true);
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();
  readonly deadlineChange = output<string | null>();
  readonly reminderEnabledChange = output<boolean>();
  readonly removeWriting = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  private readonly i18n = inject(I18nService);
  protected readonly focusMode = inject(FocusModeService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected statusLabel(): string {
    return this.t(`writings.status.${this.status()}` as TranslationKey);
  }
  protected statusIcon(): IconName {
    const s = this.status();
    if (s === 'saving') return 'spinner-gap';
    if (s === 'unsaved') return 'warning';
    return 'check';
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
  protected onDeadlineInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    this.deadlineChange.emit(target.value === '' ? null : target.value);
  }
  protected onReminderToggle(event: Event): void {
    this.reminderEnabledChange.emit((event.target as HTMLInputElement).checked);
  }
}
