// Dev-only panel for the 13b-i validation criteria. Mounted next to the
// 13a perf panel in app-shell when isDevMode(). The UI keeps three
// clearly separated sections — live state, CRUD actions, automated
// validation — so the user can either explore the model or run the
// close-out tests without conflating the two.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as git from 'isomorphic-git';

import { WorkspaceService } from '@core/fs/workspace.service';
import { AutocommitService } from '@core/versioning/autocommit.service';
import { GitFsAdapter } from '@core/versioning/git-fs.adapter';
import { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { VariantsService } from '@core/versioning/variants.service';
import type { Variant } from '@core/versioning/variants.types';
import { NotesService } from '@features/notes/services/notes.service';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { IconComponent } from '@shared/icon/icon.component';

import {
  testAlignWithGit,
  testBroadcastSetsStale,
  testPreSwitchCommit,
  testRoundTripSwitch,
} from './dev-variants-switch-tests';
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

type TestKey =
  | 'create'
  | 'rollback'
  | 'delete'
  | 'round-trip'
  | 'broadcast'
  | 'align'
  | 'pre-switch';
type TestStatus = 'idle' | 'running' | 'pass' | 'fail';
interface TestState {
  readonly status: TestStatus;
  readonly message: string;
}

@Component({
  selector: 'mc-dev-variants-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BgColorDirective, IconComponent],
  templateUrl: './dev-variants-panel.container.html',
  styleUrls: ['./dev-versioning-panel.container.css', './dev-variants-panel.container.css'],
})
export class DevVariantsPanelContainer {
  private readonly variants = inject(VariantsService);
  private readonly switcher = inject(SwitchVariantService);
  private readonly workspace = inject(WorkspaceService);
  private readonly notes = inject(NotesService);
  private readonly autocommit = inject(AutocommitService);

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
    'round-trip': { status: 'idle', message: '' },
    broadcast: { status: 'idle', message: '' },
    align: { status: 'idle', message: '' },
    'pre-switch': { status: 'idle', message: '' },
  });
  protected readonly tests = this.testsSignal.asReadonly();

  protected readonly testListI: readonly { key: TestKey; label: string; detail: string }[] = [
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

  protected readonly testListII: readonly { key: TestKey; label: string; detail: string }[] = [
    {
      key: 'round-trip',
      label: '⑤ Switch ida-y-vuelta',
      detail:
        'Desde Principal: crea throwaway, switch hacia ella, switch de vuelta, verifica activeId y HEAD en ambos extremos.',
    },
    {
      key: 'broadcast',
      label: '⑥ Broadcast cruzado dispara stale banner',
      detail:
        'Postea un mensaje en el canal mc-variants simulando otra pestaña; verifica que remoteSwitch en SwitchVariantService se vuelva no-null (lo que monta el banner amarillo).',
    },
    {
      key: 'align',
      label: '⑦ alignWithGit recupera de desalineo',
      detail:
        'Estando en una variante distinta de Principal: hace checkout manual a main, después llama alignWithGit; verifica que HEAD vuelva a la activa. Simula recovery de crash mid-switch.',
    },
    {
      key: 'pre-switch',
      label: '⑧ Switch con dirty crea pre-switch commit',
      detail:
        'Desde Principal: crea throwaway (modifica variants.json → dirty), switch, busca en el log el commit "auto: pre-switch-variant …".',
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

  protected async backdate(id: string): Promise<void> {
    await this.runAction(() => this.variants.setLastActivityAt(id, Date.now() - 31 * 86_400_000));
  }

  protected seedCount = 20;

  // why: gate ⑨ of 13b-iv needs ~N entities that diverge between two
  //      variants. The user runs this on the throwaway variant they
  //      want to merge from; the autocommit at the end captures every
  //      seeded note in a single commit on that variant's `main`.
  protected async seedNotes(): Promise<void> {
    const n = Math.max(1, Math.min(200, Number(this.seedCount) || 0));
    await this.runAction(async () => {
      const stamp = Date.now().toString(36);
      for (let i = 1; i <= n; i++) {
        await this.notes.create(`__dev-seed-${stamp}-${i.toString().padStart(2, '0')}`);
      }
      await this.autocommit.commitNow('dev-seed');
    });
  }

  protected async runTest(key: TestKey): Promise<void> {
    const fs = this.adapter();
    if (!fs) return;
    this.setTest(key, { status: 'running', message: '' });
    try {
      const result = await this.dispatchTest(key, fs);
      this.setTest(key, { status: result.pass ? 'pass' : 'fail', message: result.message });
    } catch (e) {
      this.setTest(key, { status: 'fail', message: format(e) });
    } finally {
      await this.refreshBranches();
    }
  }

  private dispatchTest(key: TestKey, fs: GitFsAdapter): Promise<TestResult> {
    const deps = { variants: this.variants, switcher: this.switcher, fs };
    switch (key) {
      case 'create':
        return testCreateFlow(this.variants, fs);
      case 'rollback':
        return testRollbackOnFailure(this.variants, fs);
      case 'delete':
        return testDeleteFlow(this.variants, fs);
      case 'round-trip':
        return testRoundTripSwitch(deps);
      case 'broadcast':
        return testBroadcastSetsStale(deps);
      case 'align':
        return testAlignWithGit(deps);
      case 'pre-switch':
        return testPreSwitchCommit(deps);
    }
  }

  protected async runAllTestsI(): Promise<void> {
    for (const t of this.testListI) await this.runTest(t.key);
  }

  protected async runAllTestsII(): Promise<void> {
    for (const t of this.testListII) await this.runTest(t.key);
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
