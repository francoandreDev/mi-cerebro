# Diferidos

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

---

## Notas (origen: paso 5)

### Vista de papelera

- **Qué**: UI para listar, restaurar y vaciar lo borrado con soft-delete. Hoy las notas se mueven a `.mi-cerebro/trash/YYYY/MM/DD/` y no hay forma de recuperarlas sin tocar disco a mano.
- **Por qué**: el soft-delete era para no perder datos. La UI de papelera es una pieza transversal a todas las entidades, no de notas.
- **Target**: §19.9bis (papelera + carpetas).

### ~~Carpetas / jerarquía real dentro de notas~~ (resuelto en §19.23a)

- **Qué**: poder anidar notas en carpetas creadas por el usuario, no sólo un grupo raíz "Notas".
- **Estado**: cerrado. Breadcrumb + drill-down (§19.23a, `shared/folder-breadcrumb/`) en `/notes` — mismo mecanismo que el resto de las 8 entidades.

---

## Árbol con filtro (origen: paso 6)

### Filtros por tipo de entidad

- **Qué**: combinaciones de filtros por tipo (notas+tasks+goals, etc.) descritos en §10.
- **Por qué**: sólo existe la entidad Note hoy. El filtro por tag ya está cubierto en 7b.
- **Target**: §19.9 (resto de entidades).

---

## Tags (origen: paso 7a)

### ~~UI dedicada de gestión de tags~~ (resuelto 2026-07-04)

- **Qué**: pantalla para listar todos los tags, renombrar masivo, hacer merge entre dos, ver cuántas entidades usa cada uno, eliminar limpiando referencias.
- **Estado**: cerrado. Ruta `/tags` (`TagsContainer`) lista todas las etiquetas con conteo de uso, filtro por label, rename inline, recolor (reusa la paleta de swatches), merge ("Combinar con...") y delete con confirmación (muestra cuántas entidades la usan). La orquestación cross-kind vive en `core/tags/tags-admin.service.ts` (`TagsAdminService`), siguiendo el mismo patrón que `TrashService`/`FoldersService`/`calendar-events.service`: un agregador en `core/` inyecta los 8 servicios de entidad taggeable (notes/tasks/goals/lists/writings/books/images/files) para que ninguna feature tenga que importar a otra. `usageCounts` es un `computed` que recorre los `summaries()` ya cargados de cada kind (sin índice inverso persistido). `merge(fromId, toId)` reescribe el array `tags` de cada entidad afectada y remueve `fromId` del registro; `deleteCascade(id)` remueve el tag del registro primero y re-guarda las entidades afectadas — cada `*Service.save()` ya filtra tags ausentes del registro (`dropStaleTags`), así que no hizo falta un método nuevo por kind para el borrado. Rail icon 🏷 cerca de 🗑/⚙. 9/9 tests nuevos (`tags-admin.service.spec.ts`).

### ~~Color picker custom para tag~~ (resuelto en §19.15, entrada obsoleta)

- **Qué**: dejar al usuario elegir el color de un tag desde la UI.
- **Estado**: esta entrada quedó desactualizada — el mini-picker inline en `mc-tag-picker` (click en el dot del chip abre la grilla de `TAG_SWATCHES`, "✕" vuelve al hash determinístico, persistido en `Tag.colorSwatchId` vía `TagsService.setSwatch`) ya se construyó al cerrar §19.15 (paso 15 del roadmap). La pantalla `/tags` (arriba) reutiliza el mismo patrón de swatches en cada fila. Se borra por regla §4.11.24 (doc desactualizada miente) en vez de dejarla como "pendiente".

---

## Búsqueda (origen: paso 7b)

### ~~Botón / atajo de "reindexar" manual~~ (resuelto 2026-07-04)

- **Qué**: §10 menciona "botón reindexar para rebuild manual si se corrompe". Hoy el rebuild ocurre solo en cada `refresh()` (apertura del workspace o paneo); no hay UI explícita.
- **Estado**: cerrado. Botón "Reindexar" en `/settings` → sección General, junto a zona horaria. Llama a `WorkspaceRefreshService.refreshAll()` (mismo método que usa el boot y el switch de variante), con estado busy/spinner y mensaje de confirmación.

### ~~Snippet centrado en la coincidencia (con highlight)~~ (resuelto 2026-07-04)

- **Qué**: en lugar de mostrar los primeros 160 caracteres del body, mostrar un fragmento alrededor del término encontrado y resaltarlo.
- **Estado**: cerrado. `SearchIndexService` guarda el body aplanado completo por doc (`DocMeta.body`) en vez de un snippet pre-truncado; en `query()`, `buildSnippet()` re-escanea el texto normalizado buscando el término matcheado más temprano (de `r.terms`, ya que MiniSearch no expone offsets) y mapea el índice de vuelta al texto original (largo 1:1 preservado por `norm()`) para recortar una ventana de ±70 caracteres. `SearchHit.snippet` pasa de `string` a `{ pre, match, post }`; la paleta renderiza `pre` + `<mark>{{ match }}</mark>` + `post` sin `innerHTML`/sanitizer. Sin match (browse por tag, o recientes) cae al fallback de los primeros 160 caracteres, igual que antes. `SEARCH_INDEX_VERSION` bump a 2 (el índice persistido en IndexedDB se reconstruye solo si cambia el schema; el usuario puede forzarlo con el botón "Reindexar" ya cerrado arriba).

### ~~Historial de últimas búsquedas / accesos recientes~~ (resuelto en §19.16a-ii + §19.16a-iii)

- **Qué**: al abrir la paleta sin escribir nada, mostrar las últimas entidades visitadas o búsquedas recientes.
- **Estado**: cerrado. Entidades recientes en §19.16a-ii (`@core/search/palette-recents.service`, sección "Recientes"). Queries literales en §19.16a-iii (`@core/search/palette-queries.service`, sección "Búsquedas anteriores" con ✕ para olvidar).

### ~~Continuidad: última ruta + scroll al abrir~~ (resuelto en §19.16a-i)

- **Qué**: §10 menciona "vuelve a la última ruta + última entidad abierta + scroll". Hoy se abre en `/notes` sin recordar nada.
- **Estado**: cerrado en §19.16a-i (`@core/continuity/continuity.service`, redirect funcional desde `/`, scroll restore en `NavigationEnd`).

---

## Versionado y variantes (origen: paso 13)

### ~~Anchor `range` multi-bloque (selección que cruza párrafos)~~ (resuelto en §19.16e-iii)

- **Qué**: hoy `range` queda confinado al bloque donde está `$from`. Selecciones que cruzan dos o más bloques caen al anchor `block` del primero (sin range). Comentar a través de párrafos no se soporta.
- **Estado**: cerrado. Nuevo `CommentAnchorType` `'range'` + `Comment.span: { startBlockId, startOffset, endBlockId, endOffset }` (par de endpoints, no lista — más simple de mapear/orphanar). Orphan handling en `comments-orphans.ts`: sólo se marca huérfano si `startBlockId` o `endBlockId` desaparecen; un bloque borrado _entre_ medio no orphana (el span simplemente cubre menos contenido). `comment-range-mapping.ext.ts` trackea ambos endpoints como posiciones absolutas (igual que el `range` de un solo bloque — `tr.mapping` no distingue bloques) y los re-resuelve a bloque/offset en cada `view.update` vía lookup inverso posición→bloque. `comment-clouds.ext.ts` dibuja la nube al final del último bloque del span y una única decoración inline que cruza los nodos intermedios sin clamping (ProseMirror lo permite nativamente). Creación: `blockSpanAtSelection` en `editor-selection.utils.ts` detecta selección cross-block comparando el blockId en `$from` vs `$to`.

### ~~Widget render para diff-marks de tipo "insertion-only"~~ (resuelto en §19.16e-iv)

- **Qué**: los diff-marks que insertan bloques enteros sin anchor en `main` no tenían punto de inserción inline natural y quedaban listados sólo en el popover de pendientes.
- **Estado**: cerrado. Nuevo mini-renderer JSON→DOM puro (`core/tiptap/draft-decorations/diff-mark-preview.ts`) cubre el subset de nodos/marcas que produce el editor (paragraph/heading/blockquote/lists/codeBlock/horizontalRule + bold/italic/strike/code/highlight), con fallback a `div` para cualquier tipo de nodo inesperado. `draft-decorations.ext.ts` lo usa para pintar cada mark `insert` (anchorType `block`) como un widget decoration (`Decoration.widget`) al final del doc — mismo punto donde `applyMarkToDoc` los aplica al aceptar — en vez de dejarlos sin renderizar como antes. El widget (`.mc-draft-insert`) es no editable (`contenteditable="false"`), clickeable, y delega el click a `EditorComponent.onDraftInsertClick`, que abre el popover de borradores con ese mark pre-seleccionado (nuevo input `focusId` en `DraftsPanelContainer`). Los marks `insert` con `anchorType: 'doc'` siguen sin renderizado inline (son el fallback raro de todo-el-documento); el popover sigue siendo la única vía para esos y para accept/reject de cualquier mark.

### Granularidad por faceta dentro del bundle de merge

- **Qué**: en 13b–d el merge ofrece elegir por entidad el bundle entero (main + draft + comments de la variante origen). Una versión avanzada permitiría tomar `main` de la variante origen pero quedarse con el `draft` o los `comments` de la variante destino.
- **Por qué**: cubre un caso raro y agrega 3× botones por delta en la UI de merge. Decisión explícita de "simple gana".
- **Target**: sin asignar (se agrega si aparece demanda real).

### Variantes sobre el fallback sin isomorphic-git

- **Qué**: si el adapter de isomorphic-git resulta inviable en 13a y se cae al fallback de snapshots en `.mi-cerebro/history/`, las variantes (13b en adelante) no son soportables. La app degrada a una sola "Principal" implícita.
- **Por qué**: implementar variantes sin git significaría reinventar branching + merge desde cero. No vale la pena hasta confirmar que isomorphic-git no funciona.
- **Target**: sin asignar (sólo se aborda si el fallback se activa en 13a).

### ~~Colapsar chips de kind en la timeline cuando hay más de N~~ (resuelto 2026-07-04)

- **Qué**: hoy cada commit de la timeline muestra todos los chips de kind tocado (`note`, `task`, `goal`, `image`, `book`, `file`, `list`, `track`, `tag`, `writing`). Cuando el commit toca 8-10 kinds los chips envuelven a dos líneas y desbalancean visualmente la fila.
- **Estado**: cerrado. `HistoryContainer.visibleKinds()`/`hiddenKindsCount()` cortan en `MAX_VISIBLE_KIND_CHIPS = 4`; el resto colapsa en un chip `+N más` (`.chip-more`).

### Toggle "ver sólo cambios" en diffs largos

- **Qué**: el diff de cuerpo (TipTap → prosa + jsdiff) muestra todo el contenido, no sólo los chunks `add`/`remove`. En notas largas las líneas de contexto opacitadas dominan visualmente. Sería útil un toggle que oculte los `context` y deje sólo los chunks modificados con un separador `…`.
- **Por qué se difirió**: nice-to-have. Con contexto reducido (~3 líneas alrededor de cada cambio) la legibilidad puede mejorar sin esconder nada — esa es una alternativa más conservadora que también queda en este ítem.
- **Target**: §19.16f.

### Tooltip por-día en la panorámica (hover sobre la ladera)

- **Qué**: al pasar el mouse sobre la silueta de la cordillera (`.panorama-svg`), mostrar un tooltip flotante con `{fecha} · N hallazgos · mix de facetas`. Actualmente el hit-rect ya tiene `<title>` accesible (nativo del navegador), pero el hover no revela el pico exacto en el eje horizontal — el título aparece con retardo del OS y no muestra el mix de facetas.
- **Por qué se difirió**: Fase 3 lo dejó marcado como "no crítico, pulido posterior". Cerramos Fase 5 sin abordarlo porque la navegación real (doble-click en columna, click en fósil, mini-mapa desde estratos) ya cubre el flujo principal y agregar un tooltip HTML propio implica un componente flotante posicionado sobre SVG con manejo de escape/scroll.
- **Target**: §19.16f (pulido del historial) — junto con el resto del polish visual del rediseño.

### Pulido visual general de `/history`

- **Qué**: cuando cerramos 13a el usuario confirmó que la información está completa y legible pero "mucha info, poco visual". Queda como ítem único agrupador para futuras iteraciones de tipografía, densidad, jerarquía y micro-interacciones del historial (anchos de columna, separadores entre buckets, hover states, animación del cambio de selección, etc.).
- **Por qué se difirió**: estructura y funcionalidad están; el polish entra cuando 13a-d estén cerrados y tengamos uso real para saber qué duele.
- **Target**: §19.16f.

### Iconito de entidad principal en cada polaroid revelada

- **Qué**: cada polaroid del zoom cordel muestra el diff ya renderizado (entidades tocadas en la leyenda al pie), pero no un ícono de la entidad principal del commit sobre la propia foto — pendiente desde el plan original de `docs/history-v2-handoff.md`.
- **Por qué se difirió**: usa `entities` del diff, que ya está disponible una vez que `HistoryDiffService.loadForCommit` resuelve; quedó anotado como pulido visual menor, no bloqueante para el gate de la Fase 4.
- **Target**: §19.16f.

### Refactor de `/history` a subcomponentes por zoom

- **Qué**: `history.container.ts` (~946 líneas) y `history.container.html`/`.css` (`.css` con 1900+ líneas) concentran todo el estado de zoom, prefetch y revelado en un solo archivo, por encima del límite de 200 warn / 300 err de §4.4. El plan es partir en `<mc-history-panorama>`, `<mc-history-strata>`, `<mc-history-cordel>`.
- **Por qué se difirió**: el rediseño priorizó cerrar las 5 fases funcionales antes de la extracción estructural; el refactor no cambia comportamiento, sólo baja el tamaño de archivo.
- **Target**: §19.16f.

### Preview inline del diff en hover sobre la polaroid (zoom detalle)

- **Qué**: en la vista cordel (§rediseño /history v2 Fase 4), mostrar un preview del diff al hacer hover sostenido sobre una polaroid sin necesidad de seleccionarla y esperar a que la mesa de revelado la muestre abajo.
- **Por qué se difirió**: pulido visual evaluado como posible upgrade después de cerrar Fase 4; no se abordó porque click+mesa de revelado ya cubre el flujo principal sin estado adicional de hover.
- **Target**: §19.16f.

### Vista secundaria de constelaciones ("mapa de patrones de trabajo")

- **Qué**: vista alternativa tipo cielo estrellado que revele patrones de trabajo emergentes (ritmo, picos, gaps) en vez de commits individuales navegables. Se descartó como vista principal del rediseño de `/history` v2 porque encontrar un commit específico en un layout 2D estrellado es peor que en la cordillera/estratos/cordel, pero quedó anotada como posible vista secundaria.
- **Por qué se difirió**: opcional, muy posterior — sólo si el rediseño principal (cordillera/estratos/cordel) deja "hambre" de ese eje analítico distinto (patrones en vez de hechos puntuales).
- **Target**: sin asignar.

### Header del editor: "n commits desde {milestone}"

- **Qué**: 13a-bis grabó milestones como git tags anotados pero no expone "estás a n commits desde el milestone más cercano" en el header del editor de cada entidad. El roadmap lo describe como "contexto leve".
- **Por qué se difirió**: requiere walk del log desde HEAD hasta el primer commit con tag (por entidad o global), un computed que reacciona a cada autocommit, y un slot visual en el header del editor que hoy ya está cargado de chips (autosave, lock, tags). Sumado a que `/history` ya muestra los milestones inline, el valor incremental es marginal hasta tener varios milestones reales en uso.
- **Target**: §19.16f (pulido del historial).

### Índice de búsqueda persistido por familia (`idx-<family>-main`)

- **Qué**: §12 13b-ii describe un índice MiniSearch por familia cacheado en IndexedDB, así el switch sólo paga rebuild la primera vez. En la implementación inicial elegimos rebuild-from-disk en cada switch porque (a) la latencia es del orden de la del primer boot, (b) introducir N índices ramifica la API de `SearchIndexService` y triplica el costo cuando lleguen 13c (comments) y 13d (draft), y (c) hasta no tener uso real con workspaces grandes no sabemos si la diferencia se siente.
- **Por qué se difirió**: optimización prematura sin métricas reales. La parte crítica del switch (commit + checkout + index swap atómicos bajo FsLockService) sí entra en 13b-ii; lo cacheable se mete después si el usuario lo nota.
- **Target**: §19.16f o sin asignar (sólo si el switch resulta lento en uso real con muchas entidades).

### Índice de búsqueda global para comentarios (`idx-<family>-comments`)

- **Qué**: §12 y §19.13c-iv listan un índice MiniSearch persistido por familia para comentarios, integrado al palette global. La infraestructura técnica del índice por familia ya se diferió arriba para `main`; agregar comments multiplica el costo (un MiniSearch por faceta) sin tener todavía métricas reales. En 13c-iv elegimos cerrar position tracking + merge bundle + history chips, dejando la indexación global de comentarios para cuando exista un walk explícito de la rama comments al boot/family-switch (necesario para "primear" el índice sin abrir cada entidad a mano).
- **Por qué se difirió**: integrar `SearchIndexService` con kind nuevo `'comment'` sin un walk de priming hace que la búsqueda sólo encuentre comentarios de entidades que el usuario tocó en la sesión actual — una UX "fantasma" peor que no tenerla. Hacer el walk requiere recorrer cada `comments/*.json` de la rama activa, lo que toca el mismo plumbing que el priming por familia y conviene diseñar junto.
- **Target**: §19.16d (pulido de búsqueda) — o un sub-paso 13c-iv-bis si surge dolor concreto antes.

### Índice de búsqueda global para borradores (`idx-<family>-draft`)

- **Qué**: §12 y §19.13d-iv listan un índice MiniSearch persistido por familia para diff-marks de borrador, integrado al palette global. Mismo razonamiento que el índice de comentarios diferido arriba: integrarlo sin un walk de priming de la rama `draft` al boot/family-switch dejaría la búsqueda mostrando sólo marks de entidades tocadas en la sesión actual — UX "fantasma". Hacer el walk requiere recorrer cada `drafts/*.json` de la rama activa, lo que toca el mismo plumbing que el priming por familia para `main` y `comments`.
- **Por qué se difirió**: los tres índices (main, comments, draft) convergen sobre la misma pieza de infraestructura (walk per-faceta + cache por familia en IndexedDB). Diseñarlos juntos evita reinventar el priming tres veces y permite decidir si los tres comparten un `idx-<family>-bundle` o quedan separados. Sin métricas reales de tamaño/latencia, mejor uno solo bien hecho.
- **Target**: §19.16d (pulido de búsqueda) — junto con los índices de `main` y `comments`.

### Índice de búsqueda de commits (full-text sobre mensajes + entidades tocadas)

- **Qué**: un índice MiniSearch sobre el log de commits (mensaje + entidades tocadas) integrado al palette global, para poder buscar "¿cuándo toqué X?" sin abrir `/history` y escanear estratos a mano.
- **Por qué se difirió**: misma familia de problema que los índices de `main`/`comments`/`draft` diferidos arriba — requiere decidir priming al boot y si comparte infraestructura con esos índices. Se agrupa con ellos para diseñarse una sola vez.
- **Target**: §19.16d (pulido de búsqueda) — junto con los índices por familia ya diferidos.

### ~~Umbral de compactación configurable en settings~~ (resuelto 2026-07-04)

- **Qué**: §12 "Compactación del historial" fijaba el umbral de disparo en 500 commits por rama sin exponerlo en settings.
- **Estado**: cerrado. `Settings.versioning.compactionThresholdCommits` (default 500, clamp 50–10000) en `settings.types.ts`/`settings.service.ts`; `CompactionSchedulerService.threshold` pasó a computed leyendo ese valor. Campo numérico con draft/apply en `/settings` → Versionado, junto al de autocommit.

### ~~Dev panel para la compactación~~ (resuelto 2026-07-04)

- **Qué**: una pantalla `/dev` que exponga `CompactionSchedulerService.runOnce({ ignoreThreshold })` como botón para QA, en vez de depender de la consola del navegador.
- **Estado**: cerrado. Ruta `/dev` (no linkeada desde el rail) con `DevContainer` — muestra rama más pesada vista + umbral actual y un botón "Compactar ahora" con estado busy/done. Los demás toggles de dev-perf (`DevPerfService`, `dev-variants-switch-tests`) siguen sin UI propia; se suman a este panel si aparece necesidad real.

### Compactación manual sobre rango específico

- **Qué**: además de la pasada background automática, una acción "Compactar este rango" desde `/history` que permita al usuario seleccionar un span de commits y forzar la fusión, respetando las barreras (tags, `before-restore`, `Merge-Group`).
- **Por qué se difirió**: la compactación background con buckets por edad cubre el caso 95%. Compactación manual es una herramienta avanzada que se justifica si el usuario quiere "limpiar" un período específico sin esperar al auto. Sin uso real no hay forma de saber si vale la UI.
- **Target**: sin asignar.

### Banner accionable de "compactar ahora" en el lecho de roca de `/history`

- **Qué**: el `.bedrock` al pie de la vista de estratos ya muestra el conteo real de commits compactables pendientes (`CompactionSchedulerService.shouldSuggestEnableCompaction`), pero es informativo — no tiene un botón que dispare la compactación desde ahí mismo. Hoy esa acción sólo existe en `/dev` (`DevContainer`, no linkeado desde el rail).
- **Por qué se difirió**: se dejó para cuando el flujo de compactación tenga UI dedicada más allá del panel de dev/QA — traer la acción al lecho de roca implica exponerla a un flujo de usuario final, no sólo debug.
- **Target**: sin asignar.

### `.git/` en OPFS para acelerar operaciones git

- **Qué**: mover `.git/` (loose objects + refs + index) al Origin Private File System del browser, dejando sólo el workdir visible en la carpeta del usuario via FS Access. isomorphic-git acepta nativamente `dir` (workdir) y `gitdir` separados. La ganancia esperada es 10-100×: cada syscall sobre OPFS cuesta ~5-10 ms vs ~100-200 ms sobre FS Access. Eso bajaría el commit base de ~3 s a ~200 ms.
- **Por qué se difirió**: las mediciones del validador en 13a (`DevPerfService`) confirmaron el piso de 3 s/commit, pero la decisión de producto fue aceptar pantallas de carga contextuales para las operaciones git disparadas por el usuario (switch de variante, merge, accept de diff-mark, crear/borrar variante) en vez de invertir 2-3 horas y duplicar el modelo de FS clients. Patrón estándar de clientes git; se entiende como aceptable hasta que el uso real demuestre lo contrario.
- **Implicaciones si se aborda**: el export ZIP (paso 14) tiene que leer también OPFS. Si el usuario limpia datos del sitio, pierde el historial git (pero conserva sus notas y puede recuperar el historial desde GitHub si tenía push configurado en 13e). Riesgo nuevo: races entre main thread (autosave) y posibles workers de git — habría que serializar accesos.
- **Target**: sin asignar (sólo si la UX con loading screens resulta intolerable en uso real, especialmente en 13b switches frecuentes o 13d accept-spam).

### Crypto-at-rest para PAT en `secrets.json`

- **Qué**: 13e-i persiste el GitHub PAT en plano dentro de `.mi-cerebro/secrets.json` (path agregado a `.gitignore` por default, nunca entra al árbol git). El plan original incluía pasphrase-based crypto (PBKDF2 + AES-GCM) sobre el campo `remote.token` para protegerlo si la carpeta del workspace se respalda/copia a otro lado sin filtros.
- **Por qué se difirió**: el threat model real al cerrar 13e era "PAT no debe entrar a git push", no "PAT debe sobrevivir leak del filesystem". El gitignore + path bajo `.mi-cerebro/` cubre el primero. Pedir passphrase en cada boot rompe el flujo "abrir la app y editar" que es lo que el usuario hace 99% de las veces; cachear la passphrase en memoria entre boots requiere otro mecanismo (Web Crypto + non-extractable key + IndexedDB) que multiplica la complejidad por 3 sin métricas reales de leak.
- **Target**: §19.16f.

### CORS proxy propio para push/fetch a GitHub

- **Qué**: 13e-i usa `https://cors.isomorphic-git.org` (proxy público mantenido por la lib) para sortear CORS de GitHub HTTPS. Funciona pero es un single point of failure operado por terceros; el plan a largo plazo es un proxy propio (Cloudflare Worker o similar) que el usuario apunta desde `/settings`.
- **Por qué se difirió**: levantar y mantener un proxy propio requiere infra externa al repo. Para el smoke push inicial y uso single-user el proxy público sirve; el usuario está advertido en la UI.
- **Target**: §19.16f.

---

## Papelera / UI (origen: rediseño de /trash)

### Thumbs reales 2×2 para galerías en la papelera

- **Qué**: la card de galería en `/trash` muestra hoy un mosaico estilizado con íconos de cámara y el contador de imágenes (vía `trash.preview.images`). El objetivo es renderizar el `GalleryCoverComponent` real con hasta 4 thumbnails leídos del dir de la galería en `.mi-cerebro/trash/`.
- **Por qué se difirió**: requiere extender `TrashService` (o `GalleriesService`) con un método que, dado un `TrashEntry` de kind `image`, lea el `meta.json` del dir borrado y devuelva blobs de las primeras N imágenes, más gestión del lifecycle de object URLs en la container (createObjectURL/revokeObjectURL al cambiar visibilidad o desmontar). Es un trabajo cross-feature no trivial para una vista de baja frecuencia. El v1 da el salto visual con cards por kind + countdown + filtros + ops jerarquizadas; la fidelidad fotográfica queda como pulido posterior.
- **Target**: sin asignar.

### Volumen real (`BookVolumeComponent`) para libros en la papelera

- **Qué**: la card de libro en `/trash` muestra hoy un tratamiento tipográfico estilizado (inicial grande + byline) en una caja con aspect-ratio 3/4. El objetivo es reusar el `BookVolumeComponent` real con `accent` del bundle del libro borrado.
- **Por qué se difirió**: requiere leer el `BookBundle` desde el archivo de la papelera para extraer `accent` + cualquier otro metadato necesario por el volumen. Mismo razonamiento que los thumbs: baja frecuencia, no bloquea la UX nueva.
- **Target**: sin asignar.

---

## Books / UI (origen: rediseño de /books)

### Pin/fijado de estantes al tope del bookshelf

- **Qué**: poder "anclar" estantes al tope para que no se muevan del orden alfabético — útil cuando hay muchos estantes y querés acceso rápido a 1-2 frecuentes.
- **Por qué se difirió**: con densidad compacta + colapso el problema de scroll quedó razonable. Pin agrega estado nuevo (set de pinned folders en localStorage), reordering del computed `shelves`, y UI (icono pin en el shelf-head). Vale la pena recién con N>10 estantes; hoy con 1-3 estantes es overkill.
- **Target**: sin asignar — abrir cuando aparezca dolor real de "tengo muchos estantes y los importantes se pierden".
- **Origen**: sesión 2026-06-29 (rediseño /books shelf — mencionado en la propuesta de UX para el problema de espacio, postergado por YAGNI).

### Estantería con forma creativa / no lineal (árbol, curva, etc.)

- **Qué**: el shelf actual es una pared rectangular con tablas horizontales y bookends a los lados — metáfora "biblioteca clásica". Una versión avanzada permitiría layouts no rectangulares: ramas de árbol con shelves angulados, espirales, formas custom que el usuario elija o defina. Las referencias mostradas en la sesión incluían un shelf con forma de árbol (ramas con libros agrupados por copa/tronco) que carga significado adicional ("estos son mis raíces", "estos son los frutos recientes", etc.).
- **Por qué se difirió**: el v1 todavía no resuelve los básicos (legibilidad del lomo, reorden, múltiples estanterías nombradas). El layout creativo agrega complejidad de posicionamiento (cada shelf necesita su propio ángulo + ancla en una grilla 2D), modelo de "shape" persistido, y editor visual para que el usuario configure. Primero hay que pulir la metáfora clásica.
- **Target**: sin asignar — abrir cuando el shelf clásico esté funcional (legible, reordenable, multi-estante) y aparezca demanda real de "quiero mi biblioteca con forma de X".
- **Origen**: sesión 2026-06-29 (rediseño /books shelf — el usuario referenció una estantería en forma de árbol como inspiración).

### IDs de libros legibles / acortados en la URL

- **Qué**: hoy `/books/:bookId/:chapterId` usa UUIDs (`23ad559b-8c33-4817-bf85-2cf8a9eb0af9/35d67ec5-e808-4aaa-b04e-cd9064eda6f9`) — internamente está bien pero externamente es ilegible, impráctico para compartir/recordar y satura la barra del browser. El "patrón id" está extendido a toda la app así que probablemente conviene resolverlo de forma transversal, no sólo en books.
- **Por qué se difirió**: requiere decidir esquema (slug derivado del título con desambiguación numérica, hash corto base36 de 6-8 chars, mapping bidireccional id↔shortId con índice en disco), migración de URLs viejas (¿redirect 301-like?, ¿soportar ambas?), y resolver colisiones cuando dos entidades distintas generan el mismo slug. Decisión cross-feature (notas, tasks, listas, escritos, libros, galerías, etc.) que merece su propio paso de roadmap, no entra en una sesión de UI de books.
- **Target**: sin asignar — sub-paso transversal a definir.
- **Origen**: sesión 2026-06-29 (rediseño /books reader, anotado mientras se enfocaba el espacio desaprovechado en la página).

### Override de imágenes para portada/reverso de libro y miniaturas de capítulo

- **Qué**: los modelos `Book.cover/back` y `Chapter.image` admiten `kind: 'image'` con ref a un archivo blob en disco. Hoy sólo se usa `kind: 'auto'` (procedural: gradiente + glyph derivados del id) y el usuario no puede subir imagen propia.
- **Por qué se difirió**: implementar el picker + storage (`books/<book>/cover.{jpg,png}`, `back.*`, `chapters/<chId>.img.*`), generación de miniaturas (cacheo en IndexedDB tipo `GalleriesService.renderThumb`) y un nuevo código `MCB-IMG-*` para "blob ilegible" es una feature de tamaño propio. Los faces procedurales ya dan identidad visual al libro y al capítulo. Cuando se aborde, basar el flujo en `GalleriesService.addImage` y refactorizar a un helper compartido.
- **Target**: sin asignar — abrir cuando el usuario lo pida o cuando se haga "biblioteca rica con tapas reales".

### Paginación real persistida fila por fila (no global)

- **Qué**: hoy `Chapter.pageCount` se actualiza cuando el editor abre el capítulo (totalSpreads\*2). Capítulos nunca abiertos caen a `ceil(words/250)`. Esto significa que el rango "pag X–Y" del índice puede mentir hasta la primera apertura.
- **Por qué se difirió**: para tener páginas exactas sin abrir el capítulo habría que renderizar el editor en headless al cargar el libro (caro) o derivar la métrica de un cálculo de altura puro sobre el JSONContent (frágil, depende del CSS). Es una optimización para libros viejos que nunca pasaron por el editor v4; libros nuevos se autocorrigen apenas el usuario los abre.
- **Target**: sin asignar.

### Menú ⋯ con duplicar / exportar a Markdown

- **Qué**: opciones "Duplicar libro", "Exportar libro a .md", "Exportar capítulo activo a .md" en el menú overflow del meta bar. Hoy sólo hay "Mover a papelera".
- **Por qué se difirió**: duplicar requiere lógica nueva en `BooksService` (copiar dir + reasignar IDs + reindexar) y exportar a MD requiere un converter de ProseMirror→Markdown que toca `@core/tiptap/`. Ambos son features de tamaño propio, no parte del rediseño visual.
- **Target**: sin asignar.

### Subset + conversión a woff2 de Crimson Pro

- **Qué**: las tres variantes de Crimson Pro viven en `public/fonts/` como `.ttf` (~98KB c/u, ~294KB total). Convertirlas a `.woff2` recortaría ~50% y un subset latin-extended bajaría otro ~30%.
- **Por qué se difirió**: `woff2_compress` no está en el entorno de desarrollo; bajar las versiones woff2 oficiales de Google Fonts requiere ajustar `User-Agent`. Funcionalmente las ttf funcionan idéntico y los 300KB son aceptables para una PWA (se cachean por el SW en el primer boot).
- **Target**: §19.16f.

### Typewriter focus línea-por-línea

- **Qué**: en modo foco actualmente se aplica una máscara CSS que oscurece arriba y abajo de la página. El target ideal es resaltar exactamente la línea/párrafo donde está el cursor (TipTap selectionUpdate → marca block actual con clase, el resto baja a opacity 0.3).
- **Por qué se difirió**: requiere extensión de ProseMirror que actualice el atributo en cada movimiento de cursor. La máscara CSS captura ~70% del efecto sin tocar el editor. Si en uso real se sienta corto, se hace.
- **Target**: §19.16f.

---

## Música — WebAudio (origen: redesign-music-v2 Fase 5)

### ~~Error code `MCB-MUS-001` para AudioContext no disponible~~ (resuelto 2026-07-04)

- **Qué**: el `AudioGraph` (`core/music/audio-graph.ts`) caía a `failed = true` y dejaba el analyser en `null` si `AudioContext` no estaba definido o si su construcción tiraba, sin código de error catalogado ni feedback al usuario.
- **Estado**: cerrado. `AudioGraph` acepta un callback `onFailed` invocado en ambos paths de fallo; `PlayerService` lo conecta a `ErrorService.report(new AppError(ERROR_CODES.MUS_001, ...))`. Código `MCB-MUS-001` catalogado en `error.codes.ts` + `docs/errors.md`. El toast genérico de `ErrorService` cubre el feedback — no hizo falta un banner dedicado; la superficie resonante (Fase 8) sigue pendiente y puede sumar su propio estado visual más adelante.
- **Origen**: redesign-music-v2 Fase 5.

---

## Música — Playlists tab (origen: redesign-music-v2 Fases 11–12)

### Drag-and-drop de tracks de la biblioteca a una playlist

- **Qué**: en v1 las playlists vivían en una columna lateral persistente: el usuario podía arrastrar tracks desde la tabla de biblioteca y soltarlos sobre una fila de playlist para mergearlos. v2 alterna la columna izquierda entre vista "Álbumes" y vista "Playlists" — las dos vistas son mutuamente excluyentes, así que el gesto "arranco un drag desde un álbum y suelto sobre una fila de playlist" no es posible sin un switch de vista en medio del drag.
- **Por qué se difirió**: la alternativa accesible (auto-switch de tab al pasar el drag sobre el tab "Playlists", o un mini-rail flotante de playlists durante el drag) ramifica la UX sin caso de uso claro. La acción equivalente sigue cubierta sin DnD por la vista del editor de playlist (`mc-playlist-editor` → "+ Añadir canciones" con buscador), así que no se pierde la operación, sólo la conveniencia del drag global.
- **Target**: sin asignar — abrir si el flujo "agregar tracks a playlist desde la biblioteca" se siente lento en uso real.
- **Origen**: redesign-music-v2 Fase 11 (modal) → reafirmado en Fase 12 (tab alternable).

---

## Música — Cover art / Waveform ID3 (origen: redesign-music Fase 9)

### Cover art y duración leídos de ID3 con `jsmediatags`

- **Qué**: extraer `picture`, `title`, `artist`, `album` y duración real de cada MP3 al subirlo. Mostrar carátula en Now Playing y como pequeña miniatura en la columna de título de la tabla.
- **Por qué se difirió**: agrega una dependencia npm (~30KB) + decisiones de persistencia (carátula como archivo aparte en `music/covers/<id>.<ext>` vs base64 inline en `_library.json`) + migración del schema de `Track` para nuevos campos opcionales. El layout 3-zonas, drag-and-drop, bulk actions, cola y atajos ya cierran el redesign de UI; las carátulas son enhancement visual, no bloquean uso.
- **Target**: sin asignar — abrir cuando se planifique fase de "música rica" o cuando el usuario explícitamente lo pida.

### Waveform pre-renderizado

- **Qué**: dibujar la forma de onda en Now Playing y permitir click para seek.
- **Por qué se difirió**: implica decodificar todo el MP3 en `AudioContext` al subir (costo: ~3-10s por archivo) y persistir el peak array. Bonito pero pesado para una PWA personal.
- **Target**: sin asignar — junto con cover art si se hace fase de "música rica".

---

## Recordatorios automáticos por meta (origen: unificación 2026-06-23)

### Lead-time por meta

- **Qué**: hoy el `settings.goals.reminderLeadMinutes` es global. Una versión avanzada permite override per-goal (este objetivo arranca antes / después que el default).
- **Por qué se difirió**: YAGNI mientras un único lead-time alcance. Sumar UI + campo en `reminder` config + migración solo se justifica si el usuario pide tratar metas distinto entre sí.
- **Target**: sin asignar.

### Hora del deadline configurable / deadline con hora propia

- **Qué**: hoy el deadline es solo `YYYY-MM-DD` y se trata como 23:59 local. Una versión avanzada permite que cada meta tenga `deadlineTime?: HH:mm` (o un setting global "considero el deadline a las HH:mm").
- **Por qué se difirió**: el modelo `Goal.deadline` es date-only y agregarle hora implica migración + UI en `DeadlinePickerComponent`. 23:59 es razonable para casi todo plazo "fin del día".
- **Target**: sin asignar.

### Snooze inteligente del goal-reminder

- **Qué**: hoy el goal-reminder dispara su toast y se re-arma al siguiente slot. "Snooze" en el toast saltaría el próximo slot completo (o N días) sin desactivar el toggle. Hoy snooze solo existe para reminders user-created (`+1h`).
- **Por qué se difirió**: requiere distinguir snooze (skip-one) de snooze (delay-fixed) y elegir UX. Mientras el toast tenga botón "abrir meta" + "cerrar", el caso "no me molestes hoy" se resuelve dejando que el siguiente slot se cumpla naturalmente.
- **Target**: sin asignar.

### Recordatorios automáticos para tareas / escritos con deadline

- **Qué**: extender el patrón goal-sourced a otras entidades con fecha (tareas con `dueDate`, escritos con plazo planificado), abriendo `sourceKind: 'task' | 'writing' | ...`.
- **Por qué se difirió**: §14 unificó primero con metas porque era el caso concreto (banner aleatorio pre-rediseño). Sumar más kinds requiere repensar UX para no inundar `/reminders` y decidir si el toggle vive por entidad o global por kind.
- **Target**: sin asignar (esperar pedido real).

---

## Metas — pasos como estrellas (origen: schema v6, 2026-06-24; canvas editor v7, 2026-06-24)

### Drag-to-reposition de estrellas existentes en el editor

- **Qué**: hoy en el editor `/goals/:id` se "siembran" pasos clickeando el lienzo (persiste `x/y` en el step), pero no hay forma de reposicionar uno ya creado salvo borrarlo y recrearlo. Agregar drag desde la estrella misma con preview de líneas MST recalculadas en vivo.
- **Por qué se difirió**: el flujo de creación con click cubre el caso principal; reposicionar requiere distinguir "click corto" (toggle done) de "drag" (mover) con threshold de píxeles, manejar touch, y mantener responsive al resize. Implementación tarea aparte.
- **Target**: sin asignar.

### Layout libre de la constelación en la wall (drag de la meta entera)

- **Qué**: en `/goals` el centroide de cada meta deriva del hash de su id. Una versión avanzada permite arrastrar la constelación entera en la wall y persistir esa posición (en el `Goal` o side-car de layout).
- **Por qué se difirió**: el layout hash-based cubre el caso sin nuevo estado. Persistir requiere otro bump de schema y resolver colisiones/overflow al resize.
- **Target**: sin asignar.

### Multi-select de pasos para acciones por lote

- **Qué**: marcar varios pasos a la vez (shift+click o lasso) para toggle/eliminar en batch.
- **Por qué se difirió**: el caso "marco 3 pasos a la vez" no apareció todavía como necesidad real; agregar selección visual + barra de acciones contextual es trabajo medible.
- **Target**: sin asignar.

---

## Recordatorios — Palomar (origen: rediseño palomar 2026-06-25)

### Animaciones de snooze / "tomar papelito" manual

- **Qué**: gestos manuales del paso 5 todavía sin cablear. El disparo del scheduler ya está implementado (puerta de la jaula se abre progresivamente, paloma vuela hasta el rail icon de `/reminders`, picotea, vuelve a la jaula si es recurrente o cae si es puntual). Falta: snooze posa la paloma en la repisa con animación; marcar hecho manual hace volar la paloma fuera de pantalla.
- **Por qué se difirió**: las animaciones disparadas por el scheduler son las críticas para que el palomar "funcione" como metáfora; los gestos manuales pueden quedar para una pasada de pulido sin perder lectura del estado.
- **Target**: sesión siguiente del redesign de `/reminders`.

### Detalles bonitos: plumitas que caen, plumaje rico, ronroneo

- **Qué**: paso 6 del plan. El aleteo ya quedó (la paloma voladora flapea el ala durante el vuelo). Faltan: plumitas que caen al pasar la paloma, plumaje más detallado en palomas recurrentes con muchos ciclos cumplidos, ronroneo/preview de mensaje en hover sostenido.
- **Por qué se difirió**: pulido visual de baja prioridad. Requiere modelo extra (`recurrence.cyclesCompleted`) para el plumaje y SVG más rico — no entra en el MVP del palomar.
- **Target**: sesión siguiente, después de las animaciones manuales.

### Palomares temáticos por categoría (como salas del museo)

- **Qué**: opcional mencionado en el plan original: separar el palomar en sub-palomares por tag/categoría, navegables como las salas del museo. Hoy se resuelve con filtros (fecha + nombre) sobre un único palomar.
- **Por qué se difirió**: los filtros del MVP ya resuelven el riesgo de saturación visual. Multi-palomar agrega complejidad de navegación que sólo vale si el usuario lo pide.
- **Target**: sin asignar.

---

## Recordatorios — Mejoras UI (origen: rediseño 2026-06-19)

### Snooze próximo lunes / fin de semana / menú overflow `⋯`

- **Qué**: presets adicionales de posponer (próximo lunes, fin de semana) y un menú overflow `⋯` que agrupe las acciones del footer de detalle en lugar de chips sueltos.
- **Estado parcial (resuelto 2026-07-04)**: "Posponer 1 día" y "Duplicar" ya están — botones planos en el footer de `/reminders`, junto a "Posponer 1 h". Quedan pendientes los presets de lunes/fin-de-semana y el agrupamiento en menú overflow.
- **Por qué se difirió lo pendiente**: los presets de día-de-semana necesitan resolver ambigüedad de UX (¿"próximo lunes" cuenta hoy si es lunes?) y el menú overflow es un patrón nuevo (no existe overflow menu en ningún otro footer de detalle de la app todavía) — con 4 botones planos la fila no se satura aún.
- **Target**: sin asignar.

### Atajos de navegación de fila (J/K, Space, E, Del)

- **Qué**: navegación por teclado dentro de la lista (J/K), Space para toggle done, E para editar, Del para borrar — todos con scope `editable-safe`.
- **Por qué se difirió**: hoy la lista no tiene concepto de "fila enfocada" (no hay roving tabindex ni signal de cursor). Implementarlo bien implica patrón reutilizable (`listbox` ARIA + cursor signal) que conviene resolver una sola vez para reminders/tasks/goals juntos. Por ahora solo `N` (nuevo) y `/` (buscar) están registrados.
- **Target**: cuando se aborde patrón compartido de listas navegables.

### ~~Badge de vencidas en el rail global~~ (resuelto 2026-07-04)

- **Qué**: pintar un badge numérico junto al ícono de Reminders en el sidebar con la cantidad de vencidas.
- **Estado**: cerrado. `RemindersService.overdueCount` (computed sobre `summaries()` + `bucketOf`) inyectado en `WorkspaceSidebarContainer`; badge rojo `.rail-badge` sobre `.rail-btn.reminders`, sólo visible cuando el conteo es > 0.

## Archivos (origen: rediseño /files — tablero de evidencia)

### Hilos entre items relacionados

- **Qué**: el rediseño "cork board" sugiere visualmente la idea de items vinculados con hilos. Hoy no hay modelo de relaciones entre `FileItem`s, así que la pieza queda como puro decorado pendiente.
- **Por qué se difirió**: introducir relaciones requiere extender `FileCollection`/`FileItem` con un grafo (id origen, id destino, opcional label), persistirlo en `_collection.json`, manejar deletes (limpiar hilos huérfanos), y diseñar UX para crear/borrar el hilo. Es un feature autónoma de tamaño propio, no parte del cambio visual.
- **Target**: sin asignar — abrir si aparece demanda real de "agrupar archivos relacionados dentro de una colección".

### ~~Navegación por carpetas / DnD entre carpetas en /files~~ (resuelto en §19.23b)

- **Qué**: el `files-index-rail` viejo exponía un árbol jerárquico de carpetas con DnD para mover colecciones entre carpetas, crear/renombrar carpetas y filtro de búsqueda. Con el rediseño "cork shelf", `/files` mostraba una grilla plana de colecciones sin esa jerarquía visual.
- **Estado**: cerrado. Resuelto junto con el resto de secciones huérfanas en §19.23b — breadcrumb + drill-down (`?folder=<path>`, `shared/folder-breadcrumb/`) reemplaza al árbol viejo, no lo reintroduce.

### Posición libre real (drag x/y) en el tablero

- **Qué**: en lugar de grilla con jitter determinista, dejar que el usuario arrastre cada artefacto a una coordenada arbitraria del corcho y persistirla.
- **Por qué se difirió**: implica nuevo `x,y` por item en el schema (migración + bump de `FILE_COLLECTION_SCHEMA_VERSION`), resolver overflow/colisiones al resize de ventana, hit-test de drop sobre el board, y modo "auto-acomodar" para colecciones nuevas. El jitter determinista ya transmite el feeling sin tocar disco ni schema.
- **Target**: sin asignar.

## Escritos (origen: rediseño /writings)

### Typewriter mode dentro del editor full-bleed

- **Qué**: toggle en el editor full-bleed de `/writings` que active "typewriter mode" — la línea activa queda visualmente al centro del viewport (scroll-padding-bottom: 40vh o equivalente) y opcionalmente atenúa los párrafos no activos.
- **Por qué se difirió**: el rediseño cerró con shelf + editor centrado a `max-width: 80ch` y back/Esc para volver. Typewriter requiere extensión de ProseMirror que reaccione a `selectionUpdate`, decisión de UX sobre dimming y persistencia del toggle. Bonito pero no bloquea la migración del section pane.
- **Target**: §19.16f (pulido del editor) o sin asignar.

### Parser de fecha natural — alcance ampliado

- **Qué**: el `@hint` actual soporta hoy/mañana/pasado, días de la semana, "en Nh/Nm/Nd" y horas (24h y am/pm). Faltan: "viernes que viene", "fin de semana", "próximo mes", fechas absolutas "15/07", parsing dentro del título sin `@`.
- **Por qué se difirió**: cobertura actual cubre los casos cotidianos; lo demás suma complejidad de parser y ambigüedad UX (cuándo `Llamar 15` significa hora 15 vs día 15). Mejor evaluar uso real antes de extender.
- **Target**: sin asignar.

## Tareas (origen: rediseño /tasks — jardín de tres canteros)

### ~~Animaciones orgánicas de DnD (raíces colgando, terrones cayendo, plop)~~ (resuelto 2026-07-14)

- **Qué**: al arrastrar una card aparecen 3-4 hilitos de raíces colgando, microspans de tierra cayendo, y al soltar un "plop" + morfismo del glyph (⋄ → ╿ → ❀) con 260 ms ease-out.
- **Estado**: cerrado, con alcance acotado respecto al original. `card--lifted` (source, mientras `dnd.draggingId()` matchea) baja opacidad y agrega una raíz colgante con balanceo (`::after` + `roots-sway`, CSS puro). `planter--over .soil` (target bajo drag) anima brillo pulsante (`soil-crumble`) y un `::after` de puntos de tierra cayendo (`clods-fall`). Al aterrizar (mismo u otro cantero), `applyTransplant` setea `justSproutedId` por 450ms → clase `card--plop` (bounce squash&stretch). El morfismo de glyph SVG entre etapas (⋄→╿→❀) se descartó: el nodo se destruye/recrea al cambiar de cantero (arrays distintos en el `@for`), así que un cross-fade real requeriría trackear el mark fuera del array — el "plop" ya comunica el cambio de etapa sin ese costo. Todo respeta `prefers-reduced-motion`. Verificado en runtime con Chrome: dispatch manual de `dragstart`/`dragenter` + inspección de `getComputedStyle` confirmó las 3 animaciones aplicadas; `onTransplant` disparado por script confirmó `card--plop` en el DOM.
- **Implementación**: `plant-card.component.css` (keyframes `roots-sway`, `plant-plop`), `planter.component.css` (`soil-crumble`, `clods-fall`), `tasks-garden.container.ts` (`justSproutedId` signal + `[lifted]`/`[justSprouted]` inputs en las 3 planteras).

### ~~Riego con cursor regadera + click para subir prioridad~~ (resuelto 2026-07-14)

- **Qué**: con el toggle 🚿 activo, mostrar cursor regadera flotante; click sobre una task de semana/backlog dispara micro-chorro y la mueve una posición arriba en su cantero.
- **Estado**: cerrado. Cursor regadera vía `cursor: url(data:image/svg+xml...)` sobre `.garden--watering` (SVG inline con el emoji 🚿, sin tracking de mouse por JS — más barato que un div flotante y logra el mismo efecto). Botón 💧 aparece en `mc-plant-card` sólo cuando `wateringMode() && stage() !== 'bloom'` (no en HOY). Al click, `onWater(id, bucket)` calcula la nueva posición con `between(posDosArriba, posUnaArriba)` de `core/ordering/fractional-position` (ya existía, sin tocar) y llama a `TasksService.setPosition` (ya existía, estaba sin uso desde la UI). Destello CSS (`plant-splash`) marca la card regada. El output `water` y el método `onWaterClick` en `PlantCardComponent` ya estaban armados sin usar de una sesión anterior — sólo faltaba el input `wateringMode`, el template del botón, y el wiring en el container. Verificado en runtime: activar el toggle mostró el cursor y los botones 💧 sólo en semana/backlog, y un click real movió "tarea semana dos" por encima de "tarea semana uno" en la lista.
- **Implementación**: `plant-card.component.ts/html/css` (`wateringMode`/`watered` inputs, botón, `plant-splash`), `tasks-garden.container.ts` (`onWater`, `wateredId` signal), `tasks-garden.container.css` (cursor `.garden--watering`).

### ~~Cesta de cosecha con salto en arco~~ (resuelto 2026-07-14)

- **Qué**: al marcar done, la card vuela en arco hasta la cesta del borde inferior del cantero HOY. Hoy se mueve por re-render sin animación.
- **Estado**: cerrado. `TasksGardenContainer.flyToBasket` clona el nodo DOM de la card (`cloneNode(true)`, conserva el atributo de scoping de Angular así que el CSS del componente sigue aplicando aunque el clon termine en `document.body`), lo posiciona `fixed` sobre su rect original y lo anima con `plant-arc` (keyframes con offset negativo en Y a mitad de camino, simulando el arco) hasta el centro de `.basket-stack .basket`, encogiéndose y desvaneciéndose; se autodestruye en `animationend` (+ `setTimeout` de seguridad). Respeta `prefers-reduced-motion` (se salta el clon entero). Verificado en runtime: conteo de la cesta subió correctamente tras cosechar, cero nodos `.plant-flying` huérfanos post-animación, sin errores de consola.
- **Implementación**: `tasks-garden.container.ts` (`flyToBasket`, `data-task-id` en las cards para el query), `plant-card.component.css` (`.plant-flying`, `@keyframes plant-arc`).

### ~~"Cargar más" en backlog (semillas que emergen)~~ (resuelto 2026-07-14)

- **Qué**: paginar el cantero de backlog cuando supera N elementos; mostrar contador de "sumergidas" + botón "cargar más" con animación de emerger.
- **Estado**: cerrado. `visibleBacklogCount` signal (default 24, `BACKLOG_PAGE_SIZE`) recorta `pending().backlog` en `visibleBacklog()`; botón "cargar más · N semillas sumergidas" (reusa la key `tasks.garden.loadMore`, que ya existía en `es.ts` sin usar, de una sesión anterior) suma otra página. Los ítems recién revelados (índice ≥ `emergingFrom()`) entran con `card--emerging` (translateY + scale, se desactiva sola a los 500ms). La paginación se resetea al buscar/limpiar el filtro. Verificado en runtime creando 27 tareas de prueba: el botón mostró "3 semillas sumergidas" al llegar a 24 visibles, y el click reveló el resto correctamente sin dejar el botón residual.
- **Implementación**: `tasks-garden.container.ts` (`visibleBacklogCount`, `emergingFrom`, `onLoadMoreBacklog`), `tasks-garden.container.html` (backlog `@for` sobre `visibleBacklog()` + botón), `plant-card.component.css` (`card--emerging`, `@keyframes seed-emerge`).

## Listas — Tiza sobre pizarra (origen: schema v4, 2026-06-25)

### Atajos directos a herramientas y colores

- **Qué**: registrar atajos en `ShortcutsService` para alternar modo tiza (`Mod+Shift+T`), elegir tiza/goma (`B`/`E`) y saltar entre colores (`1..5`) cuando el editor no tiene foco.
- **Por qué se difirió**: en v1 toda la interacción pasa por la toolbar visible; el modo tiza es deliberadamente disruptivo (toggle explícito), no algo que el usuario quiera prender con el teclado mientras está editando texto. Si en uso real aparece la fricción "tengo que ir al mouse", se cablea.
- **Target**: sin asignar.

### Textura realista de tiza (jitter + grano)

- **Qué**: los trazos hoy son SVG `path` con `stroke` plano. La sensación "tiza de verdad" pide jitter de opacidad por segmento + textura granulada (filtros SVG o canvas pattern).
- **Por qué se difirió**: el feel "tiza" lo aporta la combinación de paleta apagada sobre fondo oscuro del pane. Sumar filtros SVG complica el rendering en trazos largos. Polish que entra si las capas se sienten "planchadas".
- **Target**: sin asignar.

### Export PNG / SVG de las capas

- **Qué**: botón "exportar pizarra" que serialice las capas visibles a una imagen.
- **Por qué se difirió**: las capas viven en el JSON de la lista (versionado git las preserva). Exportar es una conveniencia, no necesario para no perder trabajo. Cuando aparezca el caso de uso (compartir un esquema fuera de la app), se agrega.
- **Target**: sin asignar.

### Undo/redo dedicado para trazos

- **Qué**: `Ctrl+Z` que deshaga el último trazo / acción de capa sin pasar por history git.
- **Por qué se difirió**: `Ctrl+Z` ya está tomado por TipTap dentro del editor; encadenar un undo de capas dispara conflictos de scope. Para revertir trazos sirve el panel de capas (vaciar capa) o el historial git. Si en uso real el `clear` se siente demasiado destructivo, se agrega un stack local.
- **Target**: sin asignar.

### Estilo "pizarra de verdad" en todo el pane

- **Qué**: el fondo del pane `/lists/:id` hoy mantiene la superficie base (tema activo). La metáfora "pizarra" se transmite por la paleta de tizas y el panel oscuro de la toolbar; ir más lejos implicaría restilizar el editor TipTap (texto claro sobre fondo verde-pizarra) y cargar fuente "Caveat" en el body.
- **Por qué se difirió**: restilizar el editor toca CSS variables transversales y rompe el modo lectura cuando otra pestaña tiene el lock. Mejor dejar el editor con su look estándar y que la pizarra sea la capa de tiza encima. Si el usuario lo pide, se cablea con un toggle "vista pizarra completa".
- **Target**: sin asignar.

## Imágenes — Museo (origen: rediseño /images, 2026-06-25)

### Sala 3D real (three.js + angular-three)

- **Qué**: convertir la sala del museo en un espacio 3D navegable en primera persona. Stack previsto: **three.js** como motor (escena con paredes `Mesh`, cuadros `PlaneGeometry` texturizados, `PerspectiveCamera` con WASD/drag o pointer-lock, spotlight cenital real, sombras proyectadas, raycasting para hover/click en cuadros) integrado vía **angular-three (NGT)** — wrapper idiomático que expone three con sintaxis declarativa Angular (signals + componentes), evitando manejar manualmente el render loop y la sincronización con el ciclo de vida. Esto entra en una **fase futura cross-página de migración 3D** (no sólo /images: también /books como libro físico real, /lists como pizarra con tiza volumétrica, etc.).
- **Por qué se difirió**: el v1 del museo es 2D con asimetría auto + luz cenital simulada por CSS gradient. Resuelve la metáfora con cero deps y mantiene la base sólida. El salto a 3D real es una fase de polish transversal que conviene hacer cuando todas las páginas tengan su v1 2D estable, para definir la lib + convenciones una sola vez.
- **Target**: fase futura de migración 3D (sin número aún en §19).

## Atajos / defaults del navegador (origen: audit 2026-06-30)

### Sobreescritura completa de defaults del navegador en combos consumidos

- **Qué**: la regla §4.6.15 exige que toda combinación de tecla consumida por la app llame `event.preventDefault()` antes de la lógica. Se hizo un sweep agregando `preventDefault()` en handlers ad-hoc (HostListener + `(keydown.*)` en templates) y se confirmó que `ShortcutsService` lo hace en capture-phase, pero **falta una verificación end-to-end de que ningún default del navegador se cuela**. Casos que en navegadores reales pueden seguir disparándose: Ctrl+S (guardar página), Ctrl+P (imprimir — colisiona con palette), Ctrl+N (nueva ventana, en algunos navegadores no se puede prevenir desde JS), Ctrl+W, F1 (ayuda nativa), F3 (find next), F11 (fullscreen). También quedan listeners no auditados en bindings tipo `(keydown.enter)`, `(keydown.arrowdown)` en templates que pueden no estar previniendo aunque consuman.
- **Por qué se difirió**: el audit fue mecánico (preventDefault donde había un handler). Verificar comportamiento real exige probar combo por combo en cada navegador soportado (Chrome, Edge, Vivaldi, Brave) y ver si el navegador todavía actúa. Algunos defaults son **inprevenibles** desde la página (Ctrl+N, Ctrl+W en la mayoría de Chromium) — esos quedan documentados como "no usar".
- **Target**: sin asignar. Tarea de QA + posible refactor de combos que choquen con defaults inprevenibles.

## Cross-section / vista unificada (origen: home guide audit, 2026-06-30)

### ~~Quick-capture global de nota desde cualquier sección~~ (resuelto 2026-07-09)

- **Qué**: un atajo que abra un overlay para crear una nota nueva **sin salir de la sección actual** (sirve mientras leés un libro, mirás el museo, escuchás música, etc.). Hoy `Alt+N` (`CreationIntentService`) crea la entidad cuya URL estás visitando — en /books crea libro, en /tasks crea tarea. No hay forma de capturar una idea suelta sin perder el contexto visual.
- **Estado**: cerrado. `QuickCaptureService` (`core/intents/quick-capture.service.ts`) registra `Alt+Shift+N` con scope `global` en `ShortcutsService` (no `Ctrl+Shift+N`: ese combo lo captura Chrome para "ventana de incógnito" antes de llegar a la página en una pestaña normal). Abre `QuickCaptureDialogComponent` (`shared/quick-capture/`, mismo esqueleto que `confirm-dialog.component.ts`, montado una sola vez en `AppShellContainer` junto al resto de overlays globales) con un textarea: `Enter` guarda, `Shift+Enter` hace salto de línea, `Esc` cancela. La primera línea se usa como título de la nota y el resto de líneas no vacías se guardan como párrafos del cuerpo (`NotesService.create` + `save`). Decisiones tomadas: la nota siempre cae en la raíz de `/notes` (`folder: ''`, igual que el resto de creaciones vía `Alt+N`) y no se preseleccionan tags (no existe un concepto de "tag activo" persistente entre secciones — los `activeTagIds` de cada wall container son filtros locales efímeros). Confirmación vía toast informativo reutilizando `AppError`/`ErrorService` (`MCB-UI-001`, ver `docs/errors.md`), con una acción "Abrir" que navega a la nota — esto requirió extender `ErrorToastComponent` para renderizar `error().actions` como botones (antes sólo lo hacía el modal). Verificado en runtime: disparado desde `/books`, permanece en `/books` tras guardar (no navega), el toast aparece con el código y el botón "Abrir" lleva a `/notes/<slug>-<id>` con título y cuerpo correctos. 6/6 tests nuevos en `quick-capture.service.spec.ts`.
- **Target**: cerrado.

### ~~Vista unificada cross-section por tag~~ (resuelto 2026-07-09)

- **Qué**: una pantalla que mostrá **todo lo tagueado con X** en una sola vista, con preview visual nativo de cada tipo (sticky para nota, poster para goal, lomo para libro, cuadro para imagen, etc.). Hoy hay filtro por tag por sección y el palette (Ctrl+K) acepta `tag:nombre`, pero no hay vista que cruce todas las secciones simultáneamente con su look propio.
- **Estado**: cerrado. `TaggedItemsService` (`core/tags/tagged-items.service.ts`) fanea sobre las 8 entidades taggeables (mismo patrón que `CalendarEventsService`/`TagsAdminService`) y expone `forTag(tagId)`. Nueva ruta `/tags/:id` (`TagDetailContainer`) agrupa por kind y renderiza cada uno con su card nativo. Se llega desde `Ctrl+K` con `tag:nombre` → aparece un ítem "Ver todo lo de #tag" (nuevo `TagViewItem` en el palette) que navega ahí.
  - **Descubrimiento de arquitectura durante la implementación**: el plan original asumía reusar directo los dumb components de cada feature (`note-slip`, `chalk-entry`, `writing-card`, `file-locker`) — viola §4.2.10 (una feature nunca importa de otra feature), nunca hecho antes en el código. Se resolvió moviendo/creando twins de solo-lectura en `shared/entity-cards/` con **inputs primitivos** (id/title/tags como `string[]`, no el `Summary` completo de cada feature) en vez del objeto de la feature — así `shared/` tampoco termina importando tipos de `features/*`. `book-volume` se movió tal cual (ya era 100% primitivo); `note-slip-card`, `chalk-entry-card`, `writing-card-preview`, `file-locker-card` y `goal-star-mini` son ports nuevos (mismo look, sin botón de borrar/drag/highlight — esta vista es de solo lectura). Tasks e images no tienen un card propio reusable (uno acoplado al bucket del jardín, el otro requeriría carga async de thumbnails, ver incidente §4.1.3b) — usan un `TaggedGenericCardComponent` compartido.
  - **Música excluida**: `Track`/`Playlist` no tienen campo `tags` — queda como nueva entrada diferida abajo.
- **Target**: cerrado.

### Tags en música (Track/Playlist)

- **Qué**: `Track` y `Playlist` (`features/music/models`) no tienen campo `tags`, a diferencia de las otras 8 entidades. Quedan afuera de cualquier filtro/vista transversal por tag (búsqueda global, `/tags/:id`).
- **Por qué se difirió**: agregar `tags` implica una migración de schema (`playlists.json`/metadata de tracks) y decidir si aplica a `Track` (por archivo) o sólo a `Playlist` (por colección) — no se tomó esa decisión de producto todavía. Descubierto al construir la vista cross-tag por tag (ítem anterior), que la excluyó de su alcance por este motivo.
- **Target**: sin asignar.

### Reschedule de tareas con DnD en el calendario

- **Qué**: en /calendar, arrastrar una tarea desde un día a otro para reagendarla, sin abrir su detalle. Hoy el calendario muestra eventos del día en un modal y para mover una tarea hay que editarla manualmente.
- **Por qué se difirió**: requiere DnD entre celdas de la grilla del mes + reuse del listener de drop del jardín de tareas. No urgente — la edición manual funciona — pero el flow "planificar proyecto" del home lo prometía.
- **Target**: sin asignar.

### Referencias / links entre entidades desde el editor

- **Qué**: poder linkear entidades entre sí desde dentro del editor (una nota que referencie una imagen, un escrito que linkee otra nota, etc.) tipo `[[wiki-link]]` o picker de "insertar referencia". Hoy las imágenes se referencian visualmente desde notas/escritos (renderización), pero no hay un sistema de links navegables entre entidades arbitrarias.
- **Por qué se difirió**: implica decidir sintaxis del link, picker de UI, resolución (qué pasa si la entidad target se borra), y cómo se ve el link en el renderizado vs el editor. Pieza grande de UX/datos.
- **Target**: sin asignar.

## Sync — UI (origen: rediseño /sync — tubos neumáticos, 2026-07-11)

### Detalles bonitos opcionales (silbido, sombra de cápsula, contador diario)

- **Qué**: silbido suave al despachar una cápsula (respetando el mute global), sombra de la cápsula proyectada sobre el tubo, contador acumulado discreto ("N envíos hoy") sólo si sale barato de derivar del histórico de `lastBulkAt`.
- **Por qué se difirió**: pulido visual/sonoro de baja prioridad explícitamente fuera del MVP del rediseño de `/sync`. El latón/madera del cuadro de mandos y la animación honesta de la cápsula en vuelo (sin barra de progreso falsa) ya se cerraron.
- **Target**: sin asignar.

## Sync — Push a remoto no funciona (origen: uso manual, 2026-07-01)

### ~~Investigar por qué falla `pushAll` contra el remoto real~~ (resuelto 2026-07-08)

- **Qué**: en uso real desde `/sync`, disparar "Push todo" no llegaba a subir los refs al remoto — todos los refs volvían `error`, la mayoría con mensaje `"unknown"`.
- **Estado**: cerrado. Eran cuatro bugs independientes en `remote-bulk.ts`/`remote.service.ts`, ninguno de red/auth/CORS (el proxy público y el PAT funcionaban bien):
  1. `classifyPushResult`'s `realFailure` trataba `undefined`/`''` como fallo real — `isomorphic-git` nunca pone `result.error = null` en un push exitoso, lo deja `undefined`/`''`, así que **todo** push exitoso se clasificaba como error.
  2. `refErrorOf` buscaba `result.refs[ref]` con el nombre corto del ref (`variant/x/main`), pero `isomorphic-git` indexa esa tabla con el nombre completo que devuelve el servidor (`refs/heads/variant/x/main`) — el lookup nunca encontraba nada.
  3. Una branch de facet (`draft`/`comments`) que nunca se creó porque la variante nunca entró en ese modo (creación perezosa) se reportaba como `error` permanente en cada `pushAll`/`fetchAll` en vez de `absent` — mismo tratamiento que ya existía para refs ausentes del lado del fetch, ahora aplicado también al lookup por nombre de `isomorphic-git`'s `NotFoundError`.
  4. `fetchAll` nunca funcionó: la app nunca llamaba `git.addRemote()`, así que `.git/config` no tenía `[remote "origin"]` y `git.fetch()` tiraba `NoRefspecError` en los 12 refs. Fix: `ensureRemoteConfigured()` (llamada idempotente a `git.addRemote(..., force: true)`, sin red) al inicio de cada `fetchAll()` — se auto-repara sin pedirle al usuario que reconfigure nada.
     Además, el `main` local y el `main` remoto habían divergido de raíz: el repo GitHub apuntado (`francoandreDev/docs`) tenía 2 commits viejos sin relación al proyecto. Confirmado con el usuario que no hacía falta conservarlos — se resolvió con un force-push puntual de `main` (no repetible, fue una operación manual de esta sesión, no un fix de código).
     4 tests de regresión nuevos en `remote-bulk.spec.ts` (12/12 pasan) usando la forma real de respuesta de GitHub capturada en vivo. `/sync` ahora muestra "Todo en orden (12 refs)".
- **Nota aparte**: `docs/deferred.priority-order.md` (§sección `Cómo empezar`) decía revisar el CORS proxy en `versioning/http.ts` — ese archivo no existe; la wiring real está en `remote-bulk.ts`. Corregido en este cierre.

## Editor — `:global()` no llega al contenido de ProseMirror (origen: cierre §19.16e-i, 2026-07-06)

### ~~Auditar y arreglar las reglas `:global(...)` de `editor.component.css`~~ (resuelto 2026-07-08)

- **Qué**: al cerrar 16e-i (highlighting) se descubrió que **todas** las reglas `.editor-host :global(...)` de `editor.component.css` compilaban mal: Angular adjuntaba el atributo de scoping `[_ngcontent-x]` directo al mismo compuesto que `:global(...)` (ej. `.editor-host[ngcontent] [ngcontent]:global(.mc-image-ref)`), en vez de dejar ese compuesto realmente global. Como los nodos que ProseMirror renderiza (`<mark>`, `<img>` de image-ref, las nubes de comentario, el propio `.ProseMirror`) son DOM crudo fuera del compilador de templates de Angular, **nunca tenían ese atributo** y la regla no matcheaba nunca. Confirmado en runtime (`getComputedStyle`): `.ProseMirror` no recibía `min-height: 180px` (daba `0px`), y el CSS compilado de `.mc-image-ref`/`.mc-comment-range` mostraba el mismo patrón roto. Afectaba: `.mc-comment-range`, `.mc-comment-cloud` (+ hover/focus), `.mc-image-ref`, `.mc-image-ref img`, `.mc-image-ref--missing`, `.ProseMirror` (outline, min-height), `.mc-draft-mutate`, `.mc-draft-strike`, `.mc-draft-insert` (+ hover/focus/hijos), y el placeholder `.ProseMirror p.is-editor-empty:first-child::before`.
- **Cómo**: las 9 reglas se movieron de `editor.component.css` (scoped) a una hoja global nueva `src/styles/_editor-content.scss` (`mc-editor .editor-host <selector> {...}`, sin `:global()`), importada en `styles.scss` — mismo patrón que `_editor-highlight.scss` (16e-i) y `_book-editor.scss` ya usaban para el mismo motivo. `editor.component.css` quedó solo con reglas que targetean elementos reales del template Angular (`.shell`, `.index-popover`, `.editor-host` base/focus/draft-session), que sí funcionaban scoped. Verificado en runtime: `.ProseMirror` ahora da `min-height: 180px` y `.mc-comment-cloud` matchea (`cursor: pointer`, color desde `--comment-accent`).

## Historial — Dejar de trackear campos "de la app" (origen: /history rediseño, 2026-07-02)

### ~~No versionar `fields.system` de las entidades del usuario~~ (resuelto 2026-07-03)

- **Qué**: los campos que la app mantiene mecánicamente (ids, timestamps, `schemaVersion`, `position` fractional-index, y extras por familia — `enteredHoyAt` en tasks, `progress`/`wallCenter` en goals, `bookId`/`pageCount` en chapters, `nextPingAt` en reminders) ya no aparecen en el diff de historial.
- **Cómo**: filtro downstream en `diff.utils.ts` (`computeUserFields` + `systemKeysFor` con set universal + overrides por familia). El JSON en disco los conserva porque runtime los usa; el pipeline de diff los ignora al leerlos, así que la historia vieja se ve limpia retroactivamente sin migrar datos. El shape del diff colapsó de `{ user, system }` a un array plano; el `systemExpandedSignal` del container quedó eliminado.

## Fs — Antipatrón `MCB-FS-003` mal usado, deuda restante (origen: §20a, 2026-07-08)

### Migrar `findPath()` de Notes/Tasks/Goals/Lists/Writings y `findChapterFile` de Books a `MCB-FS-008`

- **Qué**: `§20a` migró `bookDir`/`requireLoc` de `BooksService`/`GalleriesService`/`FilesService` (las 3 entidades directorio-por-entidad) de tirar `MCB-FS-003` a `MCB-FS-008` cuando un `id` no aparece ni tras re-caminar el filesystem. El mismo antipatrón sigue vivo en el `findPath()` interno de `NotesService`/`TasksService`/`GoalsService`/`ListsService`/`WritingsService` (entidades archivo-plano-con-sufijo, patrón preexistente que §20a tomó como referencia pero no tocó) y en `BooksService#findChapterFile` (resolución de capítulo dentro de un libro, walk-based igual que `findPath`, mismo throw final).
- **Por qué se difirió**: `§20a` acotó su alcance explícitamente a los "dos usos indebidos" nombrados en el roadmap (`books.service.ts`, `bookDir`/`requireLoc`); generalizar a los otros 6 sitios es mecánico pero son call sites adicionales fuera de ese texto, y tocarlos ameritaba su propia revisión (ej. decidir si `findChapterFile` amerita un código distinto de `findLoc`/`findPath` al nivel de libro, dado que resuelve una sub-entidad).
- **Target**: sin asignar.

## Responsive mobile — pantallas pendientes (origen: §21, 2026-07-10)

### Verificación visual real (dispositivo/navegador) de todo §21

- **Qué**: las 12 pantallas tocadas en sesiones 9-11 (shell, home, notes, tasks, goals, files, tags, trash, images, bookshelf/book-reader, variants, calendar/history/music/settings/sync/writings-shelf) tienen sus `@media` aplicados pero **casi ninguno verificado visualmente** — el bridge de captura de pantalla de Chrome (`Page.captureScreenshot`) quedó colgado la mayor parte de esas sesiones (problema recurrente, no nuevo). Sólo se confirmó en navegador real: tasks (393px y 745px), goals (419px). Todo lo demás se verificó por lectura de código + balance de llaves, no visualmente.
- **Por qué se difirió**: el bridge no se pudo destrabar reiniciando la navegación ni con reintentos (se probó, sin éxito, varias veces por sesión) — seguir insistiendo violaba el criterio de "verificar sin loopear". Se optó por avanzar por código con alta confianza (mismos patrones ya probados) y dejar la confirmación visual para cuando el bridge esté sano o el usuario lo revise a mano.
- **Target**: sin asignar — el usuario dijo que haría su propia pasada de revisión tras esta sesión.

### History — rediseño mobile dedicado de los 3 modos de zoom

- **Qué**: `history.container.css` tiene 3 modos de zoom (`zoom-strata`, `zoom-panorama`, y el modo default) con layouts de 2 columnas de ancho fijo/mixto (`360px 1fr`, `minmax(240-300px) 1fr`, `1fr minmax(300-360px)`), cada uno con su propia metáfora visual (rail de switcher, aside de libreta de campo). La sesión 11 sólo aplicó un `@media (max-width: 480px)` que los colapsa a `grid-template-columns: 1fr` como red de seguridad contra el overflow duro — no replica el comportamiento fino de cada metáfora en mobile (ej. el rail de switcher de strata debería verse distinto apilado que al costado). `zoom-detail-stack` no se tocó porque ya es mobile-first (una sola columna con filas). También quedaron sin tocar, por ser de menor riesgo: `.polaroid-btn { width: 160px }` y `.milestone-band-name { max-width: 220px }`.
- **Por qué se difirió**: es la pantalla más grande y compleja de las 7 (3227 líneas, 3 metáforas visuales distintas); diseñar cómo se ve cada modo en mobile es una decisión de UX por modo, no un fix mecánico como el resto de §21d.
- **Target**: sin asignar.

### Music — sub-componentes sin @media propio

- **Qué**: al colapsar `.zones` a 1 columna bajo 480px (sesión 11), no se auditaron los sub-componentes que viven dentro de cada zona (`album-library`, `now-playing`, `playlist-editor`, `queue-panel`, `resonant-surface`) — ninguno tiene su propio `@media`, así que podrían tener overflow interno propio aun con el contenedor ya apilado.
- **Por qué se difirió**: fuera del alcance acotado de la sesión 11 (huecos en breakpoints de contenedor, no auditoría de cada sub-componente); sin verificación visual tampoco había forma de confirmar si hacía falta.
- **Target**: sin asignar.

## Dashboard combinado (origen: §19.22)

### Verificación visual real en viewport mobile

- **Qué**: `dashboard.container.css` tiene un `@media (max-width: 480px)` (grid a 1 columna, padding reducido) pero nunca se confirmó en un viewport angosto real ni en dispositivo — la sesión que cerró §19.22 sólo verificó desktop (1512px) con Chrome.
- **Por qué se difirió**: fuera del alcance de la verificación funcional de esa sesión (typecheck/lint/tests + click-through en desktop); mismo patrón de breakpoint ya usado y probado en el resto de §21, riesgo bajo pero no confirmado.
- **Target**: sin asignar — agrupable con la próxima pasada de verificación visual de §21 si el bridge de Chrome está sano.

### ~~Tags no se muestran en los widgets del dashboard~~ (resuelto 2026-07-14)

- **Qué**: `TaskSummary`/`GoalSummary`/`NoteSummary`/`WritingSummary` ya traen `tags: readonly string[]`, pero ninguno de los 4 widgets de `/dashboard` los renderiza (sin chips de tag, a diferencia de `note-slip-card`/`kind-card` en otras vistas).
- **Estado**: cerrado (widget de reminders no aplica: `ReminderSummary` no tiene `tags`). `DashboardTaskItem`/`DashboardGoalItem` suman campo `tags` en `dashboard.types.ts`, poblado en `DashboardService` desde los summaries reales. `DashboardRecentEntry` ya traía `tags` sin usar. Los 3 widgets (`tasks`, `goals`, `recent`) reciben `[availableTags]` (signal `TagsService.tags` inyectado en `DashboardContainer`) y resuelven `tagIds → Tag` con el mismo patrón que `note-slip-card`/`tagged-generic-card`, renderizando `<mc-tag-chip>` en una segunda fila bajo el título (`.row-main` + `.tags` en `dashboard-widget.component.css`). Sin dependencias nuevas ni cambios de schema — solo se expuso un dato ya calculado.
