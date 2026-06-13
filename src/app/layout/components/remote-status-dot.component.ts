// 13e-iv — tiny color dot indicating remote sync state. Green when the
// last push outcomes are all ok/up-to-date; yellow when there are
// pending changes (last commit newer than last push); red on
// divergence. Hidden when no remote is configured.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { AutocommitService } from '@core/versioning/autocommit.service';
import { RemoteService } from '@core/versioning/remote.service';

type DotState = 'synced' | 'pending' | 'divergent' | 'hidden';

@Component({
  selector: 'mc-remote-status-dot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (state() !== 'hidden') {
      <a class="dot-wrap" routerLink="/sync" [attr.aria-label]="label()" [title]="label()">
        <span class="dot" [attr.data-state]="state()"></span>
      </a>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .dot-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--mc-space-1);
      border-radius: var(--mc-radius-pill);
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--mc-fg-muted);
    }
    .dot[data-state='synced'] {
      background: var(--mc-color-success, #2ea44f);
    }
    .dot[data-state='pending'] {
      background: var(--mc-color-warning, #d4a017);
    }
    .dot[data-state='divergent'] {
      background: var(--mc-color-danger, #c4314b);
    }
  `,
})
export class RemoteStatusDotComponent {
  private readonly remote = inject(RemoteService);
  private readonly autocommit = inject(AutocommitService);
  private readonly i18n = inject(I18nService);

  protected readonly state = computed<DotState>(() => {
    if (!this.remote.isConfigured()) return 'hidden';
    if (this.remote.hasDivergence()) return 'divergent';
    const lastPush = this.remote.lastPushAt();
    const lastCommit = this.autocommit.lastCommitAt();
    if (!lastPush) return lastCommit ? 'pending' : 'synced';
    if (lastCommit && lastCommit.getTime() > new Date(lastPush).getTime()) return 'pending';
    return 'synced';
  });

  protected readonly label = computed<string>(() => {
    const key: TranslationKey = (
      {
        synced: 'remote.status.synced',
        pending: 'remote.status.pending',
        divergent: 'remote.status.divergent',
        hidden: 'remote.status.notConfigured',
      } as const
    )[this.state()];
    return this.i18n.t(key);
  });
}
