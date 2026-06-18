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
    <div class="volume" [attr.data-tallness]="tallness()">
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
      <div class="spine">
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

  protected readonly palette = computed(() => {
    const a = this.accent();
    if (a) return { bg: a, fg: '#f4ece1' };
    return hashColor(this.bookId());
  });
  protected readonly displayTitle = computed(() => this.title() || this.untitledLabel());
  protected readonly height = computed(() => {
    switch (this.tallness()) {
      case 'short':
        return 250;
      case 'tall':
        return 320;
      default:
        return 285;
    }
  });
  // why: grosor entre 44 y 92 px según capítulos — siente la diferencia
  //      visualmente entre libros chicos y monumentales sin escalar lineal.
  protected readonly thickness = computed(() => {
    const n = this.chapterCount();
    if (n <= 1) return 48;
    if (n <= 3) return 58;
    if (n <= 6) return 68;
    if (n <= 10) return 78;
    return 92;
  });
  protected readonly coverWidth = computed(() => 180);
}
