import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

@Component({
  selector: 'mc-due-dates-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [McDatePipe, IconComponent],
  template: `
    <div class="wrap">
      @for (d of dates(); track d) {
        <span class="chip mc-anim-pop" [class.overdue]="isOverdue(d)">
          <mc-icon [name]="isOverdue(d) ? 'alarm' : 'calendar-blank'" class="chip-icon" />
          <span>{{ friendlyLabel(d) || (d | mcDate) }}</span>
          @if (editable()) {
            <button
              type="button"
              class="x"
              [attr.aria-label]="t('tasks.due.remove')"
              (click)="remove.emit(d)"
            >
              <mc-icon name="x" />
            </button>
          }
        </span>
      }
      @if (editable()) {
        <input
          type="date"
          class="input"
          [value]="draft()"
          [attr.aria-label]="t('tasks.due.add')"
          (change)="onPick($event)"
        />
      }
    </div>
  `,
  styleUrl: './due-dates-picker.component.css',
})
export class DueDatesPickerComponent {
  readonly dates = input.required<readonly string[]>();
  readonly editable = input<boolean>(true);
  readonly add = output<string>();
  readonly remove = output<string>();

  private readonly i18n = inject(I18nService);
  protected readonly draft = signal('');

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onPick(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value === '') return;
    if (this.dates().includes(value)) {
      this.draft.set('');
      return;
    }
    this.add.emit(value);
    this.draft.set('');
    (event.target as HTMLInputElement).value = '';
  }

  protected isOverdue(date: string): boolean {
    return date < today();
  }

  protected friendlyLabel(date: string): string {
    if (date === today()) return this.t('tasks.due.today');
    if (date === tomorrow()) return this.t('tasks.due.tomorrow');
    return '';
  }
}

const today = (): string => new Date().toISOString().slice(0, 10);
const tomorrow = (): string => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t.toISOString().slice(0, 10);
};
