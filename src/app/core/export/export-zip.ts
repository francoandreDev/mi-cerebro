import type { ExportOptions } from './export-zip.types';

const ASSET_DIRS = new Set(['files', 'images', 'music']);
const GIT_DIR = '.git';

export const ASSET_DIRS_LIST: readonly string[] = ['files', 'images', 'music'];

export function shouldIncludeEntry(relativePath: string, opts: ExportOptions): boolean {
  const top = topSegment(relativePath);
  if (top === GIT_DIR) return opts.includeAllVariants;
  if (ASSET_DIRS.has(top)) return opts.includeAssets;
  return true;
}

export function buildZipFilename(rootName: string, now: Date): string {
  const safe = (rootName || 'workspace').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `mi-cerebro-${safe || 'workspace'}-${formatStamp(now)}.zip`;
}

export function formatStamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

function topSegment(path: string): string {
  const i = path.indexOf('/');
  return i < 0 ? path : path.slice(0, i);
}
