import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import { TagPickerComponent } from '@shared/tags/tag-picker.component';

import { TrackWaveformComponent } from '../components/track-waveform.component';
import { LyricsLookupService } from '../services/lyrics-lookup.service';
import { MusicLibraryService } from '../services/music-library.service';
import { PlaylistsService } from '../services/playlists.service';
import { WaveformCacheService } from '../services/waveform-cache.service';

type ExternalLyricsStatus = 'idle' | 'loading' | 'found' | 'notFound' | 'error';

interface ExternalLyricsCacheEntry {
  readonly artist: string;
  readonly title: string;
  readonly lyrics: string | null;
  readonly status: ExternalLyricsStatus;
}

// why: this card focuses on the *visual* now-playing surface — cover, metadata,
// waveform-as-seek. Transport controls (prev/play/next, shuffle, repeat, stop)
// already live in the global mini-player footer; duplicating them here only
// fights the layout for vertical room.
@Component({
  selector: 'mc-now-playing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TrackWaveformComponent, TagPickerComponent],
  templateUrl: './now-playing.container.html',
  styleUrl: './now-playing.container.css',
})
export class NowPlayingContainer {
  private readonly player = inject(PlayerService);
  private readonly playlists = inject(PlaylistsService);
  private readonly library = inject(MusicLibraryService);
  private readonly waveformCache = inject(WaveformCacheService);
  private readonly lyricsLookup = inject(LyricsLookupService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);
  private readonly tagsService = inject(TagsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly availableTags = this.tagsService.tags;
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
  protected readonly displayLyrics = computed(() => this.currentTrack()?.lyrics?.trim() || null);

  protected readonly showLyrics = signal(false);

  // why: fallback search is opt-in and per-track — never fetched
  // automatically (see [[feedback_ui_must_not_lie]]). Results are cached
  // only in-memory for the session (this Map), never written to Track/disk,
  // so an unverified/wrong match never gets persisted as real metadata.
  private readonly externalCache = new Map<string, ExternalLyricsCacheEntry>();
  protected readonly externalOpen = signal(false);
  protected readonly externalArtist = signal('');
  protected readonly externalTitle = signal('');
  protected readonly externalStatus = signal<ExternalLyricsStatus>('idle');
  protected readonly externalLyrics = signal<string | null>(null);

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

    // why: closing the lyrics panel on track change avoids showing the
    // previous track's letra (or a stale empty state) while the new one loads.
    effect(() => {
      this.player.currentTrackId();
      this.showLyrics.set(false);
      this.externalOpen.set(false);
    });

    this.destroyRef.onDestroy(() => {
      if (previous !== null) URL.revokeObjectURL(previous);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected asInput(target: EventTarget | null): HTMLInputElement {
    return target as HTMLInputElement;
  }

  protected onToggleLyrics(): void {
    this.showLyrics.update((v) => !v);
  }

  protected onOpenExternalSearch(): void {
    const track = this.currentTrack();
    if (!track) return;
    const cached = this.externalCache.get(track.id);
    if (cached) {
      this.externalArtist.set(cached.artist);
      this.externalTitle.set(cached.title);
      this.externalLyrics.set(cached.lyrics);
      this.externalStatus.set(cached.status);
    } else {
      // why: never seed from originalName/displayTitle — filenames have no
      // stable "Artist - Title" pattern (edits, YouTube ids, mix titles...),
      // so a guessed split would silently feed lyrics.ovh garbage. Only
      // trust real ID3 tags; otherwise leave blank and let the user type it
      // from the filename shown as reference below the fields.
      this.externalArtist.set(track.artist?.trim() ?? '');
      this.externalTitle.set(track.title?.trim() ?? '');
      this.externalLyrics.set(null);
      this.externalStatus.set('idle');
    }
    this.externalOpen.set(true);
  }

  protected onCloseExternalSearch(): void {
    this.externalOpen.set(false);
  }

  protected onExternalArtistInput(value: string): void {
    this.externalArtist.set(value);
  }

  protected onExternalTitleInput(value: string): void {
    this.externalTitle.set(value);
  }

  protected async onSearchExternal(): Promise<void> {
    const track = this.currentTrack();
    const artist = this.externalArtist().trim();
    const title = this.externalTitle().trim();
    if (!track || !artist || !title) return;
    this.externalStatus.set('loading');
    this.externalLyrics.set(null);
    try {
      const lyrics = await this.lyricsLookup.lookup(artist, title);
      this.externalLyrics.set(lyrics);
      const status = lyrics ? 'found' : 'notFound';
      this.externalStatus.set(status);
      this.externalCache.set(track.id, { artist, title, lyrics, status });
    } catch (cause) {
      console.warn('[now-playing] external lyrics lookup failed', cause);
      this.externalStatus.set('error');
      this.externalCache.set(track.id, { artist, title, lyrics: null, status: 'error' });
    }
  }

  protected async onAddTag(label: string): Promise<void> {
    const track = this.currentTrack();
    if (!track) return;
    try {
      const tag = await this.tagsService.touch(label);
      if (track.tags.includes(tag.id)) return;
      await this.library.setTrackTags(track.id, [...track.tags, tag.id]);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onRemoveTag(id: string): Promise<void> {
    const track = this.currentTrack();
    if (!track || !track.tags.includes(id)) return;
    await this.library.setTrackTags(
      track.id,
      track.tags.filter((t) => t !== id),
    );
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
