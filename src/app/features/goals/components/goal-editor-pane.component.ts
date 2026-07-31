import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { FocusModeService } from '@core/focus-mode/focus-mode.service';
import { LEAD_PRESETS } from '@core/reminders/goal-cadence.utils';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { ConnectionsPanelContainer } from '@shared/connections/connections-panel.container';
import { EditorComponent } from '@shared/editor/editor.component';
import { IconComponent } from '@shared/icon/icon.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import { GOAL_KIND, type Goal, type GoalPriority, type GoalStep } from '../models/goal.types';
import { GoalConstellationEditorComponent } from './goal-constellation-editor.component';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

@Component({
  selector: 'mc-goal-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EditorComponent,
    TagPickerComponent,
    IconComponent,
    GoalConstellationEditorComponent,
    ConnectionsPanelContainer,
  ],
  templateUrl: './goal-editor-pane.component.html',
  styleUrl: './goal-editor-pane.component.css',
})
export class GoalEditorPaneComponent {
  protected readonly entityKind = GOAL_KIND;
  readonly goal = input.required<Goal>();
  readonly status = input<SaveStatus>('saved');
  readonly availableTags = input.required<readonly Tag[]>();
  readonly editable = input<boolean>(true);
  readonly dormant = input<boolean>(false);
  // why: dumb component can't inject SettingsService (§4.5) — the container
  //      passes the global lead-time in so the "usar default global ({n})"
  //      option can show what it would fall back to.
  readonly globalLeadMinutes = input.required<number>();
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();
  readonly completedChange = output<boolean>();
  readonly deadlineChange = output<string | null>();
  readonly deadlineTimeChange = output<string | null>();
  readonly removeGoal = output<void>();
  readonly addTag = output<string>();
  readonly removeTag = output<string>();
  readonly priorityChange = output<GoalPriority>();
  readonly reminderEnabledChange = output<boolean>();
  readonly notifyOnDormantChange = output<boolean>();
  readonly reminderLeadMinutesChange = output<number | null>();
  readonly stepsChange = output<readonly GoalStep[]>();

  private readonly i18n = inject(I18nService);
  protected readonly focusMode = inject(FocusModeService);
  protected readonly leadPresets = LEAD_PRESETS;
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected asKey(key: string): TranslationKey {
    return key as TranslationKey;
  }
  protected onReminderToggle(event: Event): void {
    this.reminderEnabledChange.emit((event.target as HTMLInputElement).checked);
  }
  protected onNotifyOnDormantToggle(event: Event): void {
    this.notifyOnDormantChange.emit((event.target as HTMLInputElement).checked);
  }
  protected onLeadMinutesSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.reminderLeadMinutesChange.emit(value === '' ? null : Number(value));
  }
  protected globalLeadLabel(): string {
    const minutes = this.globalLeadMinutes();
    const preset = this.leadPresets.find((p) => p.minutes === minutes);
    return preset ? this.t(this.asKey(preset.labelKey)) : `${minutes} min`;
  }
}
