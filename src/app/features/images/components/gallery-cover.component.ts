import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Layout = 'empty' | 'one' | 'two' | 'three' | 'four';

@Component({
  selector: 'mc-gallery-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mosaic" [attr.data-layout]="layout()">
      @if (layout() === 'empty') {
        <div class="cell placeholder" aria-hidden="true">
          <span class="icon">📷</span>
        </div>
      } @else {
        @for (slot of slots(); track $index; let i = $index) {
          <div class="cell" [attr.data-slot]="i">
            @if (urls()[slot]; as url) {
              <img [src]="url" [alt]="''" />
            } @else {
              <span class="cell-empty" aria-hidden="true">…</span>
            }
            @if (i === slots().length - 1 && overflow() > 0) {
              <span class="more">{{ moreLabel() }}</span>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .mosaic {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      background: var(--mc-bg-elevated);
      border-radius: var(--mc-radius-md);
      overflow: hidden;
      display: grid;
      gap: 2px;
    }
    .mosaic[data-layout='empty'],
    .mosaic[data-layout='one'] {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }
    .mosaic[data-layout='two'] {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr;
    }
    .mosaic[data-layout='three'] {
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 1fr 1fr;
    }
    .mosaic[data-layout='three'] .cell[data-slot='0'] {
      grid-row: 1 / span 2;
    }
    .mosaic[data-layout='four'] {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
    }
    .cell {
      position: relative;
      background: var(--mc-bg-base);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cell img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .cell-empty {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
    }
    .placeholder {
      background: var(--mc-bg-elevated);
    }
    .placeholder .icon {
      font-size: 2.4rem;
      opacity: 0.4;
    }
    .more {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--mc-bg-base) 60%, transparent);
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-lg);
      font-weight: 600;
      letter-spacing: 0.02em;
    }
  `,
})
export class GalleryCoverComponent {
  readonly coverImageIds = input.required<readonly string[]>();
  readonly imageCount = input.required<number>();
  readonly urls = input.required<Record<string, string>>();
  readonly moreLabel = input.required<string>();

  protected readonly layout = computed<Layout>(() => {
    const n = Math.min(this.coverImageIds().length, 4);
    if (n === 0) return 'empty';
    if (n === 1) return 'one';
    if (n === 2) return 'two';
    if (n === 3) return 'three';
    return 'four';
  });

  protected readonly slots = computed<readonly string[]>(() => this.coverImageIds().slice(0, 4));

  protected readonly overflow = computed<number>(() =>
    Math.max(0, this.imageCount() - this.slots().length),
  );
}
