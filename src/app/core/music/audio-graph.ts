import { signal, type Signal } from '@angular/core';

// why: WebAudio bus for the global player. Lazy because AudioContext only
// starts on a user gesture; restoring queue at boot must not touch it.
// Once createMediaElementSource() runs, the audio element's output is
// routed exclusively through this graph — analyser MUST connect to
// destination or playback goes silent.
export class AudioGraph {
  private context: AudioContext | null = null;
  private failed = false;

  private readonly analyserSignal = signal<AnalyserNode | null>(null);
  readonly analyser: Signal<AnalyserNode | null> = this.analyserSignal.asReadonly();

  constructor(
    private readonly audio: HTMLAudioElement,
    // why: reported once via ErrorService (MCB-MUS-001) so the failure
    // is catalogued instead of only living in the console.
    private readonly onFailed?: (cause: unknown) => void,
  ) {}

  async ensure(): Promise<void> {
    if (this.failed) return;
    try {
      if (this.context === null) {
        if (typeof AudioContext === 'undefined') {
          this.failed = true;
          // why: the analyser stays null; resonant-surface (Fase 8) will
          // render its "no audio data" state honestly. No UI lie.
          console.warn('[audio-graph] AudioContext not available in this browser');
          this.onFailed?.(new Error('AudioContext not available in this browser'));
          return;
        }
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(this.audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        this.context = ctx;
        this.analyserSignal.set(analyser);
      }
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
    } catch (cause) {
      this.failed = true;
      console.warn('[audio-graph] failed to initialize WebAudio graph', cause);
      this.onFailed?.(cause);
    }
  }
}
