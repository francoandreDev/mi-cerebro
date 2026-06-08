import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { EditorComponent } from '@shared/editor/editor.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import type { Goal } from '../models/goal.types';
import { DeadlinePickerComponent } from './deadline-picker.component';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-goal-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent, TagPickerComponent, DeadlinePickerComponent],
  templateUrl: './goal-editor-pane.component.html',
  styleUrl: './goal-editor-pane.component.css',
})
export class GoalEditorPaneComponent {
  readonly goal = input.required<Goal>();
  readonly status = input<SaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly editable = input<boolean>(true);
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();
  readonly completedChange = output<boolean>();
  readonly deadlineChange = output<string | null>();
  readonly removeGoal = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected statusLabel(): string {
    return this.t(`goals.status.${this.status()}` as TranslationKey);
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
  protected onCompletedToggle(event: Event): void {
    this.completedChange.emit((event.target as HTMLInputElement).checked);
  }
}
