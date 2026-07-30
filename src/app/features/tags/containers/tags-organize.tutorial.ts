import type { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: split of the old single `rowActions` step (§8.13, §4.6.15b — one
//      gesture per step) into its own flow instead of loose steps in the
//      essential one: these anchors only exist once a tag row exists, so
//      folding them into `tags` would make that flow impossible to finish
//      on an empty workspace. Registered/disposed conditionally by
//      `TagsContainer` (see the `effect` in tags.container.ts), not
//      self-managed via DestroyRef like a regular flow — the container
//      needs to control the exact moment it un-registers too.
export const TAGS_ORGANIZE_TUTORIAL: TutorialDefinition = {
  id: 'tags-organize',
  pageId: 'tags',
  labelKey: 'tags.tutorial.flow.organize',
  steps: [
    {
      anchorSelector: '[data-tutorial="tags-row-dot"]',
      titleKey: 'tags.tutorial.organize.recolor.title',
      bodyKey: 'tags.tutorial.organize.recolor.body',
      action: { event: 'click', icon: 'palette' },
    },
    {
      anchorSelector: '[data-tutorial="tags-row-rename"]',
      titleKey: 'tags.tutorial.organize.rename.title',
      bodyKey: 'tags.tutorial.organize.rename.body',
      action: { event: 'click', icon: 'pencil-simple' },
    },
    {
      anchorSelector: '[data-tutorial="tags-row-merge"]',
      titleKey: 'tags.tutorial.organize.merge.title',
      bodyKey: 'tags.tutorial.organize.merge.body',
      action: { event: 'click' },
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="tags-row-delete"]',
      titleKey: 'tags.tutorial.organize.delete.title',
      bodyKey: 'tags.tutorial.organize.delete.body',
      action: { event: 'click', icon: 'trash' },
      tier: 'avanzado',
    },
  ],
};

export function registerTagsOrganizeTutorial(tutorials: TutorialService): () => void {
  return tutorials.register(TAGS_ORGANIZE_TUTORIAL, { autoStartIfUnseen: false });
}
