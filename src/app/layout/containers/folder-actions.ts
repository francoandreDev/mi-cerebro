import type { FoldersService } from '@core/folders/folders.service';
import type { FolderKind } from '@core/folders/folders.types';
import type { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { GoalsService } from '@features/goals/services/goals.service';
import type { ListsService } from '@features/lists/services/lists.service';
import type { NotesService } from '@features/notes/services/notes.service';
import type { TasksService } from '@features/tasks/services/tasks.service';
import type { BooksService } from '@features/books/services/books.service';
import type { FilesService } from '@features/files/services/files.service';
import type { GalleriesService } from '@features/images/services/galleries.service';
import type { WritingsService } from '@features/writings/services/writings.service';

export interface EntityServices {
  readonly notes: NotesService;
  readonly tasks: TasksService;
  readonly goals: GoalsService;
  readonly lists: ListsService;
  readonly writings: WritingsService;
  readonly books: BooksService;
  readonly galleries: GalleriesService;
  readonly files: FilesService;
}

const t = (i18n: I18nService, key: TranslationKey): string => i18n.t(key);

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

export const handleEntityAction = async (
  nodeId: string,
  services: EntityServices,
  i18n: I18nService,
): Promise<void> => {
  // nodeId format: '<kind>:<id>'
  const colon = nodeId.indexOf(':');
  const kind = nodeId.slice(0, colon);
  const id = nodeId.slice(colon + 1);
  const newFolder = prompt(t(i18n, 'folders.entityMovePrompt'), '');
  if (newFolder === null) return;
  const folder = newFolder.trim();
  if (kind === 'note') await services.notes.moveToFolder(id, folder);
  else if (kind === 'task') await services.tasks.moveToFolder(id, folder);
  else if (kind === 'goal') await services.goals.moveToFolder(id, folder);
  else if (kind === 'list') await services.lists.moveToFolder(id, folder);
  else if (kind === 'writing') await services.writings.moveToFolder(id, folder);
  else if (kind === 'book') await services.books.moveBookToFolder(id, folder);
  else if (kind === 'image') await services.galleries.moveGalleryToFolder(id, folder);
  else if (kind === 'file') await services.files.moveCollectionToFolder(id, folder);
};

export const handleCreateFolder = async (
  kind: FolderKind,
  folders: FoldersService,
  i18n: I18nService,
): Promise<void> => {
  const name = prompt(t(i18n, 'folders.createPrompt'), '');
  if (name === null || name.trim() === '') return;
  await folders.createFolder(kind, '', name.trim());
};

const pathLeaf = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? path : path.slice(slash + 1);
};

const pathParent = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
};
