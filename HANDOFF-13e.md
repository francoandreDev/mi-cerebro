# Handoff — terminar 13e (push a GitHub)

## Estado actual (2026-06-13)

**13e-i Cerrado** en commit `41aa436` — feat(versioning): paso 13e-i — remote config + PAT storage + smoke push.

Lo que quedó en el repo:

- `src/app/core/versioning/remote.types.ts` — `RemoteConfig`, `RemoteSecretsFile`, `PushOutcome`, `REMOTE_SECRETS_FILE = '.mi-cerebro/secrets.json'`, `REMOTE_SECRETS_SCHEMA_VERSION = 1`.
- `src/app/core/versioning/remote.config.io.ts` — `isValidRemoteUrl`, `readRemoteSecrets`, `writeRemoteSecrets`, `ensureGitignoredSecrets` (idempotente), interface `ConfigFs`.
- `src/app/core/versioning/remote.config.io.spec.ts` — 17/17 tests passing.
- `src/app/core/versioning/remote.service.ts` — `configure`, `clear`, `pushActiveMain` (sólo `main` de la variante activa). Errores mapeados a NET-001/002/003. Usa CORS proxy `https://cors.isomorphic-git.org` y PAT via Basic auth (`username: <pat>, password: 'x-oauth-basic'`).
- `src/app/features/settings/containers/settings.container.{ts,html}` — sección "Versionado remoto" con form URL/PAT y botones Save / Push / Clear.
- `src/app/core/errors/error.codes.ts` — `NET_001`, `NET_002`, `NET_003`.
- `src/app/core/i18n/locales/es.ts` — keys `errors.net.001-003.*` y `settings.remote.*`.
- `docs/errors.md` — entradas MCB-NET-001..003.
- `docs/deferred.md` — crypto-at-rest para PAT (§19.16f) y CORS proxy propio (§19.16f).
- `PROYECTO.md` §19.13e-i marcado _Cerrado 2026-06-13_.

**Smoke test contra GitHub real**: no se hizo. Queda como validación manual del usuario; no bloquea avanzar a 13e-ii.

## Decisiones de diseño ya alineadas con el usuario (no re-preguntar)

- **Auth**: PAT pegado por el usuario, persistido en plano dentro de `.mi-cerebro/secrets.json` (gitignored por default). Crypto-at-rest queda para §19.16f.
- **Modelo del remoto**: todas las variantes × 3 ramas (`main` + `comments` + `draft`) — backup end-to-end.
- **Conflictos pull**: rechazar non-fast-forward por ref, descargar el divergente como `refs/remotes/origin/*` sin tocar local, abrir banner que lleva a `/variants/merge`. Cero merge automático.
- **Auto-push**: opt-in tras autocommit con throttle de N minutos (default 5, configurable). Cablear los placeholders `versioning.pushAfterAutocommit` y `versioning.pushThrottleMinutes` que dejó 11bis.

## Lo que falta — sub-pasos pendientes

### 13e-ii — Push y pull de N×3 ramas + pantalla `/sync`

Roadmap textual en PROYECTO.md líneas ~833. Resumen:

- `RemoteService.pushAll()` itera `variants × {main, comments, draft}`, reporta por-ref outcome (`ok` | `up-to-date` | `error`).
- `RemoteService.fetchAll()` simétrico → trae cada ref remoto a `refs/remotes/origin/<branch>` con `git.fetch`.
- Ambas bajo `FsLockService.withLock` para no cruzarse con autocommit.
- Loading screen contextual durante la operación (puede tardar ~10-30 s).
- Pantalla nueva `/sync` con tabla de refs (path local, status, last sync at) + botones "Push todo" / "Fetch todo".
- Errores nuevos: `MCB-NET-004` (push parcial — N de M refs fallaron, lista por-ref), `MCB-NET-005` (fetch parcial).
- Tests: `remote-bulk.spec` (orquestación + status reporting con http mockeado).
- Gate manual: crear 2 variantes con commits únicos en cada una × 3 facetas → push todo → borrar workspace local → fetch + verificar que todas las refs locales reflejan las remotas.

**Notas de implementación**:

- `VariantsService.list()` ya devuelve `Variant[]` con `refs.{main, comments, draft}`. Iterar y mapear a `{ref, remoteRef}` para `git.push`.
- Para `fetchAll`, isomorphic-git `git.fetch({remote, ref})` por cada ref — o `singleBranch: false` si soporta multi-ref en un fetch (verificar).
- El `RemoteService` actual está cerca del soft-cap de 200 líneas — probablemente extraer `remote-bulk.ts` con las orquestaciones para no romperlo.

### 13e-iii — Detección de divergencia + handoff a `/variants/merge`

Roadmap en PROYECTO.md líneas ~834. Resumen:

- En cada `fetch` por ref: comparar `localTip` vs `refs/remotes/origin/<branch>`. Si `localTip` no es ancestro del remoto Y el remoto no es ancestro del local → divergencia.
- `RemoteService.divergentRefs` (signal) lista refs divergentes.
- Banner global no-cerrable en el shell: "Hay cambios remotos divergentes en N rama(s). Abrir merge para resolver." → navega a `/variants/merge?incoming=remote`.
- `/variants/merge` extendido para reconocer remotos como source candidates (combo "Desde: [variante local] | remote/<branch>").
- Mientras haya divergencia pendiente, "Push todo" de `/sync` queda deshabilitado con tooltip.
- Errores: `MCB-NET-006` (divergencia detectada en fetch), `MCB-NET-007` (push post-merge rechazado por race).
- Tests: `divergence-detect.spec` con helper puro `classifyTip(local, remote)` — casos fast-forward / behind / divergent / unrelated.
- Gate manual: 2 pestañas con remotos espejo, editar misma entidad en ambas, push A, push B (B detecta divergencia post-fetch), abrir `/variants/merge` desde banner, resolver, push final exitoso.

**Notas de implementación**:

- Helper puro `classifyTip(localOid, remoteOid, isAncestor)` — separar del servicio para testear sin git. Probablemente necesite que el caller le pase los resultados de `git.isDescendent` precalculados.
- `MergeService` actual (revisar `merge.service.ts` + `merge-facetas.ts`) — extender el modelo de "source" para aceptar refs remotas.
- El banner global probablemente vive en `app.shell.*` o equivalente — revisar dónde están los banners existentes.

### 13e-iv — Auto-push throttled + status panel + cierre 13e

Roadmap en PROYECTO.md líneas ~835. Resumen:

- Cablear `versioning.pushAfterAutocommit` (boolean, default `false`) y `versioning.pushThrottleMinutes` (number, default 5) del `SettingsService` al flujo.
- `AutocommitService` (o `AutoPushService` separado que escuche `autocommit.lastCommitAt`) dispara push si: (1) toggle ON, (2) `now - lastPushAt >= throttle`, (3) no hay divergencia pendiente, (4) no hay push en vuelo.
- Indicador en sidebar/footer: dot verde "sincronizado", amarillo "pending push", rojo "divergente".
- Pantalla `/sync` muestra el toggle + throttle slider + estado actual + última operación.
- Errores: `MCB-NET-008` (auto-push skipped — push ya en vuelo).
- Tests: `auto-push-scheduler.spec` — throttle no respeta dos triggers consecutivos dentro de la ventana, sí respeta uno tras la ventana; skip cuando divergent o in-flight.
- Gate manual: habilitar auto-push con throttle 1min, editar 3 veces en 2min → exactamente 1 push entre min 0-1 y otro entre min 1-2 (no 3); editar con divergencia activa → 0 pushes hasta resolver.

**Notas de implementación**:

- `SettingsService` ya tiene los placeholders cableados a `/settings` UI (sección "Versionado" que hoy es placeholder); revisar `settings.service.ts` para confirmar si `pushAfterAutocommit` / `pushThrottleMinutes` están en el shape o sólo en i18n.
- El scheduler ideal es un servicio aparte (`AutoPushService`) que `effect()`-suscribe a `AutocommitService.lastCommitAt` y `RemoteService.{isPushing, divergentRefs}`. Mantener el `AutocommitService` ignorante del push.

## Reglas del repo a no olvidar

- **`PROYECTO.md` primero**: leer §19.13e completo antes de tocar nada. Cualquier desviación se discute y se actualiza `PROYECTO.md` en el mismo commit (regla §4.11.25).
- **Idioma**: UI en español, código y commits en inglés.
- **Caps de archivo**: 200 líneas soft warn / 300 hard error. `remote.service.ts` ya está en ~221; al agregar push/fetch bulk probablemente convenga extraer a `remote-bulk.ts`.
- **Network**: regla §4.14 — cero red excepto operaciones git iniciadas por el usuario o por el scheduler de auto-push explícitamente habilitado en `/settings`.
- **No mock DB en tests**: igual que en 13d, los tests deben hacer round-trip real con `git.push`/`git.fetch` mockeados a nivel http (no a nivel git).
- **Commits**: estilo de los últimos del branch (`feat(versioning): paso 13e-X — <titular>` + body breve + `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`).
- **Pre-commit hook**: corre eslint --fix y prettier. Mantener complejidad ≤ 10 por función y archivos ≤ 200 (warning) / 300 (error).

## Cómo arrancar el próximo chat

1. Leer `PROYECTO.md` completo (regla del proyecto).
2. Leer este handoff.
3. Leer `src/app/core/versioning/remote.service.ts` y `remote.config.io.ts` para entender los building blocks de 13e-i.
4. Si querés smoke test del push antes de seguir: configurar repo + PAT en `/settings`, dale push, verificar que la rama de la variante activa aparece en GitHub. Si falla, debuggear ahí antes de 13e-ii.
5. Arrancar por 13e-ii: empezar por `pushAll`/`fetchAll` en `RemoteService` (o nuevo `remote-bulk.ts`), después la pantalla `/sync`.
