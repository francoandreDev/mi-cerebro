import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { SettingsService, isValidTimezone } from '@core/settings/settings.service';
import type { ThemeOverride } from '@core/settings/settings.types';
import { ThemeService } from '@core/theme/theme.service';
import { isValidRemoteUrl } from '@core/versioning/remote.config.io';
import { RemoteService } from '@core/versioning/remote.service';

@Component({
  selector: 'mc-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './settings.container.html',
  styleUrl: './settings.container.css',
})
export class SettingsContainer {
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly remote = inject(RemoteService);
  private readonly errors = inject(ErrorService);
  private readonly theme = inject(ThemeService);

  protected readonly themeOptions: readonly { value: ThemeOverride; labelKey: TranslationKey }[] = [
    { value: 'auto', labelKey: 'settings.theme.option.auto' },
    { value: 'light', labelKey: 'settings.theme.option.light' },
    { value: 'dark', labelKey: 'settings.theme.option.dark' },
  ];
  protected readonly resolvedThemeKey = computed<TranslationKey>(() =>
    this.theme.resolved() === 'dark' ? 'settings.theme.option.dark' : 'settings.theme.option.light',
  );

  protected readonly state = this.settings.state;
  protected readonly timezones = listSupportedTimezones();
  protected readonly draft = signal('');
  protected readonly error = signal(false);
  protected readonly dormantDraft = signal(0);

  protected readonly remoteConfig = this.remote.config;
  protected readonly remoteLastPushAt = this.remote.lastPushAt;
  protected readonly isPushing = this.remote.isPushing;
  protected readonly remoteUrlDraft = signal('');
  protected readonly remoteTokenDraft = signal('');
  protected readonly remoteUrlError = signal(false);
  protected readonly remoteTokenError = signal(false);

  constructor() {
    // why: keep the input synced when the timezone changes from elsewhere
    //      (workspace file load, future cross-tab sync).
    effect(() => this.draft.set(this.state().timezone));
    effect(() => this.dormantDraft.set(this.state().variants.dormantThresholdDays));
  }

  protected onDormantInput(event: Event): void {
    const v = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.dormantDraft.set(v);
  }

  protected applyDormant(): void {
    if (this.dormantDraft() === this.state().variants.dormantThresholdDays) return;
    this.settings.setVariantsDormantThreshold(this.dormantDraft());
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    this.error.set(false);
  }

  protected apply(): void {
    const tz = this.draft().trim();
    if (!tz || tz === this.state().timezone) return;
    if (!isValidTimezone(tz)) {
      this.error.set(true);
      return;
    }
    this.settings.setTimezone(tz);
    this.error.set(false);
  }

  protected revert(): void {
    this.draft.set(this.state().timezone);
    this.error.set(false);
  }

  protected onRemoteUrlInput(event: Event): void {
    this.remoteUrlDraft.set((event.target as HTMLInputElement).value);
    this.remoteUrlError.set(false);
  }

  protected onRemoteTokenInput(event: Event): void {
    this.remoteTokenDraft.set((event.target as HTMLInputElement).value);
    this.remoteTokenError.set(false);
  }

  protected async saveRemote(): Promise<void> {
    const url = this.remoteUrlDraft().trim();
    const token = this.remoteTokenDraft().trim();
    const urlOk = isValidRemoteUrl(url);
    const tokenOk = token.length > 0;
    this.remoteUrlError.set(!urlOk);
    this.remoteTokenError.set(!tokenOk);
    if (!urlOk || !tokenOk) return;
    try {
      await this.remote.configure({ url, token });
      this.remoteTokenDraft.set('');
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async clearRemote(): Promise<void> {
    if (!confirm(this.t('settings.remote.confirmClear'))) return;
    try {
      await this.remote.clear();
      this.remoteUrlDraft.set('');
      this.remoteTokenDraft.set('');
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected setTheme(next: ThemeOverride): void {
    if (next === this.state().theme.override) return;
    this.settings.setThemeOverride(next);
  }

  protected async pushRemote(): Promise<void> {
    try {
      await this.remote.pushActiveMain();
    } catch (e) {
      this.errors.report(e);
    }
  }
}

const listSupportedTimezones = (): readonly string[] => {
  // why: Intl.supportedValuesOf is in all Chromium browsers we support
  //      (§3 stack). Fall back to a curated short list if a runtime lacks it.
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return Object.freeze([...intl.supportedValuesOf('timeZone')]);
    } catch {
      // fall through
    }
  }
  return Object.freeze([
    'UTC',
    'America/Lima',
    'America/Bogota',
    'America/Mexico_City',
    'America/Argentina/Buenos_Aires',
    'America/Sao_Paulo',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/Madrid',
    'Europe/London',
    'Asia/Tokyo',
  ]);
};
