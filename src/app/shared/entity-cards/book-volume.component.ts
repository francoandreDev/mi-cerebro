import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { hashColor } from '@shared/utils/hash-color';

// why: el "volumen" del libro reemplaza al lomo plano. Mantiene un look 3D
//      con tres caras visibles (lomo + portada + borde superior) y rota al
//      hover para revelar la portada. El grosor (width) crece con el número
//      de capítulos para que libros más largos se vean más gordos.
@Component({
  selector: 'mc-book-volume',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="volume" [attr.data-tallness]="tallness()" [attr.data-density]="density()">
      <div class="cover-face front">
        <span class="cover-stripe top"></span>
        <span class="cover-stripe bottom"></span>
        <span class="cover-title">{{ displayTitle() }}</span>
        @if (subtitle(); as s) {
          <span class="cover-sub">{{ s }}</span>
        }
        <span class="cover-marque" aria-hidden="true">●</span>
      </div>
      <div class="cover-face back">
        <span class="back-grain" aria-hidden="true"></span>
      </div>
      <div class="spine" [attr.data-orient]="spineOrient()">
        <span class="band top" aria-hidden="true"></span>
        <span class="spine-title">{{ displayTitle() }}</span>
        <span class="band bottom" aria-hidden="true"></span>
      </div>
      <div class="edge top" aria-hidden="true"></div>
      <div class="edge bottom" aria-hidden="true"></div>
      <div class="pages-edge" aria-hidden="true"></div>
    </div>
  `,
  styleUrl: './book-volume.component.css',
  host: {
    '[style.--mc-vol-bg]': 'palette().bg',
    '[style.--mc-vol-fg]': 'palette().fg',
    '[style.--mc-vol-h]': 'height() + "px"',
    '[style.--mc-vol-w]': 'thickness() + "px"',
    '[style.--mc-vol-d]': 'coverWidth() + "px"',
    '[style.--mc-spine-font]': 'spineFontSize() + "px"',
  },
})
export class BookVolumeComponent {
  readonly bookId = input.required<string>();
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly untitledLabel = input<string>('Sin título');
  readonly tallness = input<'short' | 'medium' | 'tall'>('medium');
  readonly chapterCount = input<number>(0);
  readonly accent = input<string | null>(null);
  // why: density 'compact' reduce dimensiones a ~65% para vistas densas
  //      (estantería compacta). El lomo sigue legible porque el font escala
  //      proporcionalmente con `thickness`. 'micro' es para íconos chiquitos
  //      (ej. bullet de la vista de lista) — ahí el lomo no necesita texto
  //      legible, así que se oculta (ver book-volume.component.css).
  readonly density = input<'normal' | 'compact' | 'micro'>('normal');

  protected readonly palette = computed(() => {
    const a = this.accent();
    if (a) return { bg: a, fg: '#f4ece1' };
    return hashColor(this.bookId());
  });
  protected readonly displayTitle = computed(() => this.title() || this.untitledLabel());
  private readonly densityScale = computed(() => {
    const d = this.density();
    if (d === 'micro') return 0.22;
    if (d === 'compact') return 0.65;
    return 1;
  });
  protected readonly height = computed(() => {
    const base = this.tallness() === 'short' ? 250 : this.tallness() === 'tall' ? 320 : 285;
    return Math.round(base * this.densityScale());
  });
  // why: grosor entre 44 y 92 px según capítulos — siente la diferencia
  //      visualmente entre libros chicos y monumentales sin escalar lineal.
  protected readonly thickness = computed(() => {
    const n = this.chapterCount();
    const base = n <= 1 ? 48 : n <= 3 ? 58 : n <= 6 ? 68 : n <= 10 ? 78 : 92;
    return Math.round(base * this.densityScale());
  });
  protected readonly coverWidth = computed(() => Math.round(180 * this.densityScale()));
  // why: tamaño de fuente del lomo escala con el grosor — un libro gordo
  //      aguanta una tipografía más grande sin desbordar a lo ancho.
  protected readonly spineFontSize = computed(() => {
    const t = this.thickness();
    if (t >= 78) return 17;
    if (t >= 68) return 16;
    if (t >= 58) return 15;
    return 14;
  });
  // why: títulos cortos sin espacios leen mejor horizontales (como en libros
  //      reales con título de una palabra). Condición doble: pocos chars Y
  //      lomo grueso — sino un "LOBRO" en lomo angosto se trunca a "LO...".
  protected readonly spineOrient = computed<'horizontal' | 'vertical'>(() => {
    const title = this.displayTitle().trim();
    if (title.length === 0 || title.includes(' ')) return 'vertical';
    if (title.length <= 3) return 'horizontal';
    if (title.length <= 5 && this.thickness() >= 68) return 'horizontal';
    return 'vertical';
  });
}
