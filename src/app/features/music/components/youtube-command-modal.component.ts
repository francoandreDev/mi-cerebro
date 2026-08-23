import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import { buildYoutubeScript } from '../utils/youtube-command';
import type { ScriptShell, YoutubeMediaFormat } from '../utils/youtube-command';

@Component({
  selector: 'mc-youtube-command-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [IconComponent],
  templateUrl: './youtube-command-modal.component.html',
  styleUrl: './youtube-command-modal.component.css',
})
export class YoutubeCommandModalComponent {
  private readonly i18n = inject(I18nService);

  readonly url = input.required<string>();
  readonly closed = output<void>();

  protected readonly format = signal<YoutubeMediaFormat>('audio');
  protected readonly shell = signal<ScriptShell>('powershell');
  protected readonly destFolder = signal('');
  protected readonly filename = signal('');
  protected readonly copied = signal(false);

  protected readonly script = computed(() =>
    buildYoutubeScript(this.shell(), {
      url: this.url(),
      format: this.format(),
      destFolder: this.destFolder(),
      filename: this.filename(),
    }),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected asInput(target: EventTarget | null): HTMLInputElement {
    return target as HTMLInputElement;
  }

  protected setFormat(format: YoutubeMediaFormat): void {
    this.format.set(format);
  }

  protected setShell(shell: ScriptShell): void {
    this.shell.set(shell);
  }

  protected async onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.script());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // why: clipboard puede fallar por permisos del navegador — el
      //      textarea sigue seleccionable a mano, no hace falta fallback.
    }
  }
}
