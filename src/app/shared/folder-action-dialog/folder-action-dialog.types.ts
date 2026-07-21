export interface FolderActionLabels {
  readonly promptTitle?: string;
  readonly renameLabel?: string;
  readonly moveLabel?: string;
  readonly deleteLabel?: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly renamePromptLabel?: string;
  readonly movePromptLabel?: string;
  readonly deleteConfirmMessage?: string;
  // why: reused by any single-free-text-input flow (create folder, move an
  //      entity to a folder) — not tied to "create" specifically.
  readonly promptLabel?: string;
}

export interface FolderActionHandlers {
  readonly onRename: (newName: string) => void | Promise<void>;
  readonly onMove: (newParentPath: string) => void | Promise<void>;
  readonly onDelete: () => void | Promise<void>;
}

export type FolderActionStep =
  | { readonly kind: 'choose' }
  | { readonly kind: 'rename'; readonly initialValue: string }
  | { readonly kind: 'move'; readonly initialValue: string }
  | { readonly kind: 'delete' }
  | { readonly kind: 'prompt' };

export interface FolderActionState {
  readonly labels: FolderActionLabels;
  readonly step: FolderActionStep;
}
