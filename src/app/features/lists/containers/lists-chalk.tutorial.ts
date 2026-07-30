import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.14 (roadmap-26-tutoriales.md, re-scoped por 8.85) — "modo tiza"
//      resultó ser una superficie completa (dibujar/borrar, color/grosor,
//      undo/redo, atajos, capas, exportar, limpiar), demasiado para el
//      `moreDetail` del step `tools` de `lists.tutorial.ts` — pasa a flujo
//      propio, manual, descubrible desde el picker de "Guía de la página"
//      cuando hay más de un flujo registrado (reglas.md §4.6.15b). Los
//      atajos de teclado (`chalk-shortcuts.ts`) se registran vía
//      `ShortcutsService` con `scope: 'editable-safe'` — no son un listener
//      local del canvas, son globales de página pero inertes fuera del
//      contentEditable/inputs y sólo tienen efecto con modo tiza activo
//      (handlers no-opean si no), así que documentarlos con
//      `action: keydown` acá es seguro: no colisionan con atajos globales
//      de otra feature (B/E/[/]/1-5/Ctrl+Shift+T no están tomados en
//      ninguna otra página, confirmado contra el registro de
//      ShortcutsService).
export const LISTS_CHALK_TUTORIAL: TutorialDefinition = {
  id: 'lists-chalk',
  pageId: 'lists',
  labelKey: 'lists.tutorial.flow.chalk',
  steps: [
    // why: todos los steps siguientes viven dentro del `@if (active())` de
    //      `chalk-toolbar.component.html` — este flujo es manual (se abre
    //      desde el picker), así que no puede asumir que el usuario ya
    //      activó modo tiza. Este step no lleva `action` (a diferencia del
    //      step `toggle` de `lists.tutorial.ts`) para no arriesgar
    //      apagarlo de nuevo si ya estaba prendido; el resto de los steps
    //      de este archivo llevan `skipIfMissing: true` por la misma razón.
    {
      anchorSelector: '[data-tutorial="lists-chalk-bar"]',
      titleKey: 'lists.tutorial.chalkIntro.title',
      bodyKey: 'lists.tutorial.chalkIntro.body',
      placement: 'bottom',
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-tool-chalk"]',
      titleKey: 'lists.tutorial.chalkDraw.title',
      bodyKey: 'lists.tutorial.chalkDraw.body',
      action: { event: 'click', icon: 'paint-brush' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-tool-eraser"]',
      titleKey: 'lists.tutorial.chalkErase.title',
      bodyKey: 'lists.tutorial.chalkErase.body',
      action: { event: 'click', icon: 'x' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-palette"]',
      titleKey: 'lists.tutorial.chalkColor.title',
      bodyKey: 'lists.tutorial.chalkColor.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="lists-chalk-palette"] button',
        icon: 'palette',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-sizes"]',
      titleKey: 'lists.tutorial.chalkSize.title',
      bodyKey: 'lists.tutorial.chalkSize.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="lists-chalk-sizes"] button',
        icon: 'circle-half',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-undo"]',
      titleKey: 'lists.tutorial.chalkUndo.title',
      bodyKey: 'lists.tutorial.chalkUndo.body',
      action: { event: 'click', icon: 'arrow-counter-clockwise' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-redo"]',
      titleKey: 'lists.tutorial.chalkRedo.title',
      bodyKey: 'lists.tutorial.chalkRedo.body',
      action: { event: 'click', icon: 'arrow-counter-clockwise' },
      skipIfMissing: true,
    },
    // why: los 6 combos documentados como mención (no practicables uno por
    //      uno sin saturar el flujo, reglas.md §4.6.15b prohíbe empaquetar
    //      varios gestos en un step) salvo Ctrl+Shift+T, el único que tiene
    //      un anchor natural (el toggle) y no requiere modo tiza ya activo.
    {
      anchorSelector: '[data-tutorial="lists-chalk-bar"]',
      titleKey: 'lists.tutorial.chalkShortcuts.title',
      bodyKey: 'lists.tutorial.chalkShortcuts.body',
      action: { event: 'keydown', key: 't', ctrlOrMeta: true, shiftKey: true, icon: 'keyboard' },
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-layers-toggle"]',
      titleKey: 'lists.tutorial.chalkLayersOpen.title',
      bodyKey: 'lists.tutorial.chalkLayersOpen.body',
      action: { event: 'click', icon: 'list-bullets' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-layers-add"]',
      titleKey: 'lists.tutorial.chalkLayersAdd.title',
      bodyKey: 'lists.tutorial.chalkLayersAdd.body',
      action: { event: 'click', icon: 'plus' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-layers-panel"]',
      titleKey: 'lists.tutorial.chalkLayersManage.title',
      bodyKey: 'lists.tutorial.chalkLayersManage.body',
      skipIfMissing: true,
      moreDetail: { bodyKey: 'lists.tutorial.chalkLayersManage.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-export"]',
      titleKey: 'lists.tutorial.chalkExport.title',
      bodyKey: 'lists.tutorial.chalkExport.body',
      action: { event: 'click', icon: 'download-simple' },
      skipIfMissing: true,
    },
    // why: destructivo (vacía todos los trazos de la capa activa, confirm
    //      dialog danger de por medio) — tier avanzado, no forma parte de
    //      un primer uso normal del tablero. Sin `action`: el botón queda
    //      deshabilitado (`canClear`) hasta que la capa activa tenga
    //      trazos, y forzar el click abriría el confirm dialog danger sin
    //      forma de que el usuario lo cancele desde el tutorial mismo.
    {
      anchorSelector: '[data-tutorial="lists-chalk-clear"]',
      titleKey: 'lists.tutorial.chalkClear.title',
      bodyKey: 'lists.tutorial.chalkClear.body',
      tier: 'avanzado',
      skipIfMissing: true,
      moreDetail: { bodyKey: 'lists.tutorial.chalkClear.moreDetail' },
    },
  ],
};

export function registerListsChalkTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(LISTS_CHALK_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
