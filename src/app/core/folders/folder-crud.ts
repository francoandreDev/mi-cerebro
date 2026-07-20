import type { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { FolderActionDialogController } from '@shared/folder-action-dialog/folder-action-dialog.controller';

import type { FoldersService } from './folders.service';
import type { FolderKind } from './folders.types';

const t = (i18n: I18nService, key: TranslationKey): string => i18n.t(key);

// Folder-only CRUD prompts (rename/move/delete an existing folder, or create
// a new one). Deliberately has zero feature imports so any feature container
// can call it directly — entity-move actions (which do need per-kind
// services) stay in @layout/containers/folder-actions.ts.
export const openFolderActionDialog = (
  rest: string,
  folders: FoldersService,
  i18n: I18nService,
  dialog: FolderActionDialogController,
  onError: (e: unknown) => void,
): void => {
  // rest format: '<kind>:<path>'
  const colon = rest.indexOf(':');
  const kind = rest.slice(0, colon) as FolderKind;
  const path = rest.slice(colon + 1);
  dialog.open(
    {
      promptTitle: t(i18n, 'folders.actionPrompt'),
      renameLabel: t(i18n, 'folders.rename'),
      moveLabel: t(i18n, 'folders.move'),
      deleteLabel: t(i18n, 'folders.delete'),
      cancelLabel: t(i18n, 'common.cancel'),
      confirmLabel: t(i18n, 'common.confirm'),
      renamePromptLabel: t(i18n, 'folders.renamePrompt'),
      movePromptLabel: t(i18n, 'folders.movePrompt'),
      deleteConfirmMessage: t(i18n, 'folders.deleteConfirm').replace('{path}', path),
    },
    pathLeaf(path),
    pathParent(path),
    {
      onRename: async (next) => {
        try {
          await folders.renameFolder(kind, path, next);
        } catch (e) {
          onError(e);
        }
      },
      onMove: async (next) => {
        try {
          await folders.moveFolder(kind, path, next);
        } catch (e) {
          onError(e);
        }
      },
      onDelete: async () => {
        try {
          await folders.deleteFolder(kind, path);
        } catch (e) {
          onError(e);
        }
      },
    },
  );
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
