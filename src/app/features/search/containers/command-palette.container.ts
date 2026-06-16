import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { CommandPaletteService } from '@core/search/command-palette.service';
import { routeFor } from '@core/search/kind-routes';
import { parsePaletteQuery } from '@core/search/palette-query';
import { PaletteQueriesService } from '@core/search/palette-queries.service';
import { PaletteRecentsService } from '@core/search/palette-recents.service';
import { SearchIndexService } from '@core/search/search-index.service';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import { TagsService } from '@core/tags/tags.service';

import {
  KIND_TITLE_KEY,
  type EntityItem,
  type PaletteItem,
  type QueryItem,
} from './command-palette.types';

@Component({
  selector: 'mc-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './command-palette.container.html',
  styleUrl: './command-palette.container.css',
})
export class CommandPaletteContainer {
  private readonly paletteState = inject(CommandPaletteService);
  private readonly searchIndex = inject(SearchIndexService);
  private readonly tagsService = inject(TagsService);
  private readonly recentsService = inject(PaletteRecentsService);
  private readonly queriesService = inject(PaletteQueriesService);
  private readonly shortcuts = inject(ShortcutsService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly open = this.paletteState.open;
  protected readonly query = signal('');
  protected readonly cursor = signal(0);

  protected readonly parsed = computed(() =>
    parsePaletteQuery(this.query(), this.tagsService.tags()),
  );

  protected readonly mode = computed<'recents' | 'results'>(() => {
    const p = this.parsed();
    return p.text === '' && p.tagIds.length === 0 ? 'recents' : 'results';
  });

  protected readonly recentsItems = computed<readonly EntityItem[]>(() => {
    if (!this.open() || this.mode() !== 'recents') return [];
    void this.searchIndex.ready();
    return this.recentsService.recents().map((r) => ({
      type: 'entity' as const,
      id: r.id,
      kind: r.kind,
      title: r.title || this.searchIndex.getTitle(r.id) || '',
      snippet: '',
    }));
  });

  protected readonly queryItems = computed<readonly QueryItem[]>(() => {
    if (!this.open() || this.mode() !== 'recents') return [];
    return this.queriesService.queries().map((q) => ({
      type: 'query' as const,
      id: `q:${q.text}`,
      text: q.text,
    }));
  });

  protected readonly entityItems = computed<readonly EntityItem[]>(() => {
    if (!this.open() || this.mode() !== 'results') return [];
    void this.searchIndex.ready();
    const p = this.parsed();
    const hits = this.searchIndex.query({ text: p.text, tagIds: p.tagIds });
    return hits.map((h) => ({
      type: 'entity' as const,
      id: h.id,
      kind: h.kind,
      title: h.title,
      snippet: h.snippet,
    }));
  });

  protected readonly items = computed<readonly PaletteItem[]>(() => {
    if (this.mode() === 'recents') {
      return [...this.recentsItems(), ...this.queryItems()];
    }
    return this.entityItems();
  });

  constructor() {
    void this.searchIndex.load();
    this.recentsService.start();
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
    return KIND_TITLE_KEY[kind] ?? 'palette.kindUnknown';
  }
  protected close(): void {
    this.paletteState.hide();
  }
  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.cursor.set(0);
  }
  protected onKey(event: KeyboardEvent): void {
    this.handlers[event.key]?.(event);
  }
  protected pick(event: Event, item: PaletteItem): void {
    event.preventDefault();
    this.activate(item);
  }
  protected forgetQuery(event: Event, text: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.queriesService.forget(text);
    const total = this.items().length;
    if (total > 0 && this.cursor() >= total) this.cursor.set(total - 1);
  }

  private registerGlobalShortcut(): void {
    const dispose = this.shortcuts.register({
      combo: 'Ctrl+K',
      labelKey: 'shortcuts.palette',
      scope: 'global',
      handler: () => this.paletteState.toggle(),
    });
    inject(DestroyRef).onDestroy(dispose);
  }

  private readonly handlers: Record<string, (event: KeyboardEvent) => void> = {
    ArrowDown: (e) => this.move(e, +1),
    ArrowUp: (e) => this.move(e, -1),
    Enter: (e) => {
      e.preventDefault();
      const list = this.items();
      const picked = list[this.cursor()];
      if (picked) this.activate(picked);
    },
    Escape: (e) => {
      e.preventDefault();
      this.close();
    },
  };

  private move(event: KeyboardEvent, delta: number): void {
    const total = this.items().length;
    if (total === 0) return;
    event.preventDefault();
    this.cursor.update((c) => (c + delta + total) % total);
  }

  private activate(item: PaletteItem): void {
    if (item.type === 'query') {
      this.query.set(item.text);
      this.cursor.set(0);
      queueMicrotask(() => this.inputEl()?.nativeElement.focus());
      return;
    }
    const text = this.parsed().text;
    if (text) this.queriesService.remember(text);
    void this.router.navigate([...routeFor(item.kind, item.id)]);
    this.close();
  }
}
