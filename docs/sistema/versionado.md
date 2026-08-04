# Versionado y variantes

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Sistema combinado de autocommits + historial navegable + variantes (bifurcaciones nombradas del workspace) + comentarios y borradores anclados + sincronización remota con GitHub, construido sobre **isomorphic-git** con un adapter propio a la File System Access API. Ver también `docs/proyecto/features.md` §12 para la descripción a nivel de spec, y `docs/proyecto/reglas.md` §4 para las reglas transversales de arquitectura, errores, privacidad/red y concurrencia entre pestañas que este sistema respeta.

## Overview: por qué isomorphic-git sobre FS Access API

El workspace del usuario vive en disco real (File System Access API), no en un backend. Usar `isomorphic-git` con un adapter propio sobre esa API da versionado real (commits, ramas, tags, diff estructurado) sin servidor y sin mover los datos del usuario fuera de su máquina, manteniendo la promesa de privacidad del proyecto (§4.14 de `reglas.md`: cero llamadas de red salvo configuración explícita del usuario).

Cada operación de isomorphic-git sobre el adapter FS Access tiene un piso de ~100-200 ms por syscall del browser, lo que se traduce en commits de ~2-3 s para una sola entidad y ~6 s para 100 entidades simultáneas. Las operaciones de autocommit corren en background (costo invisible); las operaciones disparadas directamente por el usuario (switch de variante, merge, accept de un draft, crear/borrar variante) muestran una pantalla de carga con mensaje contextual mientras terminan — patrón estándar de clientes git, aceptado como costo del approach.

**Fallback descartado:** si el adapter hubiera resultado inviable (walk inicial demasiado lento), el plan de contingencia era degradar a snapshots por entidad en `.mi-cerebro/history/<kind>/<id>/<timestamp>.json` con la misma UI de timeline, sin soporte de variantes. El adapter pasó la validación de cierre y este fallback nunca se activó.

## Autocommit y timeline

`VersioningService` corre un timer (default 5 minutos, configurable) que evalúa si hubo cambios desde `HEAD` y commitea sólo si los hay. Triggers adicionales: cierre de entidad, cambio de feature, `visibilitychange` → hidden, y `beforeunload`. Throttle de 60 s entre commits aunque se apilen varios triggers seguidos; se salta el commit si no hay diff.

Antes de leer el estado del workspace, el autocommit hace `flushAll()` sobre `AutosaveService` para no commitear a mitad de una escritura, y tanto ese flush como el propio commit corren detrás del mismo mutex (`FsLockService`) que protege el resto de las operaciones de git — evita que dos escritores toquen el mismo `FileSystemDirectoryHandle` en paralelo.

`git init` se dispara automáticamente al detectar un workspace sin `.git/`. `.gitignore` se genera y mantiene automáticamente para excluir binarios pesados (`music/tracks/`, `images/*/original/`) y las redes de seguridad paralelas del propio sistema (`.mi-cerebro/recovery/`, `/pre-migration/`, `/trash/`, `.mi-cerebro/history/`).

### Pantalla `/history`

Timeline agrupada por bucket temporal (Hoy / Ayer / Esta semana / etc.) con diff visual por entidad: texto rico (TipTap) convertido a texto plano y comparado línea a línea con `jsdiff`; metadata como tabla antes→después; tags como chips +/–; binarios sólo muestran tamaño. El HEAD actual se marca con un indicador ("Actual") en la timeline. El footer del sidebar muestra "Último commit · hace 3 min" (el timestamp se reconstruye al arrancar desde `git.log({ depth: 1 })`, no depende de estado in-memory que se pierda con un F5).

### Restore

- **Por entidad:** botón en cada fila del diff, con confirmación; escribe el blob del commit elegido a la ruta actual.
- **Por commit completo:** confirmación fuerte tipeando el short-oid del commit, autocommit `before-restore: <hash>` previo como red de seguridad, y un commit final `restore: snapshot completo desde <short>` que aplica el walk de los dos trees. Siempre reversible.

### Errores

`MCB-VER-001..003`.

## Milestones nombrados

Resuelven "no me encuentro en el océano de autocommits": el usuario nombra un commit específico como hito (ej. "antes de refactor X", "borrador 3 entregado"). Un milestone es un **git tag anotado real** (`refs/tags/<slug>`) — un ref persistente, separado del log de commits, no una fila más de la timeline.

`MilestoneService` expone `create(oid, name, description?)` (usa `git.annotatedTag` para poder guardar el mensaje del usuario, no sólo el ref), `list()`, `rename()` (delete + recreate sobre el mismo oid), `delete()`, `moveTo()`. El slug del tag sale del nombre saneado (espacios → guiones, minúsculas, ASCII). `HistoryService` expone `milestonesByOid` para que la timeline pinte los chips.

En `/history`: botón "Marcar este punto" en el detail-head de un commit (junto a "Restaurar todo este commit"); un toggle "Sólo milestones" colapsa el resto de los autocommits; los milestones se muestran como banda/separador con borde de acento sobre el commit marcado, no como fila independiente.

**Nombres únicos por diseño.** Si el usuario intenta crear o renombrar un milestone con un nombre que ya existe, el flujo se interrumpe y ofrece: (1) usar otro nombre, (2) mover el milestone existente a este commit, (3) cancelar. Se descartó el auto-sufijo `(N)` estilo Windows (miente sobre el estado real tras renombres/borrados posteriores) y permitir duplicados con slug interno por oid (rompe la búsqueda por nombre, que es el valor central del feature).

Los tags viven en `.git/refs/tags/` y viajan con el push a GitHub cuando el remoto está configurado.

### Errores

`MCB-VER-017..018`.

## Variantes (familias de 3 ramas)

Una variante visible para el usuario es, internamente, una **familia de tres ramas git** gestionada en bloque: `main` (o `variant/<slug>/main`), `draft` y `comments`. Borrador y comentarios son facetas permanentes de cada familia — se crean junto con la variante y se borran con ella; no existen sueltas.

`.mi-cerebro/variants.json` es la fuente de verdad, con schema versionado: id, nombre, color, `protected`, `lastActivityAt`, refs de las 3 ramas, `state: 'active' | 'dormant'`.

`VariantsService` (`core/versioning/`) expone `list`, `create(name, color, fromVariantId?)`, `delete(id)`, `read(id)`, `getActiveId`, `setActiveId`.

**Creación atómica de la tripla.** Crea `variant/<slug>/main`, `variant/<slug>/draft` y `variant/<slug>/comments`, bifurcando cada una de su faceta hermana en la familia origen (por default, Principal). Si cualquiera de las 3 falla, rollback completo: las ramas que sí llegaron a crearse se borran y `variants.json` no se escribe.

**Eliminación atómica.** La entrada se marca `pending-delete` en `variants.json` antes de tocar ninguna rama; si el `git branch -D` de las 3 falla a mitad de camino, la entrada queda `pending-delete` para reintento automático en el próximo arranque, en vez de dejar ramas huérfanas.

### Errores

`MCB-VER-004` (crear variante falló a mitad de camino), `MCB-VER-005` (borrar falló), `MCB-VER-006` (`variants.json` ilegible o de schema incompatible — degrada a Principal-only con opción de restaurar desde `.mi-cerebro/pre-migration/`).

### Switch de variante activa

El switch es el punto más delicado del sistema porque toca el filesystem, el índice de búsqueda y los locks por entidad a la vez. Flujo, bajo `FsLockService` de punta a punta para no cruzarse con un autocommit en vuelo:

1. `AutosaveService.flushAll()` — no deja escrituras pendientes.
2. `VersioningService.commitAll('auto: pre-switch-variant <from> → <to>')` — aterriza el dirty de la variante saliente.
3. `git.checkout({ ref: 'variant/<to>/main', force: true })`.
4. `VariantsService.setActiveId(to)` — se persiste antes del rebuild del índice, así un fallo del rebuild no deshace el switch.
5. Re-carga del índice de búsqueda (`idx-<to>-main` desde IndexedDB, rebuild si no existe) y refresh de todos los feeds de entidades desde disco (`WorkspaceRefreshService.refreshAll()`).

Mientras el switch corre, un overlay contextual muestra "Cambiando a variante {nombre}…" (operación de ~3-6 s según tamaño del repo).

**Sincronización entre pestañas.** `BroadcastChannel('mc-variants')` emite `{type: 'switched', variantId, requestedAt}`. Las pestañas hermanas que reciben el mensaje: si tienen una entidad abierta, pasan a modo lectura con un banner inline no-cerrable ("Otra pestaña cambió a la variante {X}. Recargar para continuar."); si están en una vista sin entidad abierta, recargan en silencio.

**Recuperación de crash mid-switch.** `variants.json.activeId` es la fuente de verdad; al arrancar, si `git.currentBranch()` no coincide con `activeId`, la app hace un checkout silencioso para realinear (`alignWithGit()` corre en el boot del app-shell).

La pill de variante activa en el sidebar (color de familia + nombre) es el trigger de un dropdown para cambiar de variante, con "Gestionar variantes…" al final que abre `/variants`.

### Errores

`MCB-VER-007` (switch falló durante flush o commit pre-switch), `MCB-VER-008` (checkout falló — el workspace queda en la variante de origen), `MCB-VER-009` (el índice no pudo cargarse — el switch se completa pero la búsqueda queda deshabilitada hasta un rebuild manual).

### Lifecycle de variantes en reposo

`lastActivityAt` de una familia es el máximo `committer.timestamp` del HEAD de sus 3 ramas — editar sólo el borrador o sólo comentarios mantiene viva a la variante. Si `now - lastActivityAt` supera `dormantThresholdDays` (default 30, configurable en `/settings`, campo `SettingsService.state().variants.dormantThresholdDays`), la variante pasa a `state: 'dormant'`. Principal está exenta del lifecycle y nunca se borra.

### Pantalla `/variants`

Tres secciones: **Activas** (orden por `lastActivityAt` descendente), **Principal** (permanente), **En reposo** (con CTAs "Mergear" y "Eliminar"). Permite crear variante con formulario (nombre, color, "forkear desde {activa}" por default), renombrar (modifica `variants.json` y renombra las 3 ramas atómicamente, con rollback), y eliminar con confirmación — si la variante tiene commits no mergeados contra Principal, ofrece exportar a ZIP antes de borrar. El rail-icon del sidebar es 🌿 "Variantes".

## Merge entre variantes

Pantalla `/variants/merge?from=X&into=Y`: tabla de entidades que difieren entre las familias `X` e `Y`, con path, status (`modified` / `added-in-X` / `added-in-Y` / `deleted-in-X` / `deleted-in-Y`) y preview corto del contenido.

Por entidad: "← Quedarme con esto de X" / "→ Quedarme con esto de Y" / "Saltar" (no toca destino). Atajos masivos "Todo de X →" / "← Todo de Y" con confirmación. La unidad de elección es el **bundle de las 3 facetas** de la entidad (main + comentarios anclados + diff-marks pendientes) aplicadas a la vez a la familia destino; granularidad por faceta individual es una opción avanzada, no preseleccionada.

**Aplicación.** Un commit por faceta afectada en `main` (y, si corresponde, en `comments`/`draft`) de la variante destino, todos compartiendo el trailer `Merge-Group: <uuid-de-esta-sesión>` — `/history` los agrupa visualmente como una sola operación (fila colapsable "Merge: N entradas desde X hacia Y"). El merge de comentarios y drafts es aditivo y best-effort: si la entidad tiene `comments/<id>.json` o `drafts/<id>.json` en la faceta de origen y difiere de destino, se replica con el mismo trailer más `Merge-Facet: comments|draft`; nunca borra lo que ya existe en destino si origen no tiene nada.

**Manejo de fallo parcial.** Si el commit N falla, los N-1 anteriores quedan aplicados — no hay reversión automática. La UI reporta "merge parcial: aplicadas N-1 de M, falló en {entidad}" con opciones reintentar / continuar saltando / cancelar el resto.

**Red de seguridad.** Antes del primer commit de la sesión, autocommit `pre-merge: <X> → <Y>` en la variante destino (mismo patrón que `before-restore`). La variante origen nunca se borra como parte del merge — eliminarla es una acción separada en `/variants`.

### Errores

`MCB-VER-010` (merge falló durante el commit), `MCB-VER-011` (la entidad cambió externamente entre la preview y el commit), `MCB-VER-012` (trailer `Merge-Group` inconsistente dentro del grupo aplicado).

## Comentarios anclados

La rama `comments` de cada familia no guarda copias de entidades: guarda anotaciones referidas por anchor a contenido de la rama `main` de la misma familia.

**Anclaje estable.** Una extensión TipTap (`mcBlockId`) asigna un UUID estable a cada nodo top-level (párrafo, heading, blockquote, codeBlock, listItem, horizontalRule), persistido como atributo `data-block-id`. Es la única forma de que un anchor sobreviva a ediciones posteriores del documento. Un migration step compartido rellena block-ids en documentos preexistentes.

**Forma en disco.** `comments/<entityId>.json` con schema versionado (`schemaVersion: 1`), array de `{id, anchorType, anchor, body, createdAt, orphaned}`. `anchorType` soportados: `entity` (comentario sobre toda la entidad) y `block` (nodo específico); `range` (porción de texto dentro de un bloque) existe como campo opcional aditivo (`Comment.range?: {from, to}`) para casos donde el comentario se ancla a una selección puntual, sin requerir bump de schema — comentarios viejos sin `range` siguen renderizando al final del bloque. El re-mapeo de esos offsets ante ediciones posteriores del bloque no está implementado (quedan congelados al valor de creación, con clamp para evitar el caso patológico); un `range` que cruza varios párrafos cae al anchor de tipo `block`.

**Position tracking.** Cada vez que se edita `main`, se recorren los ProseMirror steps y se remapean las posiciones de todos los anchors de `comments` y `draft` para esa entidad. Los anchors que quedan sin bloque referido se marcan `orphaned: true`; nunca expiran solos, el usuario decide re-anclar o eliminar. Los anchors de tipo `entity` nunca son huérfanos.

**Lectura/escritura sin checkout.** `CommentsService` (`core/versioning/`) opera sobre la rama `comments` vía plumbing puro de isomorphic-git (`branch-blob-ops.ts`: lee el HEAD del ref, camina el tree, escribe blob + reconstruye tree + commit + ref) sin nunca hacer checkout de esa rama. `read(entityId)` devuelve el `CommentsFile` (vacío si no hay nada aún); `save(entityId, entityTitle, comments)` corre bajo el mismo mutex que el autocommit y commitea con prefijo `auto [comentarios]: <título> (N comentarios)`.

### UI actual: nubes inline

La UI original de comentarios usaba un panel lateral fijo; fue reemplazada por una vista combinada (ver más abajo) y ya no existe. En la forma actual: al seleccionar texto en la vista `combined`, un bubble menu flotante ofrece "Comentar"; confirmar en el popover anclado a la selección deja una **nube SVG clickable inline** justo después del span comentado, en tono atenuado (variable CSS `--comment-accent`), sin highlight ni subrayado permanente sobre el texto salvo cuando el comentario tiene `range`: en ese caso se agrega una decoración inline con clase `.mc-comment-range` (borde inferior punteado). Click sobre la nube reabre el popover en modo lectura/edición. La lista navegable de comentarios pendientes/huérfanos de la entidad vive en un popover invocable desde la barra del editor, no en un panel fijo.

Alta y baja son optimistas: la mutación se refleja en la UI al toque, y la persistencia (`CommentsService.save`) corre en background con revert + reporte de error si falla.

### Errores

`MCB-VER-019` (falla de lectura/escritura del plumbing o falta workspace/variante), `MCB-VER-020` (archivo ilegible o de schema futuro), `MCB-VER-021` (anchor inválido — el bloque referido ya no existe).

## Borrador anclado (track-changes)

La rama `draft` de cada familia tampoco guarda copias completas: guarda **diff-marks pendientes** sobre `main` de la misma familia.

**Modelo.** `drafts/<entityId>.json` con schema versionado, array de `DiffMark`: `{id, anchorType: 'block' | 'doc', anchor, before, after, status: 'pending' | 'accepted' | 'rejected', createdAt, updatedAt}`. Sólo `pending` se persiste en la práctica — accept/reject son operaciones que mutan la lista, no estados de reposo.

`DraftsService` (`core/versioning/`) es un mirror estructural de `CommentsService`: `read(entityId)` / `save(entityId, entityTitle, marks)` sobre la rama `draft` vía el mismo plumbing sin checkout, bajo el mismo mutex que el autocommit, con prefijo de commit `auto [borrador]: <título> (N cambios)`.

**Creación por acción puntual sobre selección.** No existe un "modo borrador" global ni un toggle persistente por entidad. En la vista `combined`, seleccionar texto (o posicionar el cursor) y elegir "Proponer cambio" en el bubble menu abre una captura en vivo: lo que se tipee hasta salir (Esc o click fuera) se guarda como un `DiffMark` pendiente. Toda edición fuera de ese flujo va directo a `main` como siempre.

**Renderizado inline en vivo.** Mientras se captura un diff-mark, y para todos los pendientes ya guardados, decoraciones ProseMirror muestran inserciones en verde y borrados tachados en rojo sobre el documento real — no hay panel lateral persistente. La lista navegable de marks pendientes vive en un popover invocable desde la barra del editor, con vista side-by-side "Antes/Después" en dos columnas clickables: click en una columna decide qué lado queda, sin confirmación adicional (la elección del lado ya es la confirmación).

**Aceptar** aplica el `after` al documento (`applyMarkToDoc`, reemplazo/append/drop top-level por block-id), persiste el cambio como edición normal de la entidad, y agenda un commit `accept-draft: <título> (N cambios)` — nunca pisa historia, el draft se remueve del archivo tras confirmarse el commit. **Rechazar** remueve la mark sin generar commit en `main`.

Igual que comentarios, alta/baja son optimistas con revert en background ante fallo.

**Fuera de alcance:** ghost rendering inline para inserciones puras (sin anchor visible en el doc todavía) — se muestran sólo en el popover de pendientes, no inline.

### Errores

`MCB-VER-022` (falla de lectura/escritura del plumbing), `MCB-VER-023` (archivo ilegible o schema futuro), `MCB-VER-024` (anchor inválido).

## Vista combinada del editor

El editor tiene dos vistas sobre la misma rama `main` de la variante activa, alternables con un control segmentado siempre visible en la barra del editor:

- **`clean`** — sólo `main`, sin ninguna marca de comentario o borrador visible.
- **`combined`** — `main` + comentarios + diff-marks de borrador coexistiendo, con apariencia visual distinta entre sí (nubes atenuadas para comentarios, verde/rojo para diff-marks).

Este diseño reemplazó un esquema anterior de tres controles independientes (botón Comentarios, toggle "modo borrador", botón Borradores) que obligaba a alternar entre modos y fragmentaba la edición en momentos separados. La creación de comentarios y drafts pasó de esos toggles globales a ser una **acción puntual sobre selección** desde el bubble menu flotante que aparece al seleccionar texto, con atajos de teclado complementarios.

**Auto-switch a `combined`.** Si el usuario dispara "Comentar" o "Proponer cambio" estando en `clean`, la app cambia sola a `combined` y ejecuta la acción — no bloquea, no pregunta.

El schema en disco de `comments/` y `drafts/` no cambió con este rediseño (mismos anchors `entity`/`block`); sólo cambió la UI que los expone. No se agregaron códigos de error nuevos — el rediseño reusa `MCB-VER-019..024`.

## Sincronización remota con GitHub

Primera fase de apertura de red del sistema — sigue vigente la regla §4.14 de `reglas.md`: cero llamadas de red salvo configuración explícita del usuario.

**Auth.** El usuario pega un Personal Access Token (PAT), persistido en `.mi-cerebro/secrets.json` (agregado automáticamente al `.gitignore`). Desde 13e-ii el token se cifra at-rest (AES-GCM) con una clave no-extraíble por dispositivo guardada en IndexedDB (`pat-crypto.ts`) — sin passphrase, protege contra copiar/respaldar la carpeta del workspace sin ese perfil de navegador, no contra acceso completo al navegador. Archivos previos con token en plano se migran solos al leerlos.

**Modelo del remoto.** El remoto replica fielmente el estado local: todas las variantes × sus 3 ramas (`main` + `comments` + `draft`). Funciona como backup remoto end-to-end — levantar en otro dispositivo trae entidades, comentarios y borradores completos.

`RemoteService` (`core/versioning/`) expone:

- `configure({url, token})` — valida formato y persiste en `secrets.json`.
- `push({refs})` / `pushAll()` — pushea refs puntuales o `variants × {main, comments, draft}` completo, con outcome por-ref (`ok` | `up-to-date` | `error`).
- `fetchAll()` — trae cada ref remoto a `refs/remotes/origin/<branch>`.

Push y fetch usan `isomorphic-git/http/web` con header `Authorization: token <pat>`, a través de un proxy CORS público (`cors.isomorphic-git.org`) con warning visible en la UI de que no es proxy propio. Ambas operaciones corren bajo `FsLockService` para no cruzarse con un autocommit, y muestran loading screen contextual (~10-30 s con varias variantes).

### Pantalla `/sync`

Tabla de refs (path local, status, última sincronización) con botones "Push todo" / "Fetch todo", toggle de auto-push tras autocommit, slider de throttle, indicador de estado actual.

### Divergencia y hand-off a merge

En cada fetch, se compara `localTip` contra `refs/remotes/origin/<branch>` por ref; si ninguno es ancestro del otro, es divergencia (`classifyTip` puro clasifica fast-forward / behind / divergent / unrelated). `RemoteService.divergentRefs` lista las refs afectadas. Un banner global no-cerrable en el shell informa "Hay cambios remotos divergentes en N rama(s)" y navega a `/variants/merge?incoming=remote`, donde la pantalla de merge reconoce refs remotas como source candidates (combo "Desde: [variante local] | remote/`<branch>`"). Resolver el merge produce commits normales en la variante destino, que luego se pushean. Mientras haya divergencia pendiente, "Push todo" queda deshabilitado.

### Auto-push throttled

Controlado por dos settings: `versioning.pushAfterAutocommit` (boolean, default `false`) y `versioning.pushThrottleMinutes` (default 5). Un push automático se dispara sólo si el toggle está ON, pasó el throttle desde el último push, no hay divergencia pendiente y no hay push ya en vuelo (`decideAutoPush` puro resuelve `push` / `skip-disabled` / `skip-not-configured` / `skip-divergent` / `skip-in-flight` / `skip-throttle`).

Un indicador de estado (dot) en el sidebar/footer resume el estado del remoto: verde "sincronizado", amarillo "pending push", rojo "divergente", oculto si no hay remoto configurado.

### Errores

`MCB-NET-001` (config ausente o PAT/URL inválidos), `MCB-NET-002` (auth falló, 401/403), `MCB-NET-003` (push falló por red u otro error genérico), `MCB-NET-004` (push parcial — N de M refs fallaron), `MCB-NET-005` (fetch parcial), `MCB-NET-006` (divergencia detectada en fetch), `MCB-NET-007` (push post-merge rechazado por race con otro dispositivo), `MCB-NET-008` (auto-push saltado porque ya había un push en vuelo).

## Fuera de alcance / diferido

Proxy CORS propio (se usa el público de isomorphic-git); ghost rendering inline de inserciones puras de borrador; granularidad por faceta como opción por default en el merge (existe como opción avanzada); re-mapeo de offsets de `range` en comentarios ante ediciones del bloque.
