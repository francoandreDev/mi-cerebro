import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { WritingStats } from '@core/writing-stats/writing-stats.types';

@Component({
  selector: 'mc-writing-stats-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './writing-stats-popover.component.html',
  styleUrl: './writing-stats-popover.component.css',
})
export class WritingStatsPopoverComponent {
  readonly open = input<boolean>(false);
  readonly chapterStats = input.required<WritingStats>();
  readonly bookStats = input.required<WritingStats>();
  readonly globalStats = input.required<WritingStats>();
  readonly closed = output<void>();

  private readonly i18n = inject(I18nService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected round(n: number): number {
    return Math.round(n);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocClick(event: Event): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.closed.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEsc(event: Event): void {
    if (this.open()) {
      event.preventDefault();
      this.closed.emit();
    }
  }
}
