import type { Tag } from '@core/tags/tag.types';

import type { EntityKind } from './search.types';

const norm = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

export interface KindOption {
  readonly kind: EntityKind;
  readonly label: string;
}

export interface ParsedPaletteQuery {
  readonly text: string;
  readonly tagIds: readonly string[];
  readonly unknownTags: readonly string[];
  readonly kinds: readonly EntityKind[];
  readonly unknownKinds: readonly string[];
}

// Why: the palette accepts `tag:<label>` and `kind:<label>` tokens mixed with
//      free text. We split tokens, match each against its live option list
//      (accent-insensitive; `kind:` also matches the raw kind literal, e.g.
//      "task", for users who think in English/code terms), and collapse the
//      rest into the search text. Unknown tokens are flagged so the UI can
//      show "no existe X" instead of silently dropping them.
export const parsePaletteQuery = (
  input: string,
  tags: readonly Tag[],
  kindOptions: readonly KindOption[] = [],
): ParsedPaletteQuery => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const textParts: string[] = [];
  const tagIds: string[] = [];
  const unknownTags: string[] = [];
  const kinds: EntityKind[] = [];
  const unknownKinds: string[] = [];

  for (const token of tokens) {
    const tagMatch = /^tag:(.+)$/i.exec(token);
    if (tagMatch) {
      const label = tagMatch[1]!;
      const needle = norm(label);
      const tag = tags.find((t) => norm(t.label) === needle || t.id === needle);
      if (tag) tagIds.push(tag.id);
      else unknownTags.push(label);
      continue;
    }
    const kindMatch = /^kind:(.+)$/i.exec(token);
    if (kindMatch) {
      const label = kindMatch[1]!;
      const needle = norm(label);
      const option = kindOptions.find((k) => norm(k.label) === needle || norm(k.kind) === needle);
      if (option) kinds.push(option.kind);
      else unknownKinds.push(label);
      continue;
    }
    textParts.push(token);
  }

  return { text: textParts.join(' '), tagIds, unknownTags, kinds, unknownKinds };
};
