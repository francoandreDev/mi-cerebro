import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

import { ErrorService } from '@core/errors/error.service';
import { ExportZipService } from '@core/export/export-zip.service';
import { WorkspaceRefreshService } from '@core/fs/workspace-refresh.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { LEAD_PRESETS } from '@core/reminders/goal-cadence.utils';
import { SettingsService, isValidTimezone } from '@core/settings/settings.service';
import type { BgSatLevel, ThemeOverride } from '@core/settings/settings.types';
import {
  ACCENT_FG,
  ACCENT_PALETTE,
  DEFAULT_ACCENT_ID,
  DEFAULT_BG_HUE,
  accentHexFor,
  computeBgHex,
  reportContrast,
} from '@core/theme/theme-palette';
import { ThemeService } from '@core/theme/theme.service';
import { isValidRemoteUrl } from '@core/versioning/remote.config.io';
import { RemoteService } from '@core/versioning/remote.service';

@Component({
  selector: 'mc-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BgColorDirective, ConfirmDialogComponent, IconComponent],
  templateUrl: './settings.container.html',
  styleUrl: './settings.container.css',
})
export class SettingsContainer {
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly remote = inject(RemoteService);
  private readonly errors = inject(ErrorService);
  private readonly theme = inject(ThemeService);
  private readonly exportZip = inject(ExportZipService);
  private readonly workspaceRefresh = inject(WorkspaceRefreshService);

  protected readonly reindexRunning = signal(false);
  protected readonly reindexDone = signal(false);
  protected readonly confirm = new ConfirmController();

  protected readonly exportIncludeAllVariants = signal(false);
  protected readonly exportIncludeAssets = signal(true);
  protected readonly exportProgress = this.exportZip.progress;
  protected readonly exportRunning = this.exportZip.isRunning;

  protected readonly accentPalette = ACCENT_PALETTE;
  protected readonly satLevels: readonly BgSatLevel[] = ['low', 'mid', 'high'];
  protected readonly resolvedTheme = this.theme.resolved;
  protected readonly currentHue = computed(
    () => this.state().theme.customBgHue ?? DEFAULT_BG_HUE[this.resolvedTheme()],
  );
  protected readonly currentSat = computed<BgSatLevel>(
    () => this.state().theme.customBgSatLevel ?? 'mid',
  );
  protected readonly currentAccentId = computed(
    () => this.state().theme.customAccentId ?? DEFAULT_ACCENT_ID,
  );
  protected readonly previewBg = computed(() =>
    computeBgHex(this.resolvedTheme(), this.currentHue(), this.currentSat()),
  );
  protected readonly previewAccent = computed(() =>
    accentHexFor(this.resolvedTheme(), this.currentAccentId()),
  );
  protected readonly accentContrast = computed(() =>
    reportContrast(this.previewAccent(), ACCENT_FG[this.resolvedTheme()]),
  );

  protected readonly sections: readonly {
    id: SectionId;
    labelKey: TranslationKey;
    icon: IconName;
  }[] = [
    { id: 'general', labelKey: 'settings.section.general', icon: 'gear' },
    { id: 'theme', labelKey: 'settings.section.theme', icon: 'palette' },
    { id: 'remote', labelKey: 'settings.remote.section.title', icon: 'git-branch' },
    { id: 'versioning', labelKey: 'settings.section.versioning', icon: 'clock-counter-clockwise' },
    { id: 'variants', labelKey: 'settings.section.variants', icon: 'copy' },
    { id: 'export', labelKey: 'settings.export.section.title', icon: 'archive' },
    { id: 'reminders', labelKey: 'settings.section.reminders', icon: 'bell' },
    { id: 'goals', labelKey: 'settings.section.goals', icon: 'target' },
    { id: 'author', labelKey: 'settings.section.author', icon: 'pen-nib' },
  ];
  protected readonly activeSection = signal<SectionId>(readStoredSection());

  protected selectSection(id: SectionId): void {
    this.activeSection.set(id);
    try {
      sessionStorage.setItem(SECTION_STORAGE_KEY, id);
    } catch {
      // why: sessionStorage can throw in private modes; selection is non-critical.
    }
  }

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
  protected readonly goalsDormantDraft = signal(0);
  protected readonly autocommitDraft = signal(0);
  protected readonly compactionThresholdDraft = signal(0);
  protected readonly authorBioDraft = signal('');
  protected readonly leadPresets = LEAD_PRESETS;
  protected readonly currentLead = computed(() => this.state().reminders.leadMinutes);

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
    effect(() => this.goalsDormantDraft.set(this.state().goals.dormantThresholdDays));
    effect(() => this.autocommitDraft.set(this.state().versioning.autocommitMinutes));
    effect(() =>
      this.compactionThresholdDraft.set(this.state().versioning.compactionThresholdCommits),
    );
    effect(() => this.authorBioDraft.set(this.state().authorBio));
  }

  protected selectLeadPreset(minutes: number): void {
    if (this.currentLead() === minutes) return;
    this.settings.setReminderLeadMinutes(minutes);
  }

  protected asKey(key: string): TranslationKey {
    return key as TranslationKey;
  }

  protected onAutocommitInput(event: Event): void {
    const v = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.autocommitDraft.set(v);
  }

  protected applyAutocommit(event?: Event): void {
    event?.preventDefault();
    if (this.autocommitDraft() === this.state().versioning.autocommitMinutes) return;
    this.settings.setAutocommitMinutes(this.autocommitDraft());
  }

  protected onCompactionThresholdInput(event: Event): void {
    const v = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.compactionThresholdDraft.set(v);
  }

  protected applyCompactionThreshold(event?: Event): void {
    event?.preventDefault();
    if (this.compactionThresholdDraft() === this.state().versioning.compactionThresholdCommits) {
      return;
    }
    this.settings.setCompactionThresholdCommits(this.compactionThresholdDraft());
  }

  protected onAuthorBioInput(event: Event): void {
    this.authorBioDraft.set((event.target as HTMLTextAreaElement).value);
  }

  protected applyAuthorBio(event?: Event): void {
    event?.preventDefault();
    if (this.authorBioDraft() === this.state().authorBio) return;
    this.settings.setAuthorBio(this.authorBioDraft());
  }

  protected onDormantInput(event: Event): void {
    const v = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.dormantDraft.set(v);
  }

  protected applyDormant(event?: Event): void {
    event?.preventDefault();
    if (this.dormantDraft() === this.state().variants.dormantThresholdDays) return;
    this.settings.setVariantsDormantThreshold(this.dormantDraft());
  }

  protected onGoalsDormantInput(event: Event): void {
    const v = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.goalsDormantDraft.set(v);
  }

  protected applyGoalsDormant(event?: Event): void {
    event?.preventDefault();
    if (this.goalsDormantDraft() === this.state().goals.dormantThresholdDays) return;
    this.settings.setGoalsDormantThreshold(this.goalsDormantDraft());
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    this.error.set(false);
  }

  protected apply(event?: Event): void {
    event?.preventDefault();
    const tz = this.draft().trim();
    if (!tz || tz === this.state().timezone) return;
    if (!isValidTimezone(tz)) {
      this.error.set(true);
      return;
    }
    this.settings.setTimezone(tz);
    this.error.set(false);
  }

  protected revert(event?: Event): void {
    event?.preventDefault();
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

  protected clearRemote(): void {
    this.confirm.ask(
      {
        title: this.t('settings.remote.confirm.clear.title'),
        message: this.t('settings.remote.confirmClear'),
        confirmLabel: this.t('settings.remote.confirm.clear.confirm'),
        cancelLabel: this.t('settings.remote.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.remote.clear();
          this.remoteUrlDraft.set('');
          this.remoteTokenDraft.set('');
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected setTheme(next: ThemeOverride): void {
    if (next === this.state().theme.override) return;
    this.settings.setThemeOverride(next);
  }

  protected onToggleCompactWithRemote(event: Event): void {
    this.settings.setCompactWithRemote((event.target as HTMLInputElement).checked);
  }

  protected async pushRemote(): Promise<void> {
    try {
      await this.remote.pushActiveMain();
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onHueInput(event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.settings.setCustomBgHue(v);
  }

  protected setSat(level: BgSatLevel): void {
    this.settings.setCustomBgSatLevel(level);
  }

  protected satLabelKey(level: BgSatLevel): TranslationKey {
    return `settings.theme.bgSat.${level}` as TranslationKey;
  }

  protected setAccent(id: string): void {
    this.settings.setCustomAccentId(id);
  }

  protected resetTheme(): void {
    this.settings.setCustomBgHue(undefined);
    this.settings.setCustomBgSatLevel(undefined);
    this.settings.setCustomAccentId(undefined);
  }

  protected formatRatio(r: number): string {
    return r.toFixed(2);
  }

  protected onToggleIncludeVariants(event: Event): void {
    this.exportIncludeAllVariants.set((event.target as HTMLInputElement).checked);
  }

  protected onToggleIncludeAssets(event: Event): void {
    this.exportIncludeAssets.set((event.target as HTMLInputElement).checked);
  }

  protected async runExport(): Promise<void> {
    try {
      await this.exportZip.exportToDownload({
        includeAllVariants: this.exportIncludeAllVariants(),
        includeAssets: this.exportIncludeAssets(),
      });
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async runReindex(): Promise<void> {
    this.reindexRunning.set(true);
    this.reindexDone.set(false);
    try {
      await this.workspaceRefresh.refreshAll();
      this.reindexDone.set(true);
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.reindexRunning.set(false);
    }
  }
}

type SectionId =
  | 'general'
  | 'theme'
  | 'remote'
  | 'versioning'
  | 'variants'
  | 'export'
  | 'reminders'
  | 'goals'
  | 'author';

const SECTION_STORAGE_KEY = 'mc.settings.section';
const VALID_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>([
  'general',
  'theme',
  'remote',
  'versioning',
  'variants',
  'export',
  'reminders',
  'goals',
  'author',
]);

const readStoredSection = (): SectionId => {
  try {
    const v = sessionStorage.getItem(SECTION_STORAGE_KEY);
    if (v && VALID_SECTIONS.has(v as SectionId)) return v as SectionId;
  } catch {
    // why: sessionStorage may throw in private modes; fall back to default.
  }
  return 'general';
};

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
