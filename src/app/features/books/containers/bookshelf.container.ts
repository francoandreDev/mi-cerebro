import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import { IconComponent } from '@shared/icon/icon.component';

import { BookCatalogOverlayComponent } from '../components/book-catalog-overlay.component';
import { BookVolumeComponent } from '../components/book-volume.component';
import type { BookSummary } from '../models/book.types';
import { BooksService } from '../services/books.service';
import { readDragId, shelfDropTarget, slotDropTarget } from './bookshelf-dnd';
import {
  COLLAPSED_KEY,
  DENSITY_KEY,
  loadCollapsed,
  loadDensity,
  wireBfcacheReset,
} from './bookshelf-prefs';
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
  imports: [BookCatalogOverlayComponent, BookVolumeComponent, IconComponent],
  templateUrl: './bookshelf.container.html',
  styleUrl: './bookshelf.container.css',
})
export class BookshelfContainer {
  private readonly booksService = inject(BooksService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly summaries = this.booksService.summaries;
  protected readonly folders = this.booksService.folders;
  protected readonly query = signal<string>('');
  protected readonly mode = signal<'shelf' | 'list'>('shelf');
  // why: id del libro abriéndose tras un click — dispara la animación CSS antes de navegar.
  protected readonly opening = signal<string | null>(null);
  // why: DnD — libro arrastrado + shelf bajo hover (para highlight).
  protected readonly draggingId = signal<string | null>(null);
  protected readonly dragOverShelf = signal<string | null>(null);
  // why: rename inline del label de estante.
  protected readonly renamingFolder = signal<string | null>(null);
  protected readonly renameDraft = signal<string>('');
  // why: estantes transitorios (sin libros) — no viven en disco hasta el primer drop.
  protected readonly transientShelves = signal<readonly string[]>([]);
  protected readonly creatingShelf = signal<boolean>(false);
  protected readonly createDraft = signal<string>('');
  // why: densidad compacta reduce libros al 65%, persistida en localStorage.
  protected readonly density = signal<'normal' | 'compact'>(loadDensity());
  // why: estantes colapsados (set de folders), persistido.
  protected readonly collapsedShelves = signal<ReadonlySet<string>>(loadCollapsed());
  // why: estado UI del overlay del catálogo (libro-índice). No persistido.
  protected readonly catalogOpen = signal<boolean>(false);

  // why: forma plana del workspace para el overlay del catálogo.
  protected readonly catalogShelves = computed(() =>
    toCatalogShelves(this.shelves(), (f) => this.shelfLabel(f)),
  );

  constructor() {
    effect(() => localStorage.setItem(DENSITY_KEY, this.density()));
    effect(() => localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...this.collapsedShelves()])));
    inject(DestroyRef).onDestroy(
      wireBfcacheReset(() => {
        this.query.set('');
        this.draggingId.set(null);
        this.dragOverShelf.set(null);
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
  protected readonly shelves = computed<readonly Shelf[]>(() => {
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
    for (const folder of this.transientShelves()) {
      if (!grouped.has(folder)) out.push({ folder, books: [] });
    }
    return out;
  });

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
    this.openBook(id);
  }
  protected isCollapsed(folder: string): boolean {
    return this.collapsedShelves().has(folder);
  }
  protected toggleCollapse(folder: string): void {
    this.collapsedShelves.update((s) => {
      const next = new Set(s);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }
  protected openBook(id: string): void {
    if (this.opening() !== null) return;
    this.opening.set(id);
    // why: la animación de apertura dura ~520ms (ver .slot.opening en CSS).
    //      Navegamos al cerrarse para que el usuario vea el libro saliendo
    //      antes del cambio de ruta.
    window.setTimeout(() => {
      void this.router.navigate(['/books', id]);
    }, 520);
  }
  protected async createBook(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const book = await this.booksService.createBook('');
      await this.router.navigate(['/books', book.id]);
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
    this.dragOverShelf.set(null);
  }
  protected onDragOverShelf(folder: string, event: DragEvent): void {
    if (this.draggingId() === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverShelf.set(folder);
  }
  protected onDragLeaveShelf(folder: string): void {
    if (this.dragOverShelf() === folder) this.dragOverShelf.set(null);
  }
  protected async onDropOnShelf(folder: string, event: DragEvent): Promise<void> {
    event.preventDefault();
    const id = readDragId(event, this.draggingId());
    this.onDragEnd();
    if (id === null) return;
    const target = shelfDropTarget(this.summaries(), folder, id);
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
  private async applyMove(id: string, folder: string, position: string): Promise<void> {
    try {
      const dragged = this.summaries().find((s) => s.id === id);
      if (dragged && dragged.folder !== folder) {
        await this.booksService.moveBookToFolder(id, folder);
      }
      await this.booksService.setPosition(id, position);
      // why: si el shelf destino era transitorio, ahora tiene libro real y
      //      podemos sacarlo de la lista in-memory.
      this.transientShelves.update((curr) => curr.filter((f) => f !== folder));
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected startRename(folder: string): void {
    if (folder === '') return;
    this.renamingFolder.set(folder);
    this.renameDraft.set(folder);
  }
  protected cancelRename(event?: Event): void {
    event?.preventDefault();
    this.renamingFolder.set(null);
    this.renameDraft.set('');
  }
  protected onRenameInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.renameDraft.set(target.value);
  }
  protected async submitRename(folder: string, event?: Event): Promise<void> {
    event?.preventDefault();
    const next = this.renameDraft().trim();
    if (next === '' || next === folder) {
      this.cancelRename();
      return;
    }
    try {
      await this.booksService.renameShelf(folder, next);
      // why: si era transitorio, reemplazar la entrada para que el shelf
      //      siga visible con el nuevo nombre incluso sin libros.
      this.transientShelves.update((curr) =>
        curr.includes(folder) ? curr.map((f) => (f === folder ? next : f)) : curr,
      );
      this.cancelRename();
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected startCreateShelf(): void {
    this.creatingShelf.set(true);
    this.createDraft.set('');
  }
  protected cancelCreateShelf(event?: Event): void {
    event?.preventDefault();
    this.creatingShelf.set(false);
    this.createDraft.set('');
  }
  protected onCreateInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.createDraft.set(target.value);
  }
  protected submitCreateShelf(event?: Event): void {
    event?.preventDefault();
    const name = this.createDraft().trim();
    if (name === '') return;
    // why: no duplicar contra estantes existentes (con libros) ni transitorios.
    const exists =
      this.summaries().some((s) => s.folder === name) || this.transientShelves().includes(name);
    if (!exists) this.transientShelves.update((curr) => [...curr, name]);
    this.cancelCreateShelf();
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
