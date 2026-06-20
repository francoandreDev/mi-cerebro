import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { IconComponent } from '@shared/icon/icon.component';

import { MusicLibraryService } from '../services/music-library.service';
import { PlaylistsService } from '../services/playlists.service';

@Component({
  selector: 'mc-now-playing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './now-playing.container.html',
  styleUrl: './now-playing.container.css',
})
export class NowPlayingContainer {
  private readonly player = inject(PlayerService);
  private readonly playlists = inject(PlaylistsService);
  private readonly library = inject(MusicLibraryService);
  private readonly i18n = inject(I18nService);

  protected readonly currentTrack = this.player.currentTrack;
  protected readonly isPlaying = this.player.isPlaying;
  protected readonly shuffle = this.player.shuffle;
  protected readonly repeat = this.player.repeat;
  protected readonly currentTime = this.player.currentTime;
  protected readonly duration = this.player.duration;
  protected readonly queue = this.player.queue;

  protected readonly sourceTitle = computed(() => {
    const id = this.player.currentSourceId();
    if (!id) return null;
    return this.playlists.summaries().find((p) => p.id === id)?.title ?? null;
  });

  protected readonly queueTracks = computed(() => {
    const q = this.queue();
    const byId = new Map(this.library.tracks().map((t) => [t.id, t] as const));
    return q.trackIds
      .map((id, i) => {
        const t = byId.get(id);
        return t
          ? { id: t.id, originalName: t.originalName, isCurrent: i === q.index, index: i }
          : null;
      })
      .filter(
        (x): x is { id: string; originalName: string; isCurrent: boolean; index: number } =>
          x !== null,
      );
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected async onTogglePlay(): Promise<void> {
    await this.player.toggle();
  }

  protected async onPrev(): Promise<void> {
    await this.player.prev();
  }

  protected async onNext(): Promise<void> {
    await this.player.next();
  }

  protected onToggleShuffle(): void {
    this.player.toggleShuffle();
  }

  protected onToggleRepeat(): void {
    this.player.toggleRepeat();
  }

  protected onSeek(value: number): void {
    this.player.seekTo(value);
  }

  protected onSkip(delta: number): void {
    this.player.skip(delta);
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

  protected onStop(): void {
    this.player.stop();
  }

  protected async onJumpTo(index: number): Promise<void> {
    await this.player.jumpTo(index);
  }

  protected onRemoveFromQueue(index: number): void {
    this.player.removeAt(index);
  }

  protected onClearQueue(): void {
    this.player.stop();
  }
}
