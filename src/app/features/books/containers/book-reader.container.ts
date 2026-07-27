import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { FocusModeService } from '@core/focus-mode/focus-mode.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
// why: addChapter desde el editor pane usa el mismo flujo que en el desk.
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { ImageReaderService } from '@core/images/image-reader.service';
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { entitySlugSegment, extractEntityId } from '@core/routing/entity-slug';
import { TtsService } from '@core/tts/tts.service';
import type { TtsAction, TtsPaneState } from '@core/tts/tts.types';
import { emptyWritingStats } from '@core/writing-stats/writing-stats.types';
import { WritingStatsService } from '@core/writing-stats/writing-stats.service';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';
import { triggerDownload } from '@shared/utils/trigger-download';

import { ChapterEditorPaneComponent } from '../components/chapter-editor-pane.component';
import type { BookSaveStatus } from '../components/book-meta-bar.component';
import { ReaderMetaRailComponent } from '../components/reader-meta-rail.component';
import { ReaderTocRailComponent } from '../components/reader-toc-rail.component';
import { BOOK_KIND, type Book, type Chapter, type ChapterSummary } from '../models/book.types';
import {
  buildImageResolver,
  chapterToMarkdown,
  markdownFilename,
} from '../services/book-export.util';
import { BooksService } from '../services/books.service';
import { registerReaderShortcuts } from './book-reader.shortcuts';
import { registerBooksCollabTutorial } from './books-collab.tutorial';
import { registerBooksEditorAdvancedTutorial } from './books-editor-advanced.tutorial';
import { registerBooksTtsTutorial } from './books-tts.tutorial';

@Component({
  selector: 'mc-book-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChapterEditorPaneComponent,
    LockBannerComponent,
    ReaderMetaRailComponent,
    ReaderTocRailComponent,
  ],
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
  private readonly globalFocusMode = inject(FocusModeService);
  private readonly writingStats = inject(WritingStatsService);
  private readonly tts = inject(TtsService);
  private readonly imageReader = inject(ImageReaderService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly book = signal<Book | null>(null);
  protected readonly chapters = signal<readonly ChapterSummary[]>([]);
  protected readonly chapter = signal<Chapter | null>(null);
  protected readonly chapterStatus = signal<BookSaveStatus>('saved');
  protected readonly chapterLoading = signal<boolean>(false);
  private readonly localFocusMode = signal<boolean>(false);
  // why: Alt+Shift+F app-wide focus mode (§19.17) and this reader's own Ctrl+.
  //      focus toggle both hide the same chrome, so either one activates it.
  protected readonly focusMode = computed(
    () => this.localFocusMode() || this.globalFocusMode.active(),
  );
  protected readonly indexOpen = signal<boolean>(false);
  private lastScrolledChapterId: string | null = null;
  protected readonly stats = computed(() => ({
    chapter: this.chapter()?.stats ?? emptyWritingStats(),
    book: this.book()?.stats ?? emptyWritingStats(),
    global: this.writingStats.global(),
  }));
  protected readonly lock = new EntityLockController(BOOK_KIND, this.book);
  private readonly paneRef = viewChild(ChapterEditorPaneComponent);
  protected readonly ttsState = computed<TtsPaneState>(() => ({
    supported: this.tts.supported,
    speaking: this.tts.speaking(),
    paused: this.tts.paused(),
    voices: this.tts.voices(),
    prefs: this.tts.prefs(),
  }));

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
    registerBooksEditorAdvancedTutorial();
    registerBooksCollabTutorial();
    registerBooksTtsTutorial();
    registerReaderShortcuts({
      prevChapter: () => this.gotoSibling('prev'),
      nextChapter: () => this.gotoSibling('next'),
      prevPage: () => this.paneRef()?.prevSpread(),
      nextPage: () => this.paneRef()?.nextSpread(),
      toggleFocus: () => this.localFocusMode.update((v) => !v),
      toggleIndex: () => this.indexOpen.update((v) => !v),
      toggleTts: () => this.onTtsAction({ kind: 'toggle' }),
    });
    this.destroyRef.onDestroy(() => this.tts.stop());
    effect(() => {
      // why: la lectura en voz alta lee el DOM del capítulo actual — al
      //      cambiar de capítulo ese DOM deja de existir, así que hay que
      //      cortar antes de que la próxima utterance intente hablar sobre
      //      un bloque que ya no está. Atado sólo al id (no a this.chapter()
      //      entero) por el mismo motivo que chapterId en
      //      ChapterEditorPaneComponent: el body cambia en cada tecla.
      void this.chapter()?.id;
      this.tts.stop();
    });
    effect(() => {
      const raw = this.id();
      const wantedBook = raw ? extractEntityId(raw) : undefined;
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
      const rawCh = this.chapterId();
      const wantedCh = rawCh ? extractEntityId(rawCh) : undefined;
      if (!b || !wantedCh) {
        this.chapter.set(null);
        return;
      }
      if (this.chapter()?.id === wantedCh) return;
      void this.loadChapter(b.id, wantedCh);
    });
    // why: si dejaste el marcador puesto en este capítulo, abrirlo cae
    //      directo en ese párrafo — como un separador físico real. Se
    //      dispara una sola vez por transición de capítulo (no en cada
    //      tecla mientras escribís), guardando el último id ya saltado.
    effect(() => {
      const book = this.book();
      const ch = this.chapter();
      const bookmark = book?.bookmark;
      if (!ch || !bookmark || bookmark.chapterId !== ch.id) return;
      if (this.lastScrolledChapterId === ch.id) return;
      this.lastScrolledChapterId = ch.id;
      queueMicrotask(() => this.paneRef()?.scrollToBlock(bookmark.blockId));
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
    if (b) void this.router.navigate(['/books', entitySlugSegment(b.title, b.id, 'libro')]);
  }
  protected onJumpTo(chId: string): void {
    const b = this.book();
    if (!b) return;
    this.indexOpen.set(false);
    const chTitle = this.chapters().find((c) => c.id === chId)?.title ?? '';
    void this.router.navigate([
      '/books',
      entitySlugSegment(b.title, b.id, 'libro'),
      entitySlugSegment(chTitle, chId, 'capitulo'),
    ]);
  }
  protected onToggleFocus(): void {
    this.localFocusMode.update((v) => !v);
  }
  protected onToggleIndex(): void {
    this.indexOpen.update((v) => !v);
  }
  protected onTtsAction(action: TtsAction): void {
    if (action.kind === 'prefs') {
      this.tts.setPrefs(action.prefs);
      return;
    }
    if (action.kind === 'stop') {
      this.tts.stop();
      this.paneRef()?.highlightSegment(null);
      return;
    }
    // toggle
    if (this.tts.speaking()) {
      if (this.tts.paused()) this.tts.resume();
      else this.tts.pause();
      return;
    }
    const segments = this.paneRef()?.getReadableSegments() ?? [];
    this.tts.speakSegments(segments, (id) => this.paneRef()?.highlightSegment(id));
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

  protected onToggleBookmarkChapter(blockId: string): void {
    const book = this.book();
    const ch = this.chapter();
    if (!book || !ch || !this.lock.guardWrite()) return;
    const isSame = book.bookmark?.blockId === blockId;
    const next = { ...book, bookmark: isSame ? undefined : { chapterId: ch.id, blockId } };
    this.book.set(next);
    this.scheduleBookSave(next);
  }

  protected onChapterPageCountChange(pageCount: number): void {
    const current = this.chapter();
    if (!current || !this.lock.editable()) return;
    if (current.pageCount === pageCount) return;
    const next = { ...current, pageCount };
    this.chapter.set(next);
    this.scheduleChapterSave(next);
  }

  protected async onExportChapterMarkdown(): Promise<void> {
    const ch = this.chapter();
    if (!ch) return;
    const resolveImage = await buildImageResolver(this.imageReader, [ch.body]);
    const untitled = this.t('books.chapters.untitled');
    const md = chapterToMarkdown(ch, untitled, resolveImage);
    const filename = markdownFilename(ch.title || untitled, 'capitulo');
    triggerDownload(new Blob([md], { type: 'text/markdown' }), filename);
  }

  protected async onAddChapter(): Promise<void> {
    const b = this.book();
    if (!b || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      const ch = await this.booksService.addChapter(b.id, '');
      this.book.set(await this.booksService.readBook(b.id));
      this.chapters.set(await this.booksService.listChapters(b.id));
      await this.router.navigate([
        '/books',
        entitySlugSegment(b.title, b.id, 'libro'),
        entitySlugSegment(ch.title, ch.id, 'capitulo'),
      ]);
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

  private scheduleBookSave(book: Book): void {
    this.autosave.schedule<Book>(book.id, BOOK_KIND, () => book, {
      onFlush: async (payload) => {
        try {
          await this.booksService.saveBook(payload);
          await this.autosave.clear(payload.id);
        } catch (e) {
          this.errors.report(
            withReauthIfNeeded(
              e,
              () => this.workspace.reauthorize(),
              () => this.scheduleBookSave(payload),
            ),
          );
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
