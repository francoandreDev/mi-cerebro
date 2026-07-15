import type { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { FoldersService } from './folders.service';
import type { FolderKind } from './folders.types';

const t = (i18n: I18nService, key: TranslationKey): string => i18n.t(key);

// Folder-only CRUD prompts (rename/move/delete an existing folder, or create
// a new one). Deliberately has zero feature imports so any feature container
// can call it directly — entity-move actions (which do need per-kind
// services) stay in @layout/containers/folder-actions.ts.
export const handleFolderAction = async (
  rest: string,
  folders: FoldersService,
  i18n: I18nService,
): Promise<void> => {
  // rest format: '<kind>:<path>'
  const colon = rest.indexOf(':');
  const kind = rest.slice(0, colon) as FolderKind;
  const path = rest.slice(colon + 1);
  const choice = prompt(
    `${t(i18n, 'folders.actionPrompt')}\n1=${t(i18n, 'folders.rename')}\n2=${t(i18n, 'folders.move')}\n3=${t(i18n, 'folders.delete')}`,
    '1',
  );
  if (choice === null) return;
  if (choice === '1') {
    const next = prompt(t(i18n, 'folders.renamePrompt'), pathLeaf(path));
    if (next === null || next.trim() === '') return;
    await folders.renameFolder(kind, path, next.trim());
  } else if (choice === '2') {
    const next = prompt(t(i18n, 'folders.movePrompt'), pathParent(path));
    if (next === null) return;
    await folders.moveFolder(kind, path, next.trim());
  } else if (choice === '3') {
    if (!confirm(t(i18n, 'folders.deleteConfirm').replace('{path}', path))) return;
    await folders.deleteFolder(kind, path);
  }
};

export const handleCreateFolder = async (
  kind: FolderKind,
  folders: FoldersService,
  i18n: I18nService,
  parentPath = '',
): Promise<void> => {
  const name = prompt(t(i18n, 'folders.createPrompt'), '');
  if (name === null || name.trim() === '') return;
  await folders.createFolder(kind, parentPath, name.trim());
};

const pathLeaf = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? path : path.slice(slash + 1);
};

const pathParent = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
};
