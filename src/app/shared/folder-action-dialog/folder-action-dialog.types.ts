export interface FolderActionLabels {
  readonly promptTitle: string;
  readonly renameLabel: string;
  readonly moveLabel: string;
  readonly deleteLabel: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly renamePromptLabel: string;
  readonly movePromptLabel: string;
  readonly deleteConfirmMessage: string;
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
  | { readonly kind: 'delete' };

export interface FolderActionState {
  readonly labels: FolderActionLabels;
  readonly step: FolderActionStep;
}
