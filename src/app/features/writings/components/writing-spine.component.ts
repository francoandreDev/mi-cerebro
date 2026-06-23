import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { WritingSummary } from '../models/writing.types';

const THICKNESS_TIERS = [
  { max: 250, width: 40 },
  { max: 1500, width: 55 },
  { max: 6000, width: 70 },
  { max: Infinity, width: 88 },
] as const;

const hashHue = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
};

@Component({
  selector: 'mc-writing-spine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="spine"
      [style.--spine-width.px]="thickness()"
      [style.--spine-hue]="hue()"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(writing().id)"
    >
      <span class="title">{{ displayTitle() }}</span>
      <span class="foot" aria-hidden="true">
        <span class="dot"></span>
      </span>
    </button>
  `,
  styles: `
    :host {
      display: inline-block;
      scroll-snap-align: start;
    }
    .spine {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      width: var(--spine-width, 60px);
      height: 240px;
      padding: var(--mc-space-3) 4px var(--mc-space-2);
      border: 1px solid
        color-mix(in srgb, hsl(var(--spine-hue, 200) 35% 35%) 35%, var(--mc-border-default));
      border-radius: 4px;
      background: linear-gradient(
        90deg,
        hsl(var(--spine-hue, 200) 30% 28%) 0%,
        hsl(var(--spine-hue, 200) 35% 36%) 18%,
        hsl(var(--spine-hue, 200) 32% 32%) 50%,
        hsl(var(--spine-hue, 200) 35% 36%) 82%,
        hsl(var(--spine-hue, 200) 30% 28%) 100%
      );
      color: hsl(var(--spine-hue, 200) 25% 92%);
      cursor: pointer;
      transition:
        transform 140ms ease,
        box-shadow 140ms ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
    }
    .spine:hover {
      transform: translateY(-6px);
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28);
    }
    .spine:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: 3px;
    }
    .title {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-family: var(--mc-font-serif, Georgia, 'Times New Roman', serif);
      font-weight: 600;
      font-size: clamp(0.85rem, 1vw, 1rem);
      letter-spacing: 0.02em;
      line-height: 1.1;
      overflow: hidden;
      max-height: 180px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .foot {
      display: flex;
      justify-content: center;
      width: 100%;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: hsl(var(--spine-hue, 200) 50% 70%);
      opacity: 0.7;
    }
  `,
})
export class WritingSpineComponent {
  readonly writing = input.required<WritingSummary>();
  readonly untitledLabel = input.required<string>();
  readonly open = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly displayTitle = computed(() => this.writing().title || this.untitledLabel());
  protected readonly thickness = computed(() => {
    const n = this.writing().wordCount;
    for (const tier of THICKNESS_TIERS) if (n <= tier.max) return tier.width;
    return 60;
  });
  protected readonly hue = computed(() => hashHue(this.writing().id));
  protected readonly ariaOpen = computed(() =>
    this.t('writings.shelf.openAria').replace('{title}', this.displayTitle()),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
