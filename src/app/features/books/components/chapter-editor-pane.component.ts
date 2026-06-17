import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { JSONContent } from '@tiptap/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { extractPlainText } from '@core/search/tiptap-text';
import { EditorComponent } from '@shared/editor/editor.component';
import { IconComponent } from '@shared/icon/icon.component';
import { toRoman } from '@shared/utils/roman';
import { countChars, countWords, readingMinutes } from '@shared/utils/word-count';

import type { Chapter } from '../models/book.types';
import type { BookSaveStatus } from './book-meta-bar.component';

@Component({
  selector: 'mc-chapter-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent, IconComponent],
  templateUrl: './chapter-editor-pane.component.html',
  styleUrl: './chapter-editor-pane.component.css',
  host: {
    '[style.--mc-pages-x]': '(-currentSpread() * bandWidth()) + "px"',
  },
})
export class ChapterEditorPaneComponent {
  readonly chapter = input.required<Chapter>();
  readonly status = input<BookSaveStatus>('saved');
  readonly editable = input<boolean>(true);
  readonly focusMode = input<boolean>(false);
  readonly chapterIndex = input<number>(-1);
  readonly chapterTotal = input<number>(0);
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();
  readonly toggleFocus = output<void>();
  readonly addChapter = output<void>();

  private readonly pagesRef = viewChild<ElementRef<HTMLElement>>('pagesEl');
  private readonly spreadRef = viewChild<ElementRef<HTMLElement>>('spreadEl');
  private readonly titleRef = viewChild<ElementRef<HTMLInputElement>>('titleEl');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentSpread = signal<number>(0);
  // why: el ancho real de un spread en término de columnas es
  //      2*(col-width + column-gap) = spreadClientWidth - 2*pad + gap.
  //      Traducimos por bandWidth, NO por clientWidth, si no las páginas
  //      quedan medio desplazadas en cada salto.
  protected readonly bandWidth = signal<number>(0);
  private readonly contentWidth = signal<number>(0);
  private readonly extraOffset = signal<number>(0);
  protected readonly turning = signal<'forward' | 'backward' | null>(null);

  protected readonly totalSpreads = computed<number>(() => {
    const bw = this.bandWidth();
    if (bw <= 0) return 1;
    const cw = this.contentWidth();
    const off = this.extraOffset();
    return Math.max(1, Math.ceil((cw - off) / bw));
  });
  protected readonly atLast = computed(() => this.currentSpread() >= this.totalSpreads() - 1);
  protected readonly visiblePages = computed(() => {
    const s = this.currentSpread();
    return { left: s * 2 + 1, right: s * 2 + 2, total: this.totalSpreads() * 2 };
  });

  protected readonly words = computed(() => countWords(extractPlainText(this.chapter().body)));
  protected readonly chars = computed(() => countChars(extractPlainText(this.chapter().body)));
  protected readonly readMin = computed(() => readingMinutes(this.words()));
  protected readonly roman = computed(() => {
    const i = this.chapterIndex();
    return i >= 0 ? toRoman(i + 1) : '';
  });

  constructor() {
    effect(() => {
      this.chapter();
      this.currentSpread.set(0);
      queueMicrotask(() => this.updateMetrics());
    });
    effect(() => {
      const max = this.totalSpreads() - 1;
      if (this.currentSpread() > max) this.currentSpread.set(Math.max(0, max));
    });
    effect(() => {
      const pagesEl = this.pagesRef()?.nativeElement;
      const spreadEl = this.spreadRef()?.nativeElement;
      if (!pagesEl || !spreadEl) return;
      const ro = new ResizeObserver(() => this.updateMetrics());
      ro.observe(pagesEl);
      ro.observe(spreadEl);
      this.updateMetrics();
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
    const onSel = (): void => this.maybeAdvanceForCursor();
    document.addEventListener('selectionchange', onSel);
    this.destroyRef.onDestroy(() => document.removeEventListener('selectionchange', onSel));
  }

  protected onBodyChange(body: JSONContent): void {
    this.bodyChange.emit(body);
    // why: ResizeObserver no detecta cambios de scrollWidth en .pages
    //      (su clientWidth no cambia, solo crece el ancho de columnas).
    //      Re-medimos en cada cambio de contenido.
    requestAnimationFrame(() => this.updateMetrics());
  }

  protected prevSpread(): void {
    if (this.currentSpread() === 0) return;
    this.turning.set('backward');
    this.currentSpread.update((v) => v - 1);
    setTimeout(() => this.turning.set(null), 520);
  }
  protected nextSpread(): void {
    if (this.atLast()) return;
    this.turning.set('forward');
    this.currentSpread.update((v) => v + 1);
    setTimeout(() => this.turning.set(null), 520);
  }
  protected focusTitle(): void {
    this.titleRef()?.nativeElement.focus();
  }

  private updateMetrics(): void {
    const pagesEl = this.pagesRef()?.nativeElement;
    const spreadEl = this.spreadRef()?.nativeElement;
    if (!pagesEl || !spreadEl) return;
    const cs = window.getComputedStyle(pagesEl);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const colGap = parseFloat(cs.columnGap) || 0;
    const spreadW = spreadEl.clientWidth;
    this.bandWidth.set(Math.max(1, spreadW - padL - padR + colGap));
    this.contentWidth.set(pagesEl.scrollWidth);
    this.extraOffset.set(padL + padR - colGap);
  }

  private maybeAdvanceForCursor(): void {
    if (this.turning() !== null) return;
    const spread = this.spreadRef()?.nativeElement;
    if (!spread) return;
    const cursor = readCursorRect(spread);
    if (!cursor) return;
    const sr = spread.getBoundingClientRect();
    if (cursor.left > sr.right && !this.atLast()) this.nextSpread();
    else if (cursor.right < sr.left && this.currentSpread() > 0) this.prevSpread();
  }

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  protected statusLabel(): string {
    return this.t(`books.status.${this.status()}` as TranslationKey);
  }
  protected focusLabel(): string {
    return this.focusMode() ? this.t('books.editor.exitFocus') : this.t('books.editor.toggleFocus');
  }
  protected readingLabel(): string {
    const m = this.readMin();
    return m === 0
      ? this.t('books.editor.footerReadingZero')
      : this.t('books.editor.footerReading', { n: m });
  }
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
}

const readCursorRect = (spread: HTMLElement): DOMRect | null => {
  const sel = document.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!spread.contains(range.startContainer)) return null;
  const r = range.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return r;
};
