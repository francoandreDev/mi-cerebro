// Dev-only floating panel that runs DevPerfService.runAll(N) and
// renders the resulting case table + verdict banner. Mounted only
// when isDevMode() is true in app-shell. Has no place in prod.

import type { OnDestroy } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { PerfReport } from '@core/versioning/dev-perf.service';
import { DevPerfService } from '@core/versioning/dev-perf.service';

type State = 'idle' | 'running' | 'done';

@Component({
  selector: 'mc-dev-versioning-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (open()) {
      <section class="panel" role="dialog" aria-label="Validador de versionado">
        <header class="head">
          <strong>Validador versionado (13a)</strong>
          <button type="button" class="close" (click)="open.set(false)">✕</button>
        </header>
        <div class="controls">
          <label>
            N
            <input type="number" min="1" max="2000" [(ngModel)]="nValue" />
          </label>
          <button type="button" (click)="run()" [disabled]="state() === 'running'">
            {{ state() === 'running' ? 'Corriendo…' : 'Run all' }}
          </button>
          <button type="button" (click)="cleanup()" [disabled]="state() === 'running'">
            Limpiar scratch
          </button>
        </div>
        @if (state() === 'running') {
          <div class="progress">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="progressPct()"></div>
            </div>
            <div class="progress-text">
              {{ progress().completed }} / {{ progress().total }} ·
              {{
                progress().currentName
                  ? 'caso ' +
                    (progress().currentId ?? '?') +
                    ' — ' +
                    progress().currentName +
                    ' · ' +
                    ms(elapsedMs())
                  : '…'
              }}
            </div>
          </div>
        }
        @if (report(); as r) {
          <div class="verdict verdict-{{ r.verdict }}">
            Veredicto:
            <strong>{{ r.verdict.toUpperCase() }}</strong>
          </div>
          @if (r.caso7; as c7) {
            <div class="caso7">
              <div>N = {{ c7.n }}</div>
              <div>ensureRepo: {{ ms(c7.ensureRepoMs) }}</div>
              <div>
                commitAll:
                <span [class.bad]="c7.commitAllMs >= r.thresholds.commitAllMs">
                  {{ ms(c7.commitAllMs) }}
                </span>
                / {{ ms(r.thresholds.commitAllMs) }}
              </div>
              <div>
                log(50):
                <span [class.bad]="c7.logMs >= r.thresholds.logMs">
                  {{ ms(c7.logMs) }}
                </span>
                / {{ ms(r.thresholds.logMs) }}
              </div>
              <div>readBlob: {{ ms(c7.readBlobMs) }}</div>
            </div>
          }
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>caso</th>
                <th>tiempo</th>
                <th>estado</th>
              </tr>
            </thead>
            <tbody>
              @for (c of r.cases; track c.id) {
                <tr [class.fail]="c.status === 'fail'">
                  <td>{{ c.id }}</td>
                  <td>{{ c.name }}</td>
                  <td>{{ ms(c.durationMs) }}</td>
                  <td>{{ c.status === 'pass' ? '✓' : '✗' }}</td>
                </tr>
                @if (c.detail) {
                  <tr class="detail">
                    <td colspan="4">{{ c.detail }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        }
        @if (error(); as err) {
          <p class="error">{{ err }}</p>
        }
      </section>
    } @else {
      <button
        type="button"
        class="toggle"
        title="Validador de versionado (dev)"
        (click)="open.set(true)"
      >
        🧪
      </button>
    }
  `,
  styleUrl: './dev-versioning-panel.container.css',
})
export class DevVersioningPanelContainer implements OnDestroy {
  private readonly perf = inject(DevPerfService);
  protected readonly open = signal(false);
  protected readonly state = signal<State>('idle');
  protected readonly report = signal<PerfReport | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly progress = this.perf.progress;
  protected readonly elapsedMs = signal(0);
  protected readonly progressPct = computed(() => {
    const p = this.progress();
    return p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
  });
  protected nValue = 100;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    this.stopTicker();
  }

  protected async run(): Promise<void> {
    this.state.set('running');
    this.error.set(null);
    this.report.set(null);
    this.startTicker();
    try {
      const r = await this.perf.runAll(Math.max(1, Math.min(2000, this.nValue | 0)));
      this.report.set(r);
      this.state.set('done');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      this.state.set('idle');
    } finally {
      this.stopTicker();
    }
  }

  private startTicker(): void {
    this.stopTicker();
    this.tickHandle = setInterval(() => {
      const p = this.progress();
      this.elapsedMs.set(p.currentStartMs > 0 ? performance.now() - p.currentStartMs : 0);
    }, 100);
  }

  private stopTicker(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  protected async cleanup(): Promise<void> {
    this.error.set(null);
    try {
      await this.perf.cleanup();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  protected ms(value: number): string {
    return value < 10 ? value.toFixed(1) + ' ms' : Math.round(value) + ' ms';
  }
}
