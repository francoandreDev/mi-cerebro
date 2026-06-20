# Handoff — Compactación del historial (sesión 2 de 3-4)

## Contexto

Implementación de PROYECTO.md §12 "Compactación del historial" — fusionar autocommits viejos respetando barreras (tags, `before-restore:`, `Merge-Group:`).

**Antes de tocar nada, leé `PROYECTO.md` §12** (regla CLAUDE.md) y `docs/errors.md` MCB-VER-025/026/027.

## Lo que ya está (sesión 1)

`src/app/core/versioning/compaction-plan.ts` — planner puro, sin FS ni git. API:

```ts
buildCompactionPlan({ commits, tagOids, now }): CompactionPlan
isBarrier(commit, tagOids): boolean

interface CompactionPlan {
  fuseGroups: FuseGroup[];  // grupos a fusionar (≥2 commits)
  preservedOids: string[];  // commits que quedan intactos
}

interface FuseGroup {
  bucket: 'daily' | 'weekly' | 'monthly';
  bucketKey: string;        // YYYY-MM-DD | YYYY-Www | YYYY-MM (UTC)
  oids: string[];           // oldest → newest
  newestTimestamp: number;
}
```

`compaction-plan.spec.ts` — 17 tests, todos verdes. Cubren: empty, recent-only, daily fuse, singleton-bucket preservación, barreras (tag/before-restore/Merge-Group) partiendo buckets, weekly/monthly, mixed scenario, key boundaries, newestTimestamp.

## Lo que falta (sesión 2)

**Plumbing git + snapshot.** Tomar un `CompactionPlan` y aplicarlo sobre una rama vía isomorphic-git plumbing, sin tocar el working tree.

### Tareas concretas

1. **`compaction.service.ts`** (nuevo) en `core/versioning/`. Métodos:
   - `planForBranch(ref: string): Promise<CompactionPlan>` — wraps log completo del ref + `git.listTags` + filtros para obtener `tagOids`, llama al planner puro. El `log` actual está capado en `depth = 50` (ver caveat abajo).
   - `applyPlan(ref: string, plan: CompactionPlan): Promise<{ newTipOid: string }>` — rewrite real, ver abajo.
2. **Snapshot pre-compactación.** Antes de tocar refs: copiar el ref actual y los oids del rango fusionado a `.mi-cerebro/pre-compaction/<YYYY-MM-DD-HHmm>/<branch-slug>/`. Forma mínima: un JSON con `{ ref, originalTipOid, fuseGroups }`; los blobs ya están en `.git/objects/` (no se borran solos, ver caveat de GC). Si falla → `MCB-VER-026`, abortar antes de tocar refs.
3. **Reescritura.** Algoritmo lineal:
   - Walkear desde root del ref hacia HEAD construyendo nueva cadena de commits.
   - Para cada commit del log original:
     - Si está en `preservedOids`: cherry-pick conceptual (mismo tree, mismo mensaje, nuevo parent = último commit reescrito).
     - Si pertenece a un `FuseGroup`: skip todos menos el último del grupo; el "último" se reescribe con tree = tree del último commit original del grupo, mensaje = `auto-batch [<faceta>]: N commits (<bucketKey>)\n\nCompacted-From: <oid1>..<oidN>\n`, parent = último commit reescrito.
   - `git.writeCommit` para cada uno (no `git.commit`, ese stagea).
   - Al final, `git.writeRef({ force: true, value: newTipOid })`.
4. **Coordinación.** Toda la operación detrás de `FsLockService` (ver `branch-blob-ops.ts`, `merge.service.ts` para el patrón). `flushAll()` de `AutosaveService` antes.
5. **Errores.**
   - `MCB-VER-025` (compaction-failed): el fail genérico durante el rewrite.
   - `MCB-VER-026` (snapshot-failed): falla del snapshot antes de tocar refs.
   - `MCB-VER-027` (remote-divergence): no aplica en sesión 2 — entra en sesión 4.
6. **Tests.**
   - `compaction.service.spec.ts` con repo in-memory (mirar `git-fs.integration.spec.ts` para el patrón existente). Mínimo: aplicar un plan trivial (3 commits → 1 fuse → ref movido), verificar `Compacted-From` trailer, verificar snapshot escrito, verificar idempotencia (correr 2 veces sobre la rama ya compactada es no-op).

### Patrones del repo a respetar

- **Servicios:** `@Injectable({ providedIn: 'root' })`, inyectar `WorkspaceService`, `VersioningService`, `FsLockService`, `AutosaveService`. Patrón de adapter caché: ver `versioning.service.ts:28-46` (lazy `requireAdapter`, `resetForNewWorkspace`).
- **Errores:** `throw new AppError(ERROR_CODES.VER_025, { severity, context, recoverable })`. Códigos en `core/errors/error.codes.ts`; agregar las constantes nuevas ahí.
- **Plumbing sin checkout:** ver `branch-blob-ops.ts` y `tree-ops.ts`. `git.readCommit`, `git.writeCommit`, `git.writeRef` son los primitives.
- **Mensaje de commit fusionado:** subject `auto-batch [main]: N commits (YYYY-MM-DD)`. Trailer `Compacted-From: <oid1>..<oidN>` — definir formato exacto en sesión 2 (lista corta vs `oid-min..oid-max`).

### Caveats

- `versioning.service.ts log()` está limitado a `depth = 50` por default. Para compactación necesitamos el log completo del ref. Agregar un `logFull(ref)` nuevo o pasar `depth = Number.MAX_SAFE_INTEGER` — no romper el default seguro del existente.
- `git.writeCommit` requiere el shape exacto del objeto commit (`tree`, `parent`, `author`, `committer`, `message`). Ver cómo lo arma `merge-facetas.ts` (`buildMergeCommit`).
- isomorphic-git no expone `gc` sobre FS Access. Los blobs de los commits fusionados quedan huérfanos en `.git/objects/` hasta un prune manual (que probablemente nunca corre). Aceptable para v1; tracking como diferido si el bloat se vuelve real.
- Las barreras (`before-restore:`, `Merge-Group:`) ya las detecta el planner. El rewrite no necesita re-checkearlas, sólo respetar `preservedOids` tal cual viene.

## Lo que viene después (no es de esta sesión)

- **Sesión 3:** scheduler background con throttle 1×/día, detección de umbral 500 commits, settings toggle "compactar aunque haya remoto", persistencia. `MCB-VER-027` wirado contra `RemoteService` pero sin push.
- **Sesión 4:** UI (banner en `/history` cuando umbral cruzado y compactación off), integración real con `--force-with-lease` en `RemoteService`, dev panel para trigger manual.

## Verificación al cerrar la sesión

```bash
bun x vitest run src/app/core/versioning/compaction
bun run build
```

Ambos verdes. Hooks de commit corren eslint + prettier sobre staged; si fallan, fix el error real (no `--no-verify`).

## Reglas duras del repo

- TS strict, sin `any`, signals, OnPush, standalone.
- Files: soft 200 / hard 300 líneas. Si `compaction.service.ts` se acerca a 200, split.
- Sin cross-feature imports. Todo este trabajo vive en `core/versioning/`.
- UI español, código/commits inglés.
- Cualquier cambio arquitectónico actualiza `PROYECTO.md` en el mismo commit (regla §4.11.25). Sesión 1 no introduce cambios al doc — el algoritmo respeta la sección "Compactación del historial" ya escrita.
