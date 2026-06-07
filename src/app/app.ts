import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AppShellContainer } from '@layout/containers/app-shell.container';

@Component({
  selector: 'mc-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppShellContainer],
  template: `<mc-app-shell />`,
})
export class App {}
