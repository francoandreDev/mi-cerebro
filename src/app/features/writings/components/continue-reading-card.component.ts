import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { WritingSummary } from '../models/writing.types';

@Component({
  selector: 'mc-continue-reading-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
  template: `
    <article
      class="hero"
      role="article"
      tabindex="0"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(writing().id)"
      (keydown.enter)="open.emit(writing().id)"
      (keydown.space)="onSpace($event)"
    >
      <div class="body">
        <header class="head">
          <span class="eyebrow">
            <mc-icon name="bookmark-simple" aria-hidden="true" />
            {{ t('writings.shelf.continue.title') }}
          </span>
          <h2 class="title">{{ displayTitle() }}</h2>
        </header>
        @if (writing().preview) {
          <p class="preview">{{ writing().preview }}</p>
        } @else {
          <p class="empty">{{ t('writings.shelf.cardEmpty') }}</p>
        }
        <footer class="foot">
          <span class="meta">
            <span class="words">{{ wordsLabel() }}</span>
            <span class="dot" aria-hidden="true">·</span>
            <span class="ago">{{ ago() }}</span>
          </span>
          @if (resolvedTags().length) {
            <span class="tags">
              @for (tag of resolvedTags(); track tag.id) {
                <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
              }
            </span>
          }
        </footer>
      </div>
      <div class="cta-wrap">
        <span class="cta">
          {{ t('writings.shelf.continue.cta') }}
          <mc-icon name="arrow-right" aria-hidden="true" />
        </span>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .hero {
      position: relative;
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: stretch;
      gap: var(--mc-space-5);
      padding: var(--mc-space-5) var(--mc-space-6);
      min-height: 180px;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--mc-accent-primary) 8%, var(--mc-bg-elevated)),
        var(--mc-bg-elevated) 60%
      );
      border: 1px solid var(--mc-border-default);
      border-left: 4px solid var(--mc-accent-primary);
      border-radius: var(--mc-radius-lg, 12px);
      cursor: pointer;
      transition:
        transform 140ms ease,
        box-shadow 140ms ease,
        border-color 140ms ease;
    }
    .hero:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
    }
    .hero:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: 2px;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-3);
      min-width: 0;
    }
    .head {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--mc-accent-primary);
      font-size: var(--mc-font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .title {
      margin: 0;
      font-family: var(--mc-font-serif, Georgia, 'Times New Roman', serif);
      font-size: clamp(1.6rem, 2.4vw, 2.2rem);
      font-weight: 600;
      line-height: 1.15;
      color: var(--mc-fg-primary);
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .preview {
      margin: 0;
      color: var(--mc-fg-secondary);
      font-size: var(--mc-font-size-md, 0.95rem);
      line-height: 1.5;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
    .empty {
      margin: 0;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      font-style: italic;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: var(--mc-space-3);
      margin-top: auto;
      flex-wrap: wrap;
    }
    .meta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
    }
    .tags {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .cta-wrap {
      display: flex;
      align-items: flex-end;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: var(--mc-space-2) var(--mc-space-3);
      color: var(--mc-accent-primary);
      font-weight: 600;
      font-size: var(--mc-font-size-sm);
      border: 1px solid var(--mc-accent-primary);
      border-radius: var(--mc-radius-md, 8px);
      background: transparent;
      transition: background 140ms ease;
    }
    .hero:hover .cta {
      background: color-mix(in srgb, var(--mc-accent-primary) 12%, transparent);
    }
    @media (max-width: 720px) {
      .hero {
        grid-template-columns: 1fr;
      }
      .cta-wrap {
        align-items: flex-start;
      }
    }
  `,
})
export class ContinueReadingCardComponent {
  readonly writing = input.required<WritingSummary>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly ago = input.required<string>();
  readonly open = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly displayTitle = computed(() => this.writing().title || this.untitledLabel());
  protected readonly resolvedTags = computed(() => {
    const byId = new Map(this.availableTags().map((tag) => [tag.id, tag] as const));
    return this.writing()
      .tags.map((id) => byId.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  });
  protected readonly wordsLabel = computed(() => {
    const n = this.writing().wordCount;
    if (n === 0) return this.t('writings.shelf.wordsZero');
    if (n === 1) return this.t('writings.shelf.wordsOne');
    return this.t('writings.shelf.words').replace('{n}', String(n));
  });
  protected readonly ariaOpen = computed(() =>
    this.t('writings.shelf.openAria').replace('{title}', this.displayTitle()),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.open.emit(this.writing().id);
  }
}
