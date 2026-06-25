import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';

import type { Bucket, BucketedTask } from '../services/task-buckets';
import { PLANT_GLYPHS, type PlantStage } from './plant-glyphs';

@Component({
  selector: 'mc-plant-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plant-card.component.html',
  styleUrl: './plant-card.component.css',
})
export class PlantCardComponent {
  readonly entry = input.required<BucketedTask>();
  readonly stage = input.required<PlantStage>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly wiltDays = input<number>(0);

  readonly open = output<string>();
  readonly transplant = output<{ id: string; bucket: Bucket }>();
  readonly harvest = output<string>();
  readonly remove = output<string>();
  readonly water = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly displayTitle = computed(
    () => this.entry().summary.title || this.untitledLabel(),
  );

  protected readonly primaryTag = computed<Tag | null>(() => {
    const tags = this.availableTags();
    const id = this.entry().summary.tags[0];
    if (id === undefined) return null;
    return tags.find((t) => t.id === id) ?? null;
  });

  protected readonly wilting = computed(() => this.stage() === 'bloom' && this.wiltDays() >= 1);

  protected readonly glyph = computed<SafeHtml>(() => {
    const key = this.wilting() ? 'wilted' : this.stage();
    return this.sanitizer.bypassSecurityTrustHtml(PLANT_GLYPHS[key]);
  });

  protected readonly petalColor = computed(() => {
    const tag = this.primaryTag();
    if (!tag) return 'var(--mc-garden-petal-default)';
    return `color-mix(in srgb, ${tag.color} 80%, white)`;
  });

  protected readonly ariaLabel = computed(() => {
    const base = this.t('tasks.garden.aria.open').replace('{title}', this.displayTitle());
    if (!this.wilting()) return base;
    return `${base} · ${this.t('tasks.garden.aria.wilting')
      .replace('{title}', this.displayTitle())
      .replace('{days}', String(this.wiltDays()))}`;
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onClick(): void {
    this.open.emit(this.entry().summary.id);
  }

  protected onTransplantKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    // why: Enter abre el selector "trasplantar" (a11y vía teclado, regla doc).
    //      Si está en HOY, ofrecemos cosechar como primera opción.
    event.preventDefault();
    const id = this.entry().summary.id;
    const bucket = this.entry().bucket;
    const options: { label: string; action: () => void }[] = [];
    if (bucket !== 'today') {
      options.push({
        label: this.t('tasks.garden.planterToday'),
        action: () => this.transplant.emit({ id, bucket: 'today' }),
      });
    }
    if (bucket !== 'week') {
      options.push({
        label: this.t('tasks.garden.planterWeek'),
        action: () => this.transplant.emit({ id, bucket: 'week' }),
      });
    }
    if (bucket !== 'backlog') {
      options.push({
        label: this.t('tasks.garden.planterBacklog'),
        action: () => this.transplant.emit({ id, bucket: 'backlog' }),
      });
    }
    options.push({
      label: this.t('tasks.garden.harvestAction'),
      action: () => this.harvest.emit(id),
    });
    const prompt = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    const raw = window.prompt(this.t('tasks.garden.transplantPrompt') + '\n' + prompt, '1');
    const choice = Number(raw);
    if (!Number.isInteger(choice) || choice < 1 || choice > options.length) return;
    options[choice - 1]!.action();
  }

  protected onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.entry().summary.id);
  }

  protected onWaterClick(event: MouseEvent): void {
    event.stopPropagation();
    this.water.emit(this.entry().summary.id);
  }
}
