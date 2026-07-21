import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

// why: dumb — pulled out of goal-constellation-editor.component.ts (already
//      at the 300-line hard cap) per docs/proyecto/reglas.md §4.4. Owns only
//      the inline delete-confirm UI state; the container owns the selection
//      set and the steps mutation.
@Component({
  selector: 'mc-goal-selection-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './goal-selection-toolbar.component.html',
  styleUrl: './goal-selection-toolbar.component.css',
})
export class GoalSelectionToolbarComponent {
  readonly count = input.required<number>();

  readonly toggleDone = output<void>();
  readonly deleteSelected = output<void>();
  readonly clearSelection = output<void>();

  private readonly i18n = inject(I18nService);
  protected readonly confirmingDelete = signal(false);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onDeleteClick(): void {
    if (this.confirmingDelete()) {
      this.confirmingDelete.set(false);
      this.deleteSelected.emit();
      return;
    }
    this.confirmingDelete.set(true);
  }

  protected onCancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected onClearClick(): void {
    this.confirmingDelete.set(false);
    this.clearSelection.emit();
  }
}
