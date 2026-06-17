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
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { TagsService } from '@core/tags/tags.service';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';
import { reorderById } from '@shared/utils/reorder';

import { BookMetaBarComponent, type BookSaveStatus } from '../components/book-meta-bar.component';
import { ChapterEditorPaneComponent } from '../components/chapter-editor-pane.component';
import { ChapterListComponent } from '../components/chapter-list.component';
import { BOOK_KIND, type Book, type Chapter, type ChapterSummary } from '../models/book.types';
import { BooksService } from '../services/books.service';
import { registerBooksShortcuts } from './books-shortcuts.controller';

const COLLAPSED_KEY = 'mc.books.chapterListCollapsed';

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};
const writeCollapsed = (v: boolean): void => {
  try {
    localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
};

@Component({
  selector: 'mc-books',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BookMetaBarComponent,
    ChapterListComponent,
    ChapterEditorPaneComponent,
    LockBannerComponent,
  ],
  templateUrl: './books.container.html',
  styleUrl: './books.container.css',
})
export class BooksContainer {
  readonly id = input<string | undefined>(undefined);
  readonly chapterId = input<string | undefined>(undefined);

  private readonly booksService = inject(BooksService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<Book | null>(null);
  protected readonly chapters = signal<readonly ChapterSummary[]>([]);
  protected readonly activeChapter = signal<Chapter | null>(null);
  protected readonly bookStatus = signal<BookSaveStatus>('saved');
  protected readonly chapterStatus = signal<BookSaveStatus>('saved');
  protected readonly totalWords = computed(() =>
    this.chapters().reduce((acc, c) => acc + c.words, 0),
  );
  protected readonly focusMode = signal<boolean>(false);
  protected readonly chapterListCollapsed = signal<boolean>(readCollapsed());
  protected readonly bookLoading = signal<boolean>(false);
  protected readonly chapterLoading = signal<boolean>(false);
  protected readonly lock = new EntityLockController(BOOK_KIND, this.active);

  protected onToggleFocus(): void {
    this.focusMode.update((v) => !v);
  }
  protected onChapterListCollapsedChange(v: boolean): void {
    this.chapterListCollapsed.set(v);
    writeCollapsed(v);
  }

  constructor() {
    registerBooksShortcuts({
      newChapter: () => void this.onAddChapter(),
      moveChapterUp: () => {
        const ch = this.activeChapter();
        if (ch) void this.onMoveUp(ch.id);
      },
      moveChapterDown: () => {
        const ch = this.activeChapter();
        if (ch) void this.onMoveDown(ch.id);
      },
      toggleChapterList: () => this.onChapterListCollapsedChange(!this.chapterListCollapsed()),
      toggleFocus: () => this.onToggleFocus(),
    });
    effect(() => {
      const wanted = this.id();
      const current = this.active();
      if (!wanted) {
        if (current) {
          this.active.set(null);
          this.chapters.set([]);
          this.activeChapter.set(null);
        }
        return;
      }
      if (current?.id !== wanted) {
        void this.loadBook(wanted);
      }
    });
    effect(() => {
      const book = this.active();
      const wantedCh = this.chapterId();
      const currentCh = this.activeChapter();
      if (!book || !wantedCh) {
        if (currentCh) this.activeChapter.set(null);
        return;
      }
      if (currentCh?.id === wantedCh) return;
      void this.loadChapter(book.id, wantedCh);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onTitleChange(title: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, title };
    this.active.set(next);
    this.scheduleBookSave(next);
  }

  protected async onAddTag(label: string): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      const tag = await this.tagsService.touch(label);
      if (current.tags.includes(tag.id)) return;
      const next = { ...current, tags: [...current.tags, tag.id] };
      this.active.set(next);
      this.scheduleBookSave(next);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected onRemoveTag(id: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    if (!current.tags.includes(id)) return;
    const next = { ...current, tags: current.tags.filter((t) => t !== id) };
    this.active.set(next);
    this.scheduleBookSave(next);
  }

  protected async onDeleteBook(): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const ok = confirm(
      this.t('books.deleteConfirm').replace(
        '{title}',
        current.title || this.t('books.untitledTitle'),
      ),
    );
    if (!ok) return;
    try {
      await this.booksService.deleteBookToTrash(current.id);
      await this.autosave.clear(current.id);
      this.active.set(null);
      this.chapters.set([]);
      this.activeChapter.set(null);
      await this.router.navigate(['/books']);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onSelectChapter(chapterId: string): void {
    const book = this.active();
    if (!book) return;
    void this.router.navigate(['/books', book.id, chapterId]);
  }

  protected async onAddChapter(): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      const ch = await this.booksService.addChapter(book.id, '');
      this.chapters.set(await this.booksService.listChapters(book.id));
      this.active.set(await this.booksService.readBook(book.id));
      await this.router.navigate(['/books', book.id, ch.id]);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected async onMoveUp(chapterId: string): Promise<void> {
    await this.swapChapter(chapterId, -1);
  }

  protected async onMoveDown(chapterId: string): Promise<void> {
    await this.swapChapter(chapterId, +1);
  }

  protected async onReorder(payload: { from: string; to: string }): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    const order = reorderById(book.order, payload.from, payload.to);
    if (order === book.order) return;
    try {
      await this.booksService.reorderChapters(book.id, order);
      this.active.set(await this.booksService.readBook(book.id));
      this.chapters.set(await this.booksService.listChapters(book.id));
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onRemoveChapter(chapterId: string): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    const ch = this.chapters().find((c) => c.id === chapterId);
    const title = ch?.title || this.t('books.chapters.untitled');
    if (!confirm(this.t('books.chapters.deleteConfirm').replace('{title}', title))) return;
    try {
      await this.booksService.removeChapter(book.id, chapterId);
      await this.autosave.clear(chapterId);
      this.chapters.set(await this.booksService.listChapters(book.id));
      this.active.set(await this.booksService.readBook(book.id));
      if (this.activeChapter()?.id === chapterId) {
        this.activeChapter.set(null);
        await this.router.navigate(['/books', book.id]);
      }
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onChapterTitleChange(title: string): void {
    const current = this.activeChapter();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, title };
    this.activeChapter.set(next);
    this.scheduleChapterSave(next);
  }

  protected onChapterBodyChange(body: JSONContent): void {
    const current = this.activeChapter();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, body };
    this.activeChapter.set(next);
    this.scheduleChapterSave(next);
  }

  private async swapChapter(chapterId: string, delta: number): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    const order = [...book.order];
    const idx = order.indexOf(chapterId);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= order.length) return;
    const a = order[idx];
    const b = order[target];
    if (a === undefined || b === undefined) return;
    order[idx] = b;
    order[target] = a;
    try {
      await this.booksService.reorderChapters(book.id, order);
      this.active.set(await this.booksService.readBook(book.id));
      this.chapters.set(await this.booksService.listChapters(book.id));
    } catch (e) {
      this.errors.report(e);
    }
  }

  private async loadBook(id: string): Promise<void> {
    this.bookLoading.set(true);
    try {
      const book = await this.booksService.readBook(id);
      this.active.set(book);
      this.bookStatus.set('saved');
      this.chapters.set(await this.booksService.listChapters(id));
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
      this.chapters.set([]);
    } finally {
      this.bookLoading.set(false);
    }
  }

  private async loadChapter(bookId: string, chapterId: string): Promise<void> {
    this.chapterLoading.set(true);
    try {
      const ch = await this.booksService.readChapter(bookId, chapterId);
      this.activeChapter.set(ch);
      this.chapterStatus.set('saved');
    } catch (e) {
      this.errors.report(e);
      this.activeChapter.set(null);
    } finally {
      this.chapterLoading.set(false);
    }
  }

  private scheduleBookSave(book: Book): void {
    this.bookStatus.set('unsaved');
    this.autosave.schedule<Book>(book.id, BOOK_KIND, () => book, {
      onFlush: async (payload) => {
        this.bookStatus.set('saving');
        try {
          await this.booksService.saveBook(payload);
          await this.autosave.clear(payload.id);
          this.bookStatus.set('saved');
        } catch (e) {
          this.errors.report(this.withReauthIfNeeded(e, () => this.scheduleBookSave(payload)));
          this.bookStatus.set('unsaved');
        }
      },
    });
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
          const book = this.active();
          if (book) this.chapters.set(await this.booksService.listChapters(book.id));
        } catch (e) {
          this.errors.report(this.withReauthIfNeeded(e, () => this.scheduleChapterSave(payload)));
          this.chapterStatus.set('unsaved');
        }
      },
    });
  }

  private withReauthIfNeeded(error: unknown, retry?: () => void): unknown {
    return withReauthIfNeeded(error, () => this.workspace.reauthorize(), retry);
  }
}
