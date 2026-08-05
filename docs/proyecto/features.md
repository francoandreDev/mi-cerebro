# Especificación de features: búsqueda, editor, versionado, objetivos, recordatorios, calendario, música, temas (§10-17)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

## 10. Búsqueda y navegación

### Árbol con filtro (visual)

Vista de árbol expandible. Caja de filtro arriba que **resalta coincidencias y colapsa lo que no matchea**. El nivel que matchea se abre automáticamente. Si hay varias coincidencias:

- Por defecto, foco en la **más cercana al nodo actual**.
- El usuario puede elegir dirección: **arriba del árbol**, **abajo del árbol**, **general**.
- Lista de coincidencias navegable con teclado para saltar entre ellas.

### Búsqueda global

- Por texto en contenido, por nombre, por tag.
- Filtros por tipo de entidad y por tag combinables.
- Resultados con preview.
- **Índice incremental persistido en IndexedDB** (MiniSearch o Lunr). Se construye una vez al inicializar la carpeta raíz y se actualiza en cada save/borrado/renombrado. Búsqueda instantánea sin tocar el disco. Botón "reindexar" para rebuild manual si se corrompe.

### Continuidad

Al abrir la app: vuelve a la última ruta + última entidad abierta + scroll. Esto se guarda en `localStorage`.

---

## 10bis. Conexiones y backlinks entre entidades

Cierra la idea 4 de `docs/evolution.md` ("editor sin comprensión de conexiones") y dos ítems de `docs/deferred/`: "Referencias/links entre entidades desde el editor" (`shortcuts-cross-section.md`) e "Hilos entre items relacionados" (`files-writings-tasks.md`, rediseño cork board de `/files`). Diseño cerrado 2026-07-31; implementación en roadmap ítem 27 (`roadmap-27-conexiones.md`).

Una **conexión** es genérica: no le importa de qué tipo son las dos entidades que une.

```ts
EntityRef = { kind: EntityKind; id: string }
Relation = {
  id: string;
  from: EntityRef;
  to: EntityRef;
  origin: 'editor' | 'manual';
  contextSnippet?: string; // sólo origin:'editor' — frase donde nació el link, congelada al crear
  createdAt: string;
}
```

- **Storage centralizado, no embebido:** `.mi-cerebro/relations.json` (`{ schemaVersion, relations: Relation[] }`), mismo molde que `tags.json` — un backlink es un `filter` sobre el array, no un escaneo de todas las entidades. Escritura atómica + mismo `FsLockService` que ya serializa autocommits y switch de variante (evita carreras multi-pestaña).
- **Resolución de título/ruta sin duplicar infra:** `Relation` no guarda ni título ni ruta del extremo — eso ya lo tiene el índice de búsqueda de §10 (`.mi-cerebro/index/index.json`, un `IndexEntry` por entidad de cualquier kind). El panel de conexiones y el picker resuelven contra ese índice en el momento de renderizar. Consecuencia: **no hace falta un flag `orphaned` persistido** (a diferencia de los anchors de comentarios en §12) — si `IndexService.getById(kind, id)` no devuelve nada, la conexión se muestra como rota en vivo, sin estado propio que mantener.
- **`core/relations/`** (`RelationsService`, `relations-storage.ts`, `relations.types.ts`): `outgoingFor(ref)`, `backlinksFor(ref)`, `create()`, `remove()`. Sin conocimiento de features — sólo IDs y kinds, igual que `core/tags/`.

### Vincular desde el editor

- Nueva extensión TipTap `core/tiptap/entity-ref/` (mismo molde que `image-ref/`): nodo inline `entityRef` con attrs `{kind, id, label}`, persistido como `<span data-entity-ref data-kind="..." data-id="..." data-label="...">` — sobrevive a copy/paste y a búsqueda de texto plano, igual que `image-ref`.
- **Botón fijo "Vincular a…" en la barra del editor** (mismo lugar que "Insertar imagen", siempre visible, no depende de la vista Combinada ni de tener texto seleccionado — decisión tomada tras feedback de usuario, ver roadmap ítem 27 Fase 6: el punto de entrada original, sólo en la bubble menu de la vista Combinada, era indescubrible). Con selección, envuelve el texto elegido; sin selección, inserta el chip en el cursor. La bubble menu sobre selección de texto también ofrece "Vincular a…" como atajo rápido (§11) — dos caminos al mismo flujo. Abre `shared/entity-link-picker/` (dumb component) que busca sobre el **mismo índice de §10** — sin índice nuevo. Inserta el nodo `entityRef` (envolviendo la selección, o en el cursor si no hay selección) + `RelationsService.create({ from: <entidad activa>, to: <elegida>, origin: 'editor', contextSnippet: <texto de la selección, vacío si no había> })`.
- El nodo renderiza como **chip navegable** (pill, mismo lenguaje visual que un chip de prioridad/tag ya usado en la app), no como link crudo subrayado. Click resuelve la ruta actual contra el índice y navega.

### Panel "Conexiones" en el detalle de cada entidad

`shared/connections-panel/` (dumb, recibe `outgoing`/`backlinks` ya resueltos por el container — mismo patrón smart/dumb de regla §4.5), montado en el detalle de notas, escritos, listas, tareas, metas, archivos e imágenes. Dos grupos:

- **Salientes** — relaciones creadas desde esta entidad (origin `editor` o `manual`).
- **Referenciado desde** — backlinks: todo lo que apunta a esta entidad, sin que el usuario tuviera que declararlo en ambos lados. Cada card muestra el `contextSnippet` (si `origin:'editor'`) con la frase vinculada resaltada, o "vinculado manualmente" (si `origin:'manual'`), + acción de desvincular.

### Hilos manuales en `/files` (sin pasar por texto)

Resuelve el ítem diferido del rediseño cork board: arrastrar una tarjeta de `FileItem` sobre otra en el tablero crea una `Relation` `origin:'manual'` directamente (sin picker — el destino ya está a la vista), con popover opcional para nombrarla (se guarda en `contextSnippet`, reusado como label libre en este caso). Se renderiza como un hilo (SVG) entre las dos posiciones del tablero. No hace falta un grafo propio de `FileItem`/`FileCollection` — es el mismo `RelationsService` que usa el editor.

### Mapa de conexiones (grafo de 1 salto)

Botón "Ver en el mapa" en el panel "Conexiones" (no un ítem nuevo en el rail lateral ni una pestaña
en `/tags` — decisión tomada preguntando al usuario, no asumida) abre un diálogo (`shared/connections/connections-graph-overlay.component.ts`) centrado en la entidad activa: círculo central + sus
vecinos directos (salientes + backlinks fusionados por par, línea distinta si hay ambas direcciones)
en SVG puro, mismo lenguaje visual que la constelación de metas (§13) — sin física de
repulsión/springs, posiciones por ángulo determinístico alrededor del centro. Click en un vecino no
navega, **recentra el grafo sobre él** ("caminar" el grafo, con pila de historial para "Volver");
navegar de verdad es un botón "Abrir" aparte, siempre sobre la entidad central actual. Deliberadamente
1 salto, no el grafo completo del workspace — ver "Qué queda afuera" abajo.

### Qué queda afuera de este corte

- **Grafo completo del workspace con layout de fuerzas.** El mapa de 1 salto (arriba) es caminable
  pero no un mapa global — graficar todo el workspace sin física de repulsión/springs sería un
  hairball ilegible, y agregar esa física es mucho más código para un caso de uso que "caminar
  desde acá" ya cubre.
- **Sugerencias automáticas** (por tags compartidos o similitud vía MiniSearch). Es la capa "inteligente" real de la idea 4 de `evolution.md`, deliberadamente pospuesta hasta validar si vínculo manual + backlink ya resuelve el dolor real de uso.
- **Kinds vinculables en el primer corte:** notas, escritos, listas, tareas, metas, archivos, imágenes — los que tienen vista de detalle. Recordatorios y música (tracks/playlists) quedan afuera por ahora (sin vista de detalle equivalente donde anclar el panel).

---

## 11. Editor de escritura

Editor **híbrido tipo WYSIWYG**: el usuario ve siempre el resultado renderizado, no sintaxis.

Características:

- Formato básico: negrita, cursiva, subrayado, tachado, encabezados, listas, citas, código.
- **Highlighting personalizable**: el usuario define colores para fechas, números, texto plano, etc. Combina reconocimiento automático (tipo highlighting de lenguaje) con override manual desde la UI (tipo Word). Los esquemas de color custom se guardan en IndexedDB.
- Inserción de imágenes desde la galería (referencia, no embed).
- Inserción de links internos a otras entidades, como chip navegable vía "Vincular a…" en el bubble menu (ver §10bis).
- Autosave continuo.

**TipTap** sobre ProseMirror. Integración Angular vía wrapper (`ngx-tiptap` o envoltorio propio). El highlighting personalizable se implementa como extensiones custom.

### Estadísticas de escritura en vivo

Contador simple, sin series temporales: por cada alcance (capítulo, libro, global — todos los libros) se guarda **récord** (mejor día histórico), **actual** (palabras netas escritas hoy) y **promedio** (ponderado, solo sobre días con actividad real). Todo se deriva del evento de guardado ya existente (autosave → `saveChapter`), no hay tracking en vivo mientras se tipea. El corte de día usa el timezone configurado en Ajustes. Persistencia: `stats` embebido en `_book.json`/capítulo para los alcances libro/capítulo; alcance global en `.mi-cerebro/writing-stats.json` (`core/writing-stats/`).

---

## 12. Versionado, variantes e historial

Sistema combinado de autocommits + **variantes** (ramas renombradas en UI) + panel de historial navegable, sobre **isomorphic-git** con adapter propio a File System Access API. El export ZIP (paso 14) coexiste como snapshot manual rápido fuera del flujo git.

### Autocommits

- Timer cada N minutos (default 5, configurable) que evalúa si hubo cambios desde `HEAD` y commitea sólo si los hay. Triggers adicionales: cierre de entidad, cambio de feature, `visibilitychange` → hidden, `beforeunload`. Throttle de 60s entre commits aunque se apilen triggers.
- Mensaje derivado del staging: `auto: 3 notes, 1 task (2026-06-10 14:32) [trigger-reason]`. El sufijo `[reason]` registra qué trigger lo disparó (`timer`, `feature-change`, `entity-close`, `visibility`, `beforeunload`, `manual`) para diagnóstico. Cada autocommit lleva prefijo de faceta para que la timeline entremezclada sea legible: `auto: …` (main), `auto [borrador]: …`, `auto [comentarios]: …`.
- `.gitignore` automático para binarios pesados (`music/tracks/`, `images/*/original/`) y para las redes de seguridad paralelas (`.mi-cerebro/recovery/`, `/pre-migration/`, `/trash/`, `.mi-cerebro/history/`). Toggle global "incluir binarios en historial" off por default; si se prende, advertencia de bloat.
- **Coordinación con autosave**: el autocommit hace `flushAll()` sobre `AutosaveService` antes de leer la `statusMatrix`, así el commit ve el workspace quiescente. Tanto el `onFlush` de autosave como `commitAll` corren detrás del mismo mutex (`FsLockService`), lo que previene el `InvalidStateError` que dispara Chromium cuando dos escritores cruzan el mismo `FileSystemDirectoryHandle` en paralelo.
- **Recuperación de estado tras recarga**: `lastCommitAt` (el timestamp visible en el footer) es in-memory; al arrancar el servicio lee `git.log({ depth: 1 })` y reconstruye el valor desde el commit más reciente del repo. Sin esto el footer mentía con "Sin commits aún" después de un F5.

### Variantes como familias de 3 ramas

Una variante visible al usuario es internamente una **familia de tres ramas git** que se gestiona en bloque:

| Variante visible | Rama main        | Rama borrador             | Rama comentarios             |
| ---------------- | ---------------- | ------------------------- | ---------------------------- |
| Principal        | `main`           | `variant/principal/draft` | `variant/principal/comments` |
| Variante X       | `variant/<slug>` | `variant/<slug>/draft`    | `variant/<slug>/comments`    |

`.mi-cerebro/variants.json` lleva el registro: id, nombre legible, color, `protected`, `lastActivityAt`, refs de las 3 ramas, **`parentId` y `forkOid`** (linaje, schema v2). Borrador y Comentarios son **facetas permanentes de cada familia**: se crean junto con la variante, se borran con ella, no existen sueltas. Principal nunca se borra.

- **Crear variante** = bifurcar las 3 ramas a la vez, cada una forkeada de su faceta hermana en la familia origen. No se arranca con borrador/comentarios vacíos: se heredan los actuales. Forkear el contexto entero, no sólo lo definitivo.
- **Borrar variante** = `git branch -D` sobre las 3 + remover entrada. Una sola acción del usuario; si tenía commits no mergeados, warning con opción de exportar a ZIP antes.
- **Linaje persistido (schema v2).** Cada variante guarda `parentId` (id del padre; `null` sólo para Principal) y `forkOid` (OID del `main` del padre al momento del fork; `null` cuando es desconocido). Se capturan en `create()` y permiten que `/variants` muestre "Sale de X en `abc1234`" sin recalcular la merge-base contra todos los heads. Migración v1→v2 inline al leer `variants.json`: las variantes preexistentes quedan con `parentId: 'principal'` y `forkOid: null` ("origen desconocido"); a partir de v2 ambos campos se llenan honestamente.

### Comentarios anclados (rama `comments`)

La rama comentarios **no guarda copias de entidades**. Guarda anotaciones referidas por anchor a contenido en `main` de la misma familia.

- Forma en disco: `comments/<entityId>.json` con array `{id, anchorType, anchor, body, createdAt, orphaned}`.
- `anchorType` soportados desde 13c: `entity` (toda la entidad) y `block` (un nodo TipTap por id estable). `range` (porción de texto dentro de un bloque) queda diferido a pulido posterior (ver `docs/deferred/index.md`).
- **IDs estables de bloques:** extensión TipTap que asigna UUID a cada nodo top-level (párrafos, headings, list items, etc.) al crearlo, persistido como atributo del nodo. Es la única forma de tener anchors que sobrevivan a ediciones; coste ~5% en tamaño del JSON, aceptable.
- Anchors que quedan invalidados por ediciones que borran el bloque referido se marcan `orphaned: true`. Aparecen en una sección de revisión invocable (popover, no panel fijo). **Nunca expiran solos:** el usuario decide re-anclar o eliminar.
- **UX de creación e indicación visual.** En la vista combinada (ver "Switch de variante activa") el usuario selecciona texto y el bubble menu flotante ofrece "Comentar"; al confirmar el contenido en el popover anclado a la selección, el span comentado queda con una **nube clickable inline** justo después, en tono atenuado (variable CSS `--comment-accent`, gris desaturado del tema; sin highlight ni subrayado sobre el texto). Click sobre la nube reabre el popover en lectura/edición. La nube es un `<button>` con foco visible y `aria-label` i18n. Atajo de teclado complementario (a definir en implementación).

### Borrador anclado (rama `draft`, track-changes)

La rama borrador tampoco guarda copias completas. Guarda **diff-marks pendientes** sobre `main` de la misma familia.

- Forma en disco: `drafts/<entityId>.json` con array `{id, anchor, before, after, status: 'pending'|'accepted'|'rejected', createdAt}`.
- **Creación por acción puntual sobre selección.** No hay "modo borrador" global ni toggle por entidad. En la vista combinada el usuario selecciona texto (o pone el cursor en un punto) y el bubble menu flotante ofrece "Proponer cambio"; lo que tipee hasta salir (Esc o click fuera) se captura como diff-mark pendiente en la rama `draft`. Toda edición fuera de ese flujo va directo a `main` como siempre. Atajo de teclado complementario (a definir en implementación).
- **Renderizado inline en vivo (track-changes).** Mientras se captura un diff-mark, y para todos los pendientes ya guardados, el editor muestra inserciones en verde y borrados tachados en rojo sobre el doc real vía ProseMirror decorations. No hay panel lateral persistente; la lista navegable de pendientes vive en un popover invocable.
- **Aceptar un diff-mark:** genera un commit nuevo en `main` de la familia (`accept-draft: <entidad> (N cambios)`). Nunca pisa historia. El draft pasa a `status: 'accepted'` y desaparece de la vista.

### Position tracking

Cada vez que se edita `main`, se recorren los ProseMirror steps y se mapean las posiciones de todos los anchors (de la rama `comments` y de la rama `draft`) para esa entidad. Persistencia automática en las ramas correspondientes vía isomorphic-git plumbing (sin checkout de esas ramas).

### Switch de variante activa

- Una sola variante activa por workspace. Estado: `{family, view}` donde `view ∈ {'clean', 'combined'}`. `clean` muestra sólo la rama `main` de la familia activa, sin marcas; `combined` muestra `main` + comentarios + diff-marks de borrador coexistentes con apariencia distinta entre sí (ver "Comentarios anclados" y "Borrador anclado"). El usuario alterna con un control segmentado siempre visible en la barra del editor.
- **Auto-switch a `combined`** cuando el usuario intenta crear un comentario o un draft desde `clean`: la app cambia sola de vista y dispara la acción. No bloquea, no pregunta.
- Cambio de variante: commit forzado de dirty en la familia saliente + `git checkout` a `main` de la familia entrante + invalidación del índice + carga del índice por familia desde IndexedDB.
- BroadcastChannel sincroniza otras pestañas a la nueva variante; si rehúsan, entran en modo lectura con banner (reusa la maquinaria del paso 8).
- **Borrador y comentarios nunca aparecen como archivos en el FS del usuario.** Viven exclusivamente en `.git/`, leídos/escritos vía isomorphic-git plumbing sin checkout. El FS siempre refleja `main` de la variante activa.

### Lifecycle de variantes en reposo

- `lastActivityAt` de cada familia = el más reciente `lastActivityAt` de sus 3 ramas. Editar sólo el borrador mantiene viva a la familia.
- Default 30 días sin actividad → `state: 'dormant'`. Configurable en settings. **Nunca borra sola**, sólo cambia de sección visual.
- Principal está exenta. Las familias del usuario pueden entrar en reposo; en `/variants` aparecen agrupadas aparte con CTA "Mergear" y "Eliminar".

### Merge entre variantes

Pantalla dedicada (`/variants/merge?from=X&into=Y`).

- Unidad de elección por default: **bundle de las 3 facetas por entidad**. Click "← Quedarme con esto de X" aplica main + comentarios anclados + diff-marks pendientes de X a la familia destino simultáneamente.
- Granularidad por faceta dentro del bundle queda como opción avanzada, no preseleccionada (ver `docs/deferred/index.md`).
- Atajos masivos: `Todo de X →`, `← Todo de Y`. Saltar = no tocar la entidad en destino.
- Aplicación: 3 commits secuenciales (uno por faceta) compartiendo `Merge-Group: <uuid>` en el trailer. La timeline los agrupa como una sola operación. Si revienta a mitad, los commits ya hechos quedan y la UI muestra "merge parcial, reintentar". No silencioso.
- Mergear nunca borra la familia origen. Eliminar es una acción separada y explícita.

### Historial `/history`

Split de 2 columnas. Izquierda: commits agrupados por bucket temporal (_Hoy / Ayer / Esta semana / La semana pasada / Hace dos semanas / Hace un mes / Más viejo_) con sticky headers, chips por kind tocado, dot del color de la variante. Toggle "ver todas las variantes" (off por default; on entremezcla commits de todas las familias). Derecha: detalle del commit con lista de entidades cambiadas → diff visual de cada una.

**Diff visual:** texto rico convertido a texto plano normalizado + jsdiff línea a línea inline; metadata aparte como tabla "antes → después"; tags con chips +/–; binarios sólo tamaño antes/después.

**Milestones (paso 13a-bis).** El usuario nombra commits importantes ("antes de refactor X", "borrador 3 entregado") como git tags anotados — ref persistente separado del log, no una fila más de la timeline. Se renderizan como banda/separador entre commits, con panel "Sólo milestones" para colapsar el ruido de autocommits. Botón "Marcar este punto" en el detail-head; crear/renombrar/eliminar desde ahí.

### Restore

- **Por entidad:** "restaurar esta versión" → escribe el blob del commit a la ruta actual con escritura atómica + autosave marca dirty.
- **Por commit completo:** modal de confirmación fuerte + autocommit `before-restore: <hash>` previo. Siempre reversible.

### Compactación del historial

Los autocommits acumulan sin tope; tras meses de uso el log se vuelve ilegible y el `.git/` engorda de más. La compactación reescribe periódicamente segmentos del historial fusionando autocommits en uno solo, **sin tocar nunca puntos sagrados**.

**Barreras (commits que jamás se fusionan):**

- **Tags** (milestones del paso 13a-bis). Ref persistente nombrada por el usuario, semántica de "este punto importa". Además de ser barrera, el tag **presta su nombre**: cuando un segmento a compactar termina exactamente en el commit del tag, el commit compactado resultante usa `<nombre-del-milestone>` como subject en vez de `auto-batch [...]`. El trailer `Compacted-From: <rango>` se conserva igual. Segmentos adyacentes que no terminan en tag siguen usando `auto-batch [main]: N commits, ... (fecha)`.
- **`before-restore: <hash>`**. La promesa "siempre reversible" de Restore exige que el punto previo a una restauración sobreviva sin fusionar.
- **Grupos `Merge-Group: <uuid>`**. Los 3 commits de una sesión de merge se fusionan juntos o no se fusionan; nunca se fragmentan (rompería el invariante de §12 "merge entre variantes es una sola operación visible").

**Política por edad (reusa los buckets de `/history`):**

| Edad del commit | Política                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------- |
| ≤ 7 días        | Intactos.                                                                                       |
| 8–30 días       | Un commit por día por faceta (`auto-batch [main]: 47 commits, 12 notes, 3 tasks (2026-05-14)`). |
| 31–180 días     | Un commit por semana por faceta.                                                                |
| > 180 días      | Un commit por mes por faceta.                                                                   |

Las barreras rompen el bucket: si un tag cae en medio de un día/semana/mes, ese bucket se parte en dos commits compactados (antes y después del tag). Cada commit compactado lleva trailer `Compacted-From: <oid1>..<oidN>` para trazabilidad y para que el snapshot pre-compactación sirva de mapa al revertir.

**Alcance por rama.** Cada rama (`variant/<family>/main`, `…/draft`, `…/comments`) se compacta independientemente con sus propios tags. Sin coordinación entre familias ni facetas: la operación es predecible y tolerante a fallos parciales — si una rama falla, las otras quedan compactadas y la fallida queda intacta para reintentar.

**Disparo.** Background, throttle de 1×/día por workspace, sólo cuando una rama supera 500 commits (umbral fijo en el primer corte; configurable más adelante, ver `docs/deferred/index.md`). Corre detrás del mismo `FsLockService` que autocommits y switch de variante, con `flushAll()` de autosave previo. Nunca durante una pantalla de carga del usuario (switch, merge, restore, accept-draft).

**Disparo por milestone.** Además del background por edad, marcar un milestone en `/history` dispara compactación inmediata del rango **[milestone previo (o root) .. milestone recién marcado]** en la rama del commit marcado. Las barreras internas (`before-restore`, `Merge-Group`) siguen partiendo el rango — el resultado son uno o más commits compactados, y **sólo el que termina exactamente en el milestone hereda el nombre**; los demás vuelven a `auto-batch [...]`. Los commits posteriores al milestone (hasta HEAD) quedan intactos. Age-agnóstico: cae la protección de "≤ 7 días intacto", porque marcar un hito es una decisión explícita de "acá cerré capítulo, limpiá lo previo". Gated por el mismo toggle "Compactar aunque haya remoto" (ver "Interacción con push a GitHub"): con remoto configurado y toggle off, el tag se crea igual (agregar ref es cero riesgo) pero la compactación se skippea silenciosamente y el banner del historial la refleja. Renombrar o borrar el milestone después no reescribe el commit compactado: el subject se congela al momento de la fusión, el tag y el mensaje del compactado son independientes tras el rewrite.

**Snapshot pre-compactación.** Antes de tocar refs, copia de los refs afectados + objetos a fusionar a `.mi-cerebro/pre-compaction/<fecha>/<branch>/` (mismo patrón que `pre-migration/` de §4.15). Retención 30 días. Permite revertir si la compactación corrompió algo o si el usuario quiere recuperar granularidad fina.

**Interacción con push a GitHub.** Tras compactación, la siguiente sincronización con remoto requiere `push --force-with-lease` (la historia local divergió). La app **no force-pushea sola**: si hay remoto configurado, la compactación queda gated por un toggle en settings ("Compactar aunque haya remoto" — off por default). Con el toggle off, la compactación se desactiva silenciosamente y `/history` muestra un banner sugiriendo activarla cuando el log cruza el umbral. Con el toggle on, el push posterior usa `--force-with-lease` y se aborta si el remoto avanzó por otro lado (sin pisar trabajo ajeno). El mismo gate aplica a la compactación disparada por milestone.

**Interacción con `lastCommitAt`.** Sin cambios: ya se reconstruye desde `git.log({ depth: 1 })` en boot. El footer mostrará el oid del commit fusionado más reciente.

### Índice de búsqueda de comentarios y borradores

Corregido 2026-08-04: el diseño original de este párrafo (3 índices IndexedDB separados por familia, `idx-<family>-{main,comments,draft}`) se descartó en la implementación real por no aportar nada — `WorkspaceRefreshService.refreshAll()` ya recorre disco en cada switch de variante para repoblar el estado propio de cada feature (listas, walls), así que cachear aparte el índice `main` no ahorra ese walk, sólo agrega complejidad sin beneficio medible.

Lo que sí faltaba de verdad: `comment`/`draft` son kinds nuevos en el **mismo índice global** (`SearchIndexService`, ya persistido en IndexedDB desde antes), poblados por un walk de priming (`SearchFamilyPrimingService`) de las ramas `comments`/`draft` de la familia activa — nunca checked-out, así que `refreshAll()` no las toca. El priming corre al boot (después de resolver la familia activa) y tras cada switch de variante. Cada guardado de `CommentsService`/`DraftsService` reindexa en vivo los docs de esa entidad puntual (`SearchIndexService.replaceEntity`), sin esperar al próximo priming. Los ids siguen la convención `comment:<entityId>:<commentId>` / `draft:<entityId>:<markId>`; no son rutas navegables — seleccionar un resultado en el palette resuelve a la entidad que anclan. No son objetivos válidos de "Conexiones" (`LINKABLE_ENTITY_KINDS` los excluye del picker `@`).

### Push a GitHub (opt-in)

Configurable en settings: URL de repo privado + PAT. Toggle "push tras cada autocommit" con throttle de 5 min, o sólo manual con botón. **Cero llamadas a red sin esto configurado** (regla §4.14).

**Dónde vive el PAT.** Corregido 2026-08-04: esta sección decía "guardado en IndexedDB, no en localStorage" — inexacto, el PAT vive en `.mi-cerebro/secrets.json` en disco (gitignoreado, nunca entra al árbol git), no en IndexedDB. Desde 13e-ii el campo `token` se persiste cifrado (AES-GCM) con una clave no-extraíble generada una sola vez y guardada en IndexedDB (`pat-crypto.ts`) — ahí sí interviene IndexedDB, pero solo para la clave, no para el secreto en sí. Sin passphrase: la clave se "desbloquea" implícitamente por correr en este mismo perfil de navegador, protegiendo el PAT si la carpeta del workspace se copia/respalda/sincroniza a otro lado sin ese perfil, pero no ante acceso completo al navegador (ya confiado hoy para permisos de FS, temas custom, etc). Archivos v1 (token en plano, de antes de 13e-ii) se siguen leyendo y se re-persisten cifrados automáticamente al primer boot.

### Costo de operaciones git sobre FS Access

Cada operación de isomorphic-git sobre el adapter FS Access tiene un piso de ~100-200 ms por syscall del browser. En la práctica eso se traduce en commits que toman ~2-3 s aún para una sola entidad, ~6 s para 100 entidades a la vez. Las operaciones de **autocommit** corren en background y el costo es invisible. Las operaciones **disparadas por el usuario** (switch de variante, merge entre variantes, accept de un diff-mark del borrador, crear/borrar variante) muestran una **pantalla de carga con mensaje contextual** mientras la operación termina. Patrón estándar de clientes git; aceptable para esta app. Mover `.git/` a OPFS para reducir el piso queda como optimización futura (ver `docs/deferred/index.md`); se evalúa si la UX con loading screens resulta intolerable en uso real.

### Fallback si isomorphic-git resulta inviable

Snapshots por entidad en `.mi-cerebro/history/<kind>/<id>/<timestamp>.json`. Misma UI de timeline, distinto backend. Las variantes no son soportables en este modo: la app degrada a una sola "Principal" implícita. Decisión sólo tras prototipo fallido del adapter de isomorphic-git en 13a. **Estado al cierre de 13a**: descartado. El adapter pasa los 10 casos de validación con números aceptables bajo el modelo de loading screens.

---

## 13. Objetivos siempre visibles

Los objetivos no compiten por atención con el resto: aparecen en momentos específicos para que mantengan presencia sin saturar.

- **Pantalla de carga / cambio de ruta:** al navegar a una ruta nueva, durante unos segundos aparece un **botón/banner flotante** con un objetivo (o a veces una tarea) elegido al azar, en formato "Recuerda... tenés X tiempo para…".
- Sección dedicada con vista completa de todos los objetivos.
- No banner permanente. No sidebar fijo. **Si todo es importante, nada lo es.**
- **Modelo `Goal` (schema v9):** además de `deadline`/`completed` lleva los campos que alimentan la vista constelación de `/goals`:
  - `priority: 'low' | 'med' | 'high'` (default `'med'`) — controla tamaño/peso visual de la constelación.
  - `progress: 0–100` — avance. **Invariante:** `completed === true ⇒ progress = 100`. `GoalsService.save` la fuerza.
  - `steps: GoalStep[]` (default `[]`) — sub-pasos del objetivo. **Cada step es una estrella de la constelación de `/goals`; la meta es la constelación misma.** Cuando `steps.length > 0`, `progress` se deriva como `round(done/total * 100)`. Cada step puede llevar `x?, y?` opcionales (0–100, % del lienzo) cuando el usuario lo "siembra" clickeando el lienzo del editor; sin esos campos, el renderer cae a posición hash-based determinística.
  - `lastProgressAt: string` (docs/evolution.md idea 3 — "acompañamiento adaptativo") — distinto de `updatedAt` (que cualquier edición toca, incluso título/tags): sólo se mueve cuando `progress`, `completed` o el done-state de los `steps` cambian. `GoalsService.save` lo deriva comparando contra el `GoalSummary` previo en memoria (sin I/O extra); `create()` lo siembra en `now`. `isGoalDormant(completed, lastProgressAt, thresholdDays, nowMs)` en `goal.types.ts` es la señal pura: `false` si `completed`, si no `nowMs - lastProgressAt > thresholdDays` (`settings.goals.dormantThresholdDays`, ya existía como placeholder sin cablear desde 11bis — este paso lo consume por primera vez). Superficie: badge 🌙 en `DashboardGoalsWidgetComponent` (dashboard) y clase `.dormant` que desatura/apaga el titileo de la estrella en el wall (sin agregar otro color en competencia con overdue/soon — dormancia no es lo mismo que "urgente"). Migraciones acumuladas: v3→v4 sembra `priority`/`progress`, v4→v5 sembra `reminder.enabled`, v5→v6 sembra `steps: []`, v6→v7 no-op, v7→v8 sembra `lastProgressAt` desde `updatedAt` (backfill best-effort, no se puede saber retroactivamente si ediciones pasadas tocaron progreso), v8→v9 sembra `reminder.notifyOnDormant: false` (ver §14 — nuevo toggle, off por default).
- **Wall `/goals` como mapa estelar:** cada meta es una constelación. Su **centroide** sale de `goal.wallCenter` si el usuario la arrastró, si no del hash determinístico del `goal.id` (padding 18% por borde). Cada step se posiciona alrededor con offset escalado de `(step.x-50, step.y-50)*0.25` cuando tiene `x/y` guardados (drag en el editor), si no con offset `(angle, radius)` derivado del hash del `step.id`. Las líneas de constelación son un **MST intra-meta** (Prim, distancia euclídea en %) sobre los steps. Metas sin pasos son una estrella solitaria en el centroide.
- **Drag de constelación entera en el wall:** pointer-down sobre cualquier estrella + drag (umbral 5 px) traslada el centroide en vivo (los steps siguen como rebaño porque la sub-posición es relativa a `cx/cy`). Al soltar persiste `goal.wallCenter = {x, y}` via `GoalsService.patch`. Sin drag (tap) → flujo de peek/toggle/nav del gate de dos pasos.
- **Gate de dos pasos en el wall (`GoalPeekOverlayComponent`):** el 1er click sobre cualquier estrella de una constelación **no enfoca pasos**, abre un _peek_ anclado al centroide con el nombre de la meta inline-editable, chip de plazo (dashed ámbar cuando vacío, sólido con días restantes + fecha cuando hay), barra de progreso derivada, prioridad (low/med/high), CTA "Abrir mapa de estrellas" → `/goals/:id` y botón de eliminar. Toda edición persiste vía `GoalsService.patch(id, partial)`. Sólo cuando una constelación ya está enfocada, un 2do click sobre una de sus estrellas hace el toggle del step (o navega si es solitaria). **Shift-click** sobre cualquier estrella siempre navega — atajo power-user. Click en el backdrop o ✕ cierra el peek. _Por qué:_ discoverability — el usuario podía crear pasos y luego no encontraba cómo editar nombre/plazo/progreso de la meta antes de entrar al mapa.
- **Editor `/goals/:id` como carta estelar interactiva (`GoalConstellationEditorComponent`):** el panel principal es un lienzo SVG con la constelación de la meta activa. Interacciones primarias: **click en cielo vacío** → siembra una estrella nueva en esas coordenadas (`{x, y}` persisten en el step) con animación de ignición + input flotante para el título; Enter confirma, Esc cancela. **Tap sobre estrella** → toggle done. **Drag sobre estrella** → reposicionar; umbral de 4 px distingue tap de drag, pointer-capture mantiene el arrastre aunque el cursor salga; al soltar persiste `{x, y}` en el step y los links MST se redibujan en vivo. **Shift-click o click derecho en estrella** → popover con renombrar / toggle / quitar. Debajo del lienzo: tres botones de prioridad como estrellas de tamaño creciente (`low/med/high`), pill de progreso derivado, y **barra horizonte** (`🌙 ─ • ─ 🌞`) que muestra el avance temporal entre `createdAt` y `deadline` con un marcador animado; click → date picker inline. Tinte del lienzo se calienta a ámbar (≤7 días) o rojo (overdue) vía `box-shadow` interno, dando feedback global sin texto. El editor pane queda minimal: bar de título + lienzo + toggle de recordatorio + tags + body editor.

---

## 14. Recordatorios y notificaciones

- Solo **in-app, con la app abierta** (toast/banner).
- Sección dedicada para gestionar los recordatorios.
- Granularidad: fecha + hora.
- **Cadencia unificada:** todo `Reminder` — manual o derivado de meta — comparte la misma serie de avisos densificantes. Cada reminder tiene `dueAt` (lo que el usuario ve y edita: el momento objetivo) y `nextPingAt` (interno: el próximo disparo dentro de la serie). La secuencia es fija y cada vez más densa hacia el `dueAt` (1 semana / 3 días / 1 día / 12 h / 6 h / 3 h / 1 h / 30 min / 10 min / 2 min antes, en el momento, y 1 h / 6 h / 1 día después). El usuario configura sólo desde qué punto arranca la serie vía `settings.reminders.leadMinutes` (presets: 1 semana / 1 día / 6 h / 1 h / 10 min). Cuando la serie post-deadline se agota, el reminder se marca `done` automáticamente (queda en histórico, deja de avisar). `RemindersCadenceService` (en `@core/reminders/`) mantiene `nextPingAt = nextSlotFor(dueAt, now, lead)` para cada reminder pendiente vía effect + cola serializada, y expone `advance(id)` que el scheduler invoca al disparar.
- **Recordatorios automáticos por meta:** una meta con `reminder.enabled` y `deadline` alimenta un `Reminder` (`sourceKind='goal'`) con `dueAt = ${deadline}T23:59` (fin del día). `GoalRemindersSyncService` es ahora un layer puramente de ciclo de vida: crea/borra el reminder según el toggle de la meta y sincroniza `title` + `dueAt` con la meta — la cadencia (cuándo dispara) la maneja `RemindersCadenceService` igual que con un reminder manual. Toggle por meta en su detalle. Borrar un goal-reminder desde `/reminders` desactiva el toggle de la meta (no es delete normal — el sync lo recrearía).
- **Aviso proactivo de meta recién dormida** (docs/evolution.md idea 3): meta con `reminder.notifyOnDormant` en `true` (toggle propio en el editor, off por default) dispara un `Reminder` puntual (`sourceKind='goal-dormant'`, `dueAt = now`, sin recurrencia) apenas `isGoalDormant` pasa de `false` a `true` — no encaja en el modelo de lead-up de `RemindersCadenceService` porque la dormancia no tiene fecha objetivo. `GoalDormantRemindersSyncService` (en `@core/reminders/`) resuelve el flanco reusando el mismo patrón diff que `GoalRemindersSyncService`: "¿ya existe un reminder `goal-dormant` para esta meta?" hace de estado-anterior implícito, sin necesitar un Map en memoria — se crea si falta y la meta está dormida con el flag prendido, se borra si la meta retoma progreso (deja de estar dormida) antes de que el usuario lo atienda. Borrar el reminder desde `/reminders` desactiva `notifyOnDormant` en la meta (mismo motivo que con `reminder.enabled`: si no, el próximo tick lo recrearía).
- **Recordatorios automáticos para tareas y escritos con deadline** (extensión del patrón goal-sourced, cierra el ítem de `deferred/reminders-goals.md`): `Task.reminder: { enabled }` (schema v5) genera un `Reminder` (`sourceKind='task'`) a partir de `dueDates[0]` (la próxima fecha, mismo criterio "next-due" que ya usa `TasksService`) cuando `enabled && dueDates.length > 0 && !done`. `Writing` ganó un campo nuevo que no existía — `deadline: string | null` + `reminder: { enabled }` (schema v4) — y genera un `Reminder` (`sourceKind='writing'`) igual que una meta (`dueAt = ${deadline}T23:59`) cuando `enabled && deadline !== null`. `TaskRemindersSyncService`/`WritingRemindersSyncService` (en `@core/reminders/`) son layers de ciclo de vida idénticos a `GoalRemindersSyncService` (mismo diff/create/delete/retitle/reschedule por tick); la cadencia sigue siendo responsabilidad única de `RemindersCadenceService`, sin distinción por `sourceKind`. Ambos toggles son opt-in, off por default — a diferencia de la migración de goals (que prendía el reminder por default en metas con deadline, por el precedente del banner aleatorio), tareas y escritos nunca tuvieron recordatorio automático antes, así que no hay comportamiento previo que preservar. Borrar el reminder desde `/reminders` desactiva el toggle en la task/writing (mismo patrón que goals). En writings, borrar el `deadline` (botón "Quitar plazo") apaga el toggle automáticamente si estaba prendido, para no dejar un reminder-config huérfano sin fecha.
- **Tags y palomares temáticos por categoría** (cierra el ítem homónimo de `deferred/reminders-goals.md`): `Reminder.tags: readonly string[]` (schema v5, migración v4→v5 default `[]`) — mismo `TagsService`/`mc-tag-picker` que el resto de las entidades taggeables, editable desde el panel de detalle en `/reminders`. Toggle "agrupar por categoría" (off por default, preserva la grilla única de siempre) parte `inNichos()` en una sección rotulada por tag — un reminder con 2+ tags aparece en cada sección que le corresponde, mismo criterio que la vista cross-section `/tags/:id`.
- **Reminders en el índice de búsqueda global y en `/tags/:id`** (cierra el hueco que había quedado documentado al agregar tags): `RemindersService` ahora alimenta `SearchIndexService` igual que las demás entidades (`rebuildKind` en `refresh()`, `upsert` en `create`/`save`/`restore`, `remove` en `deleteToTrash`) — la infraestructura de routing/palette (`LINKABLE_ENTITY_KINDS`, `KIND_TITLE_KEY`, `iconForKind`) ya tenía `reminder` contemplado desde antes, sólo faltaba que el servicio efectivamente indexara. `TaggedItemsService` suma el fan-out de reminders y `tag-detail.container.ts`/`.html` un bloque de card más (`mc-tagged-generic-card`, ícono `bell`, subtítulo = fecha de `dueAt`). Clickear un reminder desde `/tags/:id` o `Ctrl+K` navega a `/reminders` (índice, no hay detalle propio — mismo tratamiento que track/playlist, ver `core/search/kind-routes.ts`).

---

## 15. Calendario

- Vistas **mensual** y **anual**, ambas con **expansión a día**.
- Muestra todas las entidades con fecha (tareas, objetivos con deadline, notas fechadas, recordatorios).
- Agrupadas **por tipo** dentro del día, en orden.
- **Filtros por tipo y por tag.**
- Click en un día → botón "+ nueva entrada" que abre selector de tipo.

---

## 16. Reproductor de música

- **Mini-player global**, siempre accesible. Ocupa el mínimo espacio necesario: play/pausa, anterior, siguiente.
- Expandible a vista completa con la playlist actual.
- Sección dedicada para gestionar playlists: subir MP3 (se copia a `music/tracks/`), crear playlist (definición en `music/playlists/*.json`), editar orden.
- **Reproducción aleatoria en bucle** como modo principal.
- Solo MP3 por ahora.
- **Letra de la canción:** si el MP3 trae el frame ID3 `USLT` embebido, se muestra en un panel plegable en "Now playing". Si no lo trae, hay un fallback **opt-in explícito** (nunca automático) que consulta `api.lyrics.ovh` por artista+título tipeados a mano — el resultado no se persiste en `Track`/`_library.json` ni se usa para adivinar artista/título desde el nombre del archivo (no hay patrón estable), para no arriesgar mostrar una letra equivocada como si fuera un dato verificado.

---

## 17. Temas

### Política

- **Default al primer arranque:** sigue `prefers-color-scheme` del SO. El usuario puede fijar `light` o `dark` desde settings; la preferencia se guarda en `localStorage` y, si la quita, vuelve a `auto`.
- **Switch técnico:** atributo `data-theme="light"` o `data-theme="dark"` en `<html>`. En modo `auto` no se setea el atributo y manda el `@media (prefers-color-scheme: dark)` de las variables.
- **CSS variables, nada hardcoded.** Todos los colores, radios, spacing, tipografía y elevaciones viven en tokens. Los componentes consumen tokens, nunca literales.
- **Tema custom** del usuario: override de tokens guardado en IndexedDB. Validación WCAG AA con advertencia (no bloquea), no se rompe la app si la combinación es ilegible.

### Tipografía base

System stack — cero peso de fuente, look nativo en cada SO:

```
-apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI',
Inter, Roboto, 'Helvetica Neue', Arial, sans-serif
```

Mono (para código en editor y códigos de error): `ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace`. Serif (si en el futuro queremos un modo lectura para escritos largos) queda fuera del paso 2.

### Tokens base (paso 2)

Naming: `--mc-<grupo>-<rol>`. Grupos: `bg`, `fg`, `border`, `accent`, `state`, `focus`, `space`, `radius`, `font`, `shadow`.

#### Color — dark (default cuando SO está oscuro)

Tono: **neutro frío, grises azulados**. Acento: **naranja cálido**.

| Token                 | Valor                     | Uso                                 |
| --------------------- | ------------------------- | ----------------------------------- |
| `--mc-bg-base`        | `#0d1117`                 | Fondo de la app                     |
| `--mc-bg-surface`     | `#161b22`                 | Cards, paneles, sidebar             |
| `--mc-bg-elevated`    | `#1c232c`                 | Modales, popovers, menús            |
| `--mc-bg-hover`       | `#21262d`                 | Hover de filas/items                |
| `--mc-bg-selected`    | `#2a3340`                 | Item activo                         |
| `--mc-fg-primary`     | `#e6edf3`                 | Texto principal                     |
| `--mc-fg-muted`       | `#9aa4af`                 | Texto secundario                    |
| `--mc-fg-dim`         | `#7d8590`                 | Texto deshabilitado / hints         |
| `--mc-border-default` | `#30363d`                 | Bordes y separadores                |
| `--mc-border-strong`  | `#484f58`                 | Bordes de input enfocado            |
| `--mc-accent-primary` | `#ff7a45`                 | Botones primarios, links, selección |
| `--mc-accent-hover`   | `#ff8f60`                 | Hover                               |
| `--mc-accent-active`  | `#f06a35`                 | Active / pressed                    |
| `--mc-accent-fg`      | `#1a0f08`                 | Texto sobre superficie de acento    |
| `--mc-state-danger`   | `#f85149`                 | Error                               |
| `--mc-state-warning`  | `#d29922`                 | Advertencia                         |
| `--mc-state-success`  | `#3fb950`                 | OK                                  |
| `--mc-state-info`     | `#58a6ff`                 | Info neutral                        |
| `--mc-focus-ring`     | `#ff7a45` con `alpha 0.6` | Anillo de foco visible (regla 29)   |

#### Color — light

Tono: **pergamino apagado** (beige grisáceo cálido, sin amarillento) — explícitamente más oscuro que un "claro estándar" sobre blanco porque el blanco puro resulta doloroso en uso prolongado. Acento naranja recalibrado para AA sobre fondo claro.

| Token                 | Valor                     | Uso                                             |
| --------------------- | ------------------------- | ----------------------------------------------- |
| `--mc-bg-base`        | `#cfc8b8`                 | Fondo de la app (pergamino)                     |
| `--mc-bg-surface`     | `#c2bba9`                 | Cards, paneles, sidebar                         |
| `--mc-bg-elevated`    | `#d8d2c3`                 | Modales, popovers                               |
| `--mc-bg-hover`       | `#b8b09d`                 | Hover                                           |
| `--mc-bg-selected`    | `#e6c6a8`                 | Item activo (tinte cálido del acento)           |
| `--mc-fg-primary`     | `#1f2328`                 | Texto principal                                 |
| `--mc-fg-muted`       | `#4a5058`                 | Texto secundario                                |
| `--mc-fg-dim`         | `#6a7079`                 | Texto deshabilitado                             |
| `--mc-border-default` | `#a39b89`                 | Bordes                                          |
| `--mc-border-strong`  | `#7d7565`                 | Bordes de input enfocado                        |
| `--mc-accent-primary` | `#c44616`                 | Versión oscurecida del naranja, AA sobre blanco |
| `--mc-accent-hover`   | `#a83a0f`                 | Hover                                           |
| `--mc-accent-active`  | `#922f0a`                 | Active                                          |
| `--mc-accent-fg`      | `#ffffff`                 | Texto sobre superficie de acento                |
| `--mc-state-danger`   | `#cf222e`                 | Error                                           |
| `--mc-state-warning`  | `#9a6700`                 | Advertencia                                     |
| `--mc-state-success`  | `#1a7f37`                 | OK                                              |
| `--mc-state-info`     | `#0969da`                 | Info                                            |
| `--mc-focus-ring`     | `#c44616` con `alpha 0.4` | Anillo de foco                                  |

#### Spacing, radius, fuentes, sombras

| Token                | Valor                                                       |
| -------------------- | ----------------------------------------------------------- |
| `--mc-space-1`       | `4px`                                                       |
| `--mc-space-2`       | `8px`                                                       |
| `--mc-space-3`       | `12px`                                                      |
| `--mc-space-4`       | `16px`                                                      |
| `--mc-space-5`       | `24px`                                                      |
| `--mc-space-6`       | `32px`                                                      |
| `--mc-space-7`       | `48px`                                                      |
| `--mc-radius-sm`     | `4px`                                                       |
| `--mc-radius-md`     | `8px`                                                       |
| `--mc-radius-lg`     | `12px`                                                      |
| `--mc-radius-pill`   | `9999px`                                                    |
| `--mc-font-sans`     | system stack (ver arriba)                                   |
| `--mc-font-mono`     | mono stack (ver arriba)                                     |
| `--mc-font-size-xs`  | `12px`                                                      |
| `--mc-font-size-sm`  | `13px`                                                      |
| `--mc-font-size-md`  | `14px` (base UI)                                            |
| `--mc-font-size-lg`  | `16px`                                                      |
| `--mc-font-size-xl`  | `20px`                                                      |
| `--mc-font-size-2xl` | `28px`                                                      |
| `--mc-line-tight`    | `1.2`                                                       |
| `--mc-line-base`     | `1.5`                                                       |
| `--mc-line-loose`    | `1.75`                                                      |
| `--mc-shadow-sm`     | `0 1px 2px rgb(0 0 0 / 0.20)` (dark) / `... / 0.06` (light) |
| `--mc-shadow-md`     | `0 4px 12px rgb(0 0 0 / 0.30)` / `... / 0.10`               |
| `--mc-shadow-lg`     | `0 12px 32px rgb(0 0 0 / 0.40)` / `... / 0.14`              |

### Storage

- Preferencia del tema (`'light' | 'dark' | 'auto'`) gestionada por `SettingsService` (`state().theme.override`): persiste en `.mi-cerebro/settings.json` del workspace + cache espejo en `localStorage` bajo `mc.settings.v1` (ver 11bis). `ThemeService` es consumidor puro: lee la preferencia desde settings, computa `resolved` combinando con `prefers-color-scheme`, y aplica `data-theme` al `<html>`. La clave legacy `mc.theme` (anterior a 11bis) se migra a settings la primera vez que el usuario abre la app post-cableado y luego se elimina.
- Tema custom del usuario en IndexedDB (paso futuro). Si hay tema custom activo, override los tokens vía `<style id="mc-custom-theme">` inyectado al `<head>`.

---
