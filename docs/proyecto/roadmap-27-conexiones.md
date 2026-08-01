# Roadmap — item 27 (conexiones entre entidades)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

27. **Conexiones entre entidades (backlinks + hilos manuales + mapa de 1 salto).** _Cerrado — Fases
    1-6 implementadas y verificadas en navegador real, 2026-07-31._

**Contexto.** Disparado por revisar `docs/evolution.md` a pedido del usuario: de las 4 ideas de
producto candidatas ahí registradas, la idea 4 ("editor sin comprensión de intención/conexiones")
era la única marcada `🔲 sin explorar` — la app resuelve muy bien "encontrar lo que ya sé que
busco" (§10) pero nada te dice qué se conecta con lo que estás viendo ahora. Al diseñar se
encontraron dos ítems ya diferidos que apuntaban al mismo problema desde ángulos distintos y
nunca se habían asignado a un paso: "Referencias/links entre entidades desde el editor"
(`docs/deferred/shortcuts-cross-section.md`) e "Hilos entre items relacionados"
(`docs/deferred/files-writings-tasks.md`, rediseño cork board de `/files`). Se decidió resolver
los tres frentes con un único modelo genérico en vez de tres piezas separadas.

**La spec final vive en `docs/proyecto/features.md` §10bis** — modelo de datos (`Relation`,
`EntityRef`), storage (`.mi-cerebro/relations.json`, mismo molde que `tags.json`), por qué no hace
falta un flag `orphaned` persistido (se resuelve en vivo contra el índice de §10), el flujo del
editor (`core/tiptap/entity-ref/`, mismo molde que `image-ref/`, bubble menu "Vincular a…"), el
panel "Conexiones" (`shared/connections-panel/`) y los hilos manuales de `/files`. Este archivo no
repite esa spec — sólo trae lo específico de ejecución: fases sugeridas, riesgos y qué queda
fuera.

**Por qué un solo modelo y no tres features separadas.** Los tres casos (link desde el editor,
backlink automático, hilo manual en /files) son la misma operación —"A se conecta con B"— con
distinto origen. Separarlos en tres storages distintos hubiera significado tres formas de
responder "¿qué referencia a esta entidad?" en vez de una. `RelationsService` no sabe nada de
features (mismo nivel que `core/tags/`); la resolución de título/ruta se apoya en el índice de
búsqueda que cada feature ya alimenta para §10, así que no hace falta que `core/relations/`
importe ninguna feature ni que cada feature le enseñe a resolver sus propios kinds.

**Fases sugeridas para la ejecución** (no vinculantes — quien lo implemente puede fusionar/partir
distinto si encuentra una secuencia mejor; lo único que importa es que al final estén los 3 puntos
de entrada funcionando sobre el mismo store):

1. **Fundamento:** `core/relations/` (`RelationsService`, storage, tipos) + `relations.json` vacío
   por default (`schemaVersion: 1`) + resolución de título/ruta contra el índice de §10 +
   `FsLockService` para escritura atómica coordinada con autocommit/switch de variante.
2. **Editor:** `core/tiptap/entity-ref/` + entrada "Vincular a…" en el bubble menu +
   `shared/entity-link-picker/` (reusa el índice, sin construir nada nuevo de búsqueda).
3. **Panel de conexiones:** `shared/connections-panel/`, montado en el detalle de notas, escritos,
   listas, tareas, metas, archivos e imágenes (7 puntos de montaje, mismo container/dumb split que
   cualquier otro panel lateral existente en la app).
4. **Hilos en `/files`:** drag-to-connect en el cork board + render SVG del hilo + popover opcional
   de nombre.

**Riesgos / decisiones a validar durante la implementación** (no bloquean el diseño, pero conviene
confirmarlas contra el código real al ejecutar, no asumirlas):

- **Borrado de entidad.** Con orphan resuelto en vivo contra el índice, borrar una entidad (soft-delete
  a `.mi-cerebro/trash/`, §4.9) no requiere limpiar `relations.json` de inmediato — la conexión
  simplemente deja de resolver hasta que se restaure o se purgue. Confirmar en implementación si
  conviene purgar filas de `relations.json` recién al purgar la papelera (30 días, mismo ciclo que
  el resto de las redes de seguridad) o dejarlas indefinidamente como filas muertas — el archivo es
  chico (un id + un kind por extremo), así que no purgar nunca es plausible, pero vale confirmarlo
  con volumen real de uso.
- **Renombrar/mover entidades.** Como `Relation` no guarda título ni ruta (sólo `{kind, id}`), un
  rename no invalida nada — a diferencia de si se hubiera guardado un snapshot del título. Sólo
  `contextSnippet` (la frase capturada al vincular desde el editor) queda congelado a propósito,
  mismo criterio que el subject de un commit compactado en §12 ("se congela al momento", no se
  vuelve a derivar).
- **Picker con pocos resultados / kind equivocado.** Validar en implementación real que filtrar el
  picker por kind (ej. "sólo metas") no hace falta en el primer corte — la búsqueda de texto libre
  del índice ya suele acotar lo suficiente; si en uso real resulta ruidoso, es un filtro chico de
  agregar después, no repensar el modelo.
- **Cobertura de tutorial.** Regla §4.6.15b exige tutorial por sección — "Vincular a…" en el editor
  y el panel de Conexiones necesitan al menos un step en los 7 tutoriales de las secciones que lo
  montan (Notes, Writings, Lists, Tasks, Goals, Files, Images). No se diseña acá; queda como parte
  natural del cierre de este ítem, no de un ítem 28 aparte — mismo criterio que cualquier otra
  feature nueva que toca una página con tutorial existente.

**Fase 1 — fundamento.** _Cerrado._

- `core/relations/` nuevo: `relation.types.ts` (`EntityRef`, `Relation`, `RelationOrigin`,
  `RelationsFile`, `sameRef`/`refKey` helpers) + `relations.service.ts` (`RelationsService`),
  mismo molde que `core/tags/tags.service.ts` — `refresh()`/`persist()` sobre
  `.mi-cerebro/relations.json` vía `fs.writeFileAtomic`, registrado en `MigrationsService` con
  `RELATION_SCHEMA_VERSION = 1` y `steps: []` (sin historia todavía, mismo patrón que `TagsService`
  al día uno).
- **Sin lock explícito**, igual que `TagsService`: se confía en que `writeFileAtomic` es seguro a
  nivel de archivo individual; `FsLockService` queda para orquestación de más arriba (autosave/
  autocommit), no para cada servicio hoja.
- `outgoingFor(ref)`/`backlinksFor(ref)` resuelven contra dos `computed` agrupados por
  `refKey(ref)` (`kind:id`), no un filter lineal por llamada — mismo criterio de `byIdSignal` en
  `TagsService`.
- `create()` es idempotente: mismo `from`+`to` devuelve la fila existente en vez de duplicar (doble
  click, reintento). `remove()` es no-op silencioso sobre un id inexistente.
- 8 tests en `relations.service.spec.ts` (mismo patrón `InMemoryFs`/`WorkspaceStub` que
  `tags.service.spec.ts`): refresh vacío, create+persist, idempotencia, outgoing/backlinks desde
  extremos opuestos, remove, remove no-op, lectura de `relations.json` preexistente.
- Verificado: `bun run typecheck` limpio, `bun run test` 555/555 verde (548 previos + 7 nuevos).

**Fase 2 — editor: bubble menu + picker + chip.** _Cerrado._

- `core/tiptap/entity-ref/entity-ref.node.ts` nuevo: nodo inline `entityRef` (mismo molde que
  `image-ref.node.ts`), attrs `{kind, entityId, label}`, persistido como `<span data-entity-ref
data-kind data-entity-id data-label>`. Sin fetch async — el label queda congelado al insertar. El
  ícono por kind se arma con `entityKindIcon()` (`shared/entity-cards/entity-kind-icon.ts`, ya
  existente) + `ICON_DATA` (`shared/icon/icons.data.ts`) envuelto a mano en `<svg>` — `ICON_DATA`
  sólo tiene el `<path>` interno, la envoltura normalmente la pone `IconComponent` vía Angular, que
  no está disponible dentro de un NodeView de ProseMirror.
- `shared/editor/entity-link-picker-dialog.component.ts` nuevo: mismo molde que
  `image-picker-dialog.component.ts` (backdrop + dialog standalone), pero busca sobre
  `SearchIndexService.query()` — el índice ya existente de §10, sin construir nada nuevo.
- `bubble-menu.component.ts` suma un tercer botón "Vincular a…" (`link` output) junto a
  "Proponer cambio"/"Comentar" — **misma superficie, mismo gating**: sólo visible en vista
  `combined` con selección no vacía. Documentado como limitación conocida, no bug: vincular no es
  una operación de rama como comentar/proponer, así que en teoría podría estar disponible también
  en `clean`, pero eso exige tocar la condición `showBubble` de `onEditorSelectionUpdate()` — fuera
  de alcance de este corte para no arriesgar el comportamiento ya establecido de comentarios/drafts.
- `EditorComponent` gana `entityKind` input (necesario para el extremo `from` de la `Relation`) +
  `triggerLink()` (mismo patrón que `triggerComment()`/`triggerPropose()`: captura
  `{from, to, text}` de la selección antes de que el picker le robe el foco al editor — abrir un
  diálogo colapsa la selección de ProseMirror) + `onEntityLinked()` (inserta el nodo vía
  `insertContentAt({from, to}, ...)` y llama `RelationsService.create()` con `contextSnippet` =
  el texto seleccionado). `onEntityRefOpen` resuelve la navegación del click sobre el chip vía
  `routeFor()` (`core/search/kind-routes.ts`, ya existente) + `Router.navigate()`.
- **7 puntos de montaje de `mc-editor` actualizados** con `[entityKind]="..."` (notas, tareas,
  metas, escritos, listas, capítulos de libro — goals tiene un solo punto de montaje real, en
  `goal-editor-pane.component.html`; `goal-constellation-editor.component.ts` no usa `mc-editor`
  pese a lo que sugería la investigación previa). Cada pane importa su propia constante `*_KIND` ya
  existente (`NOTE_KIND`, `TASK_KIND`, etc.) en vez de un literal repetido.
- Estilos del chip en `src/styles/_editor-content.scss` (no en el CSS del componente — el contenido
  de ProseMirror vive fuera del template compiler de Angular, ver el comment "Impacto Alto #1" ya
  documentado en ese archivo para otros nodos como `image-ref`).
- i18n: `editor.bubble.link`, `editor.linkPicker.placeholder`, `editor.linkPicker.empty`.
- **Verificado en navegador real** (`bun run start`, `/notes/:id`): bubble menu muestra "Vincular
  a…" junto a Proponer/Comentar en vista Combinada → picker busca sobre datos reales del workspace
  del usuario → seleccionar un resultado inserta el chip con ícono correcto → el chip sobrevive un
  reload completo de página (round-trip de persistencia/parseo del nodo TipTap) → click en el chip
  navega a la entidad vinculada con slug legible (`/goals/verificar-checklist-8-7-<id>`).
  `bun run typecheck` limpio, `bun run test` 555/555 verde, `ng lint` sin errores nuevos.
- **Gotcha de entorno (no de código), documentado para la próxima sesión:** en este workspace
  (`/mnt/c/devtest/...`, disco de Windows montado en WSL) el watcher de `ng serve` no detecta
  cambios de archivo de forma confiable — hace falta reiniciar el dev server manualmente para ver
  ediciones reflejadas, `ng serve` no las recoge solo pese a "Watching for file changes...".

**Fase 3 — panel "Conexiones" en el detalle de la entidad.** _Cerrado (5 de 7 kinds; los 2
restantes — archivos e imágenes — cierran en la "Fase 3b" de abajo)._

- `core/relations/resolve-relation.ts` nuevo: `resolveRelations(relations, direction, search)`,
  función pura que resuelve cada `Relation` al extremo "otro" (`to` si `direction:'outgoing'`, `from`
  si `'backlink'`) contra `SearchIndexService.getTitle()` — sin duplicar título/ruta en
  `relations.json` (§10bis). `title === null` es la señal de huérfana (entidad no indexada, ej.
  borrada) — nada persiste ese estado, se recalcula en cada render.
- `shared/connections/connections-panel.container.ts` nuevo: mismo molde que
  `CommentsPanelContainer`/`DraftsPanelContainer` (self-contenido dado sólo `entityKind`/`entityId`,
  inyecta `RelationsService`/`SearchIndexService`/`Router` directo) pero **no vive detrás de un
  toggle** — se auto-oculta (`hasAny()`) cuando no hay ninguna conexión, en vez de un ícono más para
  abrir/cerrar. Dos grupos: "Salientes" (`outgoingFor`) y "Referenciado desde" (`backlinksFor`), cada
  fila con ícono por kind (`entityKindIcon`, ya existente), título, snippet entre comillas si
  `origin:'editor'`, y botón "Desvincular" (`RelationsService.remove`). Click en la fila navega
  (`Router.navigate` + la `route` ya resuelta); deshabilitado si `title === null` (huérfana, nada a
  donde ir).
- **`WorkspaceRefreshService.refreshAll()` suma `relations.refresh()`** (junto a `tags.refresh()`,
  antes de las 6 entidades) — sin este cambio `RelationsService.relations()` quedaba vacío para
  siempre después del boot; se detectó recién al probar en navegador real, no lo cubría ningún test
  unitario porque `RelationsService` en aislamiento no necesita este wiring.
- **Montado en 5 de los 7 kinds del alcance** (`[entityKind]`/`[entityId]` ya cableados en Fase 2):
  notas, tareas, metas, escritos, listas — en cada `*-editor-pane`, inmediatamente después del
  `mc-tag-picker` y antes de `mc-editor` (para listas, antes de `mc-chalkboard-overlay`, no dentro).
  Archivos e imágenes quedan para la Fase 3b (ver abajo) — sus vistas de detalle no comparten el
  patrón `*-editor-pane`/`mc-editor`, hace falta mirar `file-locker.component.ts` y
  `galleries.container.ts` primero.
- i18n: `connections.outgoing`, `connections.backlinks`, `connections.orphaned`,
  `connections.unlink`.
- **Verificado en navegador real** (`/notes/:id` ↔ `/goals/:id`, usando el link creado en la Fase 2):
  el panel "Salientes" aparece en la nota con la meta vinculada; el panel "Referenciado desde"
  aparece en la meta con la nota + el snippet exacto seleccionado (`"balance "`); click en
  "Desvincular" saca la fila del panel **sin recargar** (reactivo, ambos lados actualizan solos
  porque `ConnectionsPanelContainer` depende de la misma señal `RelationsService.relations()`) y el
  panel entero desaparece de los dos lados una vez que no queda ninguna conexión. `bun run
typecheck` limpio, `bun run test` 555/555 verde.

**Fase 3b — archivos e imágenes.** _Cerrado._ Mismo `ConnectionsPanelContainer`, sin cambios al
componente compartido — sólo dos puntos de montaje nuevos.

- `features/files/containers/files.container.html`: `<mc-connections-panel>` entre
  `mc-file-collection-meta-bar` y `mc-file-grid` (dentro del `#drawerContent` `ng-template`, usa
  `collection.id` del `let-collection` implícito). `FilesContainer` suma
  `protected readonly entityKind = FILE_KIND` (ya importado).
- `features/images/containers/galleries.container.html`: mismo patrón, entre
  `mc-gallery-meta-bar` y `mc-museum-room`, usa `gallery.id`. `GalleriesContainer` suma
  `protected readonly entityKind = IMAGE_KIND` (ya importado).
- **Verificado en navegador real**: vinculado desde la nota una colección de archivos sin título
  (label vacío + ícono carpeta, coherente con `entityKindIcon('file') === 'folder'`) → el panel
  "Referenciado desde" aparece en el detalle de la colección con el snippet `"carpeta"`. Sin errores
  de consola nuevos (un error preexistente de `AutocommitService`/`MCB-VER-002` apareció durante la
  sesión de pruebas, ajeno a `RelationsService` — no se investigó más, atribuible a la ráfaga de
  saves de la sesión de testing, no a código de este ítem). `bun run typecheck` limpio, `bun run
test` 555/555 verde, `ng lint` sin errores nuevos.

**Fase 4 — hilos manuales en `/files`.** _Cerrado._

- `FilesContainer` gana `draggingCollectionId` (signal, un solo "qué se está arrastrando" global —
  la cantidad de casillas por carpeta es chica, no justifica trackear dragenter/dragleave por
  casilla para un resaltado más fino del target puntual) + 4 handlers HTML5 drag-and-drop
  (`dragstart`/`dragover`/`drop`/`dragend`) sobre cada `<li class="wall-slot">` del wall-grid.
  Drag-and-drop nativo en vez de pointer-capture (comparar con el drag de estrellas en
  `goal-constellation-editor.component.ts`) porque el gesto acá es "soltar sobre otro elemento
  distinto", no arrastre libre continuo — y no compite con el click de "abrir casillero" del botón
  interno, `FileLockerComponent` queda sin tocar.
- Al soltar sobre una casilla distinta: `RelationsService.create({from, to, origin:'manual'})`
  directo, sin picker — el destino ya está a la vista, resuelve el diferido original
  (`files-writings-tasks.md`, "el rediseño cork board sugiere hilos... hoy no hay modelo de
  relaciones"). Sin `contextSnippet` (no hay frase de origen en un gesto de drag).
- Feedback visual mínimo en `files.container.css`: `.dragging` (opacidad reducida en la casilla
  origen) + `.drag-target` (outline punteado en las demás mientras se arrastra) — sin thread SVG
  entre casillas (ver "explícitamente fuera" más abajo).
- **Verificado en navegador real**: creadas 2 colecciones sin título, arrastrada la 01 sobre la 02 →
  el panel "Referenciado desde" de la 02 muestra la 01 (drag-and-drop nativo del navegador
  respondió a los eventos de mouse sintéticos de la automatización sin problema). Sin errores de
  consola nuevos. `bun run typecheck` limpio, `bun run test` 555/555 verde.

**Fase 5 — mapa de conexiones (grafo de 1 salto).** _Cerrado._ Pedido explícito del usuario después
de cerrar las Fases 1-4 ("la vista de grafo visual la quiero también") — la Fase 3 original la había
descartado a propósito por costo/especulación, pero al pedirse directamente se recortó a algo chico
y real en vez del grafo completo del workspace.

- **Decisión de ubicación** (preguntada al usuario, no asumida): no un ítem nuevo en el rail lateral
  (17 secciones ya conviven ahí) ni una pestaña en `/tags` — un botón **"Ver en el mapa"** dentro del
  panel "Conexiones" existente, que abre el grafo centrado en esa entidad. Sin ruta ni punto de
  entrada global propio.
- **Alcance: 1 salto, no el grafo completo.** Muestra el nodo central + sus vecinos directos
  (salientes + backlinks fusionados por par, con línea `both` si hay ambas direcciones). Click en un
  vecino no navega — **recentra el grafo sobre él** ("caminar" el grafo), con una pila de historial
  simple para el botón "Volver". Navegar de verdad es una acción aparte: botón "Abrir" en el pie,
  siempre apuntando a la entidad central actual. Evita el hairball ilegible de graficar todo el
  workspace sin layout de fuerzas — YAGNI (regla 19): un grafo completo exigiría física de
  repulsión/springs, mucho más código, para un caso de uso ("explorar qué se conecta con qué desde
  acá") que el 1-salto+caminar ya cubre.
- `shared/connections/connections-graph-overlay.component.ts` nuevo: mismo lenguaje visual que
  `goal-constellation-editor.component.ts` (círculos + líneas en SVG puro, sin física real —
  posiciones por ángulo determinístico `i/n * 2π` alrededor del centro), mismo molde de dialog+
  backdrop que `image-picker-dialog.component.ts`. Sin íconos por kind dentro del nodo (exigiría
  `<foreignObject>` para mezclar HTML dentro de SVG, complejidad no justificada para el primer
  corte) — sólo círculo + label truncado.
- **Gotcha de Angular real, encontrado y corregido**: sembrar el signal de "nodo actual" leyendo
  `input.required()` directo en el `constructor()` dispara `NG8118` (el compilador lo trata como
  lectura prematura, aunque el valor ya esté bindeado) — error que **`tsc --noEmit` no detecta**,
  sólo aparece en el build real de Angular (`ng serve`/`ng build`). Fix: signal nullable (`current:
signal<EntityRef | null>(null)`) + un `computed ref()` que cae al valor de los inputs mientras
  `current()` es `null`, sin nada sembrado en el constructor.
- **Gotcha de tooling real, encontrado y corregido**: hacía falta un ícono nuevo (`share-network`,
  chain de 3 círculos, para el botón "Ver en el mapa" — no había ningún ícono de grafo/red en
  `icons.data.ts`). Correr `scripts/generate-icons.mjs` para agregarlo **borró silenciosamente 4
  íconos en uso** (`text-b`, `text-h-two`, `quotes`, `chart-line`) porque el array `ICONS` del
  script está desactualizado respecto al archivo real — alguien agregó íconos a mano a
  `icons.data.ts` en el pasado sin mantener el script en sync, pese al comentario "AUTO-GENERATED...
  do not edit by hand" en el encabezado. Detectado por `bun run typecheck` antes de llegar a
  cualquier lado. Fix: `icons.data.ts` restaurado desde `git show HEAD:...` + `share-network`
  agregado a mano (mismo formato que las demás entradas) en vez de re-correr el generador. El script
  quedó con un comentario `why:` documentando el drift para que nadie más lo corra a ciegas.
- i18n: `connections.viewOnMap`, `connections.graph.title`, `connections.graph.back`,
  `connections.graph.open`, `connections.graph.empty`, `connections.untitled`.
- **Verificado en navegador real**: desde `/notes/:id` con una relación saliente hacia una colección
  de archivos → "Ver en el mapa" abre el diálogo con el nodo central + 1 vecino conectado por línea
  punteada → click en el vecino recentra el grafo sobre él (aparece la flecha "Volver") → "Volver"
  restaura el centro anterior → "Abrir" navega a la entidad central actual y cierra el diálogo. Sin
  errores de consola nuevos. `bun run typecheck` limpio, `bun run test` 555/555 verde.

**Fase 6 — "Vincular a…" descubrible sin vista Combinada.** _Cerrado._ Feedback directo del usuario
tras probar las fases anteriores: "aún está poco claro, necesito que sea lo más obvio posible".
Preguntado dónde exactamente (varias fricciones candidatas: entry point, panel, drag en /files) —
respuesta: encontrar "Vincular a…" en primer lugar. Causa raíz real: el único punto de entrada era
el botón de la bubble menu, que sólo se muestra con selección de texto **y** en vista Combinada — un
usuario nuevo no tiene ningún motivo para haber cambiado a Combinada todavía (esa vista es para
comentar/proponer cambios, conceptos que tampoco conoce sin haberlos usado).

- **Botón fijo en la barra del editor**, siempre visible cuando es editable (mismo patrón que
  "Insertar imagen" — `editor-toolbar.component.ts` gana un botón "Vincular a…" con
  `data-tutorial="editor-toolbar-link"`, nuevo output `openLinkPicker`), sin depender de
  `view()`/selección. Funciona en `clean` y en `combined` por igual.
- **`EditorComponent.triggerLink()` deja de exigir selección no vacía** y ya no llama
  `ensureCombined()` (vincular no es una operación de rama — la llamada anterior era vestigial,
  documentada como "parity" en la Fase 2, nunca necesaria). Con selección: envuelve el texto elegido
  (comportamiento igual que antes). Sin selección: inserta el chip en la posición del cursor
  (`insertContentAt({from, to}, ...)` con `from === to` funciona igual para ambos casos, ProseMirror
  ya lo maneja).
  `contextSnippet` queda vacío en el caso sin selección (`RelationsService.create` ya omitía el campo
  cuando la string es `''`, sin cambios ahí).
- **Mismo botón replicado en `chapter-editor-pane.component.ts`** (libros esconden el toolbar interno
  de `mc-editor` por la paginación multi-columna — ya tenían este patrón para "Insertar imagen"/
  bold/italic/etc, delegando a `editorRef()?.metodo()`; `triggerLink()` sigue el mismo molde).
- La entrada de la bubble menu (combined + selección) queda como está, sin quitar — dos caminos al
  mismo `triggerLink()`, no una feature duplicada.
- **Verificado en navegador real**: el botón aparece siempre en la barra (vista Limpia, sin
  necesidad de cambiar a Combinada) → clickeado sin selección de texto inserta el chip en el cursor
  → clickeado con selección envuelve el texto elegido (comportamiento previo intacto) → el panel
  "Salientes" refleja ambas conexiones nuevas correctamente tras reload. `bun run typecheck`
  limpio, `bun run test` 555/555 verde.

**Explícitamente fuera de este ítem** (ver "Qué queda afuera" en `features.md` §10bis): grafo
completo del workspace con layout de fuerzas (la Fase 5 sólo cubre 1 salto desde una entidad,
caminable pero no un mapa global), sugerencias automáticas por similitud/tags compartidos, y
extender los kinds vinculables a recordatorios/música.

**Cierra al implementarse:** el target de "Referencias/links entre entidades desde el editor"
(`docs/deferred/shortcuts-cross-section.md`) y de "Hilos entre items relacionados"
(`docs/deferred/files-writings-tasks.md`) — ambos ya apuntan a este paso (regla §4.11.25b). Se
borran de sus archivos de tema recién cuando este ítem cierre implementado, no antes.

---

28. **Vista de lista + atajos de fila (J/K/Space/E/Del) en tasks y goals.** _Cerrado — implementado
    y verificado en navegador real, 2026-08-01._

**Contexto.** `docs/deferred/reminders-goals.md` tenía diferido "Atajos de navegación de fila
(J/K, Space, E, Del) — pendiente en tasks/goals" desde el rediseño de reminders (donde sí se
resolvió, con el primitivo `createListCursor`, `shared/utils/list-cursor.ts`): tasks (`/tasks`,
kanban de buckets) y goals (`/goals`, wall de constelación) no tenían ningún orden de fila visible
al que mapear J/K sin inventar uno arbitrario — violaría "la UI no debe mentir" (`reglas.md`).
Ambas features sí tenían un orden real subyacente sin usar para navegación: `TaskSummary.position`
(el mismo que reordena `onWater()`) y `GoalSummary.position` (el que ya usa el comparator de
`GoalsService.summaries`). El paso agrega un **modo lista** (toggle, mismo patrón que el grid/list
de `/books`) que hace ese orden visible, y recién ahí cablea J/K/Space/E/Del sobre él.

- `shared/utils/row-nav.controller.ts` nuevo: `RowNavController` centraliza el bloque de 5
  bindings J/K/Space/E/Del que reminders tenía inline en `registerShortcuts()` — reutilizado tal
  cual por tasks y goals en vez de copiarlo, porque ambos containers ya estaban al límite duro de
  300 líneas (`reglas.md` §4.4) antes de este cambio.
- `/tasks`: `TasksGardenContainer` gana `viewMode` (`'garden'|'list'`, persistido en
  `localStorage`, mismo patrón que `night`/`watering`) + botón toggle en el header. El modo lista
  agrupa por bucket (hoy/semana/backlog), cada grupo ya ordenado por `position`. Espacio cosecha la
  fila enfocada (no hay "descosechar" — mismo comportamiento que el botón existente).
- `/goals`: `GoalsWallContainer` gana el mismo toggle (`'wall'|'list'`). El modo lista filtra por
  query/tags/hideCompleted (mismo criterio que `buildStars`) y ordena por `summaries()` (ya
  ordenado: no completadas primero, luego `position`). Espacio marca/desmarca "lograda".
- **Bug preexistente encontrado y corregido**: `ShortcutsService.matches()` (`core/shortcuts/`)
  hacía `.trim()` sobre cada parte del combo — un combo `' '` (barra espaciadora, usado por
  reminders desde su rediseño) se convertía en `''` y nunca podía matchear `event.key === ' '`. El
  Space de reminders estaba silenciosamente roto desde que se implementó; se detectó al verificar
  Space en tasks/goals en navegador real. Fix + `shortcuts.service.spec.ts` nuevo (regresión sobre
  `matches`, exportada para testeo).
- i18n: `tasks.garden.viewMode.*`, `tasks.garden.list.*`, `tasks.shortcuts.*`,
  `goals.wall.viewMode.*`, `goals.shortcuts.*`, más un step "avanzado" en `tasks.tutorial.ts` y
  `goals.tutorial.ts` cada uno (regla §4.6.15b).
- **Verificado en navegador real**: toggle a lista en ambas páginas, J/K mueve el cursor (resaltado
  visible), Space cosecha/marca-lograda la fila enfocada, E navega a la entidad, Delete abre el
  diálogo de confirmación existente. Persistencia del modo de vista confirmada tras reload.
  `bun run typecheck` limpio, `bun run test` 567/567 verde (562 previos + 5 nuevos), `bun run lint`
  sin errores nuevos (0 errores, warnings preexistentes sin cambios).
