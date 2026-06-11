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

export interface CommitEntry {
  readonly oid: string;
  readonly shortOid: string;
  readonly message: string;
  readonly date: Date;
  readonly kinds: readonly string[];
}

export interface CommitBucket {
  readonly id: BucketId;
  readonly entries: readonly CommitEntry[];
}

export interface MilestoneEntry {
  readonly name: string;
  readonly oid: string;
  readonly message: string;
}
