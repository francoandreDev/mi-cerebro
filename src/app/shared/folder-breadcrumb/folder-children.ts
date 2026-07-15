// Given a flat list of folder paths ("a", "a/b", "a/b/c") for one kind,
// returns the immediate children of `parent` — one path segment deeper,
// deduped and sorted. Root is `''`.
export const immediateChildFolders = (
  allFolders: readonly string[],
  parent: string,
): readonly string[] => {
  const prefix = parent === '' ? '' : `${parent}/`;
  const depth = parent === '' ? 0 : parent.split('/').length;
  const children = new Set<string>();
  for (const path of allFolders) {
    if (path === parent) continue;
    if (parent !== '' && !path.startsWith(prefix)) continue;
    const segments = path.split('/');
    children.add(segments.slice(0, depth + 1).join('/'));
  }
  return [...children].sort((a, b) => a.localeCompare(b));
};

export const folderLeafName = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? path : path.slice(slash + 1);
};

export interface FolderCrumb {
  readonly label: string;
  readonly path: string;
}

// Builds the cumulative breadcrumb trail for `currentPath`, root excluded
// (callers render the root crumb separately since its label is i18n'd).
export const folderCrumbs = (currentPath: string): readonly FolderCrumb[] => {
  if (currentPath === '') return [];
  const segments = currentPath.split('/');
  const crumbs: FolderCrumb[] = [];
  let acc = '';
  for (const segment of segments) {
    acc = acc === '' ? segment : `${acc}/${segment}`;
    crumbs.push({ label: segment, path: acc });
  }
  return crumbs;
};
