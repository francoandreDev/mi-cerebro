// Detalle bonito opcional (docs/deferred/sync.md) — silbido suave al
// despachar una cápsula en /sync, respetando el mute global
// (settings.sync.muted). Lazy AudioContext: sólo se crea la primera vez
// que se necesita, nunca en boot.

import { Injectable, inject } from '@angular/core';

import { SettingsService } from '@core/settings/settings.service';

@Injectable({ providedIn: 'root' })
export class SyncWhistleService {
  private readonly settings = inject(SettingsService);
  private context: AudioContext | null = null;

  play(): void {
    if (this.settings.state().sync.muted) return;
    if (typeof AudioContext === 'undefined') return;
    try {
      const ctx = (this.context ??= new AudioContext());
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.15);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // best-effort: el silbido es cosmético, nunca debe romper un push.
    }
  }
}
