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

### Carpetas / jerarquía real dentro de notas

- **Qué**: poder anidar notas en carpetas creadas por el usuario, no sólo un grupo raíz "Notas".
- **Por qué**: el árbol del paso 6 ya soporta hijos arbitrarios; lo único que falta es UI para crear/renombrar/mover carpetas y persistencia de la jerarquía.
- **Target**: §19.9bis (papelera + carpetas).

---

## Árbol con filtro (origen: paso 6)

### Filtros por tipo de entidad

- **Qué**: combinaciones de filtros por tipo (notas+tasks+goals, etc.) descritos en §10.
- **Por qué**: sólo existe la entidad Note hoy. El filtro por tag ya está cubierto en 7b.
- **Target**: §19.9 (resto de entidades).

---

## Tags (origen: paso 7a)

### UI dedicada de gestión de tags

- **Qué**: pantalla para listar todos los tags, renombrar masivo, hacer merge entre dos, ver cuántas entidades usa cada uno, eliminar limpiando referencias.
- **Por qué**: hoy se crean en línea desde el picker y se quedan ahí. No hay vista global; renombrar requiere editar `tags.json` a mano.
- **Target**: §19.16c (gestión avanzada de tags).

### Color picker custom para tag

- **Qué**: dejar al usuario elegir el color de un tag desde la UI.
- **Por qué**: hoy el color se deriva determinísticamente del id (hash → paleta). Funciona, pero no es customizable.
- **Target**: §19.15 (temas custom + WCAG).

---

## Búsqueda (origen: paso 7b)

### Botón / atajo de "reindexar" manual

- **Qué**: §10 menciona "botón reindexar para rebuild manual si se corrompe". Hoy el rebuild ocurre solo en cada `refresh()` (apertura del workspace o paneo); no hay UI explícita.
- **Por qué**: con sólo notas el rebuild automático cubre el caso. La pieza UI tiene sentido cuando haya más entidades y el índice sea grande, o cuando exista una pantalla de "ajustes".
- **Target**: §19.16d (pulido de búsqueda).

### Snippet centrado en la coincidencia (con highlight)

- **Qué**: en lugar de mostrar los primeros 160 caracteres del body, mostrar un fragmento alrededor del término encontrado y resaltarlo.
- **Por qué**: requiere índice posicional o un re-scan por hit. La paleta ya muestra preview, pero no contextualizado.
- **Target**: §19.16d (pulido de búsqueda).

### ~~Historial de últimas búsquedas / accesos recientes~~ (resuelto en §19.16a-ii + §19.16a-iii)

- **Qué**: al abrir la paleta sin escribir nada, mostrar las últimas entidades visitadas o búsquedas recientes.
- **Estado**: cerrado. Entidades recientes en §19.16a-ii (`@core/search/palette-recents.service`, sección "Recientes"). Queries literales en §19.16a-iii (`@core/search/palette-queries.service`, sección "Búsquedas anteriores" con ✕ para olvidar).

### ~~Continuidad: última ruta + scroll al abrir~~ (resuelto en §19.16a-i)

- **Qué**: §10 menciona "vuelve a la última ruta + última entidad abierta + scroll". Hoy se abre en `/notes` sin recordar nada.
- **Estado**: cerrado en §19.16a-i (`@core/continuity/continuity.service`, redirect funcional desde `/`, scroll restore en `NavigationEnd`).

---

## Versionado y variantes (origen: paso 13)

### Re-mapping de offsets de `range` ante ediciones del bloque

- **Qué**: 13g-i introdujo `Comment.range?: { from, to }` (offsets relativos al contenido del bloque). El renderer los clampa a fin de bloque, pero no aplica `tr.mapping` cuando el texto del bloque se edita — los offsets persistidos quedan congelados al valor de creación. En la práctica funciona porque el usuario edita poco después de comentar y/o el clamp impide que la nube se renderice fuera del bloque; pero un comment sobre "las primeras 3 palabras" puede terminar subrayando algo distinto si se reescribe el inicio del bloque.
- **Por qué**: el re-mapping requiere un plugin TipTap que aplique cada `tr.mapping` a los anchors persistidos en memoria y los flushee a disk vía `CommentsService` cuando el doc autosaveea. Suma complejidad de orphan-flag (range que se colapsa a `to <= from` debería invalidarse) y un spec dedicado de mapping. Diferido hasta tener uso real que lo justifique.
- **Target**: §19.16e (pulido del editor).

### Anchor `range` multi-bloque (selección que cruza párrafos)

- **Qué**: hoy `range` queda confinado al bloque donde está `$from`. Selecciones que cruzan dos o más bloques caen al anchor `block` del primero (sin range). Comentar a través de párrafos no se soporta.
- **Por qué**: requiere un modelo de anchor distinto (lista de `{ blockId, from, to }` o un par `{ startBlockId, startOffset, endBlockId, endOffset }`), nuevo orphan handling (¿qué pasa si se borra el bloque del medio?), y renderer que dibuje la nube en el último bloque del span. El caso es minoritario.
- **Target**: §19.16e (pulido del editor) o sin asignar.

### Widget render para diff-marks de tipo "insertion-only"

- **Qué**: los diff-marks que insertan bloques enteros sin anchor en `main` (caso raro: marks heredados pre-rediseño, o resultantes de un merge entre variantes) no tienen punto de inserción inline natural. El renderizado base con decoraciones ProseMirror cubre todos los marks anclados a un punto/rango en `main`; los insertion-only sin anchor quedan listados en el popover de pendientes hasta que se acepten/rechacen.
- **Por qué**: pintarlos requeriría un mini-renderer JSON→DOM consistente con el theme del editor para un widget fantasma dentro del ProseMirror. Caso minoritario; el popover ya los expone.
- **Target**: §19.16e (pulido del editor) o sin asignar.

### Granularidad por faceta dentro del bundle de merge

- **Qué**: en 13b–d el merge ofrece elegir por entidad el bundle entero (main + draft + comments de la variante origen). Una versión avanzada permitiría tomar `main` de la variante origen pero quedarse con el `draft` o los `comments` de la variante destino.
- **Por qué**: cubre un caso raro y agrega 3× botones por delta en la UI de merge. Decisión explícita de "simple gana".
- **Target**: sin asignar (se agrega si aparece demanda real).

### Variantes sobre el fallback sin isomorphic-git

- **Qué**: si el adapter de isomorphic-git resulta inviable en 13a y se cae al fallback de snapshots en `.mi-cerebro/history/`, las variantes (13b en adelante) no son soportables. La app degrada a una sola "Principal" implícita.
- **Por qué**: implementar variantes sin git significaría reinventar branching + merge desde cero. No vale la pena hasta confirmar que isomorphic-git no funciona.
- **Target**: sin asignar (sólo se aborda si el fallback se activa en 13a).

### Colapsar chips de kind en la timeline cuando hay más de N

- **Qué**: hoy cada commit de la timeline muestra todos los chips de kind tocado (`note`, `task`, `goal`, `image`, `book`, `file`, `list`, `track`, `tag`, `writing`). Cuando el commit toca 8-10 kinds los chips envuelven a dos líneas y desbalancean visualmente la fila.
- **Por qué se difirió**: estético, no bloquea funcionalidad. La heurística "N chips + (+M más)" es trivial pero entra junto con un pulido más profundo del item de timeline.
- **Target**: §19.16f (pulido del historial — sección a crear cuando arranque el pulido).

### Toggle "ver sólo cambios" en diffs largos

- **Qué**: el diff de cuerpo (TipTap → prosa + jsdiff) muestra todo el contenido, no sólo los chunks `add`/`remove`. En notas largas las líneas de contexto opacitadas dominan visualmente. Sería útil un toggle que oculte los `context` y deje sólo los chunks modificados con un separador `…`.
- **Por qué se difirió**: nice-to-have. Con contexto reducido (~3 líneas alrededor de cada cambio) la legibilidad puede mejorar sin esconder nada — esa es una alternativa más conservadora que también queda en este ítem.
- **Target**: §19.16f.

### Pulido visual general de `/history`

- **Qué**: cuando cerramos 13a el usuario confirmó que la información está completa y legible pero "mucha info, poco visual". Queda como ítem único agrupador para futuras iteraciones de tipografía, densidad, jerarquía y micro-interacciones del historial (anchos de columna, separadores entre buckets, hover states, animación del cambio de selección, etc.).
- **Por qué se difirió**: estructura y funcionalidad están; el polish entra cuando 13a-d estén cerrados y tengamos uso real para saber qué duele.
- **Target**: §19.16f.

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

### Umbral de compactación configurable en settings

- **Qué**: §12 "Compactación del historial" fija el umbral de disparo en 500 commits por rama. Una versión avanzada lo expone en settings junto al toggle "Compactar aunque haya remoto" y al toggle de habilitar/deshabilitar la compactación.
- **Por qué se difirió**: sin uso real no sabemos qué umbral tiene sentido por defecto, ni si el usuario quiere tocarlo. Exponerlo demasiado temprano contamina la UI de settings con knobs que nadie va a usar. 500 es un número conservador (≈3 meses de uso intenso) que se puede cambiar en código si la realidad lo pide.
- **Target**: §19.16f (pulido del historial) o sin asignar.

### Dev panel para la compactación

- **Qué**: una pantalla `/dev` (o similar) que exponga `CompactionSchedulerService.runOnce({ ignoreThreshold })` como botón para QA, junto a los otros toggles de dev-perf (`DevPerfService`, `dev-variants-switch-tests`). Hoy esos servicios existen sólo como herramientas internas sin UI consumidora.
- **Por qué se difirió**: la API `runOnce()` ya está cableada (sesión 4 de §12) y desde la consola del navegador alcanza para QA. Construir el `/dev` feature entero —con todas las herramientas dev-perf, no sólo compactación— es un trabajo aparte que no aporta a una persona usuaria final.
- **Target**: sin asignar.

### Compactación manual sobre rango específico

- **Qué**: además de la pasada background automática, una acción "Compactar este rango" desde `/history` que permita al usuario seleccionar un span de commits y forzar la fusión, respetando las barreras (tags, `before-restore`, `Merge-Group`).
- **Por qué se difirió**: la compactación background con buckets por edad cubre el caso 95%. Compactación manual es una herramienta avanzada que se justifica si el usuario quiere "limpiar" un período específico sin esperar al auto. Sin uso real no hay forma de saber si vale la UI.
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

## Recordatorios — Mejoras UI (origen: rediseño 2026-06-19)

### Snooze 1d / Duplicar / menú de acciones extendido

- **Qué**: además de "Posponer 1 h" agregar 1 día, próximo lunes, fin de semana; acción "Duplicar"; menú overflow `⋯` que agrupe todo en lugar de chips sueltos al hover.
- **Por qué se difirió**: el rediseño priorizó layout 2-cols + buckets + quick-add + undo. Snooze 1h y borrar cubren ~80% del flujo diario. Sumar más acciones implica decidir si menú overflow o chips persistentes — punto de UX que conviene observar primero en uso.
- **Target**: sin asignar.

### Atajos de navegación de fila (J/K, Space, E, Del)

- **Qué**: navegación por teclado dentro de la lista (J/K), Space para toggle done, E para editar, Del para borrar — todos con scope `editable-safe`.
- **Por qué se difirió**: hoy la lista no tiene concepto de "fila enfocada" (no hay roving tabindex ni signal de cursor). Implementarlo bien implica patrón reutilizable (`listbox` ARIA + cursor signal) que conviene resolver una sola vez para reminders/tasks/goals juntos. Por ahora solo `N` (nuevo) y `/` (buscar) están registrados.
- **Target**: cuando se aborde patrón compartido de listas navegables.

### Badge de vencidas en el rail global

- **Qué**: pintar un badge numérico junto al ícono de Reminders en el sidebar con la cantidad de vencidas.
- **Por qué se difirió**: requiere exponer un signal global de "overdue count" desde `RemindersService` y agregar slot de badge en el rail (que hoy no tiene). Cambio cruza capa de layout — fuera de scope del rediseño de la página en sí.
- **Target**: sin asignar.

## Tareas (origen: rediseño /tasks)

### Drag & drop entre columnas (Hoy / Semana / Backlog)

- **Qué**: arrastrar una card de tarea entre columnas para cambiar su horizonte (mismo efecto que el patch de `dueDates` que hoy hacen los botones de mover). HTML5 DnD nativo + alternativa por teclado (focused card + Shift+→/← mueve a la columna siguiente/anterior).
- **Por qué se difirió**: la sesión cerró con botones explícitos "Hoy / Semana / Backlog" en cada card que ya cubren la operación de forma accesible por teclado (tab al botón + enter). DnD nativo agrega un helper compartido en `shared/utils/dnd.ts` + manejo de dragover/drop a nivel column + teclas Shift+flecha que conviene resolver junto con la misma pieza en `/lists` (drag de ítems dentro del detalle) para no duplicar el patrón.
- **Target**: sin asignar — abrir junto al rediseño de `/lists` o cuando aparezca dolor real.

## Archivos (origen: rediseño /files — tablero de evidencia)

### Hilos entre items relacionados

- **Qué**: el rediseño "cork board" sugiere visualmente la idea de items vinculados con hilos. Hoy no hay modelo de relaciones entre `FileItem`s, así que la pieza queda como puro decorado pendiente.
- **Por qué se difirió**: introducir relaciones requiere extender `FileCollection`/`FileItem` con un grafo (id origen, id destino, opcional label), persistirlo en `_collection.json`, manejar deletes (limpiar hilos huérfanos), y diseñar UX para crear/borrar el hilo. Es un feature autónoma de tamaño propio, no parte del cambio visual.
- **Target**: sin asignar — abrir si aparece demanda real de "agrupar archivos relacionados dentro de una colección".

### Navegación por carpetas / DnD entre carpetas en /files

- **Qué**: el `files-index-rail` viejo exponía un árbol jerárquico de carpetas con DnD para mover colecciones entre carpetas, crear/renombrar carpetas y filtro de búsqueda. Con el rediseño "cork shelf", `/files` muestra una grilla plana de colecciones (ordenada por `position`) y no expone esa jerarquía visualmente.
- **Por qué se difirió**: la pieza de árbol jerárquico chocaba con la metáfora de tablero (un corcho no tiene "subcarpetas"). El backend (`FoldersService`, `FilesService.moveCollectionToFolder`, `setPosition`) sigue intacto; lo único que falta es UI. La sidebar global todavía expone el árbol completo con DnD para quien lo necesite mientras tanto.
- **Target**: sin asignar — abrir si aparece dolor real de "tengo demasiadas colecciones planas y necesito agruparlas desde la propia página".

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

### Animaciones orgánicas de DnD (raíces colgando, terrones cayendo, plop)

- **Qué**: al arrastrar una card aparecen 3-4 hilitos de raíces colgando, microspans de tierra cayendo, y al soltar un "plop" + morfismo del glyph (⋄ → ╿ → ❀) con 260 ms ease-out.
- **Por qué se difirió**: la mecánica funcional (DnD HTML5 nativo entre canteros + cambio de stage al soltar) ya está; la coreografía requiere un drag-image custom, partículas y morfismo SVG. Es polish puro, no bloquea uso.
- **Target**: sin asignar — abrir si el jardín se siente "duro" en uso real.

### Riego con cursor regadera + click para subir prioridad

- **Qué**: con el toggle 🚿 activo, mostrar cursor regadera flotante; click sobre una task de semana/backlog dispara micro-chorro y la mueve una posición arriba en su cantero.
- **Por qué se difirió**: el toggle ya persiste su estado, pero la interacción concreta requiere capturar mouse global, animación SVG, y operación de reorden de `position` (existe `setPosition` en `TasksService` pero hay que decidir cuánto saltar). Bajo riesgo de uso real hasta que el jardín se llene.
- **Target**: sin asignar.

### Cesta de cosecha con salto en arco

- **Qué**: al marcar done, la card vuela en arco hasta la cesta del borde inferior del cantero HOY. Hoy se mueve por re-render sin animación.
- **Por qué se difirió**: la pieza visual (cestita) está implementada, lo que falta es FLIP/animación de salida. Similar al ítem de animaciones orgánicas — polish.
- **Target**: sin asignar.

### "Cargar más" en backlog (semillas que emergen)

- **Qué**: paginar el cantero de backlog cuando supera N elementos; mostrar contador de "sumergidas" + botón "cargar más" con animación de emerger.
- **Por qué se difirió**: aún no hay dolor de scroll en backlog. La lista completa cabe en el cantero con overflow-y. Cuando aparezca la fricción, se decide N de cutoff.
- **Target**: sin asignar.

## Listas — Tiza sobre pizarra (origen: schema v4, 2026-06-25)

### Drag-and-drop para reordenar capas

- **Qué**: hoy el panel de capas en `/lists/:id` ofrece botones ↑/↓ para mover una capa una posición. La forma natural es drag de la fila completa con preview del nuevo z-order.
- **Por qué se difirió**: el caso con 2-3 capas se cubre con los botones; DnD requiere un helper compartido (mismo `shared/utils/dnd.ts` que ya está deferido para tasks/lists/files). Conviene resolverlo en una pasada cross-feature.
- **Target**: sin asignar — junto con el DnD compartido.

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
