import { Injectable } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type {
  BackupFn,
  MigrationRegistration,
  MigrationStep,
  VersionedEntity,
} from './migration.types';

@Injectable({ providedIn: 'root' })
export class MigrationsService {
  private readonly registry = new Map<string, MigrationRegistration>();
  private backupFn: BackupFn | null = null;

  register(reg: MigrationRegistration): void {
    if (!this.isContiguous(reg.steps, reg.latest)) {
      throw new AppError(ERROR_CODES.MIG_001, {
        severity: 'fatal',
        context: { kind: reg.kind, reason: 'non-contiguous registration' },
      });
    }
    this.registry.set(reg.kind, reg);
  }

  // why: real backup goes through FsService; service stays I/O-free so it
  //      is unit-testable and the FS impl lives where it belongs.
  setBackupFn(fn: BackupFn | null): void {
    this.backupFn = fn;
  }

  latest(kind: string): number {
    return this.registry.get(kind)?.latest ?? 0;
  }

  async migrate<T extends VersionedEntity>(kind: string, data: T): Promise<T> {
    const reg = this.registry.get(kind);
    if (!reg) return data;

    const from = data.schemaVersion ?? 0;
    if (from === reg.latest) return data;
    if (from > reg.latest) {
      throw new AppError(ERROR_CODES.MIG_002, {
        severity: 'fatal',
        context: { kind, from, latest: reg.latest },
      });
    }

    if (this.backupFn) {
      try {
        await this.backupFn({ kind, from, to: reg.latest });
      } catch (cause) {
        throw new AppError(ERROR_CODES.MIG_001, {
          severity: 'fatal',
          cause,
          context: { kind, from, to: reg.latest, phase: 'backup' },
        });
      }
    }

    let current: VersionedEntity = data;
    for (const step of reg.steps) {
      if (step.from < from) continue;
      try {
        current = step.run(current);
      } catch (cause) {
        throw new AppError(ERROR_CODES.MIG_001, {
          severity: 'fatal',
          cause,
          context: { kind, from: step.from, to: step.to },
        });
      }
    }
    return current as T;
  }

  private isContiguous(steps: readonly MigrationStep[], latest: number): boolean {
    // why: empty steps with latest >= 0 means "all current data is at latest;
    //      no migrations were ever needed". A bump that introduces v2 from
    //      an entity that always lived at v1 registers only the 1->2 step —
    //      so the chain may start above 0. Each step must increment by 1
    //      and pick up where the previous left off, ending at `latest`.
    if (steps.length === 0) return latest >= 0;
    const sorted = [...steps].sort((a, b) => a.from - b.from);
    for (let i = 0; i < sorted.length; i++) {
      const step = sorted[i]!;
      if (step.to !== step.from + 1) return false;
      if (i > 0 && step.from !== sorted[i - 1]!.to) return false;
    }
    return sorted[sorted.length - 1]!.to === latest;
  }
}
