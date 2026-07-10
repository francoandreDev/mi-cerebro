export const WRITING_STATS_SCHEMA_VERSION = 1;

export interface WritingStats {
  readonly schemaVersion: number;
  readonly dayKey: string;
  readonly actual: number;
  readonly record: number;
  readonly average: number;
  readonly activeDays: number;
}

export const emptyWritingStats = (): WritingStats => ({
  schemaVersion: WRITING_STATS_SCHEMA_VERSION,
  dayKey: '',
  actual: 0,
  record: 0,
  average: 0,
  activeDays: 0,
});
