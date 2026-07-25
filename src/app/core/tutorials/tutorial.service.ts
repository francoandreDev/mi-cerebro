import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { hasSeenTutorial, markTutorialSeen } from './tutorial-storage';
import type { TutorialActiveState, TutorialDefinition, TutorialStep } from './tutorial.types';

export interface RegisterTutorialOptions {
  /** Auto-starts the tutorial the first time it registers if it was never seen. */
  readonly autoStartIfUnseen?: boolean;
}

// why: same register()/disposer shape as ShortcutsService — a feature
//      container registers its definition in the constructor and tears it
//      down via DestroyRef, so the registry never outlives the page.
@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly router = inject(Router);

  private readonly definitionsSignal = signal<readonly TutorialDefinition[]>([]);
  private readonly activeSignal = signal<TutorialActiveState | null>(null);
  // why: a practiced action (e.g. clicking a real note card) can itself
  // trigger real app navigation that destroys the page component the
  // active tutorial was registered from — before the delayed next() call
  // (see ACTION_ADVANCE_DELAY_MS in tutorial-overlay.component.ts) has run.
  // Without this flag, register()'s disposer would null activeSignal as if
  // the user had abandoned the tutorial by navigating away unrelatedly.
  private practicedAdvancePending = false;

  readonly active = this.activeSignal.asReadonly();

  readonly currentStep = computed<TutorialStep | null>(() => {
    const state = this.activeSignal();
    if (!state) return null;
    return state.definition.steps[state.stepIndex] ?? null;
  });

  readonly stepPosition = computed<{ current: number; total: number } | null>(() => {
    const state = this.activeSignal();
    if (!state) return null;
    return { current: state.stepIndex + 1, total: state.definition.steps.length };
  });

  hasTutorialFor(pageId: string): boolean {
    return this.definitionsSignal().some((d) => d.id === pageId);
  }

  register(definition: TutorialDefinition, options?: RegisterTutorialOptions): () => void {
    this.definitionsSignal.update((list) => [...list, definition]);
    // why: a page's own auto-start must not steal the overlay from a
    //      cross-page flow that's mid-navigation through that same page.
    if (options?.autoStartIfUnseen && !hasSeenTutorial(definition.id) && !this.activeSignal()) {
      this.start(definition.id, 'auto');
    }
    return () => {
      this.definitionsSignal.update((list) => list.filter((d) => d !== definition));
      // why: mode: 'auto' starts a filtered clone of the definition (see
      //      start()), so comparing by reference always fails here — compare
      //      by id instead.
      if (this.activeSignal()?.definition.id !== definition.id) return;
      if (this.practicedAdvancePending) return;
      this.activeSignal.set(null);
    };
  }

  /** Marks that a step's action just matched and next() is about to run — see practicedAdvancePending. */
  beginPracticedAdvance(): void {
    this.practicedAdvancePending = true;
  }

  /**
   * `mode: 'auto'` (used internally when `autoStartIfUnseen` triggers) runs
   * only `tier !== 'avanzado'` steps. `mode: 'manual'` (default — the ✨
   * "Guía de la página" button and cross-page flows) runs the full sequence,
   * básico + avanzado, in original order.
   */
  start(id: string, mode: 'auto' | 'manual' = 'manual'): void {
    const definition = this.definitionsSignal().find((d) => d.id === id);
    if (!definition || definition.steps.length === 0) return;
    const effective: TutorialDefinition =
      mode === 'auto'
        ? { ...definition, steps: definition.steps.filter((s) => s.tier !== 'avanzado') }
        : definition;
    if (effective.steps.length === 0) return;
    void this.goToStep(effective, 0);
  }

  next(): void {
    this.practicedAdvancePending = false;
    const state = this.activeSignal();
    if (!state) return;
    if (state.stepIndex + 1 >= state.definition.steps.length) {
      this.finish();
      return;
    }
    void this.goToStep(state.definition, state.stepIndex + 1);
  }

  prev(): void {
    const state = this.activeSignal();
    if (!state || state.stepIndex === 0) return;
    void this.goToStep(state.definition, state.stepIndex - 1);
  }

  skip(): void {
    const state = this.activeSignal();
    if (!state) return;
    markTutorialSeen(state.definition.id);
    this.activeSignal.set(null);
  }

  finish(): void {
    const state = this.activeSignal();
    if (!state) return;
    markTutorialSeen(state.definition.id);
    this.activeSignal.set(null);
  }

  // why: cross-page flow steps carry a `route` — navigate there first so
  //      the overlay measures the anchor on the page it actually lives on.
  //      Single-page tutorial steps omit `route` and this is a no-op.
  private async goToStep(definition: TutorialDefinition, index: number): Promise<void> {
    const step = definition.steps[index];
    if (step?.route && !this.router.url.startsWith(step.route)) {
      await this.router.navigateByUrl(step.route);
    }
    this.activeSignal.set({ definition, stepIndex: index });
  }
}
