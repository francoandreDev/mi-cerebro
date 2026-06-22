# Handoff — Compactación del historial (cierre §12)

## Contexto

Implementación de PROYECTO.md §12 "Compactación del historial" cerrada en 4 sesiones:

1. **Sesión 1** — planner puro (`compaction-plan.ts`, 17 tests).
2. **Sesión 2** — plumbing git + snapshot (`compaction.service.ts`, 3 tests).
3. **Sesión 3** — scheduler background (`compaction-scheduler.service.ts` + helper puro, 12 tests, VER_027, setting `compactWithRemote`).
4. **Sesión 4** (esta) — banner /history, `pushAllWithLease`, toggle en settings, exposición de `runOnce({ ignoreThreshold })`.

PROYECTO.md §12 ya está alineado, no requirió cambios.

## Lo nuevo en sesión 4

### Banner en `/history`

- `CompactionSchedulerService` expone:
  - `maxBranchCommitCount: Signal<number>` — actualizado al final de cada `evaluate()`.
  - `shouldSuggestEnableCompaction: Signal<boolean>` — `remote.isConfigured() && !cfg.compactWithRemote && maxBranchCommitCount() > 500`.
- `HistoryContainer` inyecta el scheduler y lee el computed. Si on, renderiza `<aside class="compaction-banner">` con CTA a `/settings`. CSS nuevo en `history.container.css` (~50 líneas, sin tocar lo existente).
- Sin polling: el conteo se refresca con cada tick del scheduler (1×/h). Bastante para el caso "el log creció pasivamente".

### `pushAllWithLease` en `RemoteService`

- `gitPushWithLeaseOne(adapter, cfg, expectedRemoteOid)` en `remote-bulk.ts`: usa `git.push({ force: true, onPrePush })`. `onPrePush` recibe `remoteRef.oid` (lo que el server reporta) y devuelve `false` si no matchea la lease → isomorphic-git aborta el push.
- `RemoteService.snapshotRemoteOid(ref): Promise<string | null>` — captura el oid del remote-tracking ref _antes_ del rewrite.
- `RemoteService.pushAllWithLease(leases: Map<ref, expectedOid | null>)` — itera variantes × facetas, pushea cada ref con su lease (o sin si la entrada del map es `null`). Refs no presentes en el map caen al `gitPushOne` normal (no-force).
- El scheduler captura la lease justo antes de `applyPlan` y batchea el push al final del `evaluate()` cuando alguna rama se reescribió y `compactWithRemote && remote.isConfigured()`.

### `runOnce({ ignoreThreshold })`

- API añadida al scheduler. Cuando `ignoreThreshold: true`, el `decideCompaction` recibe `commitCount: Number.MAX_SAFE_INTEGER` y `lastRunAt: null` — bypassea threshold + throttle, pero sigue respetando in-flight, remote-divergence y remote-gated.
- **No hay panel `/dev`.** El handoff de sesión 3 lo mencionaba, pero el feature no existe (`DevPerfService` y `dev-variants-switch-tests.ts` también están sin UI consumidora). Diferido en `docs/deferred.md` ("Dev panel para la compactación"). `runOnce({ ignoreThreshold: true })` se invoca desde la consola del navegador para QA.

### Settings UI

- Toggle "Compactar aunque haya remoto" agregado en `/settings → Versionado remoto`, debajo del enlace a `/sync`. Llama a `settings.setCompactWithRemote()`.
- I18n keys nuevas en `es.ts`: `settings.remote.compactWithRemote.label/hint`, `versioning.history.compactionBanner.title/body/cta`.

### Verificación de aliases (item ⚠️ del handoff anterior)

- `bun x vitest run` directo **no resuelve** `@core/...` porque no hay `vitest.config.ts` ni paths cargados — el builder `@angular/build:unit-test` los inyecta.
- **Correr siempre con `bun x ng test --watch=false`** (que invoca el builder). Resuelve los aliases bien y termina sin watch.
- Resultado limpio en `bun x ng test --watch=false`: 332 passed / 6 failed. Los 6 fallos son **pre-existentes** y ajenos a §12:
  - `src/app/shared/tree/tree-state.service.spec.ts` (4 fallos) — `localStorage.clear()` undefined en el entorno de test.
  - `src/app/features/variants/utils/variant-tree.spec.ts` (2 fallos) — connector indent format `"   ├ "` vs `"├ "`.
  - Ambos vienen de commits `459744f` y `6c63ef6`; no introducidos por sesión 4.

### `bun run build` — verde.

## Caveats heredados (siguen vigentes)

- `git.gc` no existe sobre FS Access: blobs huérfanos quedan en `.git/objects/` hasta un prune manual.
- Throttle 1×/día es per-workspace, no per-rama: si una rama falla, no se reintenta hasta el día siguiente.
- `gitPushWithLeaseOne` retorna `error: 'lease-violation:<ref>'` cuando `onPrePush` devuelve `false`. La clasificación es heurística sobre el mensaje de error de isomorphic-git (`pre-?push|onPrePush|prepush|aborted`); si la library cambia el wording, revisar.

## Diferidos abiertos vinculados a §12

(Ya tenían entrada antes; ninguno bloquea el cierre.)

- Umbral de compactación configurable en settings.
- Compactación manual sobre rango específico.
- `.git/` en OPFS para acelerar operaciones git.
- **Nuevo:** Dev panel para la compactación (`docs/deferred.md`).

## Reglas duras del repo (recordatorio para el próximo)

- TS strict, sin `any`, signals, OnPush, standalone.
- Files: soft 200 / hard 300 líneas. `compaction-scheduler.service.ts` quedó en ~254; `remote.service.ts` en ~298. Ambos pasan lint (warning, no error).
- Sin cross-feature imports.
- UI español, código/commits inglés.
- Cualquier cambio arquitectónico actualiza `PROYECTO.md` en el mismo commit (§4.11.25). Sesión 4 no introdujo cambios al doc.

## Próximo trabajo

§12 está cerrado. Mirar `PROYECTO.md` §19 (roadmap) para el siguiente paso, o `docs/deferred.md` para ítems sueltos.
