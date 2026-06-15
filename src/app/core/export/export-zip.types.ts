export interface ExportOptions {
  readonly includeAllVariants: boolean;
  readonly includeAssets: boolean;
}

export type ExportPhase = 'idle' | 'walking' | 'compressing' | 'done';

export interface ExportProgress {
  readonly phase: ExportPhase;
  readonly count: number;
  readonly total: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = Object.freeze({
  includeAllVariants: false,
  includeAssets: true,
});
