import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type LockBannerKind = 'foreign' | 'evicted';

// why: dumb component, kept entity-agnostic so notes/tasks/lists can all
//      reuse it. Callers pass already-translated strings — the component
//      doesn't talk to I18nService.
@Component({
  selector: 'mc-lock-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banner" role="alert">
      <div class="banner-body">
        <strong>{{ title() }}</strong>
        <span>{{ message() }}</span>
      </div>
      <div class="banner-actions">
        @if (kind() === 'foreign') {
          <button type="button" (click)="readonly.emit()">{{ readonlyLabel() }}</button>
          <button type="button" class="primary" (click)="takeover.emit()">
            {{ takeoverLabel() }}
          </button>
        } @else {
          <button type="button" class="primary" (click)="dismiss.emit()">
            {{ dismissLabel() }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mc-space-3);
      padding: var(--mc-space-3) var(--mc-space-4);
      background: var(--mc-bg-elevated);
      border-bottom: 1px solid var(--mc-border-default);
      border-left: 3px solid var(--mc-accent-primary);
    }
    .banner-body {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .banner-actions {
      display: flex;
      gap: var(--mc-space-2);
    }
    .banner-actions button {
      background: transparent;
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      cursor: pointer;
    }
    .banner-actions button.primary {
      background: var(--mc-accent-primary);
      color: var(--mc-bg-base);
      border-color: var(--mc-accent-primary);
    }
  `,
})
export class LockBannerComponent {
  readonly kind = input.required<LockBannerKind>();
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly readonlyLabel = input<string>('');
  readonly takeoverLabel = input<string>('');
  readonly dismissLabel = input<string>('');
  readonly readonly = output<void>();
  readonly takeover = output<void>();
  readonly dismiss = output<void>();
}
