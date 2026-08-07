import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import { BookVolumeComponent } from '@shared/entity-cards/book-volume.component';

import type { CatalogShelf } from './book-catalog-overlay.component';
import { TRUNK_PATH, buildTreeBranches } from '../containers/bookshelf-tree-geometry';
import type { BookSummary } from '../models/book.types';

// why: vista alternativa al modo estantería/lista — toda la biblioteca a la
//      vez, cada carpeta como una rama de un mismo árbol. Geometría pura y
//      determinística (bookshelf-tree-geometry.ts): la posición de cada
//      libro es una función de su índice dentro de `shelf.books` (ya
//      ordenado por `position` aguas arriba en el container), no una
//      coordenada persistida — así que reordenar/mover arrastrando sólo
//      necesita actualizar `position`/`folder` como en modo estantería, sin
//      un editor de forma dedicado.
@Component({
  selector: 'mc-bookshelf-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, BookVolumeComponent],
  templateUrl: './bookshelf-tree.component.html',
  styleUrl: './bookshelf-tree.component.css',
})
export class BookshelfTreeComponent {
  readonly shelves = input.required<readonly CatalogShelf[]>();
  readonly untitledLabel = input<string>('Sin título');
  readonly draggingId = input<string | null>(null);

  readonly openBook = output<BookSummary>();
  readonly openFolder = output<string>();
  readonly togglePin = output<string>();
  readonly dragStart = output<{ id: string; event: DragEvent }>();
  readonly dragEnd = output<void>();
  readonly dropOnBook = output<{ targetId: string; event: DragEvent }>();
  readonly dropOnFolder = output<{ folder: string; event: DragEvent }>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected readonly trunkPath = TRUNK_PATH;
  protected readonly branches = computed(() => buildTreeBranches(this.shelves()));

  protected displayTitle(b: BookSummary): string {
    return b.title || this.untitledLabel();
  }

  protected onFolderClick(folder: string, event: Event): void {
    event.stopPropagation();
    this.openFolder.emit(folder);
  }
  protected onPinClick(folder: string, event: Event): void {
    event.stopPropagation();
    this.togglePin.emit(folder);
  }
  protected onBookClick(book: BookSummary): void {
    this.openBook.emit(book);
  }

  // ---- Drag-and-drop: mover/reordenar libros entre ramas ------------------
  // why: el hit-testing es sobre elementos DOM reales (book-node / branch
  //      label), no sobre la curva SVG — el drag-over global del contenedor
  //      alcanza para habilitar drop en cualquier punto del árbol, así que
  //      no hace falta matemática de proximidad a la curva Bézier.
  protected readonly dragOverFolder = signal<string | null>(null);

  protected onTreeDragOver(event: DragEvent): void {
    if (this.draggingId() === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }
  protected onBookDragStart(id: string, event: DragEvent): void {
    this.dragStart.emit({ id, event });
  }
  protected onBookDrop(targetId: string, event: DragEvent): void {
    event.stopPropagation();
    this.dropOnBook.emit({ targetId, event });
  }
  protected onFolderDragEnter(folder: string): void {
    if (this.draggingId() !== null) this.dragOverFolder.set(folder);
  }
  protected onFolderDragLeave(): void {
    this.dragOverFolder.set(null);
  }
  protected onFolderDrop(folder: string, event: DragEvent): void {
    event.stopPropagation();
    this.dragOverFolder.set(null);
    this.dropOnFolder.emit({ folder, event });
  }
}
