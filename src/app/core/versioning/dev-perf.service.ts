// Dev-only validation runner for paso 13a. Executes the 10 cases
// against the user's real workspace, isolated under .mi-cerebro/perf/
// so no real data is touched. Each case gets its own subdir + .git.
// Reports timings and a viability verdict (viable / fallback) based
// on caso 7 thresholds.
//
// eslint-disable: dev-only diagnostic. The "workspace not ready" throw
// is an internal precondition signal, not user-facing.
/* eslint-disable no-restricted-syntax */

import { Injectable, inject } from '@angular/core';

import { WorkspaceService } from '@core/fs/workspace.service';

import type { Caso7Detail } from './dev-perf.casos';
import {
  caso1,
  caso2,
  caso3,
  caso4,
  caso5,
  caso6,
  caso7,
  caso8,
  caso9,
  caso10,
} from './dev-perf.casos';
import { GitFsAdapter } from './git-fs.adapter';

const SCRATCH_ROOT = '/.mi-cerebro/perf';
const COMMIT_THRESHOLD_MS = 3000;
const LOG_THRESHOLD_MS = 500;

export type CaseStatus = 'pass' | 'fail';

export interface CaseResult {
  readonly id: string;
  readonly name: string;
  readonly status: CaseStatus;
  readonly durationMs: number;
  readonly detail?: string;
}

export interface PerfReport {
  readonly cases: readonly CaseResult[];
  readonly caso7?: Caso7Detail;
  readonly verdict: 'viable' | 'fallback' | 'partial';
  readonly thresholds: {
    readonly commitAllMs: number;
    readonly logMs: number;
  };
}

@Injectable({ providedIn: 'root' })
export class DevPerfService {
  private readonly workspace = inject(WorkspaceService);

  private adapter(): GitFsAdapter {
    const root = this.workspace.root();
    if (!root) throw new Error('Workspace not ready');
    return new GitFsAdapter(root);
  }

  async runAll(n: number): Promise<PerfReport> {
    const fs = this.adapter();
    await this.cleanup(fs);
    await fs.promises.mkdir('/.mi-cerebro').catch(() => undefined);
    await fs.promises.mkdir(SCRATCH_ROOT);

    const cases: CaseResult[] = [];
    const dirFor = (id: string): string => `${SCRATCH_ROOT}/case-${id}`;

    cases.push(await this.run('1', 'init en repo fresco', () => caso1(fs, dirFor('1'))));
    cases.push(await this.run('2', 'init idempotente', () => caso2(fs, dirFor('2'))));
    cases.push(await this.run('3', 'primer commit', () => caso3(fs, dirFor('3'))));
    cases.push(await this.run('4', 'commit vacío skipped', () => caso4(fs, dirFor('4'))));
    cases.push(await this.run('5', 'add + modify + delete', () => caso5(fs, dirFor('5'))));
    cases.push(await this.run('6', '.gitignore filtra', () => caso6(fs, dirFor('6'))));

    let detail: Caso7Detail | undefined;
    cases.push(
      await this.run('7', `performance N=${n}`, async () => {
        detail = await caso7(fs, dirFor('7'), n);
      }),
    );

    cases.push(await this.run('8', 'readBlob histórico', () => caso8(fs, dirFor('8'))));
    cases.push(
      await this.run('9', 'persistencia (re-instanciar)', () =>
        caso9(fs, this.adapter(), dirFor('9')),
      ),
    );
    cases.push(await this.run('10', 'detecta repo existente', () => caso10(fs, dirFor('10'))));

    await this.cleanup(fs);

    const correctnessOk = cases.filter((c) => c.id !== '7').every((c) => c.status === 'pass');
    const perfOk =
      cases.find((c) => c.id === '7')?.status === 'pass' &&
      detail != null &&
      detail.commitAllMs < COMMIT_THRESHOLD_MS &&
      detail.logMs < LOG_THRESHOLD_MS;
    const verdict: PerfReport['verdict'] =
      correctnessOk && perfOk ? 'viable' : correctnessOk ? 'partial' : 'fallback';

    return {
      cases,
      ...(detail ? { caso7: detail } : {}),
      verdict,
      thresholds: { commitAllMs: COMMIT_THRESHOLD_MS, logMs: LOG_THRESHOLD_MS },
    };
  }

  async cleanup(fs?: GitFsAdapter): Promise<void> {
    const adapter = fs ?? this.adapter();
    await this.rmRecursive(adapter, SCRATCH_ROOT);
  }

  private async run(id: string, name: string, body: () => Promise<void>): Promise<CaseResult> {
    const start = performance.now();
    try {
      await body();
      return { id, name, status: 'pass', durationMs: performance.now() - start };
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      return {
        id,
        name,
        status: 'fail',
        durationMs: performance.now() - start,
        detail: msg,
      };
    }
  }

  private async rmRecursive(fs: GitFsAdapter, path: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.promises.readdir(path);
    } catch {
      return;
    }
    for (const name of entries) {
      const child = `${path}/${name}`;
      try {
        const s = await fs.promises.stat(child);
        if (s.isDirectory()) await this.rmRecursive(fs, child);
        else await fs.promises.unlink(child);
      } catch {
        // best effort
      }
    }
    await fs.promises.rmdir(path).catch(() => undefined);
  }
}
