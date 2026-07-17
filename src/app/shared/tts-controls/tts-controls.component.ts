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
import type { TtsAction, TtsPaneState } from '@core/tts/tts.types';
import { IconComponent } from '@shared/icon/icon.component';

const RATE_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

@Component({
  selector: 'mc-tts-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './tts-controls.component.html',
  styleUrl: './tts-controls.component.css',
})
export class TtsControlsComponent {
  readonly state = input.required<TtsPaneState>();
  readonly action = output<TtsAction>();

  protected readonly rateSteps = RATE_STEPS;
  protected readonly settingsOpen = signal(false);

  private readonly i18n = inject(I18nService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected toggleLabel(): string {
    const s = this.state();
    return s.speaking && !s.paused ? this.t('books.tts.pause') : this.t('books.tts.play');
  }

  protected onToggle(): void {
    this.action.emit({ kind: 'toggle' });
  }

  protected onStop(): void {
    this.settingsOpen.set(false);
    this.action.emit({ kind: 'stop' });
  }

  protected toggleSettings(): void {
    this.settingsOpen.update((v) => !v);
  }

  protected onRateChange(rate: number): void {
    this.action.emit({ kind: 'prefs', prefs: { ...this.state().prefs, rate } });
  }

  protected onVoiceChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    const voiceURI = target.value === '' ? null : target.value;
    this.action.emit({ kind: 'prefs', prefs: { ...this.state().prefs, voiceURI } });
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocClick(event: Event): void {
    if (!this.settingsOpen()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.settingsOpen.set(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEsc(event: Event): void {
    if (this.settingsOpen()) {
      event.preventDefault();
      this.settingsOpen.set(false);
    }
  }
}
