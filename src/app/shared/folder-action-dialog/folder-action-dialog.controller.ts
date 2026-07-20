import { signal } from '@angular/core';

import type {
  FolderActionHandlers,
  FolderActionLabels,
  FolderActionState,
} from './folder-action-dialog.types';

export class FolderActionDialogController {
  private readonly stateSignal = signal<FolderActionState | null>(null);
  readonly state = this.stateSignal.asReadonly();
  private handlers: FolderActionHandlers | null = null;
  private initialRenameValue = '';
  private initialMoveValue = '';

  open(
    labels: FolderActionLabels,
    initialRenameValue: string,
    initialMoveValue: string,
    handlers: FolderActionHandlers,
  ): void {
    this.handlers = handlers;
    this.initialRenameValue = initialRenameValue;
    this.initialMoveValue = initialMoveValue;
    this.stateSignal.set({ labels, step: { kind: 'choose' } });
  }

  chooseRename(): void {
    this.withLabels((labels) =>
      this.stateSignal.set({
        labels,
        step: { kind: 'rename', initialValue: this.initialRenameValue },
      }),
    );
  }

  chooseMove(): void {
    this.withLabels((labels) =>
      this.stateSignal.set({
        labels,
        step: { kind: 'move', initialValue: this.initialMoveValue },
      }),
    );
  }

  chooseDelete(): void {
    this.withLabels((labels) => this.stateSignal.set({ labels, step: { kind: 'delete' } }));
  }

  submitText(value: string): void {
    const step = this.stateSignal()?.step;
    const handlers = this.handlers;
    if (!step || !handlers) return;
    const trimmed = value.trim();
    if (step.kind === 'rename' && trimmed !== '') {
      this.close();
      void handlers.onRename(trimmed);
    } else if (step.kind === 'move') {
      this.close();
      void handlers.onMove(trimmed);
    }
  }

  confirmDelete(): void {
    const handlers = this.handlers;
    this.close();
    if (handlers) void handlers.onDelete();
  }

  cancel(): void {
    this.close();
  }

  private withLabels(fn: (labels: FolderActionLabels) => void): void {
    const current = this.stateSignal();
    if (current) fn(current.labels);
  }

  private close(): void {
    this.stateSignal.set(null);
    this.handlers = null;
  }
}
