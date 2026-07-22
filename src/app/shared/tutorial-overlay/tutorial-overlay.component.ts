import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey, TranslationParams } from '@core/i18n/i18n.types';

interface SpotlightRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const CARD_GAP = 12;
const CARD_WIDTH = 320;
// why: content length varies per step, so this is a heuristic ceiling for
//      clamping — not the real rendered height. Good enough to keep the
//      card's action buttons on-screen when the anchor is a large region
//      (e.g. an entire canvas) rather than a small control.
const CARD_HEIGHT_ESTIMATE = 220;
const VIEWPORT_MARGIN = 12;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// why: a single overlay mounted once in the app shell (like the mini-player)
//      reads whatever TutorialService says is active — features never
//      render their own overlay, they only register step definitions.
@Component({
  selector: 'mc-tutorial-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutorial-overlay.component.html',
  styleUrl: './tutorial-overlay.component.css',
  host: {
    '(window:resize)': 'measure()',
    '(window:scroll)': 'measure()',
    '(document:keydown)': 'onKey($event)',
  },
})
export class TutorialOverlayComponent {
  private readonly tutorials = inject(TutorialService);
  private readonly i18n = inject(I18nService);

  protected readonly step = this.tutorials.currentStep;
  protected readonly position = this.tutorials.stepPosition;

  private readonly rectSignal = signal<SpotlightRect | null>(null);
  protected readonly rect = this.rectSignal.asReadonly();

  private readonly cardBox = computed<{ left: number; top: number; transform: string }>(() => {
    const r = this.rectSignal();
    const s = this.step();
    if (!r || !s) return { left: 0, top: 0, transform: 'none' };
    const placement = s.placement ?? 'bottom';
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN);
    const maxTop = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - CARD_HEIGHT_ESTIMATE - VIEWPORT_MARGIN,
    );
    if (placement === 'top') {
      return {
        left: clamp(r.left, VIEWPORT_MARGIN, maxLeft),
        top: clamp(r.top - CARD_GAP, VIEWPORT_MARGIN + CARD_HEIGHT_ESTIMATE, window.innerHeight),
        transform: 'translateY(-100%)',
      };
    }
    if (placement === 'left') {
      return {
        left: r.left - CARD_GAP,
        top: clamp(r.top, VIEWPORT_MARGIN, maxTop),
        transform: 'translateX(-100%)',
      };
    }
    if (placement === 'right') {
      return {
        left: clamp(r.left + r.width + CARD_GAP, VIEWPORT_MARGIN, maxLeft),
        top: clamp(r.top, VIEWPORT_MARGIN, maxTop),
        transform: 'none',
      };
    }
    return {
      left: clamp(r.left, VIEWPORT_MARGIN, maxLeft),
      top: clamp(r.top + r.height + CARD_GAP, VIEWPORT_MARGIN, maxTop),
      transform: 'none',
    };
  });

  protected readonly cardLeft = computed(() => this.cardBox().left);
  protected readonly cardTop = computed(() => this.cardBox().top);
  protected readonly cardTransform = computed(() => this.cardBox().transform);

  constructor() {
    // why: the anchor element for a new step may render one tick after the
    //      step signal flips (e.g. behind an @if) — a microtask hop via
    //      setTimeout(0) lets that render settle before we measure it.
    effect(() => {
      this.step();
      setTimeout(() => this.measure(), 0);
    });
  }

  protected measure(): void {
    const s = this.step();
    if (!s) {
      if (this.rectSignal() !== null) this.rectSignal.set(null);
      return;
    }
    const el = document.querySelector(s.anchorSelector);
    if (!el) {
      if (this.rectSignal() !== null) this.rectSignal.set(null);
      return;
    }
    const r = el.getBoundingClientRect();
    this.rectSignal.set({ top: r.top, left: r.left, width: r.width, height: r.height });
  }

  protected t(key: TranslationKey, params?: TranslationParams): string {
    return this.i18n.t(key, params);
  }

  protected onKey(event: KeyboardEvent): void {
    if (!this.step()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.tutorials.skip();
    }
  }

  protected next(): void {
    this.tutorials.next();
  }

  protected prev(): void {
    this.tutorials.prev();
  }

  protected skip(): void {
    this.tutorials.skip();
  }
}
