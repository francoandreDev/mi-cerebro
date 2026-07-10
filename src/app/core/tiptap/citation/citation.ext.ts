import {
  Node,
  mergeAttributes,
  type CommandProps,
  type Editor,
  type SingleCommands,
} from '@tiptap/core';
import { Fragment, type Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';

export const CITATION_NAME = 'citation';
export const CITATION_ATTRIBUTION_NAME = 'citationAttribution';

export interface CitationAttributionPlaceholders {
  readonly author: () => string;
  readonly year: () => string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      // why: pure toggle. On: wraps the selected paragraphs — opening AND
      //      closing quote marks render immediately via CSS (see
      //      _book-editor.scss / _editor-content.scss), no separate
      //      "close" action needed. Off: drops the wrapper and any
      //      attribution — re-citing starts clean.
      toggleCitation: () => ReturnType;
    };
  }
}

// why: no addInputRules() at all — unlike StarterKit's blockquote this
//      node is never typed into existence via "> ", only via the toolbar
//      command below. Per "cero fricción de sintaxis" a literal "> " the
//      user types should stay literal text.
export const Citation = Node.create({
  name: CITATION_NAME,
  group: 'block',
  content: `paragraph+ ${CITATION_ATTRIBUTION_NAME}?`,
  defining: true,

  parseHTML() {
    return [{ tag: 'blockquote' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['blockquote', mergeAttributes(HTMLAttributes, { 'data-citation': '' }), 0];
  },

  addCommands() {
    return {
      toggleCitation:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive(CITATION_NAME)) return uncite(commands);
          return cite(commands);
        },
    };
  },

  // why: Tab at the very end of a citation's last paragraph is the
  //      user's declared flow — quote text -> Tab -> autor -> Tab (native
  //      browser focus move, both are plain <input>s in DOM order) ->
  //      año -> Enter -> back into the document. Anywhere else Tab keeps
  //      its normal no-op (falls through, returns false).
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': () => this.editor.commands.toggleCitation(),
      Tab: () => focusOrCreateAttribution(this.editor),
    };
  },
});

// why: an atom, not ProseMirror text content — "Autor"/"Año" are two real
//      <input>s in a NodeView so Tab-between-them is free native browser
//      behavior, and typing in one never touches the ProseMirror doc model
//      directly (synced back to node attrs on `input`).
export const createCitationAttribution = (placeholders: CitationAttributionPlaceholders) =>
  Node.create({
    name: CITATION_ATTRIBUTION_NAME,
    group: 'block',
    atom: true,
    selectable: false,
    defining: true,

    addAttributes() {
      return {
        author: {
          default: '',
          parseHTML: (el) => (el as HTMLElement).getAttribute('data-author') ?? '',
          renderHTML: (attrs) => (attrs['author'] ? { 'data-author': attrs['author'] } : {}),
        },
        year: {
          default: '',
          parseHTML: (el) => (el as HTMLElement).getAttribute('data-year') ?? '',
          renderHTML: (attrs) => (attrs['year'] ? { 'data-year': attrs['year'] } : {}),
        },
      };
    },

    parseHTML() {
      return [{ tag: 'footer[data-citation-attribution]' }];
    },
    renderHTML({ HTMLAttributes }) {
      return ['footer', mergeAttributes(HTMLAttributes, { 'data-citation-attribution': '' })];
    },

    addNodeView() {
      return ({ node, view, getPos, editor }) =>
        buildAttributionView(node, view, getPos, editor, placeholders);
    },
  });

const buildAttributionView = (
  initialNode: PMNode,
  view: Editor['view'],
  getPos: () => number | undefined,
  editor: Editor,
  placeholders: CitationAttributionPlaceholders,
) => {
  let node = initialNode;
  const dom = document.createElement('footer');
  dom.setAttribute('data-citation-attribution', '');
  dom.className = 'mc-citation-attribution';
  dom.contentEditable = 'false';

  const authorInput = document.createElement('input');
  authorInput.type = 'text';
  authorInput.className = 'mc-citation-author';
  authorInput.placeholder = placeholders.author();
  authorInput.value = (node.attrs['author'] as string | null) ?? '';

  const separator = document.createElement('span');
  separator.className = 'mc-citation-sep';
  separator.textContent = ', ';
  separator.setAttribute('contenteditable', 'false');

  const yearInput = document.createElement('input');
  yearInput.type = 'text';
  yearInput.className = 'mc-citation-year';
  yearInput.placeholder = placeholders.year();
  yearInput.value = (node.attrs['year'] as string | null) ?? '';

  dom.append(authorInput, separator, yearInput);

  // why: plain <input>s size to a fixed default width; sizing them to
  //      their own content (placeholder or value) is what keeps "Autor,
  //      Año" reading as running text instead of two form-field boxes.
  const autosize = (input: HTMLInputElement): void => {
    const chars = Math.max((input.value || input.placeholder).length, 1);
    input.style.width = `${chars}ch`;
  };
  autosize(authorInput);
  autosize(yearInput);

  const commitAttr = (key: 'author' | 'year', value: string): void => {
    const pos = getPos();
    if (pos === undefined) return;
    view.dispatch(view.state.tr.setNodeAttribute(pos, key, value));
  };

  authorInput.addEventListener('input', () => {
    autosize(authorInput);
    commitAttr('author', authorInput.value);
  });
  yearInput.addEventListener('input', () => {
    autosize(yearInput);
    commitAttr('year', yearInput.value);
  });

  // why: Backspace on an empty author field with nothing typed anywhere
  //      removes the whole attribution widget instead of getting stuck —
  //      the escape hatch for "I tabbed here by mistake."
  authorInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace') return;
    if (authorInput.value !== '' || authorInput.selectionStart !== 0 || yearInput.value !== '')
      return;
    e.preventDefault();
    removeAttribution(editor, getPos, node);
  });

  yearInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const pos = getPos();
    if (pos === undefined) return;
    const afterPos = pos + node.nodeSize;
    const sel = TextSelection.near(
      editor.state.doc.resolve(Math.min(afterPos, editor.state.doc.content.size)),
      1,
    );
    editor.chain().focus().setTextSelection(sel.from).run();
  });

  return {
    dom,
    ignoreMutation: () => true,
    update: (updatedNode: PMNode) => {
      if (updatedNode.type !== node.type) return false;
      node = updatedNode;
      const author = (node.attrs['author'] as string | null) ?? '';
      const year = (node.attrs['year'] as string | null) ?? '';
      if (authorInput.value !== author) {
        authorInput.value = author;
        autosize(authorInput);
      }
      if (yearInput.value !== year) {
        yearInput.value = year;
        autosize(yearInput);
      }
      return true;
    },
  };
};

const removeAttribution = (
  editor: Editor,
  getPos: () => number | undefined,
  node: PMNode,
): void => {
  const pos = getPos();
  if (pos === undefined) return;
  const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
  const sel = TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1);
  tr.setSelection(sel);
  editor.view.dispatch(tr);
  editor.commands.focus();
};

// why: the `state` prop TipTap hands to a nested `commands.command()` call
//      is a snapshot taken once when the outer command started — its
//      `.selection` getter does NOT track further mutations on the shared
//      `tr` (see @tiptap/core's createChainableState: `selection` is a
//      plain destructured variable, only refreshed by reading `.tr`).
//      Reading `tr.selection` instead — the live Transaction, mutated in
//      place by the preceding wrapIn — is what actually reflects the wrap.
const cite = (commands: SingleCommands): boolean => commands.wrapIn(CITATION_NAME);

const uncite = (commands: SingleCommands): boolean => {
  return commands.command(({ tr, dispatch }: CommandProps) => {
    const citation = findAncestor(tr.selection.$from, CITATION_NAME);
    if (!citation) return false;
    if (!dispatch) return true;
    const paragraphs: PMNode[] = [];
    citation.node.forEach((child) => {
      if (child.type.name === 'paragraph') paragraphs.push(child);
    });
    tr.replaceWith(
      citation.pos,
      citation.pos + citation.node.nodeSize,
      Fragment.fromArray(paragraphs),
    );
    dispatch(tr);
    return true;
  });
};

// why: only triggers when the cursor sits at the very end of a citation's
//      LAST paragraph — anywhere else Tab stays a no-op (returns false, PM
//      falls through to default browser tab-navigation). Exported for
//      testing — the DOM focus/input side of the NodeView isn't practical
//      to exercise from a headless jsdom Editor, but the doc-structure
//      effect (does it insert the attribution atom or not) is.
export const focusOrCreateAttribution = (editor: Editor): boolean => {
  // why: once focus actually lands on the author/year <input> (a native,
  //      non-ProseMirror-editable element inside the NodeView), the
  //      Tab keydown still bubbles up through view.dom and re-enters this
  //      same handler — but editor.state.selection never moved, so the
  //      structural checks below would still match and re-focus "autor"
  //      forever, eating every subsequent Tab and blocking the browser's
  //      native author->año focus move. Bail out whenever ProseMirror
  //      itself doesn't hold focus (i.e. one of our own inputs does).
  if (!editor.view.hasFocus()) return false;
  const { selection } = editor.state;
  if (!selection.empty) return false;
  const $from = selection.$from;
  if ($from.parent.type.name !== 'paragraph') return false;
  const parentDepth = $from.depth - 1;
  if (parentDepth < 0) return false;
  const citationNode = $from.node(parentDepth);
  if (citationNode.type.name !== CITATION_NAME) return false;
  if ($from.parentOffset !== $from.parent.content.size) return false;
  const indexInCitation = $from.index(parentDepth);
  const isLastParagraph =
    indexInCitation === citationNode.childCount - 1 ||
    citationNode.child(indexInCitation + 1).type.name !== 'paragraph';
  if (!isLastParagraph) return false;

  const citationPos = $from.before(parentDepth);
  const hasAttribution = citationNode.lastChild?.type.name === CITATION_ATTRIBUTION_NAME;
  const insertPos = citationPos + citationNode.nodeSize - 1;

  if (!hasAttribution) {
    const attrType = editor.state.schema.nodes[CITATION_ATTRIBUTION_NAME];
    if (!attrType) return false;
    editor.view.dispatch(editor.state.tr.insert(insertPos, attrType.create()));
  }
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return;
    const dom = editor.view.nodeDOM(insertPos) as HTMLElement | null;
    dom?.querySelector<HTMLInputElement>('.mc-citation-author')?.focus();
  });
  return true;
};

const findAncestor = (
  $pos: { depth: number; node: (d: number) => PMNode; before: (d: number) => number },
  typeName: string,
): { node: PMNode; pos: number } | null => {
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === typeName) return { node, pos: $pos.before(d) };
  }
  return null;
};
