import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

// why: el atributo HTML `autofocus` viola @angular-eslint/template/no-autofocus.
//      Este directive da el mismo comportamiento sin literal en el template.
@Directive({ selector: '[mcAutofocus]', standalone: true })
export class AutofocusDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef);
    afterNextRender(() => el.nativeElement.focus());
  }
}
