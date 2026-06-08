import type { Tag } from '@core/tags/tag.types';

const norm = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

export interface ParsedPaletteQuery {
  readonly text: string;
  readonly tagIds: readonly string[];
  readonly unknownTags: readonly string[];
}

// Why: the palette accepts `tag:<label>` tokens mixed with free text. We split
//      tokens, match each `tag:` against the live tag list (accent-insensitive),
//      collapse the rest into the search text. Unknown tag tokens are flagged
//      so the UI can show "no tag named X" instead of silently dropping them.
export const parsePaletteQuery = (input: string, tags: readonly Tag[]): ParsedPaletteQuery => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const textParts: string[] = [];
  const tagIds: string[] = [];
  const unknownTags: string[] = [];

  for (const token of tokens) {
    const tagMatch = /^tag:(.+)$/i.exec(token);
    if (!tagMatch) {
      textParts.push(token);
      continue;
    }
    const label = tagMatch[1]!;
    const needle = norm(label);
    const tag = tags.find((t) => norm(t.label) === needle || t.id === needle);
    if (tag) tagIds.push(tag.id);
    else unknownTags.push(label);
  }

  return { text: textParts.join(' '), tagIds, unknownTags };
};
