import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { handleCreateFolder, openFolderActionDialog } from '@core/folders/folder-crud';
import { FoldersService } from '@core/folders/folders.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { entitySlugSegment } from '@core/routing/entity-slug';

import { FolderActionDialogComponent } from '@shared/folder-action-dialog/folder-action-dialog.component';
import { FolderActionDialogController } from '@shared/folder-action-dialog/folder-action-dialog.controller';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { BookVolumeComponent } from '@shared/entity-cards/book-volume.component';
import { IconComponent } from '@shared/icon/icon.component';

import { BookCatalogOverlayComponent } from '../components/book-catalog-overlay.component';
import type { BookSummary } from '../models/book.types';
import { BooksService } from '../services/books.service';
import { readDragId, shelfDropTarget, slotDropTarget } from './bookshelf-dnd';
import { DENSITY_KEY, loadDensity, wireBfcacheReset } from './bookshelf-prefs';
import { buildBookTooltip, toCatalogShelves } from './bookshelf-projections';

interface SummaryView {
  readonly summary: BookSummary;
  readonly tallness: 'short' | 'medium' | 'tall';
  readonly tooltip: string;
}

interface Shelf {
  readonly folder: string;
  readonly books: readonly SummaryView[];
}

const TALLNESS: readonly ('short' | 'medium' | 'tall')[] = ['short', 'medium', 'tall'];

@Component({
  selector: 'mc-bookshelf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BookCatalogOverlayComponent,
    BookVolumeComponent,
    IconComponent,
    FolderBreadcrumbComponent,
    FolderActionDialogComponent,
  ],
  templateUrl: './bookshelf.container.html',
  styleUrl: './bookshelf.container.css',
})
export class BookshelfContainer {
  private readonly booksService = inject(BooksService);
  private readonly foldersService = inject(FoldersService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly folderActionDialog = new FolderActionDialogController();

  protected readonly summaries = this.booksService.summaries;
  protected readonly folders = this.booksService.folders;
  protected readonly query = signal<string>('');
  protected readonly mode = signal<'shelf' | 'list'>('shelf');
  // why: id del libro abriéndose tras un click — dispara la animación CSS antes de navegar.
  protected readonly opening = signal<string | null>(null);
  // why: DnD — libro arrastrado + estado de hover sobre el estante actual / una subcarpeta.
  protected readonly draggingId = signal<string | null>(null);
  protected readonly dragOverCurrent = signal<boolean>(false);
  // why: densidad compacta reduce libros al 65%, persistida en localStorage.
  protected readonly density = signal<'normal' | 'compact'>(loadDensity());
  // why: estado UI del overlay del catálogo (libro-índice). No persistido.
  protected readonly catalogOpen = signal<boolean>(false);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly currentFolder = computed(() => this.params().get('folder') ?? '');
  protected readonly allFolders = this.booksService.folders;

  // why: catálogo/índice global — a diferencia del estante on-screen (que sólo
  //      muestra la carpeta actual), el índice sigue mostrando la biblioteca
  //      entera para poder saltar a cualquier libro sin navegar carpeta por
  //      carpeta.
  protected readonly catalogShelves = computed(() =>
    toCatalogShelves(this.allShelvesGrouped(), (f) => this.shelfLabel(f)),
  );

  constructor() {
    effect(() => localStorage.setItem(DENSITY_KEY, this.density()));
    inject(DestroyRef).onDestroy(
      wireBfcacheReset(() => {
        this.query.set('');
        this.draggingId.set(null);
        this.dragOverCurrent.set(false);
      }),
    );
  }

  protected readonly views = computed<readonly SummaryView[]>(() =>
    this.summariesFiltered().map((s) => ({
      summary: s,
      tallness: TALLNESS[seedHash(s.id) % TALLNESS.length] ?? 'medium',
      tooltip: buildBookTooltip(s, (k, p) => this.t(k, p)),
    })),
  );
  private summariesFiltered(): readonly BookSummary[] {
    const q = this.query().trim().toLowerCase();
    return this.summaries().filter((s) => q === '' || (s.title || '').toLowerCase().includes(q));
  }

  // why: agrupado por folder — '' va arriba ('Sin estante'), resto alfabético.
  //      Sólo alimenta el catálogo/índice global (ver catalogShelves arriba).
  private readonly allShelvesGrouped = computed<readonly Shelf[]>(() => {
    const grouped = new Map<string, SummaryView[]>();
    for (const v of this.views()) {
      const key = v.summary.folder;
      const arr = grouped.get(key);
      if (arr) arr.push(v);
      else grouped.set(key, [v]);
    }
    const out: Shelf[] = [];
    const root = grouped.get('');
    if (root) out.push({ folder: '', books: root });
    const named = [...grouped.entries()]
      .filter(([f]) => f !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [folder, books] of named) out.push({ folder, books });
    return out;
  });

  // why: estante visible en pantalla — sólo los libros de la carpeta actual
  //      (match exacto, las subcarpetas se navegan vía el breadcrumb).
  protected readonly currentShelfBooks = computed<readonly SummaryView[]>(() =>
    this.views().filter((v) => v.summary.folder === this.currentFolder()),
  );

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected onQuery(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }
  protected clearQuery(): void {
    this.query.set('');
  }
  protected toggleMode(): void {
    this.mode.update((m) => (m === 'shelf' ? 'list' : 'shelf'));
  }
  protected toggleDensity(): void {
    this.density.update((d) => (d === 'normal' ? 'compact' : 'normal'));
  }
  protected openCatalog(): void {
    this.catalogOpen.set(true);
  }
  protected closeCatalog(): void {
    this.catalogOpen.set(false);
  }
  protected onCatalogSelect(id: string): void {
    this.closeCatalog();
    const title = this.summaries().find((s) => s.id === id)?.title ?? '';
    this.openBook(id, title);
  }
  protected openBook(id: string, title: string): void {
    if (this.opening() !== null) return;
    this.opening.set(id);
    // why: la animación de apertura dura ~520ms (ver .slot.opening en CSS).
    //      Navegamos al cerrarse para que el usuario vea el libro saliendo
    //      antes del cambio de ruta.
    window.setTimeout(() => {
      void this.router.navigate(['/books', entitySlugSegment(title, id, 'libro')]);
    }, 520);
  }
  protected async createBook(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const book = await this.booksService.createBook('', this.currentFolder());
      await this.router.navigate(['/books', entitySlugSegment(book.title, book.id, 'libro')]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected shelfLabel(folder: string): string {
    return folder === '' ? this.t('books.shelf.unshelved') : folder;
  }

  protected onDragStart(id: string, event: DragEvent): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
    this.draggingId.set(id);
  }
  protected onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOverCurrent.set(false);
  }
  protected onDragOverCurrentShelf(event: DragEvent): void {
    if (this.draggingId() === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverCurrent.set(true);
  }
  protected onDragLeaveCurrentShelf(): void {
    this.dragOverCurrent.set(false);
  }
  protected async onDropOnCurrentShelf(event: DragEvent): Promise<void> {
    event.preventDefault();
    const id = readDragId(event, this.draggingId());
    this.onDragEnd();
    if (id === null) return;
    const target = shelfDropTarget(this.summaries(), this.currentFolder(), id);
    await this.applyMove(id, target.folder, target.position);
  }
  protected async onDropOnSlot(targetId: string, event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const id = readDragId(event, this.draggingId());
    this.onDragEnd();
    if (id === null || id === targetId) return;
    const target = slotDropTarget(this.summaries(), targetId, id);
    if (target) await this.applyMove(id, target.folder, target.position);
  }
  // why: soltar un libro sobre una tarjeta de subcarpeta del breadcrumb lo
  //      mueve directo a esa subcarpeta, sin tener que abrirla primero.
  protected onDragOverChildFolder(payload: { path: string; event: DragEvent }): void {
    if (this.draggingId() === null) return;
    payload.event.preventDefault();
    if (payload.event.dataTransfer) payload.event.dataTransfer.dropEffect = 'move';
  }
  protected async onDropOnChildFolder(payload: { path: string; event: DragEvent }): Promise<void> {
    payload.event.preventDefault();
    const id = readDragId(payload.event, this.draggingId());
    this.onDragEnd();
    if (id === null) return;
    const target = shelfDropTarget(this.summaries(), payload.path, id);
    await this.applyMove(id, target.folder, target.position);
  }
  private async applyMove(id: string, folder: string, position: string): Promise<void> {
    try {
      const dragged = this.summaries().find((s) => s.id === id);
      if (dragged && dragged.folder !== folder) {
        await this.booksService.moveBookToFolder(id, folder);
      }
      await this.booksService.setPosition(id, position);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected onFolderNavigate(path: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: path || null },
      queryParamsHandling: 'merge',
    });
  }

  protected async onCreateSubfolder(): Promise<void> {
    await handleCreateFolder('book', this.foldersService, this.i18n, this.currentFolder());
  }

  protected onManageFolder(path: string): void {
    openFolderActionDialog(
      `book:${path}`,
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
    );
  }
}

const seedHash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
