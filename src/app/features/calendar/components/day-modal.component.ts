import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';

import type { CalendarEvent } from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import { CalendarDayPanelComponent } from './day-panel.component';

@Component({
  selector: 'mc-calendar-day-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarDayPanelComponent, IconComponent],
  template: `
    <div class="backdrop" (click)="dismiss.emit()" aria-hidden="true"></div>
    <div
      class="dialog mc-anim-pop"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="t('calendar.day.heading').replace('{date}', date())"
    >
      <button
        type="button"
        class="x mc-hover-grow"
        (click)="dismiss.emit()"
        [attr.aria-label]="t('common.close')"
      >
        <mc-icon name="x" />
      </button>
      <button type="button" class="book-link" (click)="openBook.emit(date())">
        <mc-icon name="books" />
        {{ t('calendar.day.openBook') }}
      </button>
      <mc-calendar-day-panel
        [date]="date()"
        [events]="events()"
        (open)="openEvent.emit($event)"
        (createTask)="createTask.emit()"
        (createGoal)="createGoal.emit()"
        (createReminder)="createReminder.emit()"
      />
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
    }
    .dialog {
      position: relative;
      background: var(--mc-bg-base);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      width: min(560px, 92vw);
      max-height: 80vh;
      overflow: auto;
      padding: var(--mc-space-3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    }
    .x {
      position: absolute;
      top: var(--mc-space-1);
      right: var(--mc-space-2);
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      font-size: var(--mc-font-size-lg);
      line-height: 1;
    }
    .x:hover {
      color: var(--mc-fg-primary);
    }
    .book-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
      padding: 0 0 var(--mc-space-2);
    }
    .book-link:hover {
      color: var(--mc-accent-primary);
    }
  `,
})
export class CalendarDayModalComponent {
  readonly date = input.required<string>();
  readonly events = input<readonly CalendarEvent[]>([]);
  readonly dismiss = output<void>();
  readonly openEvent = output<CalendarEvent>();
  readonly createTask = output<void>();
  readonly createGoal = output<void>();
  readonly createReminder = output<void>();
  readonly openBook = output<string>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    event.preventDefault();
    this.dismiss.emit();
  }
}
