// 13f — Editor instantiation extracted from EditorComponent. Keeps the
// component focused on UI/state wiring; the TipTap setup (extensions,
// callbacks, image-ref node, comment clouds, draft decorations) lives
// here as a pure factory.

import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import type { ImageReaderService } from '@core/images/image-reader.service';
import { createBlockIdExtension } from '@core/tiptap/block-id/block-id.ext';
import { createCommentCloudsExtension } from '@core/tiptap/comment-clouds/comment-clouds.ext';
import {
  createCommentRangeMappingExtension,
  type CommentRangeUpdate,
} from '@core/tiptap/comment-range-mapping/comment-range-mapping.ext';
import { createDraftDecorationsExtension } from '@core/tiptap/draft-decorations/draft-decorations.ext';
import { createHighlightExtension } from '@core/tiptap/highlight/highlight.ext';
import { createImageRefNode } from '@core/tiptap/image-ref/image-ref.node';
import type { Comment } from '@core/versioning/comments.types';

export interface SetupEditorContext {
  readonly element: HTMLElement;
  readonly reader: ImageReaderService;
  readonly initialContent: JSONContent;
  readonly editable: boolean;
  readonly onCloudClick: (commentId: string) => void;
  readonly cloudAriaLabel: () => string;
  readonly onUpdate: (editor: Editor) => void;
  readonly onSelectionUpdate: (editor: Editor) => void;
  readonly getComments: () => readonly Comment[];
  readonly onRangesMapped: (updates: readonly CommentRangeUpdate[]) => void;
}

export const createEditorInstance = (ctx: SetupEditorContext): Editor =>
  new Editor({
    element: ctx.element,
    extensions: [
      StarterKit,
      createHighlightExtension(),
      createBlockIdExtension(),
      createImageRefNode(ctx.reader),
      createDraftDecorationsExtension(),
      createCommentCloudsExtension({
        onClick: ctx.onCloudClick,
        ariaLabel: ctx.cloudAriaLabel,
      }),
      createCommentRangeMappingExtension({
        getComments: ctx.getComments,
        onRangesMapped: ctx.onRangesMapped,
      }),
    ],
    content: ctx.initialContent,
    editable: ctx.editable,
    onUpdate: ({ editor }) => ctx.onUpdate(editor),
    onSelectionUpdate: ({ editor }) => ctx.onSelectionUpdate(editor),
  });

export const jsonEquals = (a: JSONContent, b: JSONContent): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
