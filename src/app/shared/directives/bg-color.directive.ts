import { Directive, input } from '@angular/core';

// why: arbitrary user-defined colors (tag palette) can't be encoded as CSS
//      classes. Applying them via a host-bound directive keeps templates free
//      of inline [style.*] bindings (lint rule
//      @angular-eslint/template/no-inline-styles).
@Directive({
  selector: '[mcBgColor]',
  standalone: true,
  host: {
    '[style.background]': 'mcBgColor()',
  },
})
export class BgColorDirective {
  readonly mcBgColor = input.required<string>();
}
