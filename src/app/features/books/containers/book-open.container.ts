import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { ImageReaderService } from '@core/images/image-reader.service';
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { entitySlugSegment, extractEntityId } from '@core/routing/entity-slug';
import { SettingsService } from '@core/settings/settings.service';
import { TagsService } from '@core/tags/tags.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';
import { IconComponent } from '@shared/icon/icon.component';
import { hashColor } from '@shared/utils/hash-color';
import { reorderById } from '@shared/utils/reorder';
import { triggerDownload } from '@shared/utils/trigger-download';

import { BookMetaBarComponent, type BookSaveStatus } from '../components/book-meta-bar.component';
import { ChapterIndexCardComponent } from '../components/chapter-index-card.component';
import { BOOK_KIND, type Book, type BookFaceRef, type ChapterSummary } from '../models/book.types';
import { bookToMarkdown, buildImageResolver, markdownFilename } from '../services/book-export.util';
import { BookImagesService } from '../services/book-images.service';
import { BooksService } from '../services/books.service';
import { registerBooksChapterIndexTutorial } from './books-chapter-index.tutorial';

interface IndexPage {
  readonly kind: 'index';
  readonly chapters: readonly ChapterSummary[];
  readonly pageNumber: number;
}
type Page = IndexPage;

interface Spread {
  readonly left: Page | null;
  readonly right: Page | null;
}

const CHAPTERS_PER_INDEX_PAGE = 4;

@Component({
  selector: 'mc-book-open',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BookMetaBarComponent,
    ChapterIndexCardComponent,
    LockBannerComponent,
    ConfirmDialogComponent,
    IconComponent,
    RouterLink,
  ],
  templateUrl: './book-open.container.html',
  styleUrl: './book-open.container.css',
})
export class BookOpenContainer {
  readonly id = input<string | undefined>(undefined);

  private readonly booksService = inject(BooksService);
  private readonly bookImages = inject(BookImagesService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly settings = inject(SettingsService);
  private readonly imageReader = inject(ImageReaderService);

  protected readonly tags = this.tagsService.tags;
  protected readonly authorBio = this.settings.authorBio;
  protected readonly active = signal<Book | null>(null);
  protected readonly chapters = signal<readonly ChapterSummary[]>([]);
  protected readonly bookStatus = signal<BookSaveStatus>('saved');
  protected readonly bookLoading = signal<boolean>(false);
  protected readonly confirm = new ConfirmController();
  protected readonly currentSpread = signal<number>(0);
  // why: el libro arranca siempre cerrado — como agarrar un libro real —
  //      sin importar si la última vez que lo visitaste quedó abierto.
  protected readonly isOpen = signal<boolean>(false);
  protected readonly facing = signal<'front' | 'back'>('front');
  protected readonly opening = signal<boolean>(false);
  protected readonly totalWords = computed(() =>
    this.chapters().reduce((acc, c) => acc + c.words, 0),
  );
  protected readonly totalPages = computed(() =>
    this.chapters().reduce((acc, c) => acc + Math.max(1, c.pageCount), 0),
  );
  protected readonly lock = new EntityLockController(BOOK_KIND, this.active);
  protected readonly coverUrl = signal<string | null>(null);
  protected readonly backUrl = signal<string | null>(null);
  protected readonly chapterImageUrls = signal<Record<string, string>>({});
  private faceObjectUrls: string[] = [];
  private chapterObjectUrls: string[] = [];

  protected readonly indexPages = computed<readonly IndexPage[]>(() => {
    const list = this.chapters();
    const pages: IndexPage[] = [];
    for (let i = 0; i < list.length; i += CHAPTERS_PER_INDEX_PAGE) {
      pages.push({
        kind: 'index',
        chapters: list.slice(i, i + CHAPTERS_PER_INDEX_PAGE),
        pageNumber: Math.floor(i / CHAPTERS_PER_INDEX_PAGE) + 1,
      });
    }
    if (pages.length === 0) {
      pages.push({ kind: 'index', chapters: [], pageNumber: 1 });
    }
    return pages;
  });

  protected readonly spreads = computed<readonly Spread[]>(() => {
    const slots: Page[] = [...this.indexPages()];
    const out: Spread[] = [];
    for (let i = 0; i < slots.length; i += 2) {
      out.push({ left: slots[i] ?? null, right: slots[i + 1] ?? null });
    }
    return out;
  });

  protected readonly atFirst = computed(() => this.currentSpread() === 0);
  protected readonly atLast = computed(() => this.currentSpread() >= this.spreads().length - 1);
  protected readonly current = computed<Spread>(
    () => this.spreads()[this.currentSpread()] ?? { left: null, right: null },
  );

  protected readonly coverPalette = computed(() => {
    const book = this.active();
    if (!book) return { bg: '#3a2c1c', fg: '#f4ece1' };
    if (book.accent) return { bg: book.accent, fg: '#f4ece1' };
    return hashColor(book.id);
  });
  // why: posición de la cinta del marcador manual a lo largo del canto —
  //      proporcional a dónde cae el capítulo marcado en el orden del libro.
  protected readonly bookmarkRibbonTop = computed<number | null>(() => {
    const book = this.active();
    const chapters = this.chapters();
    const chapterId = book?.bookmark?.chapterId;
    if (!chapterId || chapters.length === 0) return null;
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx < 0) return null;
    return Math.round(((idx + 0.5) / chapters.length) * 100);
  });

  constructor() {
    registerBooksChapterIndexTutorial();
    effect(() => {
      const raw = this.id();
      const wanted = raw ? extractEntityId(raw) : undefined;
      const current = this.active();
      if (!wanted) {
        if (current) {
          this.active.set(null);
          this.chapters.set([]);
        }
        return;
      }
      if (current?.id !== wanted) void this.loadBook(wanted);
    });
    effect(() => {
      const max = this.spreads().length - 1;
      if (this.currentSpread() > max) this.currentSpread.set(Math.max(0, max));
    });
    effect(() => {
      const book = this.active();
      void this.refreshFaceUrls(book);
    });
    effect(() => {
      const chapters = this.chapters();
      void this.refreshChapterImageUrls(chapters);
    });
    inject(DestroyRef).onDestroy(() => {
      for (const url of [...this.faceObjectUrls, ...this.chapterObjectUrls]) {
        URL.revokeObjectURL(url);
      }
    });
  }

  private async refreshFaceUrls(book: Book | null): Promise<void> {
    for (const url of this.faceObjectUrls) URL.revokeObjectURL(url);
    this.faceObjectUrls = [];
    if (!book) {
      this.coverUrl.set(null);
      this.backUrl.set(null);
      return;
    }
    this.coverUrl.set(await this.loadFaceUrl(book.id, book.cover));
    this.backUrl.set(await this.loadFaceUrl(book.id, book.back));
  }

  private async loadFaceUrl(bookId: string, ref: BookFaceRef | undefined): Promise<string | null> {
    if (!ref || ref.kind !== 'image') return null;
    try {
      const blob = await this.bookImages.readFaceBlob(bookId, ref);
      const url = URL.createObjectURL(blob);
      this.faceObjectUrls.push(url);
      return url;
    } catch (cause) {
      console.warn('[books] cover/back image load failed', cause);
      return null;
    }
  }

  private async refreshChapterImageUrls(chapters: readonly ChapterSummary[]): Promise<void> {
    for (const url of this.chapterObjectUrls) URL.revokeObjectURL(url);
    this.chapterObjectUrls = [];
    const book = this.active();
    if (!book) {
      this.chapterImageUrls.set({});
      return;
    }
    const next: Record<string, string> = {};
    for (const ch of chapters) {
      if (ch.image.kind !== 'image') continue;
      try {
        const blob = await this.bookImages.readChapterImageBlob(book.id, ch.image);
        const url = URL.createObjectURL(blob);
        this.chapterObjectUrls.push(url);
        next[ch.id] = url;
      } catch (cause) {
        console.warn('[books] chapter image load failed', cause);
      }
    }
    this.chapterImageUrls.set(next);
  }

  protected async onPickCover(event: Event): Promise<void> {
    await this.pickFace('cover', event);
  }
  protected async onPickBack(event: Event): Promise<void> {
    await this.pickFace('back', event);
  }
  protected async onRemoveCover(): Promise<void> {
    await this.clearFace('cover');
  }
  protected async onRemoveBack(): Promise<void> {
    await this.clearFace('back');
  }

  private async pickFace(face: 'cover' | 'back', event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const book = this.active();
    if (!file || !book || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      this.active.set(await this.bookImages.setFace(book.id, face, file, file.name));
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  private async clearFace(face: 'cover' | 'back'): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    try {
      this.active.set(await this.bookImages.clearFace(book.id, face));
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onPickChapterImage(chapterId: string, file: File): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      await this.bookImages.setChapterImage(book.id, chapterId, file, file.name);
      this.chapters.set(await this.booksService.listChapters(book.id));
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onRemoveChapterImage(chapterId: string): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    try {
      await this.bookImages.clearChapterImage(book.id, chapterId);
      this.chapters.set(await this.booksService.listChapters(book.id));
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected isIndex(p: Page | null): p is IndexPage {
    return p !== null && p.kind === 'index';
  }

  protected prevSpread(): void {
    if (this.atFirst()) {
      this.onCloseBook();
      return;
    }
    this.currentSpread.update((v) => Math.max(0, v - 1));
  }
  protected nextSpread(): void {
    const max = this.spreads().length - 1;
    this.currentSpread.update((v) => Math.min(max, v + 1));
  }

  protected onOpenBook(event?: Event): void {
    // why: título/subtítulo son inputs editables sobre la misma cara donde
    //      se escucha el click de apertura — sin este guard, clickear para
    //      escribir el título abre el libro en vez de dejarte tipear.
    const target = event?.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (this.facing() !== 'front' || this.opening()) return;
    this.opening.set(true);
    // why: la animación de apertura dura ~450ms (ver .closed-book.opening
    //      en CSS) — recién ahí conmutamos al spread interno.
    window.setTimeout(() => {
      this.isOpen.set(true);
      this.currentSpread.set(0);
      this.opening.set(false);
    }, 450);
  }
  protected onCloseBook(): void {
    this.isOpen.set(false);
    this.facing.set('front');
  }
  protected onFlip(): void {
    this.facing.update((f) => (f === 'front' ? 'back' : 'front'));
  }
  protected onGoToBookmark(): void {
    const chapterId = this.active()?.bookmark?.chapterId;
    if (!chapterId) return;
    this.onOpenChapter(chapterId);
  }

  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.onTitleChange(target.value);
  }
  protected onTitleChange(title: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, title };
    this.active.set(next);
    this.scheduleBookSave(next);
  }

  protected onSubtitleInput(event: Event): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const next = { ...current, subtitle: target.value };
    this.active.set(next);
    this.scheduleBookSave(next);
  }

  protected onSynopsisInput(event: Event): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) return;
    const next = { ...current, synopsis: target.value };
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
      this.errors.report(this.withReauth(e));
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

  protected onDeleteBook(): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const title = current.title || this.t('books.untitledTitle');
    this.confirm.ask(
      {
        title: this.t('books.confirm.deleteBook.title'),
        message: this.t('books.deleteConfirm').replace('{title}', title),
        confirmLabel: this.t('books.confirm.deleteBook.confirm'),
        cancelLabel: this.t('books.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.booksService.deleteBookToTrash(current.id);
          await this.autosave.clear(current.id);
          await this.router.navigate(['/books']);
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected async onDuplicateBook(): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      const copy = await this.booksService.duplicateBook(current.id);
      await this.router.navigate(['/books', entitySlugSegment(copy.title, copy.id, 'libro')]);
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onExportBookMarkdown(): Promise<void> {
    const current = this.active();
    if (!current) return;
    try {
      const chapters = await this.booksService.readAllChaptersOrdered(current.id);
      const resolveImage = await buildImageResolver(
        this.imageReader,
        chapters.map((c) => c.body),
      );
      const untitled = this.t('books.chapters.untitled');
      const md = bookToMarkdown(current, chapters, untitled, resolveImage);
      const filename = markdownFilename(current.title || this.t('books.untitledTitle'), 'libro');
      triggerDownload(new Blob([md], { type: 'text/markdown' }), filename);
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected onOpenChapter(chapterId: string): void {
    const book = this.active();
    if (!book) return;
    const chapterTitle = this.chapters().find((c) => c.id === chapterId)?.title ?? '';
    void this.router.navigate([
      '/books',
      entitySlugSegment(book.title, book.id, 'libro'),
      entitySlugSegment(chapterTitle, chapterId, 'capitulo'),
    ]);
  }

  protected async onAddChapter(): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      const ch = await this.booksService.addChapter(book.id, '');
      this.chapters.set(await this.booksService.listChapters(book.id));
      this.active.set(await this.booksService.readBook(book.id));
      await this.router.navigate([
        '/books',
        entitySlugSegment(book.title, book.id, 'libro'),
        entitySlugSegment(ch.title, ch.id, 'capitulo'),
      ]);
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onMoveUp(chapterId: string): Promise<void> {
    await this.swapChapter(chapterId, -1);
  }
  protected async onMoveDown(chapterId: string): Promise<void> {
    await this.swapChapter(chapterId, +1);
  }

  protected onRemoveChapter(chapterId: string): void {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    const ch = this.chapters().find((c) => c.id === chapterId);
    const title = ch?.title || this.t('books.chapters.untitled');
    this.confirm.ask(
      {
        title: this.t('books.confirm.deleteChapter.title'),
        message: this.t('books.chapters.deleteConfirm').replace('{title}', title),
        confirmLabel: this.t('books.confirm.deleteChapter.confirm'),
        cancelLabel: this.t('books.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.booksService.removeChapter(book.id, chapterId);
          await this.autosave.clear(chapterId);
          this.chapters.set(await this.booksService.listChapters(book.id));
          this.active.set(await this.booksService.readBook(book.id));
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  private async swapChapter(chapterId: string, delta: number): Promise<void> {
    const book = this.active();
    if (!book || !this.lock.guardWrite()) return;
    const order = [...book.order];
    const idx = order.indexOf(chapterId);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= order.length) return;
    const reordered = reorderById(book.order, order[idx]!, order[target]!);
    try {
      await this.booksService.reorderChapters(book.id, reordered);
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
      this.currentSpread.set(0);
      this.isOpen.set(false);
      this.facing.set('front');
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
      this.chapters.set([]);
    } finally {
      this.bookLoading.set(false);
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
          this.errors.report(this.withReauth(e, () => this.scheduleBookSave(payload)));
          this.bookStatus.set('unsaved');
        }
      },
    });
  }

  private withReauth(error: unknown, retry?: () => void): unknown {
    return withReauthIfNeeded(error, () => this.workspace.reauthorize(), retry);
  }
}
