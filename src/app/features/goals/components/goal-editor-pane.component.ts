import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { FocusModeService } from '@core/focus-mode/focus-mode.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { EditorComponent } from '@shared/editor/editor.component';
import { IconComponent } from '@shared/icon/icon.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import { type Goal, type GoalPriority, type GoalStep } from '../models/goal.types';
import { GoalConstellationEditorComponent } from './goal-constellation-editor.component';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-goal-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent, TagPickerComponent, IconComponent, GoalConstellationEditorComponent],
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
  readonly priorityChange = output<GoalPriority>();
  readonly reminderEnabledChange = output<boolean>();
  readonly stepsChange = output<readonly GoalStep[]>();

  private readonly i18n = inject(I18nService);
  protected readonly focusMode = inject(FocusModeService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected onReminderToggle(event: Event): void {
    this.reminderEnabledChange.emit((event.target as HTMLInputElement).checked);
  }
}
