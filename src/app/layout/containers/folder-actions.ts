import { handleCreateFolder, handleFolderAction } from '@core/folders/folder-crud';
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

export { handleCreateFolder, handleFolderAction };

const t = (i18n: I18nService, key: TranslationKey): string => i18n.t(key);

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
