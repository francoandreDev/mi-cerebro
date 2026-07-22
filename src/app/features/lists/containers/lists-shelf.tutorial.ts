import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: home.entity.lists.step.{1,2} describe the shelf (creating a list,
//      opening it) while step.{3,4} describe modo-tiza inside the detail
//      page (already covered by lists.tutorial.ts, /lists/:id). Same `id`
//      as the detail tutorial on purpose — shelf and detail never mount at
//      the same time, so there's no runtime collision, and the "Guía de la
//      página" control shows the right one for whichever is live.
export const LISTS_SHELF_TUTORIAL: TutorialDefinition = {
  id: 'lists',
  steps: [
    {
      anchorSelector: '[data-tutorial="lists-shelf-new"]',
      titleKey: 'tree.type.lists',
      bodyKey: 'home.entity.lists.step.1',
    },
    {
      anchorSelector: '[data-tutorial="lists-shelf-rail"]',
      titleKey: 'tree.type.lists',
      bodyKey: 'home.entity.lists.step.2',
    },
  ],
};

export function registerListsShelfTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(LISTS_SHELF_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
