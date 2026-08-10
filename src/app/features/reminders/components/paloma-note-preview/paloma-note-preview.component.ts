import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// why: docs/deferred/reminders-goals.md "ronroneo" — dumb bubble shown by
//      the container while a paloma is hovered-and-held. No click-toggle,
//      no service injection: purely reflects `top`/`left`/`text` inputs.
@Component({
  selector: 'mc-paloma-note-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paloma-note-preview.component.html',
  styleUrl: './paloma-note-preview.component.css',
})
export class PalomaNotePreviewComponent {
  readonly text = input.required<string>();
  readonly top = input.required<number>();
  readonly left = input.required<number>();
}
