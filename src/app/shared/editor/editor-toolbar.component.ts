// 13f — Dumb toolbar for the editor. Holds the image-picker trigger, the
// view segmented control (clean | combined), the index popover toggles
// (comments / drafts), the highlight-color picker (§19.16e-i), and the
// session status flags. All state lives in the host editor; this
// component is pure UI (the highlight menu's open/closed flag is local
// presentation state, same as any other dropdown).

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { HIGHLIGHT_SWATCHES, highlightHexFor } from '@core/theme/highlight-palette';
import { ThemeService } from '@core/theme/theme.service';
import { IconComponent } from '@shared/icon/icon.component';

export type EditorView = 'clean' | 'combined';

// why: HighlightSwatch.nameKey is a template-literal type so the palette
//      module stays decoupled from the exact TranslationKey union; this
//      map narrows each known id back to a literal key the template can
//      pass to `t()` without a type assertion.
const HIGHLIGHT_SWATCH_LABELS: Record<string, TranslationKey> = {
  yellow: 'editor.highlight.color.yellow',
  green: 'editor.highlight.color.green',
  blue: 'editor.highlight.color.blue',
  rose: 'editor.highlight.color.rose',
  violet: 'editor.highlight.color.violet',
};

@Component({
  selector: 'mc-editor-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="toolbar">
      @if (editable() && hasGalleries()) {
        <button
          type="button"
          class="ghost"
          (click)="openPicker.emit()"
          [attr.aria-label]="t('editor.insertImage')"
        >
          <mc-icon name="image" /> {{ t('editor.insertImage') }}
        </button>
      }
      @if (editable()) {
        <div class="highlight-wrap">
          <button
            type="button"
            class="ghost"
            [attr.aria-pressed]="highlightMenuOpen()"
            aria-haspopup="menu"
            [attr.aria-label]="t('editor.highlight.button')"
            (click)="toggleHighlightMenu()"
          >
            <mc-icon name="paint-brush" /> {{ t('editor.highlight.button') }}
          </button>
          @if (highlightMenuOpen()) {
            <div
              class="highlight-menu"
              role="menu"
              [attr.aria-label]="t('editor.highlight.button')"
            >
              <button
                type="button"
                class="swatch clear"
                role="menuitem"
                [attr.aria-label]="t('editor.highlight.clear')"
                (click)="onPick(null)"
              >
                <mc-icon name="x" />
              </button>
              @for (sw of swatches; track sw.id) {
                <button
                  type="button"
                  class="swatch"
                  role="menuitem"
                  [style.background-color]="swatchHex(sw.id)"
                  [attr.aria-label]="swatchLabel(sw.id)"
                  (click)="onPick(sw.id)"
                ></button>
              }
            </div>
          }
        </div>
      }
      @if (commentsAvailable()) {
        <div class="view-toggle" role="group" [attr.aria-label]="t('editor.view.label')">
          <button
            type="button"
            [class.active]="view() === 'clean'"
            [attr.aria-pressed]="view() === 'clean'"
            [attr.aria-label]="t('editor.view.clean.aria')"
            (click)="setView.emit('clean')"
          >
            {{ t('editor.view.clean') }}
          </button>
          <button
            type="button"
            [class.active]="view() === 'combined'"
            [attr.aria-pressed]="view() === 'combined'"
            [attr.aria-label]="t('editor.view.combined.aria')"
            (click)="setView.emit('combined')"
          >
            {{ t('editor.view.combined') }}
          </button>
        </div>
      }
      @if (commentsAvailable() && view() === 'combined') {
        <button
          type="button"
          class="ghost"
          (click)="toggleCommentsIndex.emit()"
          [attr.aria-pressed]="commentsIndexOpen()"
          [attr.aria-label]="t('editor.index.comments.aria')"
        >
          <mc-icon name="chat-circle" /> {{ t('comments.title') }}
        </button>
        <button
          type="button"
          class="ghost"
          (click)="toggleDraftsIndex.emit()"
          [attr.aria-pressed]="draftsIndexOpen()"
          [attr.aria-label]="t('editor.index.drafts.aria')"
        >
          <mc-icon name="clipboard-text" /> {{ t('drafts.title') }}
        </button>
      }
      @if (sessionActive()) {
        <span class="session-flag" role="status" aria-live="polite">
          <mc-icon name="note-pencil" /> {{ t('editor.session.active') }}
        </span>
      }
      @if (lastSaveCount() !== null) {
        <span class="saved-flash" role="status" aria-live="polite">
          <mc-icon name="check" /> {{ t('editor.session.saved') }} ({{ lastSaveCount() }})
        </span>
      }
    </div>
  `,
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  readonly editable = input<boolean>(true);
  readonly hasGalleries = input<boolean>(false);
  readonly commentsAvailable = input<boolean>(false);
  readonly view = input.required<EditorView>();
  readonly commentsIndexOpen = input<boolean>(false);
  readonly draftsIndexOpen = input<boolean>(false);
  readonly sessionActive = input<boolean>(false);
  readonly lastSaveCount = input<number | null>(null);

  readonly openPicker = output<void>();
  readonly setView = output<EditorView>();
  readonly toggleCommentsIndex = output<void>();
  readonly toggleDraftsIndex = output<void>();
  readonly pickHighlight = output<string | null>();

  protected readonly swatches = HIGHLIGHT_SWATCHES;
  protected readonly highlightMenuOpen = signal(false);

  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected toggleHighlightMenu(): void {
    this.highlightMenuOpen.update((v) => !v);
  }

  protected swatchHex(id: string): string {
    return highlightHexFor(this.theme.resolved(), id) ?? '#888';
  }

  protected swatchLabel(id: string): string {
    return this.t(HIGHLIGHT_SWATCH_LABELS[id] ?? 'editor.highlight.button');
  }

  protected onPick(id: string | null): void {
    this.pickHighlight.emit(id);
    this.highlightMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(event: MouseEvent): void {
    if (!this.highlightMenuOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.highlightMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.highlightMenuOpen()) {
      event.preventDefault();
      this.highlightMenuOpen.set(false);
    }
  }
}
