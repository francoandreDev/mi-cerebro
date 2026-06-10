// Footer indicator for the workspace sidebar. Reads AutocommitService
// state + lastCommitAt and renders either "Commiting…" or "Último
// commit · hace N min" / "Sin commits aún". A 30s tick refreshes the
// relative-time string so it doesn't fall behind without rerenders.

import type { OnDestroy, OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { AutocommitService } from '@core/versioning/autocommit.service';

const TICK_MS = 30 * 1000;

@Component({
  selector: 'mc-autocommit-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="status"
      [class.status-busy]="state() === 'committing'"
      [attr.aria-label]="i18n.t('versioning.history.openButton')"
      [title]="i18n.t('versioning.history.openButton')"
      (click)="openHistory()"
    >
      <span aria-hidden="true" class="dot"></span>
      <span class="label">{{ label() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: block;
      padding: 8px 12px;
      border-top: 1px solid var(--mc-border-subtle, rgba(0, 0, 0, 0.08));
      font-size: 11px;
      color: var(--mc-fg-secondary, #666);
    }
    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      background: transparent;
      border: none;
      padding: 4px 0;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    .status:hover {
      color: var(--mc-fg-primary, #111);
    }
    .status:focus-visible {
      outline: 2px solid var(--mc-accent, #3a7bd5);
      outline-offset: 2px;
      border-radius: 4px;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--mc-fg-secondary, #888);
      flex-shrink: 0;
    }
    .status-busy .dot {
      background: #3a7bd5;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.4;
      }
    }
  `,
})
export class AutocommitStatusComponent implements OnInit, OnDestroy {
  private readonly autocommit = inject(AutocommitService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly state = this.autocommit.state;
  private readonly tick = signal(Date.now());
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  protected openHistory(): void {
    void this.router.navigate(['/history']);
  }

  protected readonly label = computed(() => {
    if (this.state() === 'committing') return this.i18n.t('versioning.status.committing');
    const last = this.autocommit.lastCommitAt();
    if (!last) return this.i18n.t('versioning.status.none');
    this.tick();
    const minutes = Math.max(0, Math.floor((Date.now() - last.getTime()) / 60_000));
    return this.i18n.t('versioning.status.lastCommit').replace('{n}', String(minutes));
  });

  ngOnInit(): void {
    this.tickHandle = setInterval(() => this.tick.set(Date.now()), TICK_MS);
  }

  ngOnDestroy(): void {
    if (this.tickHandle !== null) clearInterval(this.tickHandle);
  }
}
