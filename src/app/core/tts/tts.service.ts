import { Injectable, computed, signal } from '@angular/core';

import type { TtsPrefs, TtsSegment, TtsVoiceOption } from './tts.types';

const PREFS_STORAGE_KEY = 'mc.tts.prefs.v1';
const DEFAULT_PREFS: TtsPrefs = { rate: 1, voiceURI: null };

// why: singleton wrapper over window.speechSynthesis (Web Speech API) — see
//      2026-07-13 decision to use the native API over Talkify/ResponsiveVoice
//      (no external service, no usage caps, no attribution). Speaks a
//      chapter as a queue of per-paragraph segments (not one long utterance)
//      so the caller can highlight/scroll to whichever paragraph is
//      currently playing via the onSegmentStart callback.
@Injectable({ providedIn: 'root' })
export class TtsService {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  private readonly speakingSignal = signal(false);
  readonly speaking = this.speakingSignal.asReadonly();
  private readonly pausedSignal = signal(false);
  readonly paused = this.pausedSignal.asReadonly();
  private readonly nativeVoicesSignal = signal<readonly SpeechSynthesisVoice[]>([]);
  readonly voices = computed<readonly TtsVoiceOption[]>(() =>
    [...this.nativeVoicesSignal()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => ({ uri: v.voiceURI, label: `${v.name} (${v.lang})` })),
  );
  private readonly prefsSignal = signal<TtsPrefs>(this.loadPrefs());
  readonly prefs = this.prefsSignal.asReadonly();

  private segments: readonly TtsSegment[] = [];
  private segmentIndex = -1;
  private onSegmentStart: ((id: string | null) => void) | null = null;
  // why: speechSynthesis.cancel() fires the pending utterance's `onerror`
  //      (error: 'interrupted' / 'canceled') asynchronously — this flag
  //      tells that stale handler not to advance the queue on our own
  //      intentional cancel, only on a genuine synthesis failure.
  private cancelling = false;

  constructor() {
    if (!this.supported) return;
    this.refreshVoices();
    speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoices());
  }

  speakSegments(
    segments: readonly TtsSegment[],
    onSegmentStart: (id: string | null) => void,
  ): void {
    this.cancelActive();
    if (!this.supported || segments.length === 0) return;
    this.segments = segments;
    this.segmentIndex = -1;
    this.onSegmentStart = onSegmentStart;
    this.cancelling = false;
    this.speakingSignal.set(true);
    this.pausedSignal.set(false);
    this.advance();
  }

  pause(): void {
    if (!this.supported || !this.speakingSignal() || this.pausedSignal()) return;
    speechSynthesis.pause();
    this.pausedSignal.set(true);
  }

  resume(): void {
    if (!this.supported || !this.pausedSignal()) return;
    speechSynthesis.resume();
    this.pausedSignal.set(false);
  }

  stop(): void {
    this.cancelActive();
    this.onSegmentStart?.(null);
    this.onSegmentStart = null;
  }

  setPrefs(prefs: TtsPrefs): void {
    this.prefsSignal.set(prefs);
    this.persistPrefs(prefs);
    if (!this.speakingSignal() || this.segmentIndex < 0) return;
    // why: apply the new rate/voice immediately by restarting the segment
    //      currently playing, rather than waiting for the next paragraph.
    this.segmentIndex--;
    this.cancelling = true;
    speechSynthesis.cancel();
    this.cancelling = false;
    this.advance();
  }

  private advance(): void {
    this.segmentIndex++;
    const seg = this.segments[this.segmentIndex];
    if (!seg) {
      this.stop();
      return;
    }
    const utt = new SpeechSynthesisUtterance(seg.text);
    utt.rate = this.prefsSignal().rate;
    const voiceURI = this.prefsSignal().voiceURI;
    const voice = voiceURI
      ? this.nativeVoicesSignal().find((v) => v.voiceURI === voiceURI)
      : undefined;
    if (voice) utt.voice = voice;
    utt.onstart = () => this.onSegmentStart?.(seg.id);
    // why: calling speechSynthesis.speak() synchronously from inside the
    //      previous utterance's onend/onerror can silently stall the queue
    //      in Chrome (speaking stays true, the next utterance never fires
    //      onstart) — a documented engine quirk, worked around by breaking
    //      out of that call stack with a macrotask before queueing next.
    utt.onend = () => {
      if (!this.cancelling) setTimeout(() => this.advance(), 0);
    };
    utt.onerror = () => {
      if (!this.cancelling) setTimeout(() => this.advance(), 0);
    };
    speechSynthesis.speak(utt);
  }

  private cancelActive(): void {
    this.cancelling = true;
    if (this.supported) speechSynthesis.cancel();
    this.segments = [];
    this.segmentIndex = -1;
    this.speakingSignal.set(false);
    this.pausedSignal.set(false);
  }

  private refreshVoices(): void {
    this.nativeVoicesSignal.set(speechSynthesis.getVoices());
  }

  private loadPrefs(): TtsPrefs {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (!raw) return DEFAULT_PREFS;
      const parsed = JSON.parse(raw) as Partial<TtsPrefs>;
      return {
        rate: typeof parsed.rate === 'number' ? parsed.rate : DEFAULT_PREFS.rate,
        voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : null,
      };
    } catch {
      return DEFAULT_PREFS;
    }
  }

  private persistPrefs(prefs: TtsPrefs): void {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // why: localStorage may be full/unavailable; silent — UX continues.
    }
  }
}
