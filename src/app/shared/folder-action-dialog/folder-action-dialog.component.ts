import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import type { FolderActionState } from './folder-action-dialog.types';

@Component({
  selector: 'mc-folder-action-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // why: render fuera del flujo para no afectar el layout del padre.
  host: { style: 'display: contents' },
  template: `
    @if (state(); as s) {
      <button
        type="button"
        class="backdrop"
        [attr.aria-label]="s.labels.cancelLabel"
        (click)="cancelled.emit()"
      ></button>
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (keydown.escape)="cancelled.emit()"
      >
        @switch (s.step.kind) {
          @case ('choose') {
            <h3 [id]="titleId">{{ s.labels.promptTitle }}</h3>
            <div class="actions choose">
              <button #firstBtn type="button" class="ghost" (click)="chooseRename.emit()">
                {{ s.labels.renameLabel }}
              </button>
              <button type="button" class="ghost" (click)="chooseMove.emit()">
                {{ s.labels.moveLabel }}
              </button>
              <button type="button" class="danger" (click)="chooseDelete.emit()">
                {{ s.labels.deleteLabel }}
              </button>
            </div>
            <div class="actions">
              <button type="button" class="ghost" (click)="cancelled.emit()">
                {{ s.labels.cancelLabel }}
              </button>
            </div>
          }
          @case ('rename') {
            <h3 [id]="titleId">{{ s.labels.renamePromptLabel }}</h3>
            <input
              #textInput
              type="text"
              [value]="s.step.initialValue"
              (keydown.enter)="textSubmitted.emit(textInput.value)"
            />
            <div class="actions">
              <button type="button" class="ghost" (click)="cancelled.emit()">
                {{ s.labels.cancelLabel }}
              </button>
              <button type="button" class="primary" (click)="textSubmitted.emit(textInput.value)">
                {{ s.labels.confirmLabel }}
              </button>
            </div>
          }
          @case ('move') {
            <h3 [id]="titleId">{{ s.labels.movePromptLabel }}</h3>
            <input
              #textInput
              type="text"
              [value]="s.step.initialValue"
              (keydown.enter)="textSubmitted.emit(textInput.value)"
            />
            <div class="actions">
              <button type="button" class="ghost" (click)="cancelled.emit()">
                {{ s.labels.cancelLabel }}
              </button>
              <button type="button" class="primary" (click)="textSubmitted.emit(textInput.value)">
                {{ s.labels.confirmLabel }}
              </button>
            </div>
          }
          @case ('delete') {
            <h3 [id]="titleId">{{ s.labels.deleteConfirmMessage }}</h3>
            <div class="actions">
              <button type="button" class="ghost" (click)="cancelled.emit()">
                {{ s.labels.cancelLabel }}
              </button>
              <button #firstBtn type="button" class="danger" (click)="confirmDelete.emit()">
                {{ s.labels.confirmLabel }}
              </button>
            </div>
          }
        }
      </div>
    }
  `,
  styleUrl: './folder-action-dialog.component.css',
})
export class FolderActionDialogComponent {
  readonly state = input<FolderActionState | null>(null);
  readonly chooseRename = output<void>();
  readonly chooseMove = output<void>();
  readonly chooseDelete = output<void>();
  readonly textSubmitted = output<string>();
  readonly confirmDelete = output<void>();
  readonly cancelled = output<void>();

  protected readonly titleId = 'mc-folder-action-title';
  private readonly firstBtn = viewChild<ElementRef<HTMLButtonElement>>('firstBtn');
  private readonly textInput = viewChild<ElementRef<HTMLInputElement>>('textInput');

  constructor() {
    effect(() => {
      if (!this.state()) return;
      queueMicrotask(() => {
        const input = this.textInput()?.nativeElement;
        if (input) {
          input.focus();
          input.select();
        } else {
          this.firstBtn()?.nativeElement.focus();
        }
      });
    });
  }
}
