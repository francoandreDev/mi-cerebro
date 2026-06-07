export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';

export interface ErrorAction {
  readonly labelKey: string;
  readonly run: () => void | Promise<void>;
}

export type ErrorContext = Readonly<Record<string, unknown>>;
