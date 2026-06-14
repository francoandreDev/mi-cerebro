import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
      <div class="bar" [class.expanded]="expanded()">
        <button type="button" class="title" (click)="goToMusic()" [title]="t('music.openLibrary')">
          <mc-icon name="music-note" /> {{ track.originalName }}
        </button>
        <div class="ctrls">
          <button type="button" (click)="player.prev()" [attr.aria-label]="t('music.prev')">
            <mc-icon name="skip-back" />
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
          <button type="button" (click)="player.next()" [attr.aria-label]="t('music.next')">
            <mc-icon name="skip-forward" />
          </button>
          <button
            type="button"
            [class.active]="player.shuffle()"
            (click)="player.toggleShuffle()"
            [attr.aria-label]="t('music.shuffle')"
          >
            <mc-icon name="shuffle" />
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
      display: flex;
      align-items: center;
      gap: var(--mc-space-3);
      z-index: 50;
    }
    .title {
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      cursor: pointer;
      flex: 1;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .title:hover {
      color: var(--mc-accent-primary);
    }
    .ctrls {
      display: flex;
      gap: var(--mc-space-1);
    }
    .ctrls button {
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      cursor: pointer;
      font-size: 18px;
      width: 32px;
      height: 32px;
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
    }
  `,
})
export class MiniPlayerContainer {
  protected readonly player = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly expanded = signal(false);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected goToMusic(): void {
    void this.router.navigate(['/music']);
  }
}
