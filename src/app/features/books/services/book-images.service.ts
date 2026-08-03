import { Injectable, inject } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { guessMimeFromName } from '@core/images/render-thumb.util';

import type { Book, BookFaceRef, Chapter, ChapterImageRef } from '../models/book.types';
import { BooksService } from './books.service';

type Face = 'cover' | 'back';

const extFromBlob = (originalName: string, mime: string): string => {
  const dot = originalName.lastIndexOf('.');
  if (dot >= 0) return originalName.slice(dot + 1).toLowerCase();
  const guessed = mime || guessMimeFromName(originalName);
  if (guessed === 'image/jpeg') return 'jpg';
  if (guessed === 'image/png') return 'png';
  if (guessed === 'image/webp') return 'webp';
  if (guessed === 'image/gif') return 'gif';
  return 'bin';
};

// why: cover/back/chapter overrides store the blob directly alongside the
//      book's own JSON files (no thumbnail generation) — unlike gallery
//      images, each of these appears as a single instance (one cover per
//      book, one image per chapter), so a resized thumb buys nothing over
//      letting CSS scale the original. See docs/deferred/trash-books.md for
//      the feature this closes.
@Injectable({ providedIn: 'root' })
export class BookImagesService {
  private readonly fs = inject(FsService);
  private readonly books = inject(BooksService);

  async setFace(bookId: string, face: Face, blob: Blob, originalName: string): Promise<Book> {
    const dir = await this.books.bookDirFor(bookId);
    const book = await this.books.readBook(bookId);
    await this.removePrevious(dir, book[face] as BookFaceRef | undefined);
    const filename = `${face}.${extFromBlob(originalName, blob.type)}`;
    await this.fs.writeFileAtomicBinary(dir, filename, blob);
    const ref: BookFaceRef = { kind: 'image', file: filename };
    return this.books.saveBook({ ...book, [face]: ref });
  }

  async clearFace(bookId: string, face: Face): Promise<Book> {
    const dir = await this.books.bookDirFor(bookId);
    const book = await this.books.readBook(bookId);
    await this.removePrevious(dir, book[face] as BookFaceRef | undefined);
    const next: Book = { ...book };
    delete (next as Record<string, unknown>)[face];
    return this.books.saveBook(next);
  }

  async readFaceBlob(bookId: string, ref: BookFaceRef): Promise<Blob> {
    const dir = await this.books.bookDirFor(bookId);
    return this.readImage(dir, ref, bookId);
  }

  async setChapterImage(
    bookId: string,
    chapterId: string,
    blob: Blob,
    originalName: string,
  ): Promise<Chapter> {
    const dir = await this.books.chaptersDirFor(bookId);
    const chapter = await this.books.readChapter(bookId, chapterId);
    await this.removePrevious(dir, chapter.image);
    const filename = `${chapterId}.img.${extFromBlob(originalName, blob.type)}`;
    await this.fs.writeFileAtomicBinary(dir, filename, blob);
    const image: ChapterImageRef = { kind: 'image', file: filename };
    return this.books.saveChapter({ ...chapter, image });
  }

  async clearChapterImage(bookId: string, chapterId: string): Promise<Chapter> {
    const dir = await this.books.chaptersDirFor(bookId);
    const chapter = await this.books.readChapter(bookId, chapterId);
    await this.removePrevious(dir, chapter.image);
    const next: Chapter = { ...chapter };
    delete (next as Record<string, unknown>)['image'];
    return this.books.saveChapter(next);
  }

  async readChapterImageBlob(bookId: string, ref: ChapterImageRef): Promise<Blob> {
    const dir = await this.books.chaptersDirFor(bookId);
    return this.readImage(dir, ref, bookId);
  }

  private async readImage(
    dir: NativeDirRef,
    ref: BookFaceRef | ChapterImageRef | undefined,
    bookId: string,
  ): Promise<Blob> {
    if (!ref || ref.kind !== 'image') {
      throw new AppError(ERROR_CODES.IMG_001, { severity: 'error', context: { bookId } });
    }
    try {
      return await this.fs.readFile(dir, ref.file);
    } catch (cause) {
      throw new AppError(ERROR_CODES.IMG_001, {
        severity: 'error',
        cause,
        context: { bookId, file: ref.file },
      });
    }
  }

  private async removePrevious(
    dir: NativeDirRef,
    ref: BookFaceRef | ChapterImageRef | undefined,
  ): Promise<void> {
    if (!ref || ref.kind !== 'image') return;
    try {
      await this.fs.removeEntry(dir, ref.file);
    } catch {
      /* already gone */
    }
  }
}
