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

### Drag & drop / reordenamiento

- **Qué**: arrastrar nodos del árbol para reorganizar.
- **Por qué**: el árbol actual sólo lista; no hay concepto de orden custom todavía.
- **Target**: §19.16b (pulido visual del árbol).

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
