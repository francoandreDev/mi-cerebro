import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { hashColor } from '@shared/utils/hash-color';

@Component({
  selector: 'mc-book-spine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="spine">
      <span class="title">{{ displayTitle() }}</span>
      <span class="band"></span>
    </div>
  `,
  styleUrl: './book-spine.component.css',
  host: {
    '[style.--mc-spine-bg]': 'palette().bg',
    '[style.--mc-spine-fg]': 'palette().fg',
    '[style.--mc-spine-h]': 'height() + "px"',
  },
})
export class BookSpineComponent {
  readonly bookId = input.required<string>();
  readonly title = input<string>('');
  readonly untitledLabel = input<string>('Sin título');
  // why: 3 alturas para sugerir que algunos libros son más gruesos.
  //      Se decide a partir del hash del id para que sea estable.
  readonly tallness = input<'short' | 'medium' | 'tall'>('medium');

  protected readonly palette = computed(() => hashColor(this.bookId()));
  protected readonly displayTitle = computed(() => this.title() || this.untitledLabel());
  protected readonly height = computed(() => {
    switch (this.tallness()) {
      case 'short':
        return 180;
      case 'tall':
        return 240;
      default:
        return 210;
    }
  });
}
