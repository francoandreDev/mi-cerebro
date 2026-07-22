import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import { KeyboardHelpService } from './keyboard-help.service';
import { routePageId } from './route-page-id';
import { ShortcutsService } from './shortcuts.service';
import type { ShortcutBinding, ShortcutScope } from './shortcuts.types';

interface Group {
  readonly scope: ShortcutScope | 'page';
  readonly titleKey: TranslationKey;
  readonly items: readonly ShortcutBinding[];
}

@Component({
  selector: 'mc-keyboard-help-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './keyboard-help-dialog.component.html',
  styleUrl: './keyboard-help-dialog.component.css',
})
export class KeyboardHelpDialogComponent {
  private readonly shortcuts = inject(ShortcutsService);
  private readonly i18n = inject(I18nService);
  private readonly help = inject(KeyboardHelpService);
  private readonly router = inject(Router);

  protected readonly open = this.help.open;

  private readonly currentPageId = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => routePageId(e.urlAfterRedirects)),
      startWith(routePageId(this.router.url)),
    ),
    { initialValue: routePageId(this.router.url) },
  );

  protected readonly groups = computed<readonly Group[]>(() => {
    const all = this.shortcuts.bindings();
    const pageId = this.currentPageId();
    const page = pageId ? all.filter((b) => b.pageScope === pageId) : [];
    const global = all.filter((b) => b.scope === 'global' && !b.pageScope);
    const safe = all.filter((b) => b.scope === 'editable-safe' && !b.pageScope);
    const groups: Group[] = [];
    if (page.length > 0)
      groups.push({ scope: 'page', titleKey: 'shortcuts.group.page', items: page });
    if (global.length > 0)
      groups.push({ scope: 'global', titleKey: 'shortcuts.group.global', items: global });
    if (safe.length > 0)
      groups.push({
        scope: 'editable-safe',
        titleKey: 'shortcuts.group.editableSafe',
        items: safe,
      });
    return groups;
  });

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected close(): void {
    this.help.closeDialog();
  }
}
