import { Injectable, computed, inject, signal } from '@angular/core';

import { MusicLibraryService } from '@features/music/services/music-library.service';

interface QueueState {
  readonly trackIds: readonly string[];
  readonly index: number;
}

// why: single Audio element + signals. Shuffle is enabled by default per
//      §16 ("reproducción aleatoria en bucle como modo principal"); when
//      shuffle is on, prev/next walk a pre-shuffled clone of the queue.
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly library = inject(MusicLibraryService);

  private readonly audio: HTMLAudioElement;
  private currentBlobUrl: string | null = null;

  private readonly queueSignal = signal<QueueState>({ trackIds: [], index: 0 });
  readonly queue = this.queueSignal.asReadonly();
  private readonly playingSignal = signal(false);
  readonly isPlaying = this.playingSignal.asReadonly();
  private readonly shuffleSignal = signal(true);
  readonly shuffle = this.shuffleSignal.asReadonly();

  readonly currentTrackId = computed<string | null>(() => {
    const q = this.queueSignal();
    return q.trackIds[q.index] ?? null;
  });

  readonly currentTrack = computed(() => {
    const id = this.currentTrackId();
    return id ? this.library.byId(id) : null;
  });

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('play', () => this.playingSignal.set(true));
    this.audio.addEventListener('pause', () => this.playingSignal.set(false));
  }

  async playTrack(trackId: string): Promise<void> {
    await this.loadQueue([trackId], 0);
  }

  async playPlaylist(trackIds: readonly string[], startIndex = 0): Promise<void> {
    if (trackIds.length === 0) return;
    const order = this.shuffleSignal() ? shuffleFrom(trackIds, startIndex) : [...trackIds];
    await this.loadQueue(order, this.shuffleSignal() ? 0 : startIndex);
  }

  async toggle(): Promise<void> {
    if (!this.currentTrackId()) return;
    if (this.audio.paused) await this.audio.play();
    else this.audio.pause();
  }

  async next(): Promise<void> {
    const q = this.queueSignal();
    if (q.trackIds.length === 0) return;
    const nextIdx = (q.index + 1) % q.trackIds.length;
    this.queueSignal.set({ ...q, index: nextIdx });
    await this.loadCurrent(true);
  }

  async prev(): Promise<void> {
    const q = this.queueSignal();
    if (q.trackIds.length === 0) return;
    const prevIdx = (q.index - 1 + q.trackIds.length) % q.trackIds.length;
    this.queueSignal.set({ ...q, index: prevIdx });
    await this.loadCurrent(true);
  }

  toggleShuffle(): void {
    this.shuffleSignal.update((v) => !v);
  }

  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.revokeUrl();
    this.queueSignal.set({ trackIds: [], index: 0 });
  }

  private async loadQueue(trackIds: readonly string[], index: number): Promise<void> {
    this.queueSignal.set({ trackIds, index });
    await this.loadCurrent(true);
  }

  private async loadCurrent(autoPlay: boolean): Promise<void> {
    const id = this.currentTrackId();
    if (!id) return;
    try {
      const blob = await this.library.readBlob(id);
      this.revokeUrl();
      this.currentBlobUrl = URL.createObjectURL(blob);
      this.audio.src = this.currentBlobUrl;
      if (autoPlay) await this.audio.play();
    } catch (cause) {
      console.warn('[player] failed to load track', id, cause);
    }
  }

  private revokeUrl(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}

const shuffleFrom = (ids: readonly string[], startIndex: number): string[] => {
  const head = ids[startIndex];
  const rest = ids.filter((_, i) => i !== startIndex);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return head !== undefined ? [head, ...rest] : rest;
};
