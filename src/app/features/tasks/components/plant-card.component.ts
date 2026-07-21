import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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
  readonly wateringMode = input<boolean>(false);
  readonly watered = input<boolean>(false);
  readonly lifted = input<boolean>(false);
  readonly justSprouted = input<boolean>(false);
  readonly emerging = input<boolean>(false);

  readonly open = output<string>();
  readonly transplant = output<{ id: string; bucket: Bucket }>();
  readonly harvest = output<string>();
  readonly remove = output<string>();
  readonly water = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly transplantOptions = signal<readonly { label: string; action: () => void }[]>(
    [],
  );
  protected readonly transplantMenuOpen = computed(() => this.transplantOptions().length > 0);

  constructor() {
    effect(() => {
      if (!this.transplantMenuOpen()) return;
      queueMicrotask(() =>
        this.host.nativeElement
          .querySelector<HTMLButtonElement>('.transplant-menu .menu-item')
          ?.focus(),
      );
    });
  }

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

  protected readonly canWater = computed(() => this.wateringMode() && this.stage() !== 'bloom');

  protected readonly waterAriaLabel = computed(() =>
    this.t('tasks.garden.aria.water').replace('{title}', this.displayTitle()),
  );

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
    if (event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      const order: readonly Bucket[] = ['today', 'week', 'backlog'];
      const cur = order.indexOf(this.entry().bucket);
      const next = order[cur + (event.key === 'ArrowRight' ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      this.transplant.emit({ id: this.entry().summary.id, bucket: next });
      return;
    }
    if (event.key !== 'Enter') return;
    // why: Enter abre el selector "trasplantar" (a11y vía teclado, regla doc).
    //      Si está en HOY, ofrecemos cosechar como primera opción.
    event.preventDefault();
    if (this.transplantMenuOpen()) return;
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
    this.transplantOptions.set(options);
  }

  protected onTransplantOption(option: { label: string; action: () => void }): void {
    this.transplantOptions.set([]);
    option.action();
  }

  protected closeTransplantMenu(): void {
    this.transplantOptions.set([]);
  }

  @HostListener('document:keydown.escape')
  protected onTransplantMenuEscape(): void {
    if (this.transplantMenuOpen()) this.closeTransplantMenu();
  }

  @HostListener('document:click', ['$event'])
  protected onTransplantMenuDocClick(event: MouseEvent): void {
    if (!this.transplantMenuOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.closeTransplantMenu();
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
