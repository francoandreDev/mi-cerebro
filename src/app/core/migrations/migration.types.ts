// A migration takes an entity at version N and returns it at version N+1.
// Migrations must be pure functions (rule 4.15): no I/O, no shared state.

export interface VersionedEntity {
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export type MigrationFn<
  From extends VersionedEntity = VersionedEntity,
  To extends VersionedEntity = VersionedEntity,
> = (data: From) => To;

export interface MigrationStep {
  readonly from: number;
  readonly to: number;
  readonly run: MigrationFn;
}

export interface MigrationRegistration {
  readonly kind: string;
  readonly latest: number;
  readonly steps: readonly MigrationStep[];
}

export type BackupFn = (reason: { kind: string; from: number; to: number }) => Promise<void>;
