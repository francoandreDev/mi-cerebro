import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

@Component({
  selector: 'mc-deadline-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      @if (deadline()) {
        <span class="chip" [class.overdue]="isOverdue(deadline()!)">
          <span>{{ formatRelative(deadline()!) }}</span>
          @if (editable()) {
            <button
              type="button"
              class="x"
              [attr.aria-label]="t('goals.deadline.remove')"
              (click)="deadlineChange.emit(null)"
            >
              ×
            </button>
          }
        </span>
      } @else if (editable()) {
        <input
          type="date"
          class="input"
          [attr.aria-label]="t('goals.deadline.add')"
          (change)="onPick($event)"
        />
      } @else {
        <span class="muted">{{ t('goals.deadline.none') }}</span>
      }
    </div>
  `,
  styleUrl: './deadline-picker.component.css',
})
export class DeadlinePickerComponent {
  readonly deadline = input.required<string | null>();
  readonly editable = input<boolean>(true);
  readonly deadlineChange = output<string | null>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onPick(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value === '') return;
    this.deadlineChange.emit(value);
  }

  protected isOverdue(date: string): boolean {
    return date < today();
  }

  protected formatRelative(date: string): string {
    if (date === today()) return this.t('goals.deadline.today');
    if (date === tomorrow()) return this.t('goals.deadline.tomorrow');
    return date;
  }
}

const today = (): string => new Date().toISOString().slice(0, 10);
const tomorrow = (): string => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t.toISOString().slice(0, 10);
};
