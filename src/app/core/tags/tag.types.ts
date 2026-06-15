export const TAG_KIND = 'tag';
export const TAGS_FILE = 'tags.json';
export const TAG_SCHEMA_VERSION = 1;

export interface Tag {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly colorSwatchId?: string;
  readonly createdAt: string;
  readonly [key: string]: unknown;
}

export interface TagsFile {
  readonly schemaVersion: number;
  readonly tags: readonly Tag[];
  readonly [key: string]: unknown;
}

// why: deterministic palette so a tag id consistently maps to the same hue.
//      User-customizable colors are deferred (see docs/deferred.md).
export const TAG_PALETTE: readonly string[] = [
  '#e57373',
  '#f06292',
  '#ba68c8',
  '#9575cd',
  '#7986cb',
  '#64b5f6',
  '#4fc3f7',
  '#4dd0e1',
  '#4db6ac',
  '#81c784',
  '#aed581',
  '#dce775',
  '#fff176',
  '#ffd54f',
  '#ffb74d',
  '#ff8a65',
];

export const colorForId = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length] ?? TAG_PALETTE[0]!;
};
