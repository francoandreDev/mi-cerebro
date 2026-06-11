// Two related UI states tied to variant switching (PROYECTO.md §19 13b-ii):
//   (1) Full-screen loading overlay while THIS tab is performing a
//       switch (SwitchVariantService.switching is set). Blocks input so
//       the user can't trigger another action mid-flow.
//   (2) Non-dismissible top banner when ANOTHER tab broadcast a switch
//       (SwitchVariantService.remoteSwitch is set). The user must
//       reload to bring the in-memory state in line with the new HEAD.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { VariantsService } from '@core/versioning/variants.service';

@Component({
  selector: 'mc-variant-switch-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (switching(); as s) {
      <div class="overlay" role="alert" aria-live="assertive">
        <div class="overlay-card">
          <div class="overlay-spinner" aria-hidden="true">⟳</div>
          <h3 class="overlay-title">
            {{ i18n.t('variants.switching.title', { name: s.to.name }) }}
          </h3>
          <p class="overlay-detail">
            {{ i18n.t('variants.switching.detail', { from: s.from.name, to: s.to.name }) }}
          </p>
        </div>
      </div>
    }
    @if (remoteName(); as name) {
      <div class="banner" role="alert">
        <span class="banner-text">
          {{ i18n.t('variants.stale.banner', { name }) }}
        </span>
        <button type="button" class="banner-action" (click)="switchVariant.reload()">
          {{ i18n.t('variants.stale.reload') }}
        </button>
      </div>
    }
  `,
  styleUrl: './variant-switch-overlay.container.css',
})
export class VariantSwitchOverlayContainer {
  protected readonly i18n = inject(I18nService);
  protected readonly switchVariant = inject(SwitchVariantService);
  private readonly variants = inject(VariantsService);

  protected readonly switching = this.switchVariant.switching;
  protected readonly remoteName = computed(() => {
    const remote = this.switchVariant.remoteSwitch();
    if (!remote) return null;
    const v = this.variants.file().variants.find((x) => x.id === remote.to);
    return v?.name ?? remote.to;
  });
}
