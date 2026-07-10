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
import { emptyWritingStats, type WritingStats } from '@core/writing-stats/writing-stats.types';
import { EditorComponent } from '@shared/editor/editor.component';
import { IconComponent } from '@shared/icon/icon.component';
import { toRoman } from '@shared/utils/roman';
import { WritingStatsPopoverComponent } from '@shared/writing-stats-popover/writing-stats-popover.component';

import type { Chapter } from '../models/book.types';
import type { BookSaveStatus } from './book-meta-bar.component';

export interface ChapterWritingStats {
  readonly chapter: WritingStats;
  readonly book: WritingStats;
  readonly global: WritingStats;
}

@Component({
  selector: 'mc-chapter-editor-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent, IconComponent, WritingStatsPopoverComponent],
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
  readonly stats = input<ChapterWritingStats>({
    chapter: emptyWritingStats(),
    book: emptyWritingStats(),
    global: emptyWritingStats(),
  });
  readonly titleChange = output<string>();
  readonly bodyChange = output<JSONContent>();
  readonly toggleFocus = output<void>();
  // why: persistimos páginas (totalSpreads * 2) en el archivo del capítulo
  //      para que el índice pueda mostrar el rango "X–Y" sin abrir cada
  //      capítulo. Se emite cada vez que el cálculo cambia.
  readonly pageCountChange = output<number>();

  private readonly pagesRef = viewChild<ElementRef<HTMLElement>>('pagesEl');
  private readonly spreadRef = viewChild<ElementRef<HTMLElement>>('spreadEl');
  private readonly titleRef = viewChild<ElementRef<HTMLInputElement>>('titleEl');
  // why: the book pagination CSS hides mc-editor's own toolbar entirely
  //      (see _book-editor.scss) — list toggling is triggered from the
  //      pane's ui-bar instead, by calling straight into the editor
  //      component's public toggle methods.
  private readonly editorRef = viewChild(EditorComponent);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentSpread = signal<number>(0);
  // why: el ancho real de un spread en término de columnas es
  //      2*(col-width + column-gap) = spreadClientWidth - 2*pad + gap.
  //      Traducimos por bandWidth, NO por clientWidth, si no las páginas
  //      quedan medio desplazadas en cada salto.
  protected readonly bandWidth = signal<number>(0);
  // why: ancho real de UNA página (margen exterior + columna).
  //      Excluye la mitad de column-gap que pertenece al canalón/lomo
  //      — esa zona NO debe rotar con la página.
  private readonly pageWidth = signal<number>(0);
  private readonly contentWidth = signal<number>(0);
  private readonly extraOffset = signal<number>(0);
  protected readonly turning = signal<'forward' | 'backward' | null>(null);
  protected readonly statsOpen = signal<boolean>(false);

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

  protected readonly roman = computed(() => {
    const i = this.chapterIndex();
    return i >= 0 ? toRoman(i + 1) : '';
  });
  // why: el padre actualiza el signal del capítulo en CADA keystroke
  //      (body cambia → nuevo objeto Chapter). Si el effect dependiera
  //      de this.chapter() resetearíamos currentSpread a 0 con cada
  //      tecla y el auto-advance lo llevaría a 1 de nuevo: bounce
  //      alternado. Acá nos atamos sólo al id, que sólo cambia al
  //      navegar a otro capítulo.
  private readonly chapterId = computed(() => this.chapter().id);

  constructor() {
    effect(() => {
      this.chapterId();
      this.currentSpread.set(0);
      queueMicrotask(() => this.updateMetrics());
    });
    effect(() => {
      const max = this.totalSpreads() - 1;
      if (this.currentSpread() > max) this.currentSpread.set(Math.max(0, max));
    });
    effect(() => {
      const pages = this.totalSpreads() * 2;
      this.pageCountChange.emit(pages);
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
    // why: en cada tecla SÓLO actualizamos contentWidth. bandWidth
    //      depende del layout, no del contenido — si lo recomputáramos
    //      acá, la lectura de getComputedStyle puede devolver valores
    //      con micro-diferencias por redondeo y la traducción deriva
    //      1px por keystroke, dando la sensación de "seguir al cursor".
    requestAnimationFrame(() => {
      const pagesEl = this.pagesRef()?.nativeElement;
      if (pagesEl) this.contentWidth.set(pagesEl.scrollWidth);
    });
  }

  prevSpread(): void {
    if (this.currentSpread() === 0) return;
    this.startTurn('backward');
  }
  nextSpread(): void {
    if (this.atLast()) return;
    this.startTurn('forward');
  }

  private startTurn(direction: 'forward' | 'backward'): void {
    if (this.turning() !== null) return;
    const pagesEl = this.pagesRef()?.nativeElement;
    const spreadEl = this.spreadRef()?.nativeElement;
    if (!pagesEl || !spreadEl) return;
    const cur = this.currentSpread();
    const dest = direction === 'forward' ? cur + 1 : cur - 1;
    const bw = this.bandWidth();
    if (bw <= 0) {
      this.currentSpread.set(dest);
      return;
    }
    this.turning.set(direction);
    const overlay = buildFlipOverlay({
      direction,
      innerHtml: pagesEl.innerHTML,
      curSpread: cur,
      destSpread: dest,
      bandWidth: bw,
      spreadWidth: spreadEl.clientWidth,
      pageWidth: this.pageWidth(),
    });
    // why: Angular ViewEncapsulation.Emulated scope-ea el CSS con un
    //      atributo _ngcontent-XX. Los elementos creados por JS no lo
    //      heredan automáticamente; sin él, las reglas de .flip-root /
    //      .flip-page / animaciones NO matchean y el flip no anima.
    applyScopeAttr(spreadEl, overlay);
    spreadEl.appendChild(overlay);
    void overlay.getBoundingClientRect();
    overlay.classList.add('active');

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      this.currentSpread.set(dest);
      requestAnimationFrame(() => {
        overlay.remove();
        this.turning.set(null);
      });
    };
    const arriving = overlay.querySelector('.flip-page.arriving');
    arriving?.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 950);
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
    const innerW = Math.max(0, spreadW - padL - padR);
    const colW = Math.max(0, (innerW - colGap) / 2);
    this.bandWidth.set(Math.max(1, spreadW - padL - padR + colGap));
    this.pageWidth.set(Math.max(1, padL + colW));
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
  protected onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.titleChange.emit(target.value);
  }
  protected toggleBulletList(): void {
    this.editorRef()?.toggleBulletList();
  }
  protected toggleOrderedList(): void {
    this.editorRef()?.toggleOrderedList();
  }
  protected bulletListActive(): boolean {
    return this.editorRef()?.isBulletListActive() ?? false;
  }
  protected orderedListActive(): boolean {
    return this.editorRef()?.isOrderedListActive() ?? false;
  }
  protected toggleBold(): void {
    this.editorRef()?.toggleBold();
  }
  protected toggleItalic(): void {
    this.editorRef()?.toggleItalic();
  }
  protected boldActive(): boolean {
    return this.editorRef()?.isBoldActive() ?? false;
  }
  protected italicActive(): boolean {
    return this.editorRef()?.isItalicActive() ?? false;
  }
  protected insertSceneBreak(): void {
    this.editorRef()?.insertSceneBreak();
  }
  protected setHeadingLevel(level: 2 | 3 | 4): void {
    this.editorRef()?.setHeadingLevel(level);
  }
  protected toggleCitation(): void {
    this.editorRef()?.toggleCitation();
  }
  protected headingLevelActive(level: 2 | 3 | 4): boolean {
    return this.editorRef()?.isHeadingLevelActive(level) ?? false;
  }
  protected citationActive(): boolean {
    return this.editorRef()?.isCitationActive() ?? false;
  }
  protected toggleStats(): void {
    this.statsOpen.update((v) => !v);
  }
}

interface FlipOpts {
  direction: 'forward' | 'backward';
  innerHtml: string;
  curSpread: number;
  destSpread: number;
  bandWidth: number;
  spreadWidth: number;
  pageWidth: number;
}

const buildFlipOverlay = (opts: FlipOpts): HTMLElement => {
  const { direction, innerHtml, curSpread, destSpread, bandWidth, spreadWidth, pageWidth } = opts;
  const fwd = direction === 'forward';
  const movingSide: 'left' | 'right' = fwd ? 'right' : 'left';
  const arrivingSide: 'left' | 'right' = fwd ? 'left' : 'right';

  const makeSnapshot = (spread: number, align: 'left' | 'right'): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'pages book-editor flip-snapshot';
    wrap.innerHTML = innerHtml;
    wrap.style.position = 'absolute';
    wrap.style.top = '0';
    wrap.style.bottom = '0';
    wrap.style.width = `${spreadWidth}px`;
    wrap.style.transform = `translateX(${-spread * bandWidth}px)`;
    wrap.style.transition = 'none';
    // why: el snapshot vive dentro de un .flip-page más angosto que
    //      el spread. Anclar por el borde exterior hace que la
    //      columna visible caiga exactamente sobre el .flip-page,
    //      con su margen exterior incluido.
    wrap.style[align] = '0';
    return wrap;
  };

  const sizePane = (el: HTMLElement, side: 'left' | 'right'): void => {
    el.style.width = `${pageWidth}px`;
    el.style[side] = '0';
  };

  const root = document.createElement('div');
  root.className = `flip-root ${direction}`;

  const underlay = document.createElement('div');
  underlay.className = `flip-underlay ${movingSide}`;
  sizePane(underlay, movingSide);
  underlay.appendChild(makeSnapshot(destSpread, movingSide));
  root.appendChild(underlay);

  const leaving = document.createElement('div');
  leaving.className = `flip-page leaving ${movingSide}`;
  sizePane(leaving, movingSide);
  leaving.appendChild(makeSnapshot(curSpread, movingSide));
  root.appendChild(leaving);

  const arriving = document.createElement('div');
  arriving.className = `flip-page arriving ${arrivingSide}`;
  sizePane(arriving, arrivingSide);
  arriving.appendChild(makeSnapshot(destSpread, arrivingSide));
  root.appendChild(arriving);

  return root;
};

const applyScopeAttr = (sample: HTMLElement, target: HTMLElement): void => {
  let attr: string | null = null;
  for (const a of Array.from(sample.attributes)) {
    if (a.name.startsWith('_ngcontent-')) {
      attr = a.name;
      break;
    }
  }
  if (!attr) return;
  target.setAttribute(attr, '');
  target.querySelectorAll('*').forEach((el) => el.setAttribute(attr as string, ''));
};

const readCursorRect = (spread: HTMLElement): DOMRect | null => {
  const sel = document.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!spread.contains(range.startContainer)) return null;
  const r = range.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return r;
};
