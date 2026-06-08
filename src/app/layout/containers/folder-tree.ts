import type { TreeNode, TreeNodeBadge } from '@shared/tree/tree.types';

export interface FolderTreeEntity {
  readonly id: string;
  readonly folder: string;
  readonly label: string;
  readonly badges: readonly TreeNodeBadge[];
}

export interface FolderTreeOptions {
  readonly idPrefix: 'note' | 'task' | 'goal' | 'list';
  readonly entities: readonly FolderTreeEntity[];
  readonly folders: readonly string[];
}

// Builds a nested tree of folder/entity nodes for one kind. Folders are nodes
// with kind='folder' and id 'folder:<kind>:<path>'. Empty folders are
// rendered too so user can see them and target them for moves.
export const buildFolderTree = (opts: FolderTreeOptions): readonly TreeNode[] => {
  const folderPaths = new Set<string>(opts.folders);
  for (const e of opts.entities) {
    if (e.folder !== '') folderPaths.add(e.folder);
  }
  const childrenByFolder = new Map<string, FolderTreeEntity[]>();
  for (const e of opts.entities) {
    const list = childrenByFolder.get(e.folder) ?? [];
    list.push(e);
    childrenByFolder.set(e.folder, list);
  }
  const subfoldersByParent = new Map<string, string[]>();
  for (const path of folderPaths) {
    const slash = path.lastIndexOf('/');
    const parent = slash < 0 ? '' : path.slice(0, slash);
    const list = subfoldersByParent.get(parent) ?? [];
    list.push(path);
    subfoldersByParent.set(parent, list);
  }

  const buildFolder = (path: string): TreeNode => {
    const slash = path.lastIndexOf('/');
    const name = slash < 0 ? path : path.slice(slash + 1);
    return {
      id: `folder:${opts.idPrefix}:${path}`,
      label: name,
      kind: 'folder',
      children: buildChildren(path),
    };
  };

  const buildChildren = (folder: string): readonly TreeNode[] => {
    const subs = (subfoldersByParent.get(folder) ?? []).slice().sort();
    const ents = (childrenByFolder.get(folder) ?? []).slice();
    return [
      ...subs.map((p) => buildFolder(p)),
      ...ents.map((e) => ({
        id: `${opts.idPrefix}:${e.id}`,
        label: e.label,
        kind: opts.idPrefix,
        badges: e.badges,
      })),
    ];
  };

  return buildChildren('');
};
