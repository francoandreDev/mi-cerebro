// Dev-only panel for the 13b-i validation criteria. Mounted next to the
// 13a perf panel in app-shell when isDevMode(). The UI keeps three
// clearly separated sections — live state, CRUD actions, automated
// validation — so the user can either explore the model or run the
// close-out tests without conflating the two.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as git from 'isomorphic-git';

import { WorkspaceService } from '@core/fs/workspace.service';
import { GitFsAdapter } from '@core/versioning/git-fs.adapter';
import { VariantsService } from '@core/versioning/variants.service';
import type { Variant } from '@core/versioning/variants.types';
import { BgColorDirective } from '@shared/directives/bg-color.directive';

import {
  testCreateFlow,
  testDeleteFlow,
  testRollbackOnFailure,
  type TestResult,
} from './dev-variants-tests';

interface RefRow {
  readonly label: 'main' | 'draft' | 'comments';
  readonly ref: string;
  readonly present: boolean;
}
interface VariantGroup {
  readonly variant: Variant;
  readonly refs: readonly RefRow[];
}

type TestKey = 'create' | 'rollback' | 'delete';
type TestStatus = 'idle' | 'running' | 'pass' | 'fail';
interface TestState {
  readonly status: TestStatus;
  readonly message: string;
}

@Component({
  selector: 'mc-dev-variants-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BgColorDirective],
  templateUrl: './dev-variants-panel.container.html',
  styleUrls: ['./dev-versioning-panel.container.css', './dev-variants-panel.container.css'],
})
export class DevVariantsPanelContainer {
  private readonly variants = inject(VariantsService);
  private readonly workspace = inject(WorkspaceService);

  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly lastError = signal<string | null>(null);
  protected readonly branches = signal<readonly string[]>([]);
  protected readonly file = computed(() => this.variants.file());

  protected readonly pendingCount = computed(
    () => this.file().variants.filter((v) => v.pendingDelete).length,
  );

  protected readonly groups = computed<readonly VariantGroup[]>(() => {
    const known = new Set(this.branches());
    return this.file().variants.map((v) => ({
      variant: v,
      refs: [
        { label: 'main' as const, ref: v.refs.main, present: known.has(v.refs.main) },
        { label: 'draft' as const, ref: v.refs.draft, present: known.has(v.refs.draft) },
        { label: 'comments' as const, ref: v.refs.comments, present: known.has(v.refs.comments) },
      ],
    }));
  });

  protected readonly orphanBranches = computed(() => {
    const claimed = new Set<string>();
    for (const v of this.file().variants) {
      claimed.add(v.refs.main);
      claimed.add(v.refs.draft);
      claimed.add(v.refs.comments);
    }
    return this.branches().filter((b) => !claimed.has(b));
  });

  private readonly testsSignal = signal<Record<TestKey, TestState>>({
    create: { status: 'idle', message: '' },
    rollback: { status: 'idle', message: '' },
    delete: { status: 'idle', message: '' },
  });
  protected readonly tests = this.testsSignal.asReadonly();

  protected readonly testList: readonly { key: TestKey; label: string; detail: string }[] = [
    {
      key: 'create',
      label: '① Crear → 3 refs + entrada',
      detail:
        'Crea una variante throwaway, verifica que sus 3 refs entren a .git y la entrada a variants.json, después la borra.',
    },
    {
      key: 'rollback',
      label: '② Rollback si falla la 3ª rama',
      detail:
        'Pre-crea a mano el ref de comments para forzar colisión, lanza create y verifica que tire VER-004, no escriba variants.json y no deje refs huérfanos.',
    },
    {
      key: 'delete',
      label: '③ Borrar limpia las 3 ramas',
      detail:
        'Crea una variante throwaway y la borra; verifica que sus 3 refs y la entrada queden ausentes.',
    },
  ];

  protected newName = '';
  protected newColor = '#7aa2ff';

  protected async create(): Promise<void> {
    if (!this.newName.trim()) return;
    await this.runAction(async () => {
      await this.variants.create({ name: this.newName.trim(), color: this.newColor });
      this.newName = '';
    });
  }

  protected async del(id: string): Promise<void> {
    await this.runAction(() => this.variants.delete(id));
  }

  protected async setActive(id: string): Promise<void> {
    await this.runAction(() => this.variants.setActiveId(id));
  }

  protected async refresh(): Promise<void> {
    await this.runAction(() => this.variants.refresh());
  }

  protected runTest(key: TestKey): Promise<void> {
    const fn =
      key === 'create'
        ? testCreateFlow
        : key === 'rollback'
          ? testRollbackOnFailure
          : testDeleteFlow;
    return this.runTestWith(key, fn);
  }

  protected async runAllTests(): Promise<void> {
    await this.runTest('create');
    await this.runTest('rollback');
    await this.runTest('delete');
  }

  // Wrap every CRUD mutation: clear errors, mark busy, refresh the
  // branch list afterwards so the live counts always reflect git's truth.
  private async runAction(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.lastError.set(null);
    try {
      await action();
    } catch (e) {
      this.lastError.set(format(e));
    } finally {
      await this.refreshBranches();
      this.busy.set(false);
    }
  }

  private async runTestWith(
    key: TestKey,
    fn: (s: VariantsService, fs: GitFsAdapter) => Promise<TestResult>,
  ): Promise<void> {
    const fs = this.adapter();
    if (!fs) return;
    this.setTest(key, { status: 'running', message: '' });
    try {
      const result = await fn(this.variants, fs);
      this.setTest(key, {
        status: result.pass ? 'pass' : 'fail',
        message: result.message,
      });
    } catch (e) {
      this.setTest(key, { status: 'fail', message: format(e) });
    } finally {
      await this.refreshBranches();
    }
  }

  private setTest(key: TestKey, state: TestState): void {
    this.testsSignal.update((current) => ({ ...current, [key]: state }));
  }

  private adapter(): GitFsAdapter | null {
    const root = this.workspace.root();
    if (!root) {
      this.lastError.set('workspace not ready');
      return null;
    }
    return new GitFsAdapter(root);
  }

  private async refreshBranches(): Promise<void> {
    const fs = this.adapter();
    if (!fs) return;
    try {
      const names = await git.listBranches({ fs, dir: '/' });
      this.branches.set([...names].sort());
    } catch {
      // best-effort; counts will lag until next action succeeds
    }
  }

  protected async openPanel(): Promise<void> {
    this.open.set(true);
    await this.refreshBranches();
  }
}

function format(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}
