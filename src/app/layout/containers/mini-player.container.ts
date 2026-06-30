import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-mini-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (player.currentTrack(); as track) {
      <div class="bar">
        <button type="button" class="title" (click)="goToMusic()" [title]="t('music.openLibrary')">
          <mc-icon name="music-note" /> {{ track.originalName }}
        </button>
        <div class="seek">
          <span class="time">{{ formatTime(player.currentTime()) }}</span>
          <input
            type="range"
            class="seek-input"
            min="0"
            [max]="player.duration() || 0"
            step="0.5"
            [value]="player.currentTime()"
            (input)="onSeek(asInput($event.target).valueAsNumber)"
            [attr.aria-label]="t('music.seek')"
          />
          <span class="time">{{ formatTime(player.duration()) }}</span>
        </div>
        <div class="ctrls">
          <button
            type="button"
            [class.active]="player.shuffle()"
            (click)="player.toggleShuffle()"
            [attr.aria-label]="t('music.shuffle')"
            [title]="t('music.shuffle')"
          >
            <mc-icon name="shuffle" />
          </button>
          <button
            type="button"
            (click)="player.prev()"
            [attr.aria-label]="t('music.prev')"
            [title]="t('music.prev')"
          >
            <mc-icon name="skip-back" />
          </button>
          <button
            type="button"
            (click)="player.skip(-10)"
            [attr.aria-label]="t('music.skipBack10')"
            [title]="t('music.skipBack10')"
          >
            −10s
          </button>
          <button
            type="button"
            class="play"
            (click)="player.toggle()"
            [attr.aria-label]="t('music.playPause')"
          >
            @if (player.isPlaying()) {
              <mc-icon name="pause" />
            } @else {
              <mc-icon name="play" />
            }
          </button>
          <button
            type="button"
            (click)="player.skip(10)"
            [attr.aria-label]="t('music.skipForward10')"
            [title]="t('music.skipForward10')"
          >
            +10s
          </button>
          <button
            type="button"
            (click)="player.next()"
            [attr.aria-label]="t('music.next')"
            [title]="t('music.next')"
          >
            <mc-icon name="skip-forward" />
          </button>
          <button
            type="button"
            [class.active]="player.repeat() === 'one'"
            (click)="player.toggleRepeat()"
            [attr.aria-label]="t('music.repeat')"
            [title]="repeatTitle()"
          >
            <mc-icon name="arrows-clockwise" />
          </button>
          <button type="button" (click)="player.stop()" [attr.aria-label]="t('music.stop')">
            <mc-icon name="x" />
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--mc-bg-elevated);
      border-top: 1px solid var(--mc-border-default);
      padding: var(--mc-space-1) var(--mc-space-3);
      display: grid;
      grid-template-columns: minmax(120px, 1fr) minmax(220px, 2fr) auto;
      align-items: center;
      gap: var(--mc-space-3);
      z-index: 50;
      min-height: 56px;
    }
    .title {
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      cursor: pointer;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .title:hover {
      color: var(--mc-accent-primary);
    }
    .seek {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      min-width: 0;
    }
    .seek-input {
      flex: 1;
      min-width: 0;
      accent-color: var(--mc-accent-primary);
    }
    .time {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-muted);
      font-variant-numeric: tabular-nums;
      min-width: 36px;
      text-align: center;
    }
    .ctrls {
      display: flex;
      gap: var(--mc-space-1);
      align-items: center;
    }
    .ctrls button {
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      cursor: pointer;
      font-size: 12px;
      height: 32px;
      min-width: 32px;
      padding: 0 6px;
      border-radius: var(--mc-radius-sm);
    }
    .ctrls button:hover {
      background: var(--mc-bg-hover);
    }
    .ctrls button.active {
      color: var(--mc-accent-primary);
    }
    .ctrls button.play {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      width: 40px;
    }
    @media (max-width: 900px) {
      .bar {
        grid-template-columns: 1fr;
        gap: var(--mc-space-1);
      }
    }
  `,
})
export class MiniPlayerContainer {
  protected readonly player = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  constructor() {
    // why: reserve bottom space on app shell so the fixed bar never overlaps
    //      page content or the sidebar. Cleared when nothing is playing.
    effect(() => {
      const visible = this.player.currentTrack() !== null;
      document.documentElement.style.setProperty('--mc-mini-player-h', visible ? '56px' : '0px');
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected repeatTitle(): string {
    return this.i18n.t(this.player.repeat() === 'one' ? 'music.repeat.one' : 'music.repeat.off');
  }

  protected goToMusic(): void {
    void this.router.navigate(['/music']);
  }

  protected onSeek(value: number): void {
    this.player.seekTo(value);
  }

  protected asInput(target: EventTarget | null): HTMLInputElement {
    return target as HTMLInputElement;
  }

  protected formatTime(sec: number): string {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00';
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
