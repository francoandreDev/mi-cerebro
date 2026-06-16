import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import { ShortcutsService } from './shortcuts.service';
import type { ShortcutBinding, ShortcutScope } from './shortcuts.types';

interface Group {
  readonly scope: ShortcutScope;
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

  protected readonly open = signal(false);

  protected readonly groups = computed<readonly Group[]>(() => {
    const all = this.shortcuts.bindings();
    const global = all.filter((b) => b.scope === 'global');
    const safe = all.filter((b) => b.scope === 'editable-safe');
    const groups: Group[] = [];
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

  constructor() {
    const dispose = this.shortcuts.register({
      combo: '?',
      labelKey: 'shortcuts.help.open',
      scope: 'editable-safe',
      handler: () => this.open.set(true),
    });
    inject(DestroyRef).onDestroy(dispose);
  }

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
    this.open.set(false);
  }
}
