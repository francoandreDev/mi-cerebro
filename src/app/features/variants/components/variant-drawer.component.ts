// Bottom drawer of /variants: 2-line strip with the selected variant's
// compact info + action buttons. Slides up when a brazo is picked in
// the delta. Same output surface as the old variant-detail — the
// container wires them identically.

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Variant } from '@core/versioning/variants.types';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import type { VariantOverview } from '../services/variants-stats.service';

@Component({
  selector: 'mc-variant-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BgColorDirective, McDatePipe, IconComponent],
  templateUrl: './variant-drawer.component.html',
  styleUrl: './variant-drawer.component.css',
})
export class VariantDrawerComponent {
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
  readonly selectParent = output<string>();

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected shortOid(oid: string | null | undefined): string {
    return oid ? oid.slice(0, 7) : '';
  }

  protected onColorInput(event: Event): void {
    this.colorChange.emit((event.target as HTMLInputElement).value);
  }

  protected onHeadClick(): void {
    const head = this.overview()?.head;
    if (head) this.openCommit.emit(head.oid);
  }

  protected onMilestoneClick(): void {
    const ms = this.overview()?.milestone;
    if (ms) this.openCommit.emit(ms.oid);
  }

  protected onParentClick(): void {
    const parentId = this.variant()?.parentId;
    if (parentId) this.selectParent.emit(parentId);
  }

  // why: auto-commit subjects follow `auto: <parts> (<stamp>) [reason]`.
  //      We split them so the drawer can render each piece as its own
  //      visual chip instead of one wall of text. `stamp` gets dropped —
  //      the activity pill already carries it. Manual commits fall
  //      through as a single subject string.
  protected readonly headParsed = computed(() => {
    const subject = this.overview()?.head?.subject ?? '';
    return parseHeadSubject(subject);
  });
}

export interface ParsedHead {
  readonly kind: 'auto' | 'manual' | 'empty';
  readonly summary: string;
  readonly reason: string | null;
}

const AUTO_RE = /^auto:\s+(.+?)\s+\(([^)]+)\)(?:\s+\[([^\]]+)\])?\s*$/;

export function parseHeadSubject(subject: string): ParsedHead {
  const trimmed = subject.trim();
  if (!trimmed) return { kind: 'empty', summary: '', reason: null };
  const m = AUTO_RE.exec(trimmed);
  if (m) return { kind: 'auto', summary: m[1] ?? '', reason: m[3] ?? null };
  return { kind: 'manual', summary: trimmed, reason: null };
}
