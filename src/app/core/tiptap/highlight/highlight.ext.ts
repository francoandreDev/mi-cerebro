import Highlight from '@tiptap/extension-highlight';

export const HIGHLIGHT_COLOR_ATTR = 'data-color';

// why: the stock multicolor Highlight extension renders the swatch id
//      straight into an inline `background-color` style, which only works
//      when `color` is a literal CSS color. We store a curated swatch id
//      (see @core/theme/highlight-palette) instead, so the mark stays
//      theme-aware — light/dark resolution happens purely in CSS via
//      `mark[data-color]` rules, not at document-save time.
export const createHighlightExtension = () =>
  Highlight.extend({
    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute(HIGHLIGHT_COLOR_ATTR),
          renderHTML: (attributes: { color?: string | null }) => {
            if (!attributes.color) return {};
            return { [HIGHLIGHT_COLOR_ATTR]: attributes.color };
          },
        },
      };
    },
  }).configure({ multicolor: true });
