// Right pane of /variants: full detail of the selected variant + the
// action buttons that used to live on the card.

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Variant } from '@core/versioning/variants.types';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import type { VariantOverview } from '../services/variants-stats.service';

@Component({
  selector: 'mc-variant-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BgColorDirective, McDatePipe],
  templateUrl: './variant-detail.component.html',
  styleUrl: './variant-detail.component.css',
})
export class VariantDetailComponent {
  private readonly i18n = inject(I18nService);

  readonly variant = input<Variant | null>(null);
  readonly overview = input<VariantOverview | null>(null);
  readonly parentName = input<string | null>(null);
  readonly isActive = input<boolean>(false);
  readonly isDormant = input<boolean>(false);
  readonly renaming = input<boolean>(false);
  readonly renameValue = input<string>('');
  readonly busy = input<boolean>(false);
  readonly switching = input<boolean>(false);

  readonly switchTo = output<void>();
  readonly merge = output<void>();
  readonly delete_ = output<void>();
  readonly renameStart = output<void>();
  readonly renameSubmit = output<void>();
  readonly renameCancel = output<void>();
  readonly renameValueChange = output<string>();
  readonly colorChange = output<string>();
  readonly openCommit = output<string>();

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected shortOid(oid: string | null | undefined): string {
    return oid ? oid.slice(0, 7) : '';
  }

  protected onColorInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.colorChange.emit(next);
  }

  protected onHeadClick(): void {
    const head = this.overview()?.head;
    if (head) this.openCommit.emit(head.oid);
  }

  protected onMilestoneClick(): void {
    const ms = this.overview()?.milestone;
    if (ms) this.openCommit.emit(ms.oid);
  }
}
