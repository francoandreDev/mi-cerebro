import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { IconComponent } from '@shared/icon/icon.component';

import { TrackWaveformComponent } from '../components/track-waveform.component';
import { MusicLibraryService } from '../services/music-library.service';
import { PlaylistsService } from '../services/playlists.service';
import { WaveformCacheService } from '../services/waveform-cache.service';

// why: this card focuses on the *visual* now-playing surface — cover, metadata,
// waveform-as-seek. Transport controls (prev/play/next, shuffle, repeat, stop)
// already live in the global mini-player footer; duplicating them here only
// fights the layout for vertical room.
@Component({
  selector: 'mc-now-playing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TrackWaveformComponent],
  templateUrl: './now-playing.container.html',
  styleUrl: './now-playing.container.css',
})
export class NowPlayingContainer {
  private readonly player = inject(PlayerService);
  private readonly playlists = inject(PlaylistsService);
  private readonly library = inject(MusicLibraryService);
  private readonly waveformCache = inject(WaveformCacheService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentTrack = this.player.currentTrack;
  protected readonly currentTime = this.player.currentTime;
  protected readonly duration = this.player.duration;

  protected readonly sourceTitle = computed(() => {
    const id = this.player.currentSourceId();
    if (!id) return null;
    return this.playlists.summaries().find((p) => p.id === id)?.title ?? null;
  });

  protected readonly displayTitle = computed(() => {
    const t = this.currentTrack();
    if (!t) return null;
    return (t.title?.trim() || t.originalName).trim();
  });

  protected readonly displayArtist = computed(() => this.currentTrack()?.artist?.trim() ?? null);
  protected readonly displayAlbum = computed(() => this.currentTrack()?.album?.trim() ?? null);

  private readonly coverUrl = signal<string | null>(null);
  protected readonly coverUrlRead = this.coverUrl.asReadonly();

  protected readonly waveformPeaks = computed(() =>
    this.waveformCache.peaksFor(this.player.currentTrackId()),
  );
  protected readonly waveformStatus = computed(() =>
    this.waveformCache.statusFor(this.player.currentTrackId()),
  );

  constructor() {
    // why: load and revoke the cover blob URL alongside the current track.
    // Token guards against stale async resolutions when the track changes
    // mid-flight; `previous` is revoked before assigning a new URL so the
    // signal+effect interaction stays on the read side (rule 3b).
    let previous: string | null = null;
    let token = 0;
    effect(() => {
      const track = this.currentTrack();
      const myToken = ++token;
      if (previous !== null) {
        URL.revokeObjectURL(previous);
        previous = null;
        this.coverUrl.set(null);
      }
      if (!track || !track.coverPath) return;
      this.library
        .readCoverBlob(track.coverPath)
        .then((blob) => {
          if (!blob || myToken !== token) return;
          const url = URL.createObjectURL(blob);
          previous = url;
          this.coverUrl.set(url);
        })
        .catch((cause) => console.warn('[now-playing] cover load failed', cause));
    });

    effect(() => {
      const id = this.player.currentTrackId();
      if (id !== null) void this.waveformCache.ensure(id);
    });

    this.destroyRef.onDestroy(() => {
      if (previous !== null) URL.revokeObjectURL(previous);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSeek(value: number): void {
    this.player.seekTo(value);
  }

  protected formatTime(sec: number): string {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00';
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
