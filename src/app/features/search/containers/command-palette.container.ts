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
import { type KindOption, parsePaletteQuery } from '@core/search/palette-query';
import { PaletteQueriesService } from '@core/search/palette-queries.service';
import { PaletteRecentsService } from '@core/search/palette-recents.service';
import { SearchIndexService } from '@core/search/search-index.service';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

import { registerCommandPaletteTutorial } from './command-palette.tutorial';
import {
  KIND_TITLE_KEY,
  type EntityItem,
  type PaletteItem,
  type QueryItem,
  type TagViewItem,
} from './command-palette.types';

@Component({
  selector: 'mc-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
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

  protected readonly kindOptions = computed<readonly KindOption[]>(() =>
    Object.keys(KIND_TITLE_KEY).map((kind) => ({ kind, label: this.t(KIND_TITLE_KEY[kind]!) })),
  );

  protected readonly parsed = computed(() =>
    parsePaletteQuery(this.query(), this.tagsService.tags(), this.kindOptions()),
  );

  protected readonly mode = computed<'recents' | 'results'>(() => {
    const p = this.parsed();
    return p.text === '' && p.tagIds.length === 0 && p.kinds.length === 0 ? 'recents' : 'results';
  });

  protected readonly recentsItems = computed<readonly EntityItem[]>(() => {
    if (!this.open() || this.mode() !== 'recents') return [];
    void this.searchIndex.ready();
    return this.recentsService.recents().map((r) => ({
      type: 'entity' as const,
      id: r.id,
      kind: r.kind,
      title: r.title || this.searchIndex.getTitle(r.id) || '',
      snippet: { pre: '', match: '', post: '' },
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
    const hits = this.searchIndex.query({
      text: p.text,
      tagIds: p.tagIds,
      ...(p.kinds.length > 0 ? { kinds: p.kinds } : {}),
    });
    return hits.map((h) => ({
      type: 'entity' as const,
      id: h.id,
      kind: h.kind,
      title: h.title,
      snippet: h.snippet,
    }));
  });

  protected readonly tagViewItem = computed<TagViewItem | null>(() => {
    if (!this.open() || this.mode() !== 'results') return null;
    const tagId = this.parsed().tagIds[0];
    if (!tagId) return null;
    const tag = this.tagsService.byId(tagId);
    if (!tag) return null;
    return { type: 'tagView' as const, tagId, label: tag.label };
  });

  protected readonly tagViewOffset = computed(() => (this.tagViewItem() ? 1 : 0));

  protected readonly items = computed<readonly PaletteItem[]>(() => {
    if (this.mode() === 'recents') {
      return [...this.recentsItems(), ...this.queryItems()];
    }
    const tagView = this.tagViewItem();
    return tagView ? [tagView, ...this.entityItems()] : this.entityItems();
  });

  constructor() {
    void this.searchIndex.load();
    this.recentsService.start();
    this.registerGlobalShortcut();
    registerCommandPaletteTutorial();
    effect(() => {
      if (this.open()) {
        this.cursor.set(0);
        queueMicrotask(() => this.inputEl()?.nativeElement.focus());
      } else {
        this.query.set('');
      }
    });
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected kindKey(kind: string): TranslationKey {
    return KIND_TITLE_KEY[kind] ?? 'palette.kindUnknown';
  }
  protected iconForKind(kind: string): IconName {
    const map: Record<string, IconName> = {
      note: 'note',
      task: 'check-square',
      list: 'list-bullets',
      goal: 'target',
      reminder: 'bell',
      file: 'folder',
      image: 'image-square',
      writing: 'pen-nib',
      book: 'books',
      comment: 'chat-circle',
      draft: 'note-pencil',
      commit: 'clock-counter-clockwise',
    };
    return map[kind] ?? 'file';
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
    if (item.type === 'tagView') {
      void this.router.navigate(['/tags', item.tagId]);
      this.close();
      return;
    }
    const text = this.parsed().text;
    if (text) this.queriesService.remember(text);
    if (item.kind === 'commit') {
      const oid = item.id.split(':')[1] ?? item.id;
      void this.router.navigate(['/history'], { queryParams: { oid } });
      this.close();
      return;
    }
    const target = this.resolveNavigationTarget(item);
    void this.router.navigate([...routeFor(target.kind, target.id, target.title)]);
    this.close();
  }

  // Comment/draft hits are annotations, not routable entities — their id
  // is `${kind}:${entityId}:${localId}` (see CommentsService/DraftsService
  // search wiring). Resolve to the entity they're anchored to so selecting
  // one opens that entity instead of a broken `/notes/comment:...` route.
  private resolveNavigationTarget(item: EntityItem): EntityItem {
    if (item.kind !== 'comment' && item.kind !== 'draft') return item;
    const entityId = item.id.split(':')[1] ?? item.id;
    const kind = this.searchIndex.getKind(entityId) ?? item.kind;
    const title = this.searchIndex.getTitle(entityId) ?? item.title;
    return { ...item, id: entityId, kind, title };
  }
}
