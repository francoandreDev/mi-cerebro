// Domain types for the history feature. Kept in their own file so
// service + container can share without a circular import.

export type BucketId =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'two-weeks'
  | 'one-month'
  | 'older';

// why: when a commit message carries the `Merge-Group: <uuid>` trailer
//      produced by MergeService, the timeline collapses consecutive
//      commits of the same group into one visual row. The group id is
//      what links them; the from/into names are pulled from the subject
//      so the leader row can show a human label without re-reading refs.
export interface MergeGroupInfo {
  readonly id: string;
  readonly fromName: string | null;
  readonly intoName: string | null;
}

export interface CommitEntry {
  readonly oid: string;
  readonly shortOid: string;
  readonly message: string;
  readonly date: Date;
  readonly kinds: readonly string[];
  readonly mergeGroup: MergeGroupInfo | null;
}

export type TimelineItem =
  | { readonly kind: 'commit'; readonly entry: CommitEntry }
  | {
      readonly kind: 'merge-group';
      readonly id: string;
      readonly fromName: string | null;
      readonly intoName: string | null;
      readonly latest: CommitEntry;
      readonly members: readonly CommitEntry[];
    };

export interface CommitBucket {
  readonly id: BucketId;
  readonly items: readonly TimelineItem[];
}

export interface MilestoneEntry {
  readonly name: string;
  readonly oid: string;
  readonly message: string;
}
