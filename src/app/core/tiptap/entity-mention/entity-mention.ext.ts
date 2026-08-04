import { Extension, InputRule } from '@tiptap/core';

export const ENTITY_MENTION_NAME = 'entityMention';

export interface EntityMentionRange {
  readonly from: number;
  readonly to: number;
}

// why: alternate trigger for the same "Vincular a…" flow (§10bis) — typing
//      "@" at the start of a word opens mc-entity-link-picker-dialog instead
//      of requiring the toolbar button. Deliberately not built on
//      @tiptap/suggestion (the usual mention-extension foundation): that
//      package tracks a live-growing query and an inline floating list,
//      neither of which this needs — the picker is the same centered modal
//      as the button flow and steals focus the instant it opens (see
//      mcAutofocus on its search input), so no further characters ever
//      reach the editor after "@". The handler leaves the "@" in the doc as
//      plain text; onTrigger's range covers only that one character, so a
//      picked entity replaces just the "@" (insertContentAt in
//      EditorComponent.onEntityLinked) — dismissing without picking leaves
//      "@" as ordinary text, same as any other unconsumed keystroke.
export const createEntityMentionExtension = (onTrigger: (range: EntityMentionRange) => void) =>
  Extension.create({
    name: ENTITY_MENTION_NAME,
    addInputRules() {
      return [
        new InputRule({
          // why: (?:^|\s) requires "@" at the start of the block or after
          //      whitespace, so "user@host" typed inline never triggers.
          find: /(?:^|\s)@$/,
          handler: ({ range }) => {
            onTrigger({ from: range.to - 1, to: range.to });
          },
        }),
      ];
    },
  });
