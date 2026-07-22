import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

import { I18nService } from '@core/i18n/i18n.service';
import { routePageId } from '@core/shortcuts/route-page-id';
import { KeyboardHelpService } from '@core/shortcuts/keyboard-help.service';
import { TutorialService } from '@core/tutorials/tutorial.service';
import { IconComponent } from '@shared/icon/icon.component';

// why: single fixed entry point for "guía de la página" + "atajos de la
//      página", mounted once in the shell — replaces the old situation
//      where '?' was the only way in, with zero visible affordance
//      anywhere (auditoría 03).
@Component({
  selector: 'mc-page-help-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="wrap">
      @if (canGuide()) {
        <button
          type="button"
          class="btn"
          [title]="i18n.t('tutorial.control.open')"
          [attr.aria-label]="i18n.t('tutorial.control.open')"
          (click)="openGuide()"
        >
          <mc-icon name="sparkle" />
        </button>
      }
      <button
        type="button"
        class="btn"
        [title]="i18n.t('tutorial.control.shortcuts')"
        [attr.aria-label]="i18n.t('tutorial.control.shortcuts')"
        (click)="openShortcuts()"
      >
        <mc-icon name="keyboard" />
      </button>
    </div>
  `,
  styles: `
    .wrap {
      position: fixed;
      right: var(--mc-space-4, 16px);
      bottom: calc(var(--mc-mini-player-h, 0px) + var(--mc-space-4, 16px));
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2, 8px);
      z-index: 60;
    }
    .btn {
      width: 2.25rem;
      height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--mc-radius-pill, 9999px);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default, var(--mc-border));
      color: var(--mc-fg-muted);
      cursor: pointer;
      box-shadow: var(--mc-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.2));
    }
    .btn:hover {
      color: var(--mc-fg-primary);
      border-color: var(--mc-border-strong);
    }
  `,
})
export class PageHelpControlComponent {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly tutorials = inject(TutorialService);
  private readonly keyboardHelp = inject(KeyboardHelpService);

  private readonly currentPageId = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => routePageId(e.urlAfterRedirects)),
      startWith(routePageId(this.router.url)),
    ),
    { initialValue: routePageId(this.router.url) },
  );

  protected readonly canGuide = computed(() => {
    const id = this.currentPageId();
    return id !== null && this.tutorials.hasTutorialFor(id);
  });

  protected openGuide(): void {
    const id = this.currentPageId();
    if (id) this.tutorials.start(id);
  }

  protected openShortcuts(): void {
    this.keyboardHelp.openDialog();
  }
}
