import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { getDirByPath, getOrCreateDirByPath, joinPath } from '@core/fs/walk';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
import { nextPositionAfter, seedMissingPositions } from '@core/ordering/seed-positions';
import { positionSeedMigrationStep } from '@core/ordering/position.migration';
import { SearchIndexService } from '@core/search/search-index.service';
import { blockIdMigrationStep } from '@core/tiptap/block-id/block-id.migration';
import type { SearchDoc } from '@core/search/search.types';
import { extractPlainText } from '@core/search/tiptap-text';
import { TagsService } from '@core/tags/tags.service';
import { toSlug, withSuffix } from '@shared/utils/slug';
import { countWords } from '@shared/utils/word-count';

import { buildChapterPreview } from './chapter-preview';

import {
  BOOK_KIND,
  BOOK_META_FILE,
  BOOK_SCHEMA_VERSION,
  BOOKS_DIR,
  CHAPTER_FILE_SUFFIX,
  CHAPTER_SCHEMA_VERSION,
  CHAPTERS_DIR,
  emptyChapterDoc,
  type Book,
  type BookBundle,
  type BookSummary,
  type Chapter,
  type ChapterImageRef,
  type ChapterPreview,
  type ChapterSummary,
} from '../models/book.types';

// why: estimación de páginas para capítulos que nunca pasaron por el editor.
//      250 palabras/página es el estándar de libros impresos (folio).
const PAGES_PER_WORD_DIVISOR = 250;
const estimatePageCount = (words: number): number =>
  Math.max(1, Math.ceil(words / PAGES_PER_WORD_DIVISOR));

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

interface BookLocation {
  readonly folder: string;
  readonly slug: string;
}

@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  private readonly idToLoc = new Map<string, BookLocation>();
  private readonly chapterCountById = new Map<string, number>();
  private readonly summariesSignal = signal<readonly BookSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();
  private readonly foldersSignal = signal<readonly string[]>([]);
  readonly folders = this.foldersSignal.asReadonly();
  readonly foldersSet = computed(() => new Set(this.foldersSignal()));

  constructor() {
    this.migrations.register({
      kind: BOOK_KIND,
      latest: BOOK_SCHEMA_VERSION,
      // why: v3→v4 es identidad. Sólo agrega campos opcionales (cover/back/
      //      accent en Book; pageCount/image en Chapter); los archivos viejos
      //      quedan válidos y los defaults los resuelve la UI.
      steps: [
        blockIdMigrationStep(1),
        positionSeedMigrationStep(2),
        { from: 3, to: 4, run: (d) => ({ ...d, schemaVersion: 4 }) },
      ],
    });
  }

  async refresh(): Promise<readonly BookSummary[]> {
    const root = await this.booksDir();
    this.idToLoc.clear();
    this.chapterCountById.clear();
    const summaries: BookSummary[] = [];
    const folders: string[] = [];
    const indexDocs: SearchDoc[] = [];
    const booksById = new Map<string, Book>();
    await this.walkBooks(root, '', summaries, folders, indexDocs, booksById);
    summaries.sort(compareLegacy);
    const seeds = seedMissingPositions(summaries);
    if (seeds.length > 0) {
      const positionById = new Map(seeds.map((s) => [s.id, s.position] as const));
      for (const [id, pos] of positionById) {
        const book = booksById.get(id);
        if (book) await this.writePositionInPlace(book, pos);
      }
      for (let i = 0; i < summaries.length; i++) {
        const seeded = positionById.get(summaries[i]!.id);
        if (seeded) summaries[i] = { ...summaries[i]!, position: seeded };
      }
    }
    summaries.sort(comparePosition);
    this.summariesSignal.set(summaries);
    this.foldersSignal.set(folders);
    await this.search.rebuild(indexDocs);
    return summaries;
  }

  async createBook(title = '', folder = ''): Promise<Book> {
    const root = await this.booksDir();
    const parent = await getOrCreateDirByPath(this.fs, root, folder);
    const slug = await this.allocSlug(parent, title);
    const bookDir = await this.fs.getOrCreateDir(parent, slug);
    await this.fs.getOrCreateDir(bookDir, CHAPTERS_DIR);
    const now = new Date().toISOString();
    const position = nextPositionAfter(lastPosition(this.summariesSignal()));
    const book: Book = {
      id: crypto.randomUUID(),
      title,
      tags: [],
      order: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: BOOK_SCHEMA_VERSION,
      position,
    };
    await this.fs.writeFileAtomic(bookDir, BOOK_META_FILE, JSON.stringify(book, null, 2));
    this.idToLoc.set(book.id, { folder, slug });
    this.chapterCountById.set(book.id, 0);
    this.summariesSignal.update((curr) =>
      sortByPosition([...curr, this.toSummary(book, folder, 0)]),
    );
    if (folder !== '' && !this.foldersSet().has(folder)) {
      this.foldersSignal.update((curr) => [...curr, folder]);
    }
    await this.search.upsert(this.toSearchDoc(book, []));
    return book;
  }

  async readBook(id: string): Promise<Book> {
    const dir = await this.bookDir(id);
    const raw = await this.fs.readJson<Book>(dir, BOOK_META_FILE);
    return this.migrations.migrate<Book>(BOOK_KIND, raw);
  }

  async saveBook(book: Book): Promise<Book> {
    const dir = await this.bookDir(book.id);
    const cleanTags = this.dropStaleTags(book.tags);
    const updated: Book = { ...book, tags: cleanTags, updatedAt: new Date().toISOString() };
    await this.fs.writeFileAtomic(dir, BOOK_META_FILE, JSON.stringify(updated, null, 2));
    const loc = this.idToLoc.get(book.id);
    if (loc) {
      const count = this.chapterCountById.get(book.id) ?? 0;
      this.summariesSignal.update((curr) =>
        sortByPosition(
          curr.map((s) => (s.id === book.id ? this.toSummary(updated, loc.folder, count) : s)),
        ),
      );
    }
    await this.search.upsert(this.toSearchDoc(updated, await this.listChaptersText(book.id)));
    return updated;
  }

  async setPosition(id: string, position: string): Promise<void> {
    const book = await this.readBook(id);
    const updated: Book = { ...book, position, updatedAt: new Date().toISOString() };
    const dir = await this.bookDir(id);
    await this.fs.writeFileAtomic(dir, BOOK_META_FILE, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sortByPosition(curr.map((s) => (s.id === id ? { ...s, position } : s))),
    );
  }

  private async writePositionInPlace(book: Book, position: string): Promise<void> {
    const dir = await this.bookDir(book.id);
    const seeded: Book = { ...book, position };
    await this.fs.writeFileAtomic(dir, BOOK_META_FILE, JSON.stringify(seeded, null, 2));
  }

  async deleteBookToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const loc = await this.findLoc(id);
    const bookDir = await this.bookDir(id);
    const book = await this.fs.readJson<Book>(bookDir, BOOK_META_FILE);
    const chapters = await this.readAllChapters(bookDir);
    const bundle: BookBundle = { book, chapters };
    const trash = await this.trashDir(root);
    const dest = `${BOOK_KIND}__${id}__${loc.slug}.json`;
    await this.fs.writeFileAtomic(trash, dest, JSON.stringify(bundle, null, 2));
    const parent = await this.getFolderDir(loc.folder);
    if (parent) {
      try {
        await this.fs.removeEntry(parent, loc.slug, { recursive: true });
      } catch {
        /* already gone */
      }
    }
    this.idToLoc.delete(id);
    this.chapterCountById.delete(id);
    this.summariesSignal.update((curr) => curr.filter((s) => s.id !== id));
    await this.search.remove(id);
    for (const ch of chapters) await this.search.remove(ch.id);
  }

  async restoreFromBundle(bundle: BookBundle): Promise<void> {
    const root = await this.booksDir();
    const slug = await this.allocSlug(root, bundle.book.title);
    const bookDir = await this.fs.getOrCreateDir(root, slug);
    const chaptersDir = await this.fs.getOrCreateDir(bookDir, CHAPTERS_DIR);
    await this.fs.writeFileAtomic(bookDir, BOOK_META_FILE, JSON.stringify(bundle.book, null, 2));
    for (const ch of bundle.chapters) {
      const chSlug = await this.allocChapterSlug(chaptersDir, ch.title);
      await this.fs.writeFileAtomic(chaptersDir, chSlug, JSON.stringify(ch, null, 2));
    }
    await this.refresh();
  }

  // why: rename de un "estante" (= folder en disco) se resuelve moviendo cada
  //      libro del folder viejo al nuevo. moveBookToFolder ya crea el destino
  //      si no existe y borra el dir del libro en el origen; al final del loop
  //      el folder viejo queda vacío (su dir físico puede sobrevivir hasta el
  //      próximo refresh). Devuelve cantidad de libros movidos.
  async renameShelf(oldFolder: string, newFolder: string): Promise<number> {
    if (oldFolder === '' || oldFolder === newFolder.trim()) return 0;
    const target = newFolder.trim();
    if (target === '') return 0;
    const ids = this.summariesSignal()
      .filter((s) => s.folder === oldFolder)
      .map((s) => s.id);
    for (const id of ids) {
      await this.moveBookToFolder(id, target);
    }
    this.foldersSignal.update((curr) => curr.filter((f) => f !== oldFolder));
    return ids.length;
  }

  async moveBookToFolder(id: string, newFolder: string): Promise<void> {
    const loc = await this.findLoc(id);
    if (loc.folder === newFolder) return;
    const root = await this.booksDir();
    const srcParent = await this.getFolderDir(loc.folder);
    if (!srcParent) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const destParent = await getOrCreateDirByPath(this.fs, root, newFolder);
    const destSlug = await this.allocAvailableDir(destParent, loc.slug);
    const srcDir = await this.fs.getDir(srcParent, loc.slug);
    if (!srcDir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const destDir = await this.fs.getOrCreateDir(destParent, destSlug);
    await moveBookDir(this.fs, srcDir, destDir);
    try {
      await this.fs.removeEntry(srcParent, loc.slug, { recursive: true });
    } catch {
      /* already gone */
    }
    this.idToLoc.set(id, { folder: newFolder, slug: destSlug });
    this.summariesSignal.update((curr) =>
      sortByPosition(curr.map((s) => (s.id === id ? { ...s, folder: newFolder } : s))),
    );
    if (newFolder !== '' && !this.foldersSet().has(newFolder)) {
      this.foldersSignal.update((curr) => [...curr, newFolder]);
    }
  }

  async listChapters(bookId: string): Promise<readonly ChapterSummary[]> {
    const chaptersDir = await this.chaptersDir(bookId);
    interface Draft {
      readonly id: string;
      readonly title: string;
      readonly updatedAt: string;
      readonly words: number;
      readonly preview: ChapterPreview;
      readonly pageCount: number;
      readonly image: ChapterImageRef;
    }
    const map = new Map<string, Draft>();
    const idToFile = new Map<string, string>();
    for await (const filename of this.fs.listFiles(chaptersDir, CHAPTER_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Chapter>(chaptersDir, filename);
        const ch = await this.migrations.migrate<Chapter>(BOOK_KIND, raw);
        const plain = extractPlainText(ch.body);
        const words = countWords(plain);
        map.set(ch.id, {
          id: ch.id,
          title: ch.title,
          updatedAt: ch.updatedAt,
          words,
          preview: buildChapterPreview(plain),
          pageCount: ch.pageCount ?? estimatePageCount(words),
          image: ch.image ?? { kind: 'auto' },
        });
        idToFile.set(ch.id, filename);
      } catch (cause) {
        console.warn('[books] skipped chapter', filename, cause);
      }
    }
    const book = await this.readBook(bookId);
    const draftsOrdered: Draft[] = [];
    for (const id of book.order) {
      const ch = map.get(id);
      if (ch) {
        draftsOrdered.push(ch);
        map.delete(id);
      }
    }
    for (const ch of map.values()) draftsOrdered.push(ch);
    let cursor = 1;
    const ordered: ChapterSummary[] = draftsOrdered.map((d) => {
      const pageStart = cursor;
      const pageEnd = cursor + Math.max(1, d.pageCount) - 1;
      cursor = pageEnd + 1;
      return { ...d, pageStart, pageEnd };
    });
    this.chapterCountById.set(bookId, ordered.length);
    this.chapterFileCache.set(bookId, idToFile);
    return ordered;
  }

  async addChapter(bookId: string, title = ''): Promise<Chapter> {
    const chaptersDir = await this.chaptersDir(bookId);
    const now = new Date().toISOString();
    const chapter: Chapter = {
      id: crypto.randomUUID(),
      bookId,
      title,
      body: emptyChapterDoc(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: CHAPTER_SCHEMA_VERSION,
    };
    const filename = await this.allocChapterSlug(chaptersDir, title);
    await this.fs.writeFileAtomic(chaptersDir, filename, JSON.stringify(chapter, null, 2));
    const cache = this.chapterFileCache.get(bookId) ?? new Map<string, string>();
    cache.set(chapter.id, filename);
    this.chapterFileCache.set(bookId, cache);
    const book = await this.readBook(bookId);
    const updated: Book = {
      ...book,
      order: [...book.order, chapter.id],
      updatedAt: now,
    };
    await this.saveBook(updated);
    await this.search.upsert(this.toChapterSearchDoc(chapter));
    return chapter;
  }

  async readChapter(bookId: string, chapterId: string): Promise<Chapter> {
    const chaptersDir = await this.chaptersDir(bookId);
    const filename = await this.findChapterFile(bookId, chaptersDir, chapterId);
    const raw = await this.fs.readJson<Chapter>(chaptersDir, filename);
    return this.migrations.migrate<Chapter>(BOOK_KIND, raw);
  }

  async saveChapter(chapter: Chapter): Promise<Chapter> {
    const chaptersDir = await this.chaptersDir(chapter.bookId);
    const filename = await this.findChapterFile(chapter.bookId, chaptersDir, chapter.id);
    const updated: Chapter = { ...chapter, updatedAt: new Date().toISOString() };
    await this.fs.writeFileAtomic(chaptersDir, filename, JSON.stringify(updated, null, 2));
    const book = await this.readBook(chapter.bookId);
    await this.saveBook({ ...book, updatedAt: updated.updatedAt });
    await this.search.upsert(this.toChapterSearchDoc(updated));
    return updated;
  }

  async removeChapter(bookId: string, chapterId: string): Promise<void> {
    const chaptersDir = await this.chaptersDir(bookId);
    const filename = await this.findChapterFile(bookId, chaptersDir, chapterId);
    await this.fs.removeEntry(chaptersDir, filename);
    const cache = this.chapterFileCache.get(bookId);
    if (cache) cache.delete(chapterId);
    const book = await this.readBook(bookId);
    await this.saveBook({
      ...book,
      order: book.order.filter((id) => id !== chapterId),
      updatedAt: new Date().toISOString(),
    });
    await this.search.remove(chapterId);
  }

  async reorderChapters(bookId: string, order: readonly string[]): Promise<void> {
    const book = await this.readBook(bookId);
    await this.saveBook({ ...book, order, updatedAt: new Date().toISOString() });
  }

  private readonly chapterFileCache = new Map<string, Map<string, string>>();

  private async findChapterFile(
    bookId: string,
    chaptersDir: NativeDirRef,
    chapterId: string,
  ): Promise<string> {
    const cached = this.chapterFileCache.get(bookId)?.get(chapterId);
    if (cached) return cached;
    for await (const filename of this.fs.listFiles(chaptersDir, CHAPTER_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Chapter>(chaptersDir, filename);
        if (raw.id === chapterId) {
          const cache = this.chapterFileCache.get(bookId) ?? new Map<string, string>();
          cache.set(chapterId, filename);
          this.chapterFileCache.set(bookId, cache);
          return filename;
        }
      } catch {
        /* skip corrupt */
      }
    }
    throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { chapterId } });
  }

  private async walkBooks(
    dir: NativeDirRef,
    folder: string,
    summaries: BookSummary[],
    folders: string[],
    indexDocs: SearchDoc[],
    booksById: Map<string, Book>,
  ): Promise<void> {
    for await (const name of this.fs.listSubdirs(dir)) {
      const sub = await this.fs.getDir(dir, name);
      if (!sub) continue;
      if (await this.fs.hasEntry(sub, BOOK_META_FILE)) {
        try {
          const raw = await this.fs.readJson<Book>(sub, BOOK_META_FILE);
          const book = await this.migrations.migrate<Book>(BOOK_KIND, raw);
          this.idToLoc.set(book.id, { folder, slug: name });
          booksById.set(book.id, book);
          const chaptersDir = await this.fs.getOrCreateDir(sub, CHAPTERS_DIR);
          let count = 0;
          const chTexts: string[] = [];
          for await (const fn of this.fs.listFiles(chaptersDir, CHAPTER_FILE_SUFFIX)) {
            try {
              const chRaw = await this.fs.readJson<Chapter>(chaptersDir, fn);
              const ch = await this.migrations.migrate<Chapter>(BOOK_KIND, chRaw);
              count++;
              chTexts.push(`${ch.title} ${extractPlainText(ch.body)}`);
              indexDocs.push(this.toChapterSearchDoc(ch));
            } catch {
              /* skip */
            }
          }
          this.chapterCountById.set(book.id, count);
          summaries.push(this.toSummary(book, folder, count));
          indexDocs.push(this.toSearchDoc(book, chTexts));
        } catch (cause) {
          console.warn('[books] skipped book', name, cause);
        }
      } else {
        const path = joinPath(folder, name);
        folders.push(path);
        await this.walkBooks(sub, path, summaries, folders, indexDocs, booksById);
      }
    }
  }

  private async listChaptersText(bookId: string): Promise<readonly string[]> {
    const chaptersDir = await this.chaptersDir(bookId);
    const out: string[] = [];
    for await (const fn of this.fs.listFiles(chaptersDir, CHAPTER_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Chapter>(chaptersDir, fn);
        out.push(`${raw.title} ${extractPlainText(raw.body)}`);
      } catch {
        /* skip */
      }
    }
    return out;
  }

  private async readAllChapters(bookDir: NativeDirRef): Promise<readonly Chapter[]> {
    const chaptersDir = await this.fs.getOrCreateDir(bookDir, CHAPTERS_DIR);
    const out: Chapter[] = [];
    for await (const fn of this.fs.listFiles(chaptersDir, CHAPTER_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Chapter>(chaptersDir, fn);
        out.push(raw);
      } catch {
        /* skip */
      }
    }
    return out;
  }

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  // why: reload directo puede montar la ruta de detalle antes de que el
  //      sidebar dispare refresh() y puebla idToLoc — re-caminamos el
  //      filesystem como fallback en vez de asumir el id borrado (§20a).
  private async findLoc(id: string): Promise<BookLocation> {
    const cached = this.idToLoc.get(id);
    if (cached) return cached;
    const root = await this.booksDir();
    const found = await this.walkForLoc(root, '', id);
    if (found) return found;
    throw new AppError(ERROR_CODES.FS_008, { severity: 'error', context: { id } });
  }

  private async walkForLoc(
    dir: NativeDirRef,
    folder: string,
    id: string,
  ): Promise<BookLocation | null> {
    for await (const name of this.fs.listSubdirs(dir)) {
      const sub = await this.fs.getDir(dir, name);
      if (!sub) continue;
      if (await this.fs.hasEntry(sub, BOOK_META_FILE)) {
        try {
          const raw = await this.fs.readJson<Book>(sub, BOOK_META_FILE);
          this.idToLoc.set(raw.id, { folder, slug: name });
          if (raw.id === id) return { folder, slug: name };
        } catch {
          /* skip corrupt */
        }
      } else {
        const found = await this.walkForLoc(sub, joinPath(folder, name), id);
        if (found) return found;
      }
    }
    return null;
  }

  private async booksDir(): Promise<NativeDirRef> {
    return this.fs.getOrCreateDir(this.requireRoot(), BOOKS_DIR);
  }

  private async getFolderDir(folder: string): Promise<NativeDirRef | null> {
    const root = await this.booksDir();
    return getDirByPath(this.fs, root, folder);
  }

  private async bookDir(id: string): Promise<NativeDirRef> {
    const loc = await this.findLoc(id);
    const parent = await this.getFolderDir(loc.folder);
    if (!parent) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const dir = await this.fs.getDir(parent, loc.slug);
    if (!dir) throw new AppError(ERROR_CODES.FS_008, { severity: 'error', context: { id } });
    return dir;
  }

  private async chaptersDir(bookId: string): Promise<NativeDirRef> {
    const dir = await this.bookDir(bookId);
    return this.fs.getOrCreateDir(dir, CHAPTERS_DIR);
  }

  private async trashDir(root: NativeDirRef): Promise<NativeDirRef> {
    const meta = await this.fs.getOrCreateDir(root, TRASH_DIR);
    const trash = await this.fs.getOrCreateDir(meta, TRASH_SUBDIR);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    let cursor = trash;
    for (const part of today.split('/')) {
      cursor = await this.fs.getOrCreateDir(cursor, part);
    }
    return cursor;
  }

  private async allocSlug(dir: NativeDirRef, title: string): Promise<string> {
    const base = toSlug(title, 'libro');
    for (let n = 1; n < 1000; n++) {
      const candidate = withSuffix(base, n);
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error', context: { base } });
  }

  private async allocChapterSlug(dir: NativeDirRef, title: string): Promise<string> {
    const base = toSlug(title, 'capitulo');
    for (let n = 1; n < 1000; n++) {
      const candidate = `${withSuffix(base, n)}${CHAPTER_FILE_SUFFIX}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error', context: { base } });
  }

  private async allocAvailableDir(dir: NativeDirRef, name: string): Promise<string> {
    if (!(await this.fs.hasEntry(dir, name))) return name;
    for (let n = 1; n < 1000; n++) {
      const candidate = `${name}-${n}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error' });
  }

  private toSummary(book: Book, folder: string, chapterCount: number): BookSummary {
    return {
      id: book.id,
      title: book.title,
      updatedAt: book.updatedAt,
      tags: book.tags,
      folder,
      chapterCount,
      position: book.position ?? '',
      cover: book.cover ?? { kind: 'auto' },
      back: book.back ?? { kind: 'auto' },
      accent: book.accent ?? null,
      subtitle: book.subtitle ?? '',
    };
  }

  private toSearchDoc(book: Book, chapterTexts: readonly string[]): SearchDoc {
    const tagIds = this.dropStaleTags(book.tags);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    const body = chapterTexts.join(' ').trim();
    return {
      id: book.id,
      kind: BOOK_KIND,
      title: book.title,
      body: tagLabels === '' ? body : `${body} ${tagLabels}`,
      tagIds,
    };
  }

  private toChapterSearchDoc(chapter: Chapter): SearchDoc {
    return {
      id: chapter.id,
      kind: BOOK_KIND,
      title: chapter.title,
      body: extractPlainText(chapter.body),
      tagIds: [],
    };
  }

  private dropStaleTags(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    return tagIds.filter((id) => this.tags.byId(id) !== undefined);
  }
}

const compareLegacy = (a: BookSummary, b: BookSummary): number =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

const comparePosition = (a: BookSummary, b: BookSummary): number => {
  if (a.position === '' && b.position === '') return compareLegacy(a, b);
  if (a.position === '') return 1;
  if (b.position === '') return -1;
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
};

const sortByPosition = (list: readonly BookSummary[]): BookSummary[] =>
  [...list].sort(comparePosition);

const lastPosition = (list: readonly BookSummary[]): string | null => {
  let max: string | null = null;
  for (const s of list) {
    if (s.position !== '' && (max === null || s.position > max)) max = s.position;
  }
  return max;
};

const moveBookDir = async (fs: FsService, src: NativeDirRef, dest: NativeDirRef): Promise<void> => {
  for await (const filename of fs.listFiles(src)) {
    await fs.moveFile(src, filename, dest, filename);
  }
  for await (const sub of fs.listSubdirs(src)) {
    const subSrc = await fs.getDir(src, sub);
    if (!subSrc) continue;
    const subDest = await fs.getOrCreateDir(dest, sub);
    await moveBookDir(fs, subSrc, subDest);
  }
};
