# Handoff — Compactación del historial (sesión 3 de 4)

## Contexto

Implementación de PROYECTO.md §12 "Compactación del historial". Sesión 1 dejó el planner puro; sesión 2 el plumbing git + snapshot pre-compactación; **sesión 3 (esta) cablea el scheduler background + threshold + toggle remoto + VER_027**. Sesión 4 cierra con UI (banner `/history`, dev panel) e integración real `--force-with-lease` en `RemoteService`.

**Antes de tocar nada, leé `PROYECTO.md` §12** (regla CLAUDE.md) y `docs/errors.md` MCB-VER-025/026/027.

## Lo que ya está (sesiones 1 + 2 + 3)

### Sesión 1 — planner puro

`src/app/core/versioning/compaction-plan.ts` — `buildCompactionPlan({ commits, tagOids, now }) → { fuseGroups, preservedOids }`. 17 tests verdes en `compaction-plan.spec.ts`. Respeta barreras (tag / `before-restore:` / `Merge-Group:`) y buckets (daily 8–30d / weekly 31–180d / monthly >180d).

### Sesión 2 — plumbing git + snapshot

`src/app/core/versioning/compaction.service.ts` con:

- `planForBranch(ref): Promise<CompactionPlan>` — `versioning.logFull(ref)` + `versioning.listTagOids()` → planner.
- `applyPlan(ref, plan): Promise<{newTipOid, rewrote}>` — snapshot a `.mi-cerebro/pre-compaction/<YYYY-MM-DD-HHmm>/<branch-slug>/plan.json` → walk root→tip (`git.readCommit` + `git.writeCommit`, skip todos los no-últimos de cada grupo, fuse-commit con subject `auto-batch [<faceta>]: N commits (<bucketKey>)` y trailer `Compacted-From: <oid1>..<oidN>`) → `git.writeRef force:true`. Detrás de `FsLockService` + `autosave.flushAll()`. No-op idempotente si `fuseGroups.length === 0`.
- `versioning.service.ts` ganó `logFull(ref)` (sin cap de depth) y `listTagOids()` (peelea anotados).
- `VER_025` / `VER_026` cableados en `error.codes.ts` + `i18n/locales/es.ts`.
- `.mi-cerebro/pre-compaction/` agregado al gitignore default (`versioning.constants.ts`).
- `compaction.service.spec.ts` — 3 integration tests (fuse trivial 3→1 con trailer, snapshot JSON escrito, idempotencia).

### Sesión 3 — scheduler background

1. **`compaction-scheduler.ts`** — helper puro `decideCompaction(input): CompactionSchedulerDecision`. Orden de skips: `in-flight` → `remote-gated` → `divergent` → `below-threshold` → `throttle` → `run`. 12 tests verdes en `compaction-scheduler.spec.ts`.

   ```ts
   type CompactionSchedulerDecision =
     | 'run'
     | 'skip-below-threshold'
     | 'skip-throttle'
     | 'skip-in-flight'
     | 'skip-remote-gated'
     | 'skip-divergent';

   interface CompactionSchedulerInput {
     commitCount: number; // per-ref
     thresholdCommits: number; // 500
     now: number;
     lastRunAt: number | null; // workspace-global
     throttleMs: number; // 24h
     remoteConfigured: boolean;
     compactWithRemote: boolean;
     hasDivergence: boolean;
     inFlight: boolean; // managed at evaluate() level, no por-ref
   }
   ```

2. **`compaction-state.io.ts`** — read/write `.mi-cerebro/compaction-state.json` (schema v1, `{ schemaVersion, lastRunAt }`). Per-workspace, no per-branch: el throttle 1×/día es global a la pasada; el threshold sí es per-branch.

3. **`compaction-scheduler.service.ts`** — `@Injectable({ providedIn: 'root' })`. En `workspace.isReady()` carga estado y arranca `setInterval(evaluate, 1h)` + corre una pasada inmediata. `evaluate()` enumera variantes × `{main, draft, comments}`, para cada ref calcula `commitCount` con `versioning.logFull(ref)`, pasa por `decideCompaction`, y si `'run'` llama a `compaction.planForBranch` + `applyPlan`. Persiste `lastRunAt` sólo si alguna rama se reescribió.

4. **Settings.** `versioning.compactWithRemote: boolean` (default `false`) en `settings.types.ts` con `DEFAULT_SETTINGS` + setter `setCompactWithRemote(enabled)` en `settings.service.ts`. Schema v1 mantenido (merge aditivo con defaults absorbe el campo nuevo sin romper).

5. **VER_027** — `error.codes.ts` + `ERROR_CODE_META` + `i18n/locales/es.ts` (`errors.ver.027.title` / `errors.ver.027.message`). El scheduler emite `VER_027` (severity warning, recoverable) cuando `remote.isConfigured() && cfg.compactWithRemote && remote.hasDivergence()`, **una sola vez por ventana de 24h** para no spamear el toast en cada tick. `skip-remote-gated` (toggle off) es silencioso por diseño — el banner en `/history` queda para sesión 4.

6. **App shell.** `CompactionSchedulerService` se inyecta eagerly en `AppShellContainer` (junto con `AutoPushService`) y `.start()` se llama en el constructor; el effect interno espera a `workspace.isReady()`.

### Estado al cierre de sesión 3

- ✅ `compaction-scheduler.spec.ts` 12/12 verdes en la última corrida local.
- ⚠️ La corrida completa de `bun x vitest run src/app/core/versioning/compaction` se interrumpió antes de cerrar: el run mostró 29/29 tests de `compaction-plan.spec.ts` + `compaction-scheduler.spec.ts` verdes, pero `compaction.service.spec.ts` falló por `Cannot find package '@core/errors/app-error'` al importar `autosave.service.ts` — alias resolution de vitest, **no relacionado con código de sesión 3** (el spec ya andaba en sesión 2 cerrando 127/127). Verificar en sesión 4 si fue un glitch puntual del runner o cambió algo en `vitest.config`/`tsconfig`. Si persiste, revisar `vite-tsconfig-paths` o alias explícitos en la config de vitest.
- ⚠️ `bun run build` y `bun x vitest run` (suite completa) no se ejecutaron en esta sesión por interrupción. Correr al abrir sesión 4 antes de tocar nada nuevo.

## Lo que falta (sesión 4)

1. **UI banner en `/history`.** Cuando `remote.isConfigured() && !cfg.compactWithRemote && hay alguna rama con commitCount > 500`, mostrar banner sugiriendo activar el toggle. Necesita un computed que cruce settings + remote + un counter de commits por familia (el scheduler ya hace este cálculo, exponerlo como signal observable para no duplicarlo).

2. **Force-push real en `RemoteService`.** Hoy `pushAll()` usa el flujo normal; falta una variante `pushAllWithLease()` (o un flag) para que el primer push tras compactación use `--force-with-lease`. La compactación reescribió historia local: sin force, GitHub rechaza el push. Aborto si el remoto avanzó (`force-with-lease` ya lo hace nativo en isomorphic-git, ver `remote-bulk.ts`).

3. **Dev panel para trigger manual.** El `CompactionSchedulerService` ya expone `runOnce()` — exponerlo desde `/dev` (junto a los otros toggles de dev-perf) para forzar una pasada sin esperar el tick horario ni el threshold (probablemente con un flag `ignoreThreshold` para QA).

4. **Settings UI.** Toggle "Compactar aunque haya remoto" en `/settings` → "Versionado remoto". Llamar a `settings.setCompactWithRemote(boolean)`.

5. **Verificar resolución de aliases** del item ⚠️ arriba.

## Patrones del repo a respetar

- **Servicios:** `@Injectable({ providedIn: 'root' })`, signals + effects, OnPush.
- **Plumbing sin checkout:** `branch-blob-ops.ts`, `tree-ops.ts`. `git.readCommit/writeCommit/writeRef`.
- **Errores:** `throw new AppError(ERROR_CODES.X, { severity, context, recoverable })`. Códigos en `error.codes.ts` + `ERROR_CODE_META` + i18n.
- **Persistencia per-workspace:** `.mi-cerebro/<file>.json`, lock vía `FsLockService` cuando toca `.git/`, JSON pretty-printed con `JSON.stringify(_, null, 2)`.

## Caveats heredados

- `git.gc` no existe sobre FS Access (isomorphic-git limitation). Los blobs de commits fusionados quedan huérfanos en `.git/objects/` hasta un prune manual (que probablemente nunca corre). Aceptable para v1; tracking como diferido si el bloat se vuelve real.
- El throttle 1×/día es per-workspace, no per-rama: una rama que falla no se reintenta hasta el próximo día. Aceptable porque el `applyPlan` ya es por-rama atómico.

## Verificación al cerrar la sesión

```bash
bun x vitest run
bun run build
```

Ambos verdes. Hooks de commit corren eslint + prettier sobre staged; si fallan, fix el error real (no `--no-verify`).

## Reglas duras del repo

- TS strict, sin `any`, signals, OnPush, standalone.
- Files: soft 200 / hard 300 líneas. `compaction-scheduler.service.ts` queda en ~170; si crece, extraer la enumeración de refs o el reporting de skips.
- Sin cross-feature imports. Todo este trabajo vive en `core/versioning/` (excepto el toque a `core/settings/` y `layout/containers/app-shell.container.ts`).
- UI español, código/commits inglés.
- Cualquier cambio arquitectónico actualiza `PROYECTO.md` en el mismo commit (regla §4.11.25). Sesión 3 no introduce cambios al doc — el algoritmo respeta la sección "Compactación del historial" ya escrita.
