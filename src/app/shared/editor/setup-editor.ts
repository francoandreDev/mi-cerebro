// 13f — Editor instantiation extracted from EditorComponent. Keeps the
// component focused on UI/state wiring; the TipTap setup (extensions,
// callbacks, image-ref node, comment clouds, draft decorations) lives
// here as a pure factory.

import { Editor, type JSONContent } from '@tiptap/core';
import { Heading } from '@tiptap/extension-heading';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { BulletList, OrderedList } from '@tiptap/extension-list';
import StarterKit from '@tiptap/starter-kit';

import type { ImageReaderService } from '@core/images/image-reader.service';
import { createBlockIdExtension } from '@core/tiptap/block-id/block-id.ext';
import { createBookmarkPinExtension } from '@core/tiptap/bookmark-pin/bookmark-pin.ext';
import {
  Citation,
  createCitationAttribution,
  type CitationAttributionPlaceholders,
} from '@core/tiptap/citation/citation.ext';
import { createCommentCloudsExtension } from '@core/tiptap/comment-clouds/comment-clouds.ext';
import {
  createCommentRangeMappingExtension,
  type CommentRangeUpdate,
} from '@core/tiptap/comment-range-mapping/comment-range-mapping.ext';
import { createDraftDecorationsExtension } from '@core/tiptap/draft-decorations/draft-decorations.ext';
import {
  createEntityRefNode,
  type EntityRefOpenPayload,
} from '@core/tiptap/entity-ref/entity-ref.node';
import { createHighlightExtension } from '@core/tiptap/highlight/highlight.ext';
import { createImageRefNode } from '@core/tiptap/image-ref/image-ref.node';
import { createTtsHighlightExtension } from '@core/tiptap/tts-highlight/tts-highlight.ext';
import { createTypewriterFocusExtension } from '@core/tiptap/typewriter-focus/typewriter-focus.ext';
import type { Comment } from '@core/versioning/comments.types';

// why: StarterKit's bullet/ordered list nodes ship a hardcoded
//      wrappingInputRule that turns "- "/"* "/"+ "/"1. " typed at the start
//      of a line into a list, with no config flag to opt out (only `false`,
//      which also drops the toggle command and keyboard shortcut). Per
//      "cero fricción de sintaxis" (docs/proyecto/index.md §1) list creation should be
//      an explicit action (toolbar/shortcut), not an ambush on the user's
//      literal "-"/"*"/"+" — so the two nodes are re-added with their
//      addInputRules stripped, keeping commands and Mod-Shift-8/7 intact.
export const BulletListNoAutoconvert = BulletList.extend({ addInputRules: () => [] });
export const OrderedListNoAutoconvert = OrderedList.extend({ addInputRules: () => [] });
// why: same ambush as the lists above — "---", "—-", "___ ", "*** " typed
//      at line start silently swap the line for a scene-break rule.
export const HorizontalRuleNoAutoconvert = HorizontalRule.extend({ addInputRules: () => [] });
// why: same ambush — "# "/"## " typed at line start silently swaps the
//      line for a heading. Toggle command and Mod-Alt-2..4 stay intact.
//      Levels capped at 2-4: the chapter title (books) / entity title
//      already reads as the de-facto H1, so exposing H1 here would let
//      users create a second, competing "biggest" heading inside the body.
export const HeadingNoAutoconvert = Heading.extend({ addInputRules: () => [] }).configure({
  levels: [2, 3, 4],
});
// why: citations are a purpose-built node (see citation.ext.ts), not
//      StarterKit's generic blockquote — they never had an input rule to
//      strip, and get quote-mark/attribution styling the plain blockquote
//      didn't have.

export interface SetupEditorContext {
  readonly element: HTMLElement;
  readonly reader: ImageReaderService;
  readonly initialContent: JSONContent;
  readonly editable: boolean;
  readonly citationAttributionPlaceholders: CitationAttributionPlaceholders;
  readonly onCloudClick: (commentId: string) => void;
  readonly cloudAriaLabel: () => string;
  readonly onDraftInsertClick: (markId: string) => void;
  readonly draftInsertAriaLabel: () => string;
  readonly onUpdate: (editor: Editor) => void;
  readonly onSelectionUpdate: (editor: Editor) => void;
  readonly getComments: () => readonly Comment[];
  readonly onRangesMapped: (updates: readonly CommentRangeUpdate[]) => void;
  readonly isBookmarkable: () => boolean;
  readonly onBookmarkToggle: (blockId: string) => void;
  readonly bookmarkPinAriaLabel: () => string;
  readonly bookmarkMarkerAriaLabel: () => string;
  readonly onEntityRefOpen: (payload: EntityRefOpenPayload) => void;
}

export const createEditorInstance = (ctx: SetupEditorContext): Editor =>
  new Editor({
    element: ctx.element,
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
        heading: false,
        blockquote: false,
      }),
      BulletListNoAutoconvert,
      OrderedListNoAutoconvert,
      HorizontalRuleNoAutoconvert,
      HeadingNoAutoconvert,
      Citation,
      createCitationAttribution(ctx.citationAttributionPlaceholders),
      createHighlightExtension(),
      createBlockIdExtension(),
      createTtsHighlightExtension(),
      createTypewriterFocusExtension(),
      createImageRefNode(ctx.reader),
      createEntityRefNode(ctx.onEntityRefOpen),
      createDraftDecorationsExtension({
        onClick: ctx.onDraftInsertClick,
        ariaLabel: ctx.draftInsertAriaLabel,
      }),
      createCommentCloudsExtension({
        onClick: ctx.onCloudClick,
        ariaLabel: ctx.cloudAriaLabel,
      }),
      createCommentRangeMappingExtension({
        getComments: ctx.getComments,
        onRangesMapped: ctx.onRangesMapped,
      }),
      createBookmarkPinExtension({
        isBookmarkable: ctx.isBookmarkable,
        onToggle: ctx.onBookmarkToggle,
        pinAriaLabel: ctx.bookmarkPinAriaLabel,
        markerAriaLabel: ctx.bookmarkMarkerAriaLabel,
      }),
    ],
    content: ctx.initialContent,
    editable: ctx.editable,
    onUpdate: ({ editor }) => ctx.onUpdate(editor),
    onSelectionUpdate: ({ editor }) => ctx.onSelectionUpdate(editor),
  });

export const jsonEquals = (a: JSONContent, b: JSONContent): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
