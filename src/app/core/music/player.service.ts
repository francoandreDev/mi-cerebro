import { Injectable, type Signal, computed, effect, inject, signal } from '@angular/core';

import { MusicLibraryService } from '@features/music/services/music-library.service';

import { AudioGraph } from './audio-graph';

type RepeatMode = 'off' | 'one';

interface QueueState {
  readonly trackIds: readonly string[];
  readonly index: number;
  readonly originalOrder: readonly string[];
}

interface PersistedState {
  readonly trackIds: readonly string[];
  readonly originalOrder: readonly string[];
  readonly index: number;
  readonly currentTime: number;
  readonly shuffle: boolean;
  readonly repeat: RepeatMode;
  readonly sourceId: string | null;
}

const STORAGE_KEY = 'mc.player.state';
const SEEK_SAVE_THROTTLE_MS = 1500;

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly library = inject(MusicLibraryService);

  private readonly audio: HTMLAudioElement;
  private readonly audioGraph: AudioGraph;
  readonly analyser: Signal<AnalyserNode | null>;
  private currentBlobUrl: string | null = null;
  private lastSeekSaveAt = 0;
  private restored = false;

  private readonly queueSignal = signal<QueueState>({
    trackIds: [],
    index: 0,
    originalOrder: [],
  });
  readonly queue = this.queueSignal.asReadonly();
  private readonly playingSignal = signal(false);
  readonly isPlaying = this.playingSignal.asReadonly();
  private readonly shuffleSignal = signal(false);
  readonly shuffle = this.shuffleSignal.asReadonly();
  private readonly repeatSignal = signal<RepeatMode>('off');
  readonly repeat = this.repeatSignal.asReadonly();
  private readonly currentTimeSignal = signal(0);
  readonly currentTime = this.currentTimeSignal.asReadonly();
  private readonly durationSignal = signal(0);
  readonly duration = this.durationSignal.asReadonly();
  private readonly currentSourceSignal = signal<string | null>(null);
  readonly currentSourceId = this.currentSourceSignal.asReadonly();

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
    this.audioGraph = new AudioGraph(this.audio);
    this.analyser = this.audioGraph.analyser;
    this.audio.addEventListener('ended', () => void this.handleEnded());
    this.audio.addEventListener('play', () => this.playingSignal.set(true));
    this.audio.addEventListener('pause', () => this.playingSignal.set(false));
    this.audio.addEventListener('timeupdate', () => {
      this.currentTimeSignal.set(this.audio.currentTime);
      const now = Date.now();
      if (now - this.lastSeekSaveAt > SEEK_SAVE_THROTTLE_MS) {
        this.lastSeekSaveAt = now;
        this.persist();
      }
    });
    this.audio.addEventListener('loadedmetadata', () => {
      const dur = this.audio.duration || 0;
      this.durationSignal.set(dur);
      const id = this.currentTrackId();
      if (id && dur > 0) void this.library.backfillDurationMs(id, dur * 1000);
    });

    // why: restore once the library has loaded so we can resolve track ids.
    effect(() => {
      const tracks = this.library.tracks();
      if (this.restored || tracks.length === 0) return;
      this.restored = true;
      void this.restoreFromStorage();
    });
  }

  async playTrack(trackId: string): Promise<void> {
    this.currentSourceSignal.set(null);
    await this.loadQueue([trackId], [trackId], 0);
  }

  async playPlaylist(
    trackIds: readonly string[],
    startIndex = 0,
    sourceId: string | null = null,
    forceShuffle?: boolean,
  ): Promise<void> {
    if (trackIds.length === 0) return;
    this.currentSourceSignal.set(sourceId);
    if (forceShuffle === true) this.shuffleSignal.set(true);
    const useShuffle = this.shuffleSignal();
    const original = [...trackIds];
    const order = useShuffle ? shuffleFrom(trackIds, startIndex) : original;
    const index = useShuffle ? 0 : startIndex;
    await this.loadQueue(order, original, index);
  }

  async toggle(): Promise<void> {
    if (!this.currentTrackId()) return;
    if (this.audio.paused) {
      await this.audioGraph.ensure();
      await this.audio.play();
    } else this.audio.pause();
  }

  async next(): Promise<void> {
    const q = this.queueSignal();
    if (q.trackIds.length === 0) return;
    const last = q.index >= q.trackIds.length - 1;
    // why: manual `next` while repeat is active should still advance —
    // the single-track loop only applies to natural end-of-track (audio.loop).
    if (last && q.trackIds.length > 1) {
      this.audio.pause();
      return;
    }
    const nextIdx = (q.index + 1) % q.trackIds.length;
    this.queueSignal.set({ ...q, index: nextIdx });
    await this.loadCurrent(true);
  }

  async prev(): Promise<void> {
    const q = this.queueSignal();
    if (q.trackIds.length === 0) return;
    // why: "prev" within first 3s of a track restarts it (familiar UX).
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    const prevIdx = (q.index - 1 + q.trackIds.length) % q.trackIds.length;
    this.queueSignal.set({ ...q, index: prevIdx });
    await this.loadCurrent(true);
  }

  toggleShuffle(): void {
    const turningOn = !this.shuffleSignal();
    this.shuffleSignal.set(turningOn);
    const q = this.queueSignal();
    if (q.trackIds.length === 0) {
      this.persist();
      return;
    }
    const currentId = q.trackIds[q.index];
    if (currentId === undefined) {
      this.persist();
      return;
    }
    if (turningOn) {
      this.applyShuffledQueue(q.originalOrder, currentId);
    } else {
      const order = q.originalOrder.length > 0 ? q.originalOrder : [...q.trackIds];
      const newIdx = Math.max(0, order.indexOf(currentId));
      this.queueSignal.set({ trackIds: order, index: newIdx, originalOrder: order });
    }
    this.persist();
  }

  toggleRepeat(): void {
    const next: RepeatMode = this.repeatSignal() === 'off' ? 'one' : 'off';
    this.repeatSignal.set(next);
    this.audio.loop = next === 'one';
    this.persist();
  }

  private applyShuffledQueue(originalOrder: readonly string[], currentId: string): void {
    const startIdx = originalOrder.indexOf(currentId);
    const shuffled = shuffleFrom(originalOrder, startIdx >= 0 ? startIdx : 0);
    this.queueSignal.set({ trackIds: shuffled, index: 0, originalOrder });
  }

  async jumpTo(index: number): Promise<void> {
    const q = this.queueSignal();
    if (index < 0 || index >= q.trackIds.length || index === q.index) return;
    this.queueSignal.set({ ...q, index });
    await this.loadCurrent(true);
  }

  seekTo(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    const dur = this.durationSignal();
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    this.audio.currentTime = clamped;
    this.currentTimeSignal.set(clamped);
    this.persist();
  }

  skip(deltaSeconds: number): void {
    this.seekTo(this.audio.currentTime + deltaSeconds);
  }

  removeAt(index: number): void {
    const q = this.queueSignal();
    if (index < 0 || index >= q.trackIds.length) return;
    if (index === q.index) return;
    const removedId = q.trackIds[index];
    const trackIds = q.trackIds.filter((_, i) => i !== index);
    const originalOrder =
      removedId !== undefined ? q.originalOrder.filter((id) => id !== removedId) : q.originalOrder;
    const newIndex = index < q.index ? q.index - 1 : q.index;
    this.queueSignal.set({ trackIds, index: newIndex, originalOrder });
    this.persist();
  }

  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.revokeUrl();
    this.queueSignal.set({ trackIds: [], index: 0, originalOrder: [] });
    this.currentSourceSignal.set(null);
    this.currentTimeSignal.set(0);
    this.durationSignal.set(0);
    this.persist();
  }

  private async handleEnded(): Promise<void> {
    await this.next();
  }

  private async loadQueue(
    trackIds: readonly string[],
    originalOrder: readonly string[],
    index: number,
  ): Promise<void> {
    this.queueSignal.set({ trackIds, index, originalOrder });
    this.currentTimeSignal.set(0);
    await this.loadCurrent(true);
  }

  private async loadCurrent(autoPlay: boolean, seekTo?: number): Promise<void> {
    const id = this.currentTrackId();
    if (!id) return;
    try {
      const blob = await this.library.readBlob(id);
      this.revokeUrl();
      this.currentBlobUrl = URL.createObjectURL(blob);
      this.audio.src = this.currentBlobUrl;
      if (seekTo !== undefined && seekTo > 0) {
        const apply = (): void => {
          this.audio.currentTime = seekTo;
          this.audio.removeEventListener('loadedmetadata', apply);
        };
        this.audio.addEventListener('loadedmetadata', apply);
      }
      if (autoPlay) {
        await this.audioGraph.ensure();
        await this.audio.play();
      }
      void this.library.incrementPlayCount(id);
      this.persist();
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

  private persist(): void {
    try {
      const q = this.queueSignal();
      const state: PersistedState = {
        trackIds: q.trackIds,
        originalOrder: q.originalOrder,
        index: q.index,
        currentTime: this.audio.currentTime || 0,
        shuffle: this.shuffleSignal(),
        repeat: this.repeatSignal(),
        sourceId: this.currentSourceSignal(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // why: localStorage may be full/unavailable; silent — UX continues.
    }
  }

  private async restoreFromStorage(): Promise<void> {
    let raw: string | null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (raw === null) return;
    let parsed: PersistedState;
    try {
      parsed = JSON.parse(raw) as PersistedState;
    } catch {
      return;
    }
    if (!Array.isArray(parsed.trackIds) || parsed.trackIds.length === 0) return;
    const validIds = new Set(this.library.tracks().map((t) => t.id));
    const trackIds = parsed.trackIds.filter((id) => validIds.has(id));
    const originalOrder = (parsed.originalOrder ?? parsed.trackIds).filter((id) =>
      validIds.has(id),
    );
    if (trackIds.length === 0) return;
    const index = Math.min(Math.max(0, parsed.index ?? 0), trackIds.length - 1);
    this.shuffleSignal.set(parsed.shuffle === true);
    const repeat: RepeatMode = parsed.repeat === 'one' ? 'one' : 'off';
    this.repeatSignal.set(repeat);
    this.audio.loop = repeat === 'one';
    this.currentSourceSignal.set(parsed.sourceId ?? null);
    this.queueSignal.set({ trackIds, index, originalOrder });
    await this.loadCurrent(false, parsed.currentTime || 0);
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
