import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { SettingsService, isValidTimezone } from '@core/settings/settings.service';

@Component({
  selector: 'mc-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.container.html',
  styleUrl: './settings.container.css',
})
export class SettingsContainer {
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);

  protected readonly state = this.settings.state;
  protected readonly timezones = listSupportedTimezones();
  protected readonly draft = signal('');
  protected readonly error = signal(false);
  protected readonly dormantDraft = signal(0);

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
