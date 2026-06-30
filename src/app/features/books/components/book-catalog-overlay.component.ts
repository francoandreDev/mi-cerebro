import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import { IconComponent } from '@shared/icon/icon.component';

import type { BookSummary } from '../models/book.types';

export interface CatalogShelf {
  readonly folder: string;
  readonly label: string;
  readonly books: readonly BookSummary[];
}

// why: overlay tipo libro abierto que lista estantes + libros del workspace.
//      UI pura, sin persistencia: cada apertura refleja el estado actual.
//      El filtro interior y las dos listas scrollables hacen que escale a
//      cientos de libros sin volverse inviable.
@Component({
  selector: 'mc-book-catalog-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './book-catalog-overlay.component.html',
  styleUrl: './book-catalog-overlay.component.css',
})
export class BookCatalogOverlayComponent {
  readonly shelves = input.required<readonly CatalogShelf[]>();
  readonly untitledLabel = input<string>('Sin título');
  readonly dismiss = output<void>();
  readonly pick = output<string>();

  private readonly i18n = inject(I18nService);

  // why: null = sin filtro de estante (muestra todos). Caso default.
  protected readonly selectedFolder = signal<string | null>(null);
  protected readonly query = signal<string>('');

  protected readonly totalBooks = computed(() =>
    this.shelves().reduce((acc, s) => acc + s.books.length, 0),
  );

  protected readonly visibleBooks = computed<readonly BookSummary[]>(() => {
    const q = this.query().trim().toLowerCase();
    const selected = this.selectedFolder();
    const out: BookSummary[] = [];
    for (const shelf of this.shelves()) {
      if (selected !== null && shelf.folder !== selected) continue;
      for (const b of shelf.books) {
        if (q === '' || b.title.toLowerCase().includes(q)) out.push(b);
      }
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
  protected selectShelf(folder: string | null): void {
    this.selectedFolder.set(folder);
  }
  protected onBookClick(id: string): void {
    this.pick.emit(id);
  }
  protected onClose(event?: Event): void {
    event?.preventDefault();
    this.dismiss.emit();
  }
  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    event.preventDefault();
    this.dismiss.emit();
  }
  protected displayTitle(b: BookSummary): string {
    return b.title || this.untitledLabel();
  }
}
