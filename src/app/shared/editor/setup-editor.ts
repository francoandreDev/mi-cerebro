// 13f — Editor instantiation extracted from EditorComponent. Keeps the
// component focused on UI/state wiring; the TipTap setup (extensions,
// callbacks, image-ref node, comment clouds, draft decorations) lives
// here as a pure factory.

import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import type { ImageReaderService } from '@core/images/image-reader.service';
import { createBlockIdExtension } from '@core/tiptap/block-id/block-id.ext';
import { createCommentCloudsExtension } from '@core/tiptap/comment-clouds/comment-clouds.ext';
import { createDraftDecorationsExtension } from '@core/tiptap/draft-decorations/draft-decorations.ext';
import { createImageRefNode } from '@core/tiptap/image-ref/image-ref.node';

export interface SetupEditorContext {
  readonly element: HTMLElement;
  readonly reader: ImageReaderService;
  readonly initialContent: JSONContent;
  readonly editable: boolean;
  readonly onCloudClick: (commentId: string) => void;
  readonly cloudAriaLabel: () => string;
  readonly onUpdate: (editor: Editor) => void;
  readonly onSelectionUpdate: (editor: Editor) => void;
}

export const createEditorInstance = (ctx: SetupEditorContext): Editor =>
  new Editor({
    element: ctx.element,
    extensions: [
      StarterKit,
      createBlockIdExtension(),
      createImageRefNode(ctx.reader),
      createDraftDecorationsExtension(),
      createCommentCloudsExtension({
        onClick: ctx.onCloudClick,
        ariaLabel: ctx.cloudAriaLabel,
      }),
    ],
    content: ctx.initialContent,
    editable: ctx.editable,
    onUpdate: ({ editor }) => ctx.onUpdate(editor),
    onSelectionUpdate: ({ editor }) => ctx.onSelectionUpdate(editor),
  });

export const jsonEquals = (a: JSONContent, b: JSONContent): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
