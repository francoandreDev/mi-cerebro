// One factory per taggable entity kind (§19.16c — tags admin screen). Each
// closes over its own concrete service/entity type internally; the exported
// shape (TaggableAdapter) stays generic-free so TagsAdminService can just
// iterate a flat list without knowing about Note/Task/Goal/... individually.

import { BOOK_KIND } from '@features/books/models/book.types';
import type { BooksService } from '@features/books/services/books.service';
import { FILE_KIND } from '@features/files/models/file-collection.types';
import type { FilesService } from '@features/files/services/files.service';
import { GOAL_KIND } from '@features/goals/models/goal.types';
import type { GoalsService } from '@features/goals/services/goals.service';
import { IMAGE_KIND } from '@features/images/models/gallery.types';
import type { GalleriesService } from '@features/images/services/galleries.service';
import { LIST_KIND } from '@features/lists/models/list.types';
import type { ListsService } from '@features/lists/services/lists.service';
import { NOTE_KIND } from '@features/notes/models/note.types';
import type { NotesService } from '@features/notes/services/notes.service';
import { TASK_KIND } from '@features/tasks/models/task.types';
import type { TasksService } from '@features/tasks/services/tasks.service';
import { WRITING_KIND } from '@features/writings/models/writing.types';
import type { WritingsService } from '@features/writings/services/writings.service';

import type { TaggableAdapter } from './taggable-adapter';

export const noteTaggableAdapter = (notes: NotesService): TaggableAdapter => ({
  kind: NOTE_KIND,
  summaries: () => notes.summaries(),
  replaceTags: async (id, nextTags) => {
    const note = await notes.read(id);
    await notes.save({ ...note, tags: nextTags });
  },
});

export const taskTaggableAdapter = (tasks: TasksService): TaggableAdapter => ({
  kind: TASK_KIND,
  summaries: () => tasks.summaries(),
  replaceTags: async (id, nextTags) => {
    const task = await tasks.read(id);
    await tasks.save({ ...task, tags: nextTags });
  },
});

export const goalTaggableAdapter = (goals: GoalsService): TaggableAdapter => ({
  kind: GOAL_KIND,
  summaries: () => goals.summaries(),
  replaceTags: async (id, nextTags) => {
    const goal = await goals.read(id);
    await goals.save({ ...goal, tags: nextTags });
  },
});

export const listTaggableAdapter = (lists: ListsService): TaggableAdapter => ({
  kind: LIST_KIND,
  summaries: () => lists.summaries(),
  replaceTags: async (id, nextTags) => {
    const list = await lists.read(id);
    await lists.save({ ...list, tags: nextTags });
  },
});

export const writingTaggableAdapter = (writings: WritingsService): TaggableAdapter => ({
  kind: WRITING_KIND,
  summaries: () => writings.summaries(),
  replaceTags: async (id, nextTags) => {
    const writing = await writings.read(id);
    await writings.save({ ...writing, tags: nextTags });
  },
});

export const bookTaggableAdapter = (books: BooksService): TaggableAdapter => ({
  kind: BOOK_KIND,
  summaries: () => books.summaries(),
  replaceTags: async (id, nextTags) => {
    const book = await books.readBook(id);
    await books.saveBook({ ...book, tags: nextTags });
  },
});

export const galleryTaggableAdapter = (galleries: GalleriesService): TaggableAdapter => ({
  kind: IMAGE_KIND,
  summaries: () => galleries.summaries(),
  replaceTags: async (id, nextTags) => {
    const gallery = await galleries.readGallery(id);
    await galleries.saveGallery({ ...gallery, tags: nextTags });
  },
});

export const fileTaggableAdapter = (files: FilesService): TaggableAdapter => ({
  kind: FILE_KIND,
  summaries: () => files.summaries(),
  replaceTags: async (id, nextTags) => {
    const collection = await files.readCollection(id);
    await files.saveCollection({ ...collection, tags: nextTags });
  },
});
