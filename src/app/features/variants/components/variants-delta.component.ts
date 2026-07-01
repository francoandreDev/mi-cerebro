// The delta view of /variants. Full-canvas SVG river: Principal is the
// top channel; every other variant curves off its parent's channel and
// flows to the right. Search + "Nueva variante" float in the header
// band as map controls. Selection is the only interaction here — the
// bottom drawer owns the actions.

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Variant } from '@core/versioning/variants.types';
import { IconComponent } from '@shared/icon/icon.component';

import type { VariantOverview } from '../services/variants-stats.service';
import { buildDeltaLayout, type DeltaArm } from '../utils/delta-layout';

interface RenderedArm {
  readonly arm: DeltaArm;
  readonly matches: boolean;
  readonly milestoneName: string | null;
  readonly milestoneHash: string | null;
  readonly forkHash: string | null;
  readonly headHash: string | null;
}

@Component({
  selector: 'mc-variants-delta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './variants-delta.component.html',
  styleUrl: './variants-delta.component.css',
})
export class VariantsDeltaComponent {
  private readonly i18n = inject(I18nService);

  readonly variants = input.required<readonly Variant[]>();
  readonly overviews = input.required<Record<string, VariantOverview>>();
  readonly activeId = input<string | null>(null);
  readonly selectedId = input<string | null>(null);
  readonly dormantIds = input.required<ReadonlySet<string>>();
  readonly query = input.required<string>();
  readonly justMergedId = input<string | null>(null);

  readonly pick = output<string>();

  protected readonly layout = computed(() => buildDeltaLayout(this.variants()));

  protected readonly rendered = computed<readonly RenderedArm[]>(() => {
    const q = this.query().trim().toLowerCase();
    const overviews = this.overviews();
    return this.layout().arms.map((arm) => {
      const v = arm.variant;
      const matches =
        q === '' || v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q);
      const ov = overviews[v.id];
      return {
        arm,
        matches,
        milestoneName: ov?.milestone?.name ?? null,
        milestoneHash: ov?.milestone?.oid ? ov.milestone.oid.slice(0, 7) : null,
        forkHash: v.forkOid ? v.forkOid.slice(0, 7) : null,
        headHash: ov?.head?.oid ? ov.head.oid.slice(0, 7) : null,
      };
    });
  });

  protected readonly viewBox = computed(() => {
    const { width, height } = this.layout();
    return `0 0 ${width} ${height}`;
  });

  protected readonly hasMatches = computed(() => this.rendered().some((r) => r.matches));

  protected isActive(id: string): boolean {
    return this.activeId() === id;
  }

  protected isSelected(id: string): boolean {
    return this.selectedId() === id;
  }

  protected isDormant(id: string): boolean {
    return this.dormantIds().has(id);
  }

  protected isMerging(id: string): boolean {
    return this.justMergedId() === id;
  }

  protected reedsFor(arm: DeltaArm): readonly { x: number; y: number }[] {
    const spacing = 60;
    const first = arm.startX + 40;
    const last = arm.tailX - 40;
    const out: { x: number; y: number }[] = [];
    for (let x = first; x < last; x += spacing) out.push({ x, y: arm.y });
    return out;
  }

  protected onArmKey(event: KeyboardEvent, id: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.pick.emit(id);
    }
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
