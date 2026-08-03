import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import { BookVolumeComponent } from '@shared/entity-cards/book-volume.component';

import type { CatalogShelf } from './book-catalog-overlay.component';
import { TRUNK_PATH, buildTreeBranches } from '../containers/bookshelf-tree-geometry';
import type { BookSummary } from '../models/book.types';

// why: vista alternativa al modo estantería/lista — toda la biblioteca a la
//      vez, cada carpeta como una rama de un mismo árbol. Geometría pura y
//      determinística (bookshelf-tree-geometry.ts), sin forma persistida ni
//      editor visual — ver docs/deferred/trash-books.md (ítem cerrado) para
//      el porqué de ese recorte de alcance.
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

  readonly openBook = output<BookSummary>();
  readonly openFolder = output<string>();
  readonly togglePin = output<string>();

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
}
