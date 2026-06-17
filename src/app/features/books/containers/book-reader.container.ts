import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
// why: addChapter desde el editor pane usa el mismo flujo que en el desk.
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';

import { ChapterEditorPaneComponent } from '../components/chapter-editor-pane.component';
import type { BookSaveStatus } from '../components/book-meta-bar.component';
import { BOOK_KIND, type Book, type Chapter, type ChapterSummary } from '../models/book.types';
import { BooksService } from '../services/books.service';
import { registerReaderShortcuts } from './book-reader.shortcuts';

@Component({
  selector: 'mc-book-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChapterEditorPaneComponent, LockBannerComponent],
  templateUrl: './book-reader.container.html',
  styleUrl: './book-reader.container.css',
})
export class BookReaderContainer {
  readonly id = input<string | undefined>(undefined);
  readonly chapterId = input<string | undefined>(undefined);

  private readonly booksService = inject(BooksService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly book = signal<Book | null>(null);
  protected readonly chapters = signal<readonly ChapterSummary[]>([]);
  protected readonly chapter = signal<Chapter | null>(null);
  protected readonly chapterStatus = signal<BookSaveStatus>('saved');
  protected readonly chapterLoading = signal<boolean>(false);
  protected readonly focusMode = signal<boolean>(false);
  protected readonly indexOpen = signal<boolean>(false);
  protected readonly lock = new EntityLockController(BOOK_KIND, this.book);

  protected readonly activeIndex = computed(() => {
    const ch = this.chapter();
    if (!ch) return -1;
    return this.chapters().findIndex((c) => c.id === ch.id);
  });
  protected readonly prev = computed<ChapterSummary | null>(() => {
    const i = this.activeIndex();
    return i > 0 ? (this.chapters()[i - 1] ?? null) : null;
  });
  protected readonly next = computed<ChapterSummary | null>(() => {
    const i = this.activeIndex();
    const list = this.chapters();
    return i >= 0 && i < list.length - 1 ? (list[i + 1] ?? null) : null;
  });

  constructor() {
    registerReaderShortcuts({
      prevChapter: () => this.gotoSibling('prev'),
      nextChapter: () => this.gotoSibling('next'),
      toggleFocus: () => this.focusMode.update((v) => !v),
      toggleIndex: () => this.indexOpen.update((v) => !v),
    });
    effect(() => {
      const wantedBook = this.id();
      if (!wantedBook) {
        this.book.set(null);
        this.chapters.set([]);
        this.chapter.set(null);
        return;
      }
      if (this.book()?.id !== wantedBook) void this.loadBook(wantedBook);
    });
    effect(() => {
      const b = this.book();
      const wantedCh = this.chapterId();
      if (!b || !wantedCh) {
        this.chapter.set(null);
        return;
      }
      if (this.chapter()?.id === wantedCh) return;
      void this.loadChapter(b.id, wantedCh);
    });
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected bookTitle(): string {
    return this.book()?.title || this.t('books.untitledTitle');
  }
  protected chapterTitle(): string {
    return this.chapter()?.title || this.t('books.chapters.untitled');
  }
  protected indexLabel(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  protected onBackToDesk(): void {
    const b = this.book();
    if (b) void this.router.navigate(['/books', b.id]);
  }
  protected onJumpTo(chId: string): void {
    const b = this.book();
    if (!b) return;
    this.indexOpen.set(false);
    void this.router.navigate(['/books', b.id, chId]);
  }
  protected onToggleFocus(): void {
    this.focusMode.update((v) => !v);
  }
  protected onToggleIndex(): void {
    this.indexOpen.update((v) => !v);
  }
  private gotoSibling(dir: 'prev' | 'next'): void {
    const target = dir === 'prev' ? this.prev() : this.next();
    if (target) this.onJumpTo(target.id);
  }

  protected onChapterTitleChange(title: string): void {
    const current = this.chapter();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, title };
    this.chapter.set(next);
    this.scheduleChapterSave(next);
  }
  protected onChapterBodyChange(body: JSONContent): void {
    const current = this.chapter();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, body };
    this.chapter.set(next);
    this.scheduleChapterSave(next);
  }

  protected async onAddChapter(): Promise<void> {
    const b = this.book();
    if (!b || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      const ch = await this.booksService.addChapter(b.id, '');
      this.book.set(await this.booksService.readBook(b.id));
      this.chapters.set(await this.booksService.listChapters(b.id));
      await this.router.navigate(['/books', b.id, ch.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  private async loadBook(id: string): Promise<void> {
    try {
      this.book.set(await this.booksService.readBook(id));
      this.chapters.set(await this.booksService.listChapters(id));
    } catch (e) {
      this.errors.report(e);
      this.book.set(null);
      this.chapters.set([]);
    }
  }

  private async loadChapter(bookId: string, chapterId: string): Promise<void> {
    this.chapterLoading.set(true);
    try {
      this.chapter.set(await this.booksService.readChapter(bookId, chapterId));
      this.chapterStatus.set('saved');
    } catch (e) {
      this.errors.report(e);
      this.chapter.set(null);
    } finally {
      this.chapterLoading.set(false);
    }
  }

  private scheduleChapterSave(chapter: Chapter): void {
    this.chapterStatus.set('unsaved');
    this.autosave.schedule<Chapter>(chapter.id, BOOK_KIND, () => chapter, {
      onFlush: async (payload) => {
        this.chapterStatus.set('saving');
        try {
          await this.booksService.saveChapter(payload);
          await this.autosave.clear(payload.id);
          this.chapterStatus.set('saved');
          const b = this.book();
          if (b) this.chapters.set(await this.booksService.listChapters(b.id));
        } catch (e) {
          this.errors.report(
            withReauthIfNeeded(
              e,
              () => this.workspace.reauthorize(),
              () => this.scheduleChapterSave(payload),
            ),
          );
          this.chapterStatus.set('unsaved');
        }
      },
    });
  }
}
