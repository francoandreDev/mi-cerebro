// Programmatic tests for the 13b-ii close-out criteria. Same shape as
// the 13b-i tests: setup → run → assert → cleanup → structured result.
//
// Each test creates a throwaway variant, performs whatever flow it
// needs, then deletes the throwaway and switches back to Principal.

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from '@core/versioning/git-fs.adapter';
import type { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { VARIANTS_CHANNEL_NAME } from '@core/versioning/variants-channel';
import type { VariantsService } from '@core/versioning/variants.service';
import { PRINCIPAL_VARIANT_ID } from '@core/versioning/variants.types';

import type { TestResult } from './dev-variants-tests';

const REPO = '/';

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export interface SwitchDeps {
  readonly variants: VariantsService;
  readonly switcher: SwitchVariantService;
  readonly fs: GitFsAdapter;
}

// ⑤ Round-trip: switch to a throwaway variant and back; verify HEAD,
//    activeId and that the workspace is on the right branch each time.
export async function testRoundTripSwitch(deps: SwitchDeps): Promise<TestResult> {
  const { variants, switcher, fs } = deps;
  const startId = variants.getActiveId();
  if (startId !== PRINCIPAL_VARIANT_ID) {
    return {
      pass: false,
      message: `el test corre desde Principal; estás en ${startId}. Activá Principal primero.`,
    };
  }
  const name = uniqueName('rt-switch');
  let createdId: string | null = null;
  try {
    const created = await variants.create({ name, color: '#888888' });
    createdId = created.id;
    await switcher.switchTo(created.id);
    if (variants.getActiveId() !== created.id) {
      return { pass: false, message: 'activeId no cambió al hacer switch hacia adelante' };
    }
    const fwd = await git.currentBranch({ fs, dir: REPO });
    if (fwd !== `variant/${created.id}/main`) {
      return { pass: false, message: `HEAD ≠ esperado tras switch fwd: ${String(fwd)}` };
    }
    await switcher.switchTo(PRINCIPAL_VARIANT_ID);
    if (variants.getActiveId() !== PRINCIPAL_VARIANT_ID) {
      return { pass: false, message: 'activeId no volvió a principal' };
    }
    const back = await git.currentBranch({ fs, dir: REPO });
    if (back !== 'main') {
      return { pass: false, message: `HEAD ≠ main tras volver: ${String(back)}` };
    }
    return {
      pass: true,
      message: 'switch fwd + back: activeId y HEAD coinciden en ambos extremos',
    };
  } catch (e) {
    return { pass: false, message: format(e) };
  } finally {
    if (createdId && variants.getActiveId() !== createdId) {
      try {
        await variants.delete(createdId);
      } catch {
        // best-effort
      }
    }
  }
}

// ⑥ Cross-tab: simulate another tab's broadcast and verify that
//    SwitchVariantService.remoteSwitch picks it up.
export async function testBroadcastSetsStale(deps: SwitchDeps): Promise<TestResult> {
  const { switcher, variants } = deps;
  const fake = new BroadcastChannel(VARIANTS_CHANNEL_NAME);
  try {
    const before = switcher.remoteSwitch();
    if (before) {
      return {
        pass: false,
        message: 'ya había un remoteSwitch pendiente al inicio (recargá y reintentá)',
      };
    }
    const someoneElse = variants
      .file()
      .variants.find((v) => v.id !== variants.getActiveId() && !v.pendingDelete);
    if (!someoneElse) {
      return {
        pass: false,
        message: 'no hay otra variante para simular el broadcast — creá una primero',
      };
    }
    fake.postMessage({
      type: 'switched',
      variantId: someoneElse.id,
      requestedAt: Date.now(),
    });
    // why: BroadcastChannel delivery is async to other listeners in
    //      the same agent. Yield twice to let microtasks flush.
    await sleep(50);
    const after = switcher.remoteSwitch();
    if (!after) {
      return {
        pass: false,
        message: 'remoteSwitch sigue null tras el broadcast — la suscripción no funciona',
      };
    }
    if (after.to !== someoneElse.id) {
      return {
        pass: false,
        message: `remoteSwitch.to esperado ${someoneElse.id}, fue ${after.to}`,
      };
    }
    return {
      pass: true,
      message: `remoteSwitch detectó el switch a ${someoneElse.name} — el banner se monta automáticamente`,
    };
  } catch (e) {
    return { pass: false, message: format(e) };
  } finally {
    fake.close();
  }
}

// ⑦ AlignWithGit recovers from crash mid-switch: manually checkout
//    Principal main → call alignWithGit → expect HEAD to be back on
//    the active variant's main.
export async function testAlignWithGit(deps: SwitchDeps): Promise<TestResult> {
  const { variants, switcher, fs } = deps;
  const startId = variants.getActiveId();
  if (startId === PRINCIPAL_VARIANT_ID) {
    return {
      pass: false,
      message: 'el test necesita estar en una variante distinta de Principal (creá una y activala)',
    };
  }
  const active = variants.getActive();
  if (!active) return { pass: false, message: 'no hay variante activa' };
  try {
    await git.checkout({ fs, dir: REPO, ref: 'main', force: true });
    const drifted = await git.currentBranch({ fs, dir: REPO });
    if (drifted !== 'main') {
      return {
        pass: false,
        message: `no logré desalinear HEAD (currentBranch=${String(drifted)})`,
      };
    }
    await switcher.alignWithGit();
    const after = await git.currentBranch({ fs, dir: REPO });
    if (after !== stripHeads(active.refs.main)) {
      return { pass: false, message: `alignWithGit dejó HEAD en ${String(after)}` };
    }
    return { pass: true, message: `alignWithGit reposicionó HEAD a ${after}` };
  } catch (e) {
    return { pass: false, message: format(e) };
  }
}

// ⑧ Dirty preservation: creating the throwaway variant rewrites
//    variants.json (which IS tracked); we then trigger the switch and
//    verify the auto pre-switch-variant commit is in the log.
export async function testPreSwitchCommit(deps: SwitchDeps): Promise<TestResult> {
  const { variants, switcher, fs } = deps;
  if (variants.getActiveId() !== PRINCIPAL_VARIANT_ID) {
    return { pass: false, message: 'el test necesita arrancar en Principal' };
  }
  const name = uniqueName('dirty-pre');
  let createdId: string | null = null;
  try {
    const created = await variants.create({ name, color: '#888888' });
    createdId = created.id;
    await switcher.switchTo(created.id);
    // why: the pre-switch commit lands on `main` (the variant we left)
    //      BEFORE the checkout swaps HEAD. After the switch, HEAD lives
    //      on a branch that was forked off main earlier, so its log
    //      doesn't see the new commit. Read main's log explicitly.
    const log = await git.log({ fs, dir: REPO, ref: 'main', depth: 5 });
    const expected = `auto: pre-switch-variant ${PRINCIPAL_VARIANT_ID} → ${created.id}`;
    const found = log.find((e) => e.commit.message.trim() === expected);
    if (!found) {
      const messages = log.map((e) => e.commit.message.trim()).join(' | ');
      return {
        pass: false,
        message: `no encontré "${expected}" en los últimos ${log.length} de main: ${messages}`,
      };
    }
    return { pass: true, message: `pre-switch-variant commit registrado en main: ${expected}` };
  } catch (e) {
    return { pass: false, message: format(e) };
  } finally {
    try {
      if (createdId && variants.getActiveId() !== PRINCIPAL_VARIANT_ID) {
        await switcher.switchTo(PRINCIPAL_VARIANT_ID);
      }
      if (createdId) await variants.delete(createdId);
    } catch {
      // best-effort
    }
  }
}

function stripHeads(ref: string): string {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function format(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}
