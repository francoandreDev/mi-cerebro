import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { CommandPaletteService } from '@core/search/command-palette.service';
import { parsePaletteQuery } from '@core/search/palette-query';
import { SearchIndexService } from '@core/search/search-index.service';
import type { SearchHit } from '@core/search/search.types';
import { TagsService } from '@core/tags/tags.service';

// why: features can't import other features (rule 10). Until search-kind
//      routes move into core, the palette knows the note kind by literal.
const NOTE_KIND_LITERAL = 'note';

@Component({
  selector: 'mc-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close()" (keydown.enter)="close()" tabindex="-1">
        <div
          class="dialog"
          role="dialog"
          [attr.aria-label]="t('palette.label')"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <input
            #input
            type="text"
            class="input"
            [placeholder]="t('palette.placeholder')"
            [attr.aria-label]="t('palette.placeholder')"
            [value]="query()"
            (input)="onInput($event)"
            (keydown)="onKey($event)"
          />
          @if (parsed().unknownTags.length > 0) {
            <p class="warn">
              {{ t('palette.unknownTag') }} "{{ parsed().unknownTags.join(', ') }}"
            </p>
          }
          @if (hits().length === 0) {
            <p class="empty">{{ t('palette.empty') }}</p>
          } @else {
            <ul class="results" role="listbox">
              @for (h of hits(); track h.id; let i = $index) {
                <li
                  class="hit"
                  role="option"
                  [class.highlight]="cursor() === i"
                  [attr.aria-selected]="cursor() === i"
                  (mouseenter)="cursor.set(i)"
                  (mousedown)="pick($event, h)"
                >
                  <div class="kind">{{ t(kindKey(h.kind)) }}</div>
                  <div class="title">{{ h.title || t('notes.untitledTitle') }}</div>
                  @if (h.snippet) {
                    <div class="snippet">{{ h.snippet }}</div>
                  }
                </li>
              }
            </ul>
          }
          <p class="hint">{{ t('palette.hint') }}</p>
        </div>
      </div>
    }
  `,
  styleUrl: './command-palette.container.css',
})
export class CommandPaletteContainer {
  private readonly paletteState = inject(CommandPaletteService);
  private readonly searchIndex = inject(SearchIndexService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly open = this.paletteState.open;
  protected readonly query = signal('');
  protected readonly cursor = signal(0);

  protected readonly parsed = computed(() =>
    parsePaletteQuery(this.query(), this.tagsService.tags()),
  );

  protected readonly hits = computed<readonly SearchHit[]>(() => {
    if (!this.open()) return [];
    // touch ready so palette re-runs once the index finishes loading.
    void this.searchIndex.ready();
    const p = this.parsed();
    if (p.text === '' && p.tagIds.length === 0) return [];
    return this.searchIndex.query({ text: p.text, tagIds: p.tagIds });
  });

  constructor() {
    void this.searchIndex.load();
    this.registerGlobalShortcut();
    effect(() => {
      if (this.open()) {
        this.cursor.set(0);
        queueMicrotask(() => this.inputEl()?.nativeElement.focus());
      } else {
        this.query.set('');
      }
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected kindKey(kind: string): TranslationKey {
    if (kind === NOTE_KIND_LITERAL) return 'notes.title';
    return 'palette.kindUnknown';
  }

  protected close(): void {
    this.paletteState.hide();
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.cursor.set(0);
  }

  protected onKey(event: KeyboardEvent): void {
    const handler = this.handlers[event.key];
    if (handler) handler(event);
  }

  protected pick(event: Event, hit: SearchHit): void {
    event.preventDefault();
    this.navigate(hit);
  }

  private registerGlobalShortcut(): void {
    // why: Angular's @HostListener attaches in bubbling phase, and on some
    //      Chrome versions the omnibox shortcut (Ctrl+K) wins the race. We
    //      register at capture phase on window so the page intercepts first.
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();
        this.paletteState.toggle();
        return;
      }
      if (event.key === 'Escape' && this.open()) {
        event.preventDefault();
        this.close();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('keydown', handler, { capture: true });
    });
  }

  private readonly handlers: Record<string, (event: KeyboardEvent) => void> = {
    ArrowDown: (e) => this.move(e, +1),
    ArrowUp: (e) => this.move(e, -1),
    Enter: (e) => {
      e.preventDefault();
      const list = this.hits();
      const picked = list[this.cursor()];
      if (picked) this.navigate(picked);
    },
    Escape: (e) => {
      e.preventDefault();
      this.close();
    },
  };

  private move(event: KeyboardEvent, delta: number): void {
    const total = this.hits().length;
    if (total === 0) return;
    event.preventDefault();
    this.cursor.update((c) => (c + delta + total) % total);
  }

  private navigate(hit: SearchHit): void {
    if (hit.kind === NOTE_KIND_LITERAL) void this.router.navigate(['/notes', hit.id]);
    this.close();
  }
}
