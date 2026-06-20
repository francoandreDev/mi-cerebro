#!/usr/bin/env node
// Extracts SVG inner content from @phosphor-icons/core into a TS file.
// Run with: bun scripts/generate-icons.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const assets = join(root, 'node_modules', '@phosphor-icons', 'core', 'assets');

const ICONS = [
  // entity types
  ['note', 'regular', 'note'],
  ['check-square', 'regular', 'check-square'],
  ['target', 'regular', 'target'],
  ['list-bullets', 'regular', 'list-bullets'],
  ['pen-nib', 'regular', 'pen-nib'],
  ['books', 'regular', 'books'],
  ['image', 'regular', 'image'],
  ['paperclip', 'regular', 'paperclip'],
  // routes
  ['calendar-dots', 'regular', 'calendar-dots'],
  ['bell', 'regular', 'bell'],
  ['music-notes', 'regular', 'music-notes'],
  ['music-note', 'regular', 'music-note'],
  ['clock-counter-clockwise', 'regular', 'clock-counter-clockwise'],
  ['git-branch', 'regular', 'git-branch'],
  ['trash', 'regular', 'trash'],
  ['gear', 'regular', 'gear'],
  // actions / ui
  ['magnifying-glass', 'regular', 'magnifying-glass'],
  ['x', 'regular', 'x'],
  ['check', 'regular', 'check'],
  ['pencil-simple', 'regular', 'pencil-simple'],
  ['warning', 'regular', 'warning'],
  ['fire', 'regular', 'fire'],
  ['star', 'regular', 'star'],
  ['star-fill', 'fill', 'star-fill'],
  // editor
  ['chat-circle', 'regular', 'chat-circle'],
  ['note-pencil', 'regular', 'note-pencil'],
  ['clipboard-text', 'regular', 'clipboard-text'],
  // music / player
  ['play', 'regular', 'play'],
  ['pause', 'regular', 'pause'],
  ['skip-back', 'regular', 'skip-back'],
  ['skip-forward', 'regular', 'skip-forward'],
  ['shuffle', 'regular', 'shuffle'],
  // file mime
  ['video-camera', 'regular', 'video-camera'],
  ['file-pdf', 'regular', 'file-pdf'],
  ['file-text', 'regular', 'file-text'],
  ['package', 'regular', 'package'],
  ['file', 'regular', 'file'],
  // dev
  ['keyboard', 'regular', 'keyboard'],
  ['test-tube', 'regular', 'test-tube'],
  // reminders ui
  ['alarm', 'regular', 'alarm'],
  ['hourglass-medium', 'regular', 'hourglass-medium'],
  ['sun-horizon', 'regular', 'sun-horizon'],
  ['calendar-blank', 'regular', 'calendar-blank'],
  ['calendar-check', 'regular', 'calendar-check'],
  ['circle-dashed', 'regular', 'circle-dashed'],
  ['flag', 'regular', 'flag'],
  ['sparkle', 'regular', 'sparkle'],
  ['plus-circle', 'regular', 'plus-circle'],
  ['caret-down', 'regular', 'caret-down'],
  ['caret-right', 'regular', 'caret-right'],
  ['arrow-counter-clockwise', 'regular', 'arrow-counter-clockwise'],
  ['dots-three-vertical', 'regular', 'dots-three-vertical'],
  // general actions / filters
  ['plus', 'regular', 'plus'],
  ['minus', 'regular', 'minus'],
  ['funnel', 'regular', 'funnel'],
  ['funnel-simple', 'regular', 'funnel-simple'],
  ['faders-horizontal', 'regular', 'faders-horizontal'],
  ['sort-ascending', 'regular', 'sort-ascending'],
  ['sort-descending', 'regular', 'sort-descending'],
  ['arrows-clockwise', 'regular', 'arrows-clockwise'],
  ['arrow-up', 'regular', 'arrow-up'],
  ['arrow-down', 'regular', 'arrow-down'],
  ['arrow-left', 'regular', 'arrow-left'],
  ['arrow-right', 'regular', 'arrow-right'],
  ['caret-up', 'regular', 'caret-up'],
  ['caret-left', 'regular', 'caret-left'],
  ['eye', 'regular', 'eye'],
  ['eye-slash', 'regular', 'eye-slash'],
  ['tag', 'regular', 'tag'],
  ['download-simple', 'regular', 'download-simple'],
  ['upload-simple', 'regular', 'upload-simple'],
  ['copy', 'regular', 'copy'],
  ['link-simple', 'regular', 'link-simple'],
  ['archive', 'regular', 'archive'],
  ['push-pin', 'regular', 'push-pin'],
  ['push-pin-slash', 'regular', 'push-pin-slash'],
  ['folder', 'regular', 'folder'],
  ['folder-open', 'regular', 'folder-open'],
  ['folder-plus', 'regular', 'folder-plus'],
  ['info', 'regular', 'info'],
  ['lightbulb', 'regular', 'lightbulb'],
  ['list-checks', 'regular', 'list-checks'],
  ['list-magnifying-glass', 'regular', 'list-magnifying-glass'],
  ['kanban', 'regular', 'kanban'],
  ['broom', 'regular', 'broom'],
  ['dot-outline', 'regular', 'dot-outline'],
  ['circle-half', 'regular', 'circle-half'],
  ['spinner-gap', 'regular', 'spinner-gap'],
  ['heart', 'regular', 'heart'],
  ['bookmark', 'regular', 'bookmark'],
  ['bookmark-simple', 'regular', 'bookmark-simple'],
  ['lock', 'regular', 'lock'],
  ['lock-open', 'regular', 'lock-open'],
  ['arrow-square-out', 'regular', 'arrow-square-out'],
  ['floppy-disk', 'regular', 'floppy-disk'],
  ['paint-brush', 'regular', 'paint-brush'],
  ['palette', 'regular', 'palette'],
  ['translate', 'regular', 'translate'],
  ['moon', 'regular', 'moon'],
  ['sun', 'regular', 'sun'],
  ['image-square', 'regular', 'image-square'],
  ['squares-four', 'regular', 'squares-four'],
  ['rows', 'regular', 'rows'],
  ['columns', 'regular', 'columns'],
  ['grid-four', 'regular', 'grid-four'],
];

const INNER_RE = /<svg[^>]*>([\s\S]*)<\/svg>/;

const entries = ICONS.map(([name, weight, file]) => {
  const path = join(assets, weight, `${file}.svg`);
  const raw = readFileSync(path, 'utf8');
  const m = INNER_RE.exec(raw);
  if (!m) throw new Error(`could not parse svg: ${path}`);
  const inner = m[1].trim().replace(/\s+/g, ' ');
  return `  '${name}': '${inner.replace(/'/g, "\\'")}',`;
}).join('\n');

const names = ICONS.map(([n]) => `'${n}'`).join(' | ');

const out = `// AUTO-GENERATED by scripts/generate-icons.mjs. Do not edit by hand.
// Source: @phosphor-icons/core (MIT). viewBox 0 0 256 256, fill="currentColor".

export type IconName =
  | ${ICONS.map(([n]) => `'${n}'`).join('\n  | ')};

export const ICON_DATA: Record<IconName, string> = {
${entries}
};
`;

writeFileSync(join(root, 'src', 'app', 'shared', 'icon', 'icons.data.ts'), out);
console.log(`wrote ${ICONS.length} icons`);
