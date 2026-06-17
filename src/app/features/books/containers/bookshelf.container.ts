import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import { BookSpineComponent } from '../components/book-spine.component';
import type { BookSummary } from '../models/book.types';
import { BooksService } from '../services/books.service';
import { formatAgo } from './format-ago';

interface SummaryView {
  readonly summary: BookSummary;
  readonly tallness: 'short' | 'medium' | 'tall';
  readonly tooltip: string;
}

const TALLNESS: readonly ('short' | 'medium' | 'tall')[] = ['short', 'medium', 'tall'];

@Component({
  selector: 'mc-bookshelf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookSpineComponent],
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
  protected readonly query = signal<string>('');
  protected readonly mode = signal<'shelf' | 'list'>('shelf');

  protected readonly views = computed<readonly SummaryView[]>(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.summaries();
    return list
      .filter((s) => q === '' || (s.title || '').toLowerCase().includes(q))
      .map((s) => ({
        summary: s,
        tallness: TALLNESS[seedHash(s.id) % TALLNESS.length] ?? 'medium',
        tooltip: this.tooltipFor(s),
      }));
  });

  protected readonly shelves = computed<readonly (readonly SummaryView[])[]>(() => {
    const out: SummaryView[][] = [];
    let row: SummaryView[] = [];
    for (const v of this.views()) {
      row.push(v);
      if (row.length === 8) {
        out.push(row);
        row = [];
      }
    }
    if (row.length > 0) out.push(row);
    return out;
  });

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected onQuery(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }
  protected toggleMode(): void {
    this.mode.update((m) => (m === 'shelf' ? 'list' : 'shelf'));
  }
  protected openBook(id: string): void {
    void this.router.navigate(['/books', id]);
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

  private tooltipFor(s: BookSummary): string {
    const chapters =
      s.chapterCount === 1
        ? this.t('books.chapters.countOne')
        : this.t('books.chapters.countMany', { count: s.chapterCount });
    const ago = formatAgo(s.updatedAt, (k, p) => this.t(k, p));
    return this.t('books.shelf.tooltip', {
      title: s.title || this.t('books.untitledTitle'),
      chapters,
      words: '—',
      ago,
    });
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
