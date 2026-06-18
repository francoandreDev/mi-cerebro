import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { TrashKind, TrashPreview } from '@core/trash/trash.types';

interface ContentState {
  readonly status: 'loading' | 'ready' | 'missing';
  readonly preview: TrashPreview | null;
}

@Component({
  selector: 'mc-trash-card-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trash-card-content.component.html',
  styleUrl: './trash-card-content.component.css',
})
export class TrashCardContentComponent {
  readonly kind = input.required<TrashKind>();
  readonly title = input.required<string>();
  readonly state = input.required<ContentState>();

  private readonly i18n = inject(I18nService);

  protected readonly bookInitial = computed<string>(() => {
    const t = this.title().trim();
    return t.length > 0 ? t[0]!.toUpperCase() : '·';
  });

  protected readonly galleryCount = computed<number>(() => {
    const p = this.state().preview;
    if (!p) return 0;
    const fact = p.facts.find((f) => f.labelKey === 'trash.preview.images');
    return fact ? Number(fact.value) || 0 : 0;
  });

  protected readonly galleryLabel = computed<string>(() => {
    const n = this.galleryCount();
    if (n === 1) return this.t('trash.galleryImages.one');
    return this.t('trash.galleryImages.many').replace('{n}', String(n));
  });

  protected readonly listItems = computed<readonly string[]>(() => {
    const p = this.state().preview;
    if (!p?.excerpt) return [];
    return p.excerpt
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 5);
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected factValue(value: string): string {
    if (value.startsWith('trash.preview.status.')) return this.t(value as TranslationKey);
    return value;
  }

  protected factLabel(key: string): string {
    return this.t(key as TranslationKey);
  }
}
