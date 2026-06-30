import { Injectable, computed, inject, signal } from '@angular/core';

import { computePeaks, DEFAULT_BUCKET_COUNT } from '../utils/waveform-peaks';
import { MusicLibraryService } from './music-library.service';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

interface Entry {
  readonly status: Status;
  readonly peaks: Float32Array | null;
}

const IDLE: Entry = { status: 'idle', peaks: null };

// why: WebAudio decode is heavy (~50–200ms per mp3). Cache peaks per track.id
// in memory so re-plays and seeks don't repay the cost. Failures are honest:
// status 'failed' lets the UI fall back to the plain range slider instead of
// pretending we have data.
@Injectable({ providedIn: 'root' })
export class WaveformCacheService {
  private readonly library = inject(MusicLibraryService);

  private readonly entries = signal<Map<string, Entry>>(new Map());
  private offlineCtx: AudioContext | null = null;

  peaksFor(trackId: string | null): Float32Array | null {
    if (trackId === null) return null;
    return this.entries().get(trackId)?.peaks ?? null;
  }

  statusFor(trackId: string | null): Status {
    if (trackId === null) return 'idle';
    return this.entries().get(trackId)?.status ?? 'idle';
  }

  selectStatus(trackIdSignal: () => string | null) {
    return computed(() => this.statusFor(trackIdSignal()));
  }

  selectPeaks(trackIdSignal: () => string | null) {
    return computed(() => this.peaksFor(trackIdSignal()));
  }

  async ensure(trackId: string): Promise<void> {
    const current = this.entries().get(trackId) ?? IDLE;
    if (current.status === 'loading' || current.status === 'ready') return;
    this.setEntry(trackId, { status: 'loading', peaks: null });
    try {
      const blob = await this.library.readBlob(trackId);
      const arrayBuf = await blob.arrayBuffer();
      const ctx = this.getContext();
      if (ctx === null) {
        this.setEntry(trackId, { status: 'failed', peaks: null });
        return;
      }
      // why: decodeAudioData mutates the buffer in some engines; clone first.
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      const peaks = computePeaks(decoded, DEFAULT_BUCKET_COUNT);
      this.setEntry(trackId, { status: 'ready', peaks });
    } catch (cause) {
      console.warn('[waveform-cache] decode failed', trackId, cause);
      this.setEntry(trackId, { status: 'failed', peaks: null });
    }
  }

  private setEntry(trackId: string, entry: Entry): void {
    const next = new Map(this.entries());
    next.set(trackId, entry);
    this.entries.set(next);
  }

  private getContext(): AudioContext | null {
    if (this.offlineCtx !== null) return this.offlineCtx;
    if (typeof AudioContext === 'undefined') return null;
    try {
      this.offlineCtx = new AudioContext();
      return this.offlineCtx;
    } catch (cause) {
      console.warn('[waveform-cache] AudioContext unavailable', cause);
      return null;
    }
  }
}
