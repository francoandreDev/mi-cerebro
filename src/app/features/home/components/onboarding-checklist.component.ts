import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { OnboardingStep } from '@core/onboarding/onboarding.types';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-onboarding-checklist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <section class="onboarding" aria-labelledby="onboarding-title">
      <header class="head">
        <div class="head-text">
          <h2 class="title" id="onboarding-title">{{ t('home.onboarding.title') }}</h2>
          <p class="subtitle">
            {{ t('home.onboarding.progress', { done: completedCount(), total: total() }) }}
          </p>
        </div>
        <button
          type="button"
          class="dismiss"
          [attr.aria-label]="t('home.onboarding.dismiss')"
          (click)="dismiss.emit()"
        >
          <mc-icon name="eye-slash" aria-hidden="true" />
          <span>{{ t('home.onboarding.dismiss') }}</span>
        </button>
      </header>
      <ol class="list">
        @for (item of items(); track item.id) {
          <li>
            <button
              type="button"
              class="step"
              [class.done]="item.done"
              (click)="itemClick.emit(item)"
            >
              <mc-icon
                [name]="item.done ? 'check-square' : 'circle-dashed'"
                aria-hidden="true"
                class="step-icon"
              />
              <span class="step-text">
                <span class="step-title">{{ t(item.titleKey) }}</span>
                <span class="step-desc">{{ t(item.descriptionKey) }}</span>
              </span>
            </button>
          </li>
        }
      </ol>
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--mc-space-7);
    }
    .onboarding {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-4);
      padding: var(--mc-space-4) var(--mc-space-5);
      border-radius: var(--mc-radius-lg);
      border: 1px solid var(--mc-border-default);
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--mc-accent-primary) 6%, var(--mc-bg-elevated)),
        var(--mc-bg-elevated) 65%
      );
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--mc-space-3);
      flex-wrap: wrap;
    }
    .head-text {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
      min-width: 0;
    }
    .title {
      margin: 0;
      font-size: var(--mc-font-size-lg);
      color: var(--mc-fg-default);
      letter-spacing: 0.02em;
    }
    .subtitle {
      margin: 0;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
    }
    .dismiss {
      display: inline-flex;
      align-items: center;
      gap: var(--mc-space-2);
      padding: 0.35rem 0.8rem;
      border-radius: var(--mc-radius-pill);
      border: 1px solid var(--mc-border-default);
      background: transparent;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
      cursor: pointer;
      flex: 0 0 auto;
    }
    .dismiss:hover {
      background: var(--mc-bg-hover);
      color: var(--mc-fg-default);
    }
    .dismiss:focus-visible {
      outline: 2px solid var(--mc-accent-primary);
      outline-offset: 2px;
    }
    .list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--mc-space-3);
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: var(--mc-space-2);
      width: 100%;
      padding: var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      border: 1px solid var(--mc-border-default);
      background: var(--mc-bg-default);
      color: var(--mc-fg-default);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition:
        border-color 140ms ease,
        opacity 140ms ease;
    }
    .step:hover {
      border-color: var(--mc-accent-primary);
    }
    .step:focus-visible {
      outline: 2px solid var(--mc-accent-primary);
      outline-offset: 2px;
    }
    .step.done {
      opacity: 0.7;
      border-style: dashed;
    }
    .step-icon {
      flex: 0 0 auto;
      margin-top: 0.15em;
      color: var(--mc-accent-primary);
    }
    .step.done .step-icon {
      color: var(--mc-fg-muted);
    }
    .step-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .step-title {
      font-size: var(--mc-font-size-sm);
      font-weight: 600;
    }
    .step.done .step-title {
      text-decoration: line-through;
      text-decoration-color: var(--mc-fg-muted);
    }
    .step-desc {
      font-size: var(--mc-font-size-xs, 0.72rem);
      color: var(--mc-fg-muted);
      line-height: 1.4;
    }
    @media (max-width: 480px) {
      .onboarding {
        padding: var(--mc-space-4);
      }
      .list {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class OnboardingChecklistComponent {
  readonly items = input.required<readonly OnboardingStep[]>();
  readonly completedCount = input.required<number>();
  readonly total = input.required<number>();

  readonly itemClick = output<OnboardingStep>();
  readonly dismiss = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
