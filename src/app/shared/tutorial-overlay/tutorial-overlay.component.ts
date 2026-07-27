import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialStep } from '@core/tutorials/tutorial.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey, TranslationParams } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import { keyLabelsFor, matchesAction } from './tutorial-action-matching';

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
// why: a short pause between "we saw you do it" and auto-advancing so the
//      checkmark is actually readable instead of flashing past.
const ACTION_ADVANCE_DELAY_MS = 700;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// why: connector used to run center-to-center, cutting straight through both
//      boxes — this clips each end to where the center-to-center ray exits
//      its own box, so the dashed line visibly starts/ends at the nearest
//      border instead of the middle of the card/target.
const edgePoint = (
  cx: number,
  cy: number,
  halfWidth: number,
  halfHeight: number,
  towardX: number,
  towardY: number,
): { x: number; y: number } => {
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scaleX = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
};

// why: a single overlay mounted once in the app shell (like the mini-player)
//      reads whatever TutorialService says is active — features never
//      render their own overlay, they only register step definitions.
@Component({
  selector: 'mc-tutorial-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './tutorial-overlay.component.html',
  styleUrl: './tutorial-overlay.component.css',
  host: {
    '(window:resize)': 'measure()',
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

  private readonly actionDoneSignal = signal(false);
  protected readonly actionDone = this.actionDoneSignal.asReadonly();
  private actionListenerCleanup: (() => void) | null = null;

  // why: which way the user was navigating when a step's anchor turns out
  //      to be missing — measure() uses this to skip a `skipIfMissing` step
  //      in the same direction the user was already going, instead of
  //      always skipping forward. Without this, pressing "Atrás" out of a
  //      step that sits right after a skipped one just bounces back onto
  //      itself: prev() lands on the skipped step, finds no anchor, and the
  //      old unconditional `next()` here undid the very prev() the user
  //      just asked for.
  private skipDirection: 'forward' | 'backward' = 'forward';
  private lastDefinitionId: string | null = null;

  // why: scroll events don't bubble, so a bare `(window:scroll)` binding
  //      never sees scrolling inside one of this app's many internal
  //      `overflow: auto` panes — the spotlight rect (viewport-relative via
  //      getBoundingClientRect) went stale and visibly drifted from the
  //      real element. A capture-phase listener on `document` still catches
  //      scroll on any descendant, since capture propagates root-to-target
  //      regardless of bubbling.
  private readonly scrollHandler = (): void => this.measure();

  // why: expanded in-place on the step's own card, not a new step — see
  //      TutorialStep.moreDetail. Collapses whenever the step changes.
  private readonly moreDetailOpenSignal = signal(false);
  protected readonly moreDetailOpen = this.moreDetailOpenSignal.asReadonly();

  // why: the real DOM box of what to click/drag — highlighted directly
  //      (outline hugging the actual element) instead of a synthetic marker
  //      floating on top of it, so the user learns to recognize the real
  //      button/control, not a generic overlay glyph.
  private readonly actionRectSignal = signal<SpotlightRect | null>(null);
  protected readonly actionRect = this.actionRectSignal.asReadonly();
  protected readonly actionKeys = computed(() => {
    const action = this.step()?.action;
    return action ? keyLabelsFor(action) : [];
  });

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

  // why: a dashed line from the card to the exact target — the card can
  //      land anywhere around the anchor (see cardBox placement logic), so
  //      without this the eye has to guess which highlighted thing on
  //      screen the words belong to. Purely decorative (aria-hidden).
  protected readonly connector = computed<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(() => {
    const r = this.rectSignal();
    const s = this.step();
    if (!r || !s) return null;
    const ar = this.actionRectSignal();
    const targetBox = ar ?? r;
    const target = {
      cx: targetBox.left + targetBox.width / 2,
      cy: targetBox.top + targetBox.height / 2,
    };
    const box = this.cardBox();
    const placement = s.placement ?? 'bottom';
    // why: cardBox() gives the CSS top/left *before* the placement transform
    //      (translateY/X -100%) is applied — recover the visually rendered
    //      center per placement so the line starts where the card actually is.
    const cardCenter =
      placement === 'top'
        ? {
            x: clamp(box.left + CARD_WIDTH / 2, 0, window.innerWidth),
            y: box.top - CARD_HEIGHT_ESTIMATE / 2,
          }
        : placement === 'left'
          ? { x: box.left - CARD_WIDTH / 2, y: box.top + CARD_HEIGHT_ESTIMATE / 2 }
          : { x: box.left + CARD_WIDTH / 2, y: box.top + CARD_HEIGHT_ESTIMATE / 2 };
    const cardEdge = edgePoint(
      cardCenter.x,
      cardCenter.y,
      CARD_WIDTH / 2,
      CARD_HEIGHT_ESTIMATE / 2,
      target.cx,
      target.cy,
    );
    const targetEdge = edgePoint(
      target.cx,
      target.cy,
      targetBox.width / 2,
      targetBox.height / 2,
      cardCenter.x,
      cardCenter.y,
    );
    return { x1: cardEdge.x, y1: cardEdge.y, x2: targetEdge.x, y2: targetEdge.y };
  });

  constructor() {
    // why: the anchor element for a new step may render one tick after the
    //      step signal flips (e.g. behind an @if) — a microtask hop via
    //      setTimeout(0) lets that render settle before we measure it.
    effect(() => {
      const s = this.step();
      const active = this.tutorials.active();
      // why: a fresh tutorial (different id from whatever ran last) always
      //      starts by skipping forward, regardless of which direction the
      //      previous tutorial happened to leave skipDirection in.
      if (active && active.definition.id !== this.lastDefinitionId) {
        this.lastDefinitionId = active.definition.id;
        this.skipDirection = 'forward';
      }
      this.actionDoneSignal.set(false);
      this.moreDetailOpenSignal.set(false);
      this.teardownAction();
      setTimeout(() => {
        this.measure();
        if (s?.action) this.setupAction(s.action, s.anchorSelector);
      }, 0);
    });
    document.addEventListener('scroll', this.scrollHandler, true);
    inject(DestroyRef).onDestroy(() => {
      this.teardownAction();
      document.removeEventListener('scroll', this.scrollHandler, true);
    });
  }

  // why: lets a step ask the user to actually perform the gesture it
  //      describes (click/submit/shortcut) instead of only reading about
  //      it — a capture-phase document listener sees the real interaction
  //      wherever it happens, then auto-advances once it matches.
  private setupAction(action: NonNullable<TutorialStep['action']>, defaultSelector: string): void {
    const selector = action.selector ?? defaultSelector;
    const handler = (event: Event): void => {
      if (!matchesAction(action, event, selector)) return;
      this.actionDoneSignal.set(true);
      this.tutorials.beginPracticedAdvance();
      setTimeout(() => this.tutorials.next(), ACTION_ADVANCE_DELAY_MS);
    };
    document.addEventListener(action.event, handler, true);
    this.actionListenerCleanup = () => document.removeEventListener(action.event, handler, true);
  }

  private teardownAction(): void {
    this.actionListenerCleanup?.();
    this.actionListenerCleanup = null;
  }

  protected measure(): void {
    const s = this.step();
    if (!s) {
      if (this.rectSignal() !== null) this.rectSignal.set(null);
      if (this.actionRectSignal() !== null) this.actionRectSignal.set(null);
      return;
    }
    const el = document.querySelector(s.anchorSelector);
    if (!el) {
      if (this.rectSignal() !== null) this.rectSignal.set(null);
      // why: a step describing a gesture on an entity the user hasn't
      // created yet (a note, a writing, a book) has nothing to spotlight —
      // skip it instead of leaving the card floating at (0,0) (see Fase 4
      // of roadmap-26-tutoriales.md, "tarjeta flotando en la esquina").
      if (s.skipIfMissing) {
        if (this.skipDirection === 'backward') this.tutorials.prev();
        else this.tutorials.next();
        return;
      }
    } else {
      const r = el.getBoundingClientRect();
      this.rectSignal.set({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    this.measureActionRect(s);
  }

  // why: the action's target (what to actually click/drag) can be a
  //      smaller, more specific element than the spotlighted anchor (e.g.
  //      Books spotlights the whole shelf but the click that counts is
  //      the "nuevo libro" button) — measured separately so the highlight
  //      hugs that exact real element instead of the broad region.
  private measureActionRect(step: TutorialStep): void {
    const action = step.action;
    if (!action || action.event === 'keydown') {
      if (this.actionRectSignal() !== null) this.actionRectSignal.set(null);
      return;
    }
    const el = document.querySelector(action.selector ?? step.anchorSelector);
    if (!el) {
      if (this.actionRectSignal() !== null) this.actionRectSignal.set(null);
      return;
    }
    const r = el.getBoundingClientRect();
    this.actionRectSignal.set({ top: r.top, left: r.left, width: r.width, height: r.height });
  }

  // why: dots communicate step count/position wordlessly (the numeric
  //      "N/M" it replaces was the last bit of pure UI chrome text).
  protected dotRange(total: number): number[] {
    return Array.from({ length: total }, (_, i) => i + 1);
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
    this.skipDirection = 'forward';
    this.tutorials.next();
  }

  protected prev(): void {
    this.skipDirection = 'backward';
    this.tutorials.prev();
  }

  protected skip(): void {
    this.tutorials.skip();
  }

  protected toggleMoreDetail(): void {
    this.moreDetailOpenSignal.update((open) => !open);
  }
}
