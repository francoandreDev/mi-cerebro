// why: reminders are flat (no folders) so FolderKind diverges from TrashKind.
export type FolderKind = 'note' | 'task' | 'goal' | 'list' | 'writing' | 'book' | 'image' | 'file';

export interface FolderNode {
  readonly path: string;
  readonly name: string;
  readonly children: readonly FolderNode[];
}

export const buildFolderTree = (paths: readonly string[]): readonly FolderNode[] => {
  // why: input is flat list of paths like ['a', 'a/b', 'c']; build a tree of
  //      nodes whose children are kept sorted alphabetically for stable UI.
  const childrenByPath = new Map<string, string[]>();
  for (const path of paths) {
    const slash = path.lastIndexOf('/');
    const parent = slash < 0 ? '' : path.slice(0, slash);
    const list = childrenByPath.get(parent) ?? [];
    list.push(path);
    childrenByPath.set(parent, list);
  }
  const build = (path: string): FolderNode => {
    const slash = path.lastIndexOf('/');
    const name = slash < 0 ? path : path.slice(slash + 1);
    const kids = (childrenByPath.get(path) ?? []).slice().sort();
    return { path, name, children: kids.map((p) => build(p)) };
  };
  return (childrenByPath.get('') ?? [])
    .slice()
    .sort()
    .map((p) => build(p));
};
