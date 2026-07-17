import type { JSONContent } from '@tiptap/core';

// why: given the imageRef node's galleryId/imageId, returns a `data:` URI to
//      embed inline (or undefined to fall back to an empty `![alt]()`).
//      Resolving requires disk I/O (ImageReaderService), so it happens async
//      *before* this sync converter runs — see buildImageResolver in
//      features/books/services/book-export.util.ts.
export type MarkdownImageResolver = (
  galleryId: string | null,
  imageId: string | null,
) => string | undefined;

const noResolver: MarkdownImageResolver = () => undefined;

interface RenderCtx {
  readonly headingOffset: number;
  readonly resolveImage: MarkdownImageResolver;
}

// why: scoped to the node/mark types this editor actually produces (see
//      shared/editor/setup-editor.ts) — not a general-purpose ProseMirror
//      renderer for arbitrary TipTap docs.
//      `headingOffset` lets callers nest a chapter's own headings under a
//      structural title they're prepending themselves (see bookToMarkdown in
//      features/books/services/book-export.util.ts): the editor caps
//      headings at level 2-4 because the chapter title already reads as the
//      de-facto H1 (setup-editor.ts) — fine when a chapter is exported on
//      its own, but when several chapters are concatenated under book/chapter
//      titles rendered as H1/H2, the chapter's internal level-2 headings
//      would otherwise collide with that H2 instead of nesting under it.
export const tiptapToMarkdown = (
  doc: JSONContent,
  headingOffset = 0,
  resolveImage: MarkdownImageResolver = noResolver,
): string => {
  const ctx: RenderCtx = { headingOffset, resolveImage };
  return (doc.content ?? [])
    .map((node) => renderBlock(node, 0, ctx))
    .filter((b) => b !== '')
    .join('\n\n');
};

const renderBlock = (node: JSONContent, depth: number, ctx: RenderCtx): string => {
  switch (node.type) {
    case 'paragraph':
      return renderInline(node.content, false, ctx);
    case 'heading': {
      const level = Math.min(
        6,
        Math.max(1, Number(node.attrs?.['level'] ?? 2) + ctx.headingOffset),
      );
      return `${'#'.repeat(level)} ${renderInline(node.content, false, ctx)}`;
    }
    case 'codeBlock':
      return '```\n' + renderInline(node.content, true, ctx) + '\n```';
    case 'horizontalRule':
      return '---';
    case 'bulletList':
      return renderList(node, false, depth, ctx);
    case 'orderedList':
      return renderList(node, true, depth, ctx);
    case 'citation':
      return renderCitation(node, ctx);
    default:
      return renderInline(node.content, false, ctx);
  }
};

const renderInline = (content: JSONContent[] | undefined, plain: boolean, ctx: RenderCtx): string =>
  (content ?? []).map((n) => renderInlineNode(n, plain, ctx)).join('');

const renderInlineNode = (node: JSONContent, plain: boolean, ctx: RenderCtx): string => {
  if (node.type === 'hardBreak') return '\n';
  // why: imageRef is an inline atom node (image-ref.node.ts — group: 'inline'),
  //      so it shows up as a child of a paragraph's content, never as a
  //      top-level block in doc.content.
  if (node.type === 'imageRef') {
    const alt = String(node.attrs?.['alt'] ?? '');
    const galleryId = (node.attrs?.['galleryId'] as string | null) ?? null;
    const imageId = (node.attrs?.['imageId'] as string | null) ?? null;
    const src = ctx.resolveImage(galleryId, imageId) ?? '';
    return `![${alt}](${src})`;
  }
  if (typeof node.text !== 'string') return '';
  return plain ? node.text : applyMarks(node.text, node.marks);
};

const MARK_WRAP: Record<string, string> = {
  bold: '**',
  italic: '_',
  strike: '~~',
  code: '`',
  highlight: '==',
};

const applyMarks = (text: string, marks?: JSONContent['marks']): string =>
  (marks ?? []).reduce((out, mark) => {
    const wrap = MARK_WRAP[mark.type];
    return wrap ? `${wrap}${out}${wrap}` : out;
  }, text);

const renderCitation = (node: JSONContent, ctx: RenderCtx): string => {
  const content = node.content ?? [];
  const last = content[content.length - 1];
  const hasAttribution = last?.type === 'citationAttribution';
  const paragraphs = hasAttribution ? content.slice(0, -1) : content;
  const lines = paragraphs
    .map((p) => renderBlock(p, 0, ctx))
    .join('\n')
    .split('\n')
    .map((line) => `> ${line}`.trimEnd());
  if (hasAttribution && last) lines.push(`>`, `> — ${renderAttribution(last)}`);
  return lines.join('\n');
};

const renderAttribution = (node: JSONContent): string => {
  const author = String(node.attrs?.['author'] ?? '');
  const year = String(node.attrs?.['year'] ?? '');
  return [author, year].filter((v) => v !== '').join(', ');
};

const renderList = (node: JSONContent, ordered: boolean, depth: number, ctx: RenderCtx): string => {
  const indent = '  '.repeat(depth);
  return (node.content ?? [])
    .map((item, i) => renderListItem(item, ordered ? `${i + 1}.` : '-', indent, depth, ctx))
    .join('\n');
};

const renderListItem = (
  item: JSONContent,
  marker: string,
  indent: string,
  depth: number,
  ctx: RenderCtx,
): string =>
  (item.content ?? [])
    .map((child, i) => {
      const rendered =
        child.type === 'bulletList' || child.type === 'orderedList'
          ? renderBlock(child, depth + 1, ctx)
          : renderBlock(child, depth, ctx);
      return i === 0 ? `${indent}${marker} ${rendered}` : rendered;
    })
    .join('\n');
