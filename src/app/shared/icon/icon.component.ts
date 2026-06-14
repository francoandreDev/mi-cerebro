import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

import { ICON_DATA, type IconName } from './icons.data';

@Component({
  selector: 'mc-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="svg-wrap"
    [innerHTML]="svg()"
    [attr.role]="label() ? 'img' : null"
    [attr.aria-label]="label()"
    [attr.aria-hidden]="label() ? null : 'true'"
  ></span>`,
  styles: [
    `
      :host {
        display: inline-block;
        width: 1em;
        height: 1em;
        line-height: 0;
        vertical-align: -0.15em;
        color: currentColor;
        flex-shrink: 0;
      }
      .svg-wrap {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly label = input<string | null>(null);

  protected readonly svg = computed<SafeHtml>(() => {
    const inner = ICON_DATA[this.name()];
    const html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="100%" height="100%">${inner}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });
}
