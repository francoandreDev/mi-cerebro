// 13b-iv types. Pure data shapes shared by MergeService, the /variants/merge
// page and the history grouping. No runtime — types-only.

// why: a row only appears when oids differ. The 3 cases that matter
//      for the UI are "X has it but Y doesn't", "Y has it but X doesn't"
//      and "both have it, differ". From X's perspective, "only-in-from"
//      means "added in X relative to Y"; "only-in-into" means "deleted
//      in X (relative to Y)" — same git fact, different framings. The
//      UI uses the from-centric labels.
export type MergeStatus = 'modified' | 'only-in-from' | 'only-in-into';

export type MergeChoice = 'from' | 'into' | 'skip';

export interface MergeDiffEntry {
  readonly filepath: string;
  readonly status: MergeStatus;
  // why: short head-of-file slice, only for the file types we know are
  //      text. Used by the table preview column. Null when the blob is
  //      binary or absent.
  readonly previewFrom: string | null;
  readonly previewInto: string | null;
}

export interface MergeSelection {
  readonly filepath: string;
  readonly choice: MergeChoice;
}

export interface MergePlan {
  readonly fromVariantId: string;
  readonly intoVariantId: string;
  readonly entries: readonly MergeDiffEntry[];
}

export interface MergeProgress {
  readonly applied: number;
  readonly total: number;
  readonly currentPath: string | null;
}

export interface MergeOutcome {
  readonly groupId: string;
  readonly applied: readonly string[];
  readonly failedAt: { readonly path: string; readonly reason: string } | null;
  readonly remaining: readonly string[];
}
