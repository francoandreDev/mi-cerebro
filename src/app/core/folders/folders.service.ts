import { Injectable, inject } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import {
  getDirByPath,
  getOrCreateDirByPath,
  joinPath,
  splitRelativePath,
  walkEntities,
} from '@core/fs/walk';
import { WorkspaceService } from '@core/fs/workspace.service';
import { KIND_DIRS } from '@core/trash/trash.types';
import { GoalsService } from '@features/goals/services/goals.service';
import { ListsService } from '@features/lists/services/lists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { toSlug } from '@shared/utils/slug';

import type { FolderKind } from './folders.types';

const FILE_SUFFIX = '.json';

@Injectable({ providedIn: 'root' })
export class FoldersService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly notes = inject(NotesService);
  private readonly tasks = inject(TasksService);
  private readonly goals = inject(GoalsService);
  private readonly lists = inject(ListsService);

  async createFolder(kind: FolderKind, parentPath: string, name: string): Promise<string> {
    const slug = toSlug(name);
    if (slug === '') throw new AppError(ERROR_CODES.FS_001, { severity: 'error' });
    const root = await this.kindRoot(kind);
    const parent = await getOrCreateDirByPath(this.fs, root, parentPath);
    if (await this.fs.hasEntry(parent, slug)) {
      throw new AppError(ERROR_CODES.FS_001, {
        severity: 'warning',
        context: { reason: 'folder exists', name: slug },
      });
    }
    await this.fs.getOrCreateDir(parent, slug);
    const newPath = joinPath(parentPath, slug);
    await this.refreshKind(kind);
    return newPath;
  }

  async renameFolder(kind: FolderKind, path: string, newName: string): Promise<string> {
    const { folder: parentPath } = splitRelativePath(path);
    const newPath = joinPath(parentPath, toSlug(newName));
    if (newPath === path) return path;
    await this.moveFolderInternal(kind, path, newPath);
    return newPath;
  }

  async moveFolder(kind: FolderKind, path: string, newParent: string): Promise<string> {
    const { filename: leaf } = splitRelativePath(path);
    const newPath = joinPath(newParent, leaf);
    if (newPath === path) return path;
    if (newPath.startsWith(`${path}/`)) {
      throw new AppError(ERROR_CODES.FS_001, {
        severity: 'warning',
        context: { reason: 'cannot move folder into itself', path },
      });
    }
    await this.moveFolderInternal(kind, path, newPath);
    return newPath;
  }

  async deleteFolder(kind: FolderKind, path: string): Promise<void> {
    // why: soft-delete everything inside via the entity service so each item
    //      lands in trash with its kind prefix and the entity's summaries
    //      signal drops it. Then remove the empty directory tree.
    const ids = this.idsInsideFolder(kind, path);
    for (const id of ids) await this.softDeleteEntity(kind, id);
    const root = await this.kindRoot(kind);
    const { folder: parentPath, filename: leaf } = splitRelativePath(path);
    const parent = await getDirByPath(this.fs, root, parentPath);
    if (parent) {
      try {
        await this.fs.removeEntry(parent, leaf, { recursive: true });
      } catch {
        /* already gone */
      }
    }
    await this.refreshKind(kind);
  }

  private async moveFolderInternal(
    kind: FolderKind,
    oldPath: string,
    newPath: string,
  ): Promise<void> {
    const root = await this.kindRoot(kind);
    const src = await getDirByPath(this.fs, root, oldPath);
    if (!src) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const dest = await getOrCreateDirByPath(this.fs, root, newPath);
    await moveDirRecursive(this.fs, src, dest);
    // why: remove the now-empty source. We walk back up parents stripping the
    //      single original branch, but only if those parents end up empty.
    const { folder: parentPath, filename: leaf } = splitRelativePath(oldPath);
    const parent = await getDirByPath(this.fs, root, parentPath);
    if (parent) {
      try {
        await this.fs.removeEntry(parent, leaf, { recursive: true });
      } catch {
        /* not empty / already gone */
      }
    }
    await this.refreshKind(kind);
  }

  private idsInsideFolder(kind: FolderKind, path: string): readonly string[] {
    const summaries = this.summariesFor(kind);
    return summaries.filter((s) => isInsideFolder(s.folder, path)).map((s) => s.id);
  }

  private summariesFor(kind: FolderKind): readonly { id: string; folder: string }[] {
    if (kind === 'note') return this.notes.summaries();
    if (kind === 'task') return this.tasks.summaries();
    if (kind === 'goal') return this.goals.summaries();
    return this.lists.summaries();
  }

  private async softDeleteEntity(kind: FolderKind, id: string): Promise<void> {
    if (kind === 'note') await this.notes.deleteToTrash(id);
    else if (kind === 'task') await this.tasks.deleteToTrash(id);
    else if (kind === 'goal') await this.goals.deleteToTrash(id);
    else await this.lists.deleteToTrash(id);
  }

  private async refreshKind(kind: FolderKind): Promise<void> {
    if (kind === 'note') await this.notes.refresh();
    else if (kind === 'task') await this.tasks.refresh();
    else if (kind === 'goal') await this.goals.refresh();
    else await this.lists.refresh();
  }

  private async kindRoot(kind: FolderKind): Promise<FsDirectoryHandle> {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return this.fs.getOrCreateDir(root, KIND_DIRS[kind]);
  }
}

const isInsideFolder = (entityFolder: string, folder: string): boolean =>
  entityFolder === folder || entityFolder.startsWith(`${folder}/`);

const moveDirRecursive = async (
  fs: FsService,
  src: FsDirectoryHandle,
  dest: FsDirectoryHandle,
): Promise<void> => {
  for await (const entry of walkEntities(fs, src, FILE_SUFFIX)) {
    const targetDir = await getOrCreateDirByPath(fs, dest, entry.folder);
    await fs.moveFile(entry.dirHandle, entry.filename, targetDir, entry.filename);
  }
};
