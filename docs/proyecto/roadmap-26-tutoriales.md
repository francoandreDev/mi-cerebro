# Roadmap — item 26 (tutorial guiado por página)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

26. **Tutorial guiado por página, fallback del diseño auto-explicativo (§4.6.15b).** Disparado por dos auditorías de UX seguidas (descubribilidad y "usuario cero") que encontraron el mismo patrón: gestos reales (shift-click multi-selección en Metas, los 3 modos de Historial, la toolbar completa de "modo tiza" en Listas) sin ninguna vía de descubrimiento salvo tropezar con ellos o leer el manual estático en `/`. Decisión explícita: el tutorial es un **fallback**, no reemplaza el trabajo de hints/leyendas ya en curso — cubre lo que un hint estático no puede narrar (una secuencia, no solo el significado de un símbolo).

**Fase 1 — fundamento + piloto en Historial.** _Cerrado._

- `core/tutorials/` nuevo: `tutorial.types.ts` (`TutorialStep`/`TutorialDefinition`, cada step con `anchorSelector` + `titleKey`/`bodyKey` + `placement` opcional), `tutorial-storage.ts` (`hasSeenTutorial`/`markTutorialSeen` sobre `localStorage` `mc.tutorial.seen.v1`, best-effort try/catch — mismo estilo que `dashboard-resurface-storage.ts`), `tutorial.service.ts` (`register()`/disposer igual que `ShortcutsService`, `start`/`next`/`prev`/`skip`/`finish`, auto-arranque opcional si nunca se vio).
- `shared/tutorial-overlay/` nuevo: `TutorialOverlayComponent`, montado una sola vez en `AppShellContainer` (como el mini-player). Spotlight vía `getBoundingClientRect()` sobre `anchorSelector`, recalculado en resize/scroll y con un `setTimeout(0)` tras cambiar de step para dar tiempo a que el anchor nuevo renderice. La tarjeta se clampea al viewport (no existía antes ningún caso de "posicionar una tarjeta relativa a un rect de pantalla" en el codebase — lo más cercano era `goal-peek-overlay`, que posiciona por punto, no por rect). `Escape` cierra (skip) vía `(document:keydown)` en el host — probado que un `(keydown)` solo en el elemento del overlay no alcanza si el foco quedó en un botón fuera del overlay (ej. el ícono que lo relanzó).
- `ShortcutBinding` suma `pageScope?: string` (opcional, no rompe bindings existentes). `KeyboardHelpDialogComponent` gana un tercer grupo "De esta página" (`shortcuts.group.page`) filtrando por `pageScope === routePageId(router.url)`, antes de los grupos `global`/`editable-safe` (que excluyen ahora los bindings con `pageScope` para no duplicarlos). `core/shortcuts/route-page-id.ts` nuevo: única fuente de "ruta → slug de página", usada tanto por el diálogo de atajos como por el control de la sección siguiente.
- `layout/components/page-help-control.component.ts` nuevo: control fijo (esquina inferior derecha, por encima del mini-player) con dos íconos — "Guía de la página" (`sparkle`, solo visible si `TutorialService.hasTutorialFor(currentPageId)`) y "Atajos de la página" (`keyboard`, siempre visible, abre el diálogo ya filtrado). Reemplaza la situación anterior donde `?` era el único acceso a los atajos, sin ningún botón visible en ningún lado (hallazgo central de la auditoría "usuario cero").
- **Piloto: Historial**, 3 steps: el grupo de zoom `Cordillera/Estratos/Cordel` (`[data-tutorial="history-zoom"]`), el timeline de commits (`[data-tutorial="history-timeline"]`), y el filtro "Sólo milestones" (`[data-tutorial="history-milestones-filter"]`) — este último cubre el flujo "nombrá un punto importante y después filtrá el ruido", no solo el significado de un ícono. `features/history/containers/history.tutorial.ts` (`HISTORY_TUTORIAL`), registrado en `HistoryContainer.ngOnInit`/desregistrado en `ngOnDestroy`, mismo ciclo de vida que sus shortcuts existentes (que además pasaron a llevar `pageScope: 'history'`).

**Fase 2 — Metas y Listas.** _Cerrado._

- **Metas** (`/goals`), 3 steps anclados a `[data-tutorial="goals-sky"]` (la región de la constelación completa, no una estrella puntual — evita depender de qué estrella exista): click marca un paso hecho, Shift+click selecciona varias + click derecho abre el menú, drag mueve la constelación entera. `features/goals/containers/goals.tutorial.ts` (`GOALS_TUTORIAL` + `registerGoalsTutorial()` — la función de registro vive ahí, no inline en el container, porque `goals-wall.container.ts` ya rozaba el límite de 300 líneas de la regla 4.4).
- **Listas** (`/lists/:id`), 2 steps anclados a `[data-tutorial="lists-chalk-bar"]` (la barra de "modo tiza", visible esté activo o no): qué hace el botón, y qué aparece completo al activarlo (paleta, grosores, deshacer/rehacer, capas, exportar). `features/lists/containers/lists.tutorial.ts` (`LISTS_TUTORIAL` + `registerListsTutorial()`, mismo motivo de extracción). Registrado solo en `ListsContainer` (`/lists/:id`), no en `ListsShelfContainer` (`/lists`) — el ícono de guía no aparece en el shelf porque ahí no hay nada que anclar.
- **Bug de layout encontrado y corregido durante esta fase**: el clamp del overlay (`tutorial-overlay.component.ts`) solo acotaba la posición horizontal de la tarjeta, no la vertical. Con un anchor grande (`.sky` de Metas ocupa casi toda la pantalla), la placement `'bottom'` calculaba `top` por debajo del propio anchor — que ya es casi tan alto como el viewport — dejando los botones de navegación fuera de la pantalla. Fix: `CARD_HEIGHT_ESTIMATE` (heurística, no la altura real renderizada) + clamp también en `top` para las 4 placements, no solo en `left`.
- Verificado en navegador real (`bun run start`) los 3 pilotos completos, paso a paso, con capturas: el tutorial se dispara solo la primera vez, "Saltar"/completar marcan visto (no reaparece tras recargar), el ícono ✨ relanza a demanda, y `?` filtra los atajos por página en las 3 vistas. `bun run typecheck` limpio, `bun run test` 548/548 verde, `ng lint` sin errores nuevos.

**Fase 3 — cobertura completa (17/17) + flujos cross-página reales.** _Cerrado._ Corrige lo que
la Fase 1/2 dejó corto: solo 3 de 17 secciones tenían tutorial, y el contenido de esas 3 era
verificado a mano pero no el copy ya documentado del proyecto.

- **`home.content.ts` se mueve de `features/home/` a `core/home-content/`.** Vivía en una feature
  pero es contenido que ahora leen 16 features más (regla 10 — "una feature nunca importa de
  otra"; el move es el fix, no una excepción). Cero cambio de contenido, un solo call site
  actualizado (`home.container.ts`).
- **`core/tutorials/entity-tutorial.builder.ts`** (`buildEntityTutorial(cardKey, anchorSelector,
placement?)`): busca el `HomeCard` correspondiente en `HOME_GROUPS` y arma el
  `TutorialDefinition` mapeando `card.steps` (ya `TranslationKey[]`) a `TutorialStep[]` sobre un
  único anchor — mismo patrón de "un anchor, el texto cambia por paso" que ya probaron Metas y
  Listas. Evita repetir el copy 14 veces.
- **14 secciones nuevas registradas con el builder**, cada una con un `data-tutorial="..."` sobre
  el elemento real, siempre presente (no gateado por estado), identificado por relevamiento de
  código — ver la tabla de anchors más arriba: Notas, Tareas, Escritos, Libros, Imágenes,
  Archivos, Música, Calendario, Recordatorios, Variantes, Papelera, Configuración, y el tramo de
  **shelf** de Listas (`/lists`, antes sin tutorial — el tramo de detalle `/lists/:id` ya
  existía).
- **Panel y Etiquetas** no tienen card en `home-content.ts` (no están en el "Qué hay" de la home)
  — copy nuevo, verificado contra `dashboard.container.html` (5 widgets + resurface) y
  `tags.container.html` (recolor/rename/merge/eliminar por fila, gateado a que exista ≥1 tag).
- **Metas** gana 3 steps previos (`home.entity.goals.step.1-3`, anclados a un nuevo
  `[data-tutorial="goals-create"]` en el hero-create) — el tutorial anterior explicaba gestos
  avanzados (shift-click, drag) sin cubrir "cómo creo una meta nueva" primero.
- **Tutorial cross-página real**, no solo "una página con navegación": `TutorialStep` suma
  `route?: string`; `TutorialService` inyecta `Router` y, al avanzar a un step con `route`
  distinto de la URL actual, hace `router.navigateByUrl(route)` antes de medir el anchor
  (`goToStep()`). `register(def, { autoStartIfUnseen: true })` ahora chequea que no haya un
  tutorial ya activo antes de auto-arrancar — evita que el tutorial de una página se dispare
  encima de un flujo cross-página que está navegando por ahí.
- **`core/tutorials/home-flows.tutorial.ts`**: `PROJECT_FLOW_TUTORIAL` (`/goals → /writings →
/tasks → /calendar`) y `DAILY_FLOW_TUTORIAL` (`/calendar → /goals → /tasks → /reminders`),
  copy 100% de `home.flow.project.*`/`home.flow.daily.*`, reusando los mismos anchors de las
  páginas de arriba (cero anchors nuevos). Registrados una sola vez en `AppShellContainer`
  (siempre montado) con `autoStartIfUnseen: false` — un flujo nunca se dispara solo.
- **Los otros 2 flujos "hoy" no se duplican como flujo aparte**: _Capturar una idea suelta_ ocurre
  entero en `/notes` y _Escribir algo largo_ casi entero en `/writings` — el botón "Recorrer" de
  esas dos cards en la home simplemente llama `tutorials.start('notes')`/`tutorials.start(
'writings')`, reusando el tutorial de esa página en vez de repetir el mismo contenido dos veces.
- **Los 2 flujos "próximamente"** (`study`, `tagview`) no se construyen — describen quick-capture
  global desde el reader y una vista cross-tag unificada, ninguna de las dos existe todavía.
- **Entrada**: cada card de "Flujos típicos" en la home (`/`) suma un botón "Recorrer este flujo"
  (`home.workflows.start`) que llama `tutorials.start(<id>)` con el mapeo de arriba.
- Verificado: `bun run typecheck` limpio, `bun run test` 548/548 verde (mismo baseline de antes
  de esta fase), `ng lint` sin errores nuevos.

**Fase 4 — corrección de anchors mal colocados.** _Cerrado._ Auditoría de usuario ("en la
mayoría de páginas el tutorial está mal colocado, no referencia a los elementos que debe")
encontró que varias de las 14 secciones armadas con `buildEntityTutorial` en la Fase 3 solo
tenían override para 1-2 de sus steps — el resto caía al `defaultAnchor` aunque el copy de ese
step describiera un elemento completamente distinto. Cuando el anchor resuelto no existe en el
DOM, `TutorialOverlayComponent.measure()` no dibuja spotlight y la tarjeta cae a `left:0, top:0`
(sin clamp porque no hay `rect`) — el síntoma visible de "tarjeta flotando en la esquina" que
reportó el usuario.

- **Books**: nuevo anchor `[data-tutorial="books-shelf"]` en `.shelves` (`bookshelf.container.html`,
  siempre presente en modo estantería, el default). Steps 1 ("arrastrás a la estantería") y 3
  ("click en el libro abre el lector") pasan de `books-new` a `books-shelf`.
- **Files**: nuevo anchor `[data-tutorial="files-wall"]` en `.wall-board` (`files.container.html`,
  siempre presente, cubre vacío y poblado). Steps 2 (tags pintan el locker) y 3 (click abre el
  locker) pasan de `files-new` a `files-wall`.
- **Reminders**: nuevo anchor `[data-tutorial="reminders-palomar"]` en `.palomar`
  (`reminders.container.html`, siempre presente). Step 2 (puerta de la jaula / repisa de vencidos)
  pasa de `reminders-quick-add` a `reminders-palomar`. `home-flows.tutorial.ts` actualizado en el
  mismo sentido: `DAILY_FLOW_TUTORIAL` step 4 pasa de `reminders-quick-add` a
  `reminders-palomar`, y step 3 pasa de `tasks-compose` a `tasks-planters` (ya usado
  correctamente por `tasks.tutorial.ts` para el mismo contenido — "cantero floración" no es
  "crear tarea").
- **Settings**: nuevo anchor `[data-tutorial="settings-rail-icon"]` en el botón del engranaje del
  rail (`layout/containers/workspace-sidebar.container.html`) — cruza de `features/settings/` a
  `layout/` solo como selector CSS (sin import entre features, no viola regla 10). Step 1 ("abrís
  /settings desde el ícono del engranaje en el rail") pasa de `settings-nav` (las tabs internas de
  la página, un elemento distinto) a ese ícono real.

**Casos que quedan sin anchor real, documentados y no forzados:**

- **Notes step 3** ("agregás tags desde el selector lateral"): ese selector vive en
  `note-editor-pane` (`/notes/:id`), una ruta que solo existe una vez creada y abierta una nota —
  no hay ningún elemento en `/notes` (donde vive el tutorial) que lo represente. Forzar
  `TutorialStep.route` ahí rompería en el primer uso real (usuario sin notas todavía).
- **Images steps 2-3** ("arrastrás a la sala" / "mini-mapa"): `mc-museum-room` y
  `mc-room-minimap` viven en `/images/:id` (`galleries.container.html`), no en el índice
  `/images` donde corre el tutorial — mismo problema de ruta gateada por contenido inexistente.
- **Writings steps 2-4** (editor full-bleed, autosave, `/history`): viven en `/writings/:id`, no
  en el shelf `/writings` donde corre el tutorial.
- **Music step 4** (mini-barra inferior global): `mc-mini-player` solo renderiza
  `@if (player.currentTrack())` — no es "siempre presente" (regla de la Fase 3), así que
  anclarlo ahí sería intermitente según haya o no algo sonando.
- **Trash step 1** (card con preview en `/trash`): `.grid` de cards solo renderiza cuando la
  papelera no está vacía — un usuario nuevo (el caso que dispara el tutorial) la ve vacía.

Arreglar estos bien requiere una decisión de producto que excede "apuntar el anchor
correctamente" — instrumentar un anchor cross-página confiable implica o (a) navegar a una
entidad que todavía no existe la primera vez que se ve el tutorial, o (b) agregar un estado
"vacío pero anclable" a esos elementos. Sin target de fase asignado todavía; queda para cuando
se retome tutorial/cross-page nav en profundidad.

**Fase 7 — profundidad cross-página real.** _Cerrado._ Retoma exactamente los 4 casos que la
Fase 4 dejó abiertos (Notes tags, Writings editor/autosave/focus, Images sala/mini-mapa, Books
atajos del lector — Trash queda igual, es un estado vacío real, no una ruta inalcanzable). La
decisión de producto: (a) las 3 rutas de detalle que ya navegan solas al crear (Writings, Images,
Books) reciben anchors reales — nada que instrumentar del lado de la navegación, ya ocurre. (b)
Notes es la única que no auto-navega al crear (se queda en `/notes`); en vez de forzarla a
auto-navegar (rompería la convención de "el sticky nace en el muro"), el step existente que ya
describía "click en cualquier sticky abre el editor" gana `action: click` real sobre cualquier
nota — la navegación ocurre como efecto del gesto real del usuario, no del motor del tutorial.

- **`TutorialStep.skipIfMissing?: boolean`** (`tutorial.types.ts`): si el anchor de un step no
  está en el DOM, el overlay hace `tutorials.next()` en vez de dejar la tarjeta flotando en
  `(0,0)` — el bug de layout documentado en la Fase 4 para exactamente este caso (usuario sin
  notas/escritos/libros/galerías todavía). Implementado en el mismo `effect()` de
  `TutorialOverlayComponent` que ya mide con `setTimeout(0)`. Genérico — cualquier tutorial futuro
  con un step opcional puede usarlo, no es específico de estos 4 casos.
- **`TutorialStepAction.altKey?: boolean`** (`tutorial.types.ts`) + `matchesKeydown`/`keyLabelsFor`
  en `tutorial-action-matching.ts` — faltaba soporte de Alt como modificador (`ctrlOrMeta`/
  `shiftKey` ya existían). Necesario para Alt+←/→ (Books) y Alt+Shift+F (Writings, modo foco).
- **Notes** (`notes.tutorial.ts`): step "format" gana `action: { event: 'click', selector:
'[data-tutorial="notes-wall"] article.slip' }` (nuevo `data-tutorial="notes-wall"` en
  `notes-wall.container.html`, el contenedor `.roll`). Step "tags" ancla en
  `[data-tutorial="notes-tag-picker"]`, nuevo atributo en `<mc-tag-picker>`
  (`note-editor-pane.component.ts`) — ambos con `skipIfMissing: true`.
- **Writings** (`writings.tutorial.ts`): los 3 steps que antes re-anclaban en `writings-new` (el
  compose del shelf, inexistente tras navegar) pasan a `[data-tutorial="writings-editor"]`, nuevo
  atributo en `.canvas` (`writings.container.html`). El step de modo foco gana
  `action: keydown Alt+Shift+F`. Los 3 con `skipIfMissing: true`.
- **Images** (`images.tutorial.ts`): nuevo step "upload" ancla en `[data-tutorial="images-room"]`
  (nuevo atributo en `<mc-museum-room>`, `galleries.container.html`) con
  `action: keydown Ctrl+V`. El mini-mapa se separa en su propio step, anclado en
  `[data-tutorial="images-room-minimap"]` (nuevo, en `<mc-room-minimap>`) — antes compartía body
  con el step de navegación del plano. Los 3 steps nuevos/tocados con `skipIfMissing: true`.
- **Books** (`books.tutorial.ts`): el step único `books.tutorial.reader` (4 atajos en un body, el
  ejemplo textual que la regla §4.6.15b usa para lo que NO hacer) se divide en 4 steps reales,
  cada uno anclado en `book-reader.container.html` (`data-tutorial="books-reader-pane"` para
  paginar y modo foco, `"books-reader-nav"` para saltar de capítulo, `"books-reader-toc"` para el
  índice) con su propio `action` (`PageDown`, `Alt+→`, `Ctrl+.`, click en el ícono del índice).
  Claves i18n nuevas: `books.tutorial.readerPaging/readerChapterNav/readerFocus/readerToc.title|body`,
  reemplazando la entrada única `books.tutorial.reader.*`.
- Verificado: `npx tsc --noEmit` limpio. Confirmado en navegador real (`localhost:9876`) el color
  de acento del overlay (ver más abajo) y la navegación real de Notes/click-en-sticky.

**Nota de color (mismo commit, hallazgo del audit de tutorial 2026-07-24):** el overlay
(`shared/tutorial-overlay/`) hardcodeaba `#ff5a3c` (naranja) y `#2dbd6e` (verde) en vez de usar
`--mc-accent-primary`/`--mc-state-success` — el spotlight, el connector punteado y los keycaps no
seguían el acento configurado en Tema (regla §4.6.13, "CSS variables para todo lo temable").
Corregido: todos los colores del overlay ahora leen las variables del tema, con el hex original
como fallback. También se corrigió que el `titleKey` de cada step nunca se renderizaba (solo vivía
en el `aria-label` del diálogo, invisible para usuarios videntes) — ahora se muestra como
encabezado en negrita sobre el body. Y se corrigió que los botones "Recorrer este flujo" de
_Capturar una idea suelta_/_Escribir algo largo_ (`home.container.ts`) no hacían nada al
clickearse desde `/` — llamaban `tutorials.start('notes'|'writings')`, definiciones que solo se
registran mientras esas páginas están montadas, sin navegar primero. `startWorkflow()` ahora
navega a `/notes`/`/writings` antes de arrancar el tutorial.

- Verificado: `bun run typecheck` limpio, `bun run test` verde, `ng lint` sin errores nuevos.
  Confirmado en navegador real (`bun run start`) que Books, Files, Reminders y Settings
  spotlightean el elemento correcto en los steps corregidos.

**Fase 5 — pasos que se practican, no solo se leen.** _Cerrado._ Feedback de usuario tras la Fase
4 ("mejor, pero todavía tiene margen para enseñar de verdad"): el tutorial seguía siendo un
slideshow — spotlight + texto + "Siguiente", sin exigir ni reaccionar a que el usuario hiciera el
gesto real. Se agregó una vía opcional para que un step se dé por practicado con una interacción
real de la página, en vez de solo con el click en "Siguiente".

- **`TutorialStep.action?: TutorialStepAction`** (`tutorial.types.ts`): `{ event: 'click' |
'submit' | 'keydown', selector?, key?, ctrlOrMeta? }`. `selector` default al propio
  `anchorSelector` del step — lo que se spotlightea es típicamente lo que hay que tocar; se puede
  overridear cuando el gesto real vive en un control distinto (ej. Books step 1 spotlightea el
  estante pero el click que se practica es el botón "nuevo libro", que es el que realmente dispara
  la subida).
- **`TutorialOverlayComponent`** (`shared/tutorial-overlay/`): un listener en `document` (capture
  phase, sobrevive a `stopPropagation` de abajo) por step activo, instalado/desinstalado en el
  mismo `effect` que ya reseteaba el spotlight al cambiar de step. Al matchear (por
  `closest(selector)` para click/submit, por `key`/`ctrlOrMeta` para keydown), muestra "¡Bien!
  Avanzando…" y llama `tutorials.next()` tras `ACTION_ADVANCE_DELAY_MS` (700ms, para que el
  checkmark se alcance a leer). El botón "Siguiente" **no se deshabilita** — regla de
  accesibilidad §4.13: un usuario que no puede ejecutar el gesto físico (ej. drag-drop) no puede
  quedar bloqueado; el mecanismo premia la práctica real sin ser la única vía de avance.
- **`entity-tutorial.builder.ts`**: `StepAnchorOverride` suma `action?` opcional, mergeado en el
  step resultante — mismo mecanismo que ya existía para `anchorSelector`/`placement` por step.
- **9 tutoriales instrumentados** con al menos un step accionable: Notes (step 1, submit del
  compose), Tasks (step 1, submit del compose), Reminders (step 1, submit del quick-add), Goals
  (step 1, submit del hero create), Lists (step 1, click del toggle "modo tiza"), Books (step 1,
  click en "nuevo libro"), Files (step 1, click en "nuevo archivo"), Images (step 1, click en
  "nueva sala"), Settings (step 2, click en una tab). El resto de los steps de esas páginas y las
  8 secciones no tocadas en esta fase quedan como lectura + "Siguiente" — no todo step tiene un
  gesto único e inequívoco que practicar (ej. "queda colgado en grande cada vez que abrís
  /goals" no es una acción).
- Nuevas claves i18n: `tutorial.nav.actionHint`, `tutorial.nav.actionDone`.
- Verificado en navegador real: se probó el submit real de Tasks y Reminders (escribir + enviar
  el form) y en ambos casos el tutorial detectó la acción, mostró "¡Bien! Avanzando…" y pasó solo
  al siguiente step. `bun run typecheck` limpio, `bun run test` 548/548 verde.

**Fase 6 — copy dedicado, no reciclado de home-content.ts.** _Cerrado._ Feedback de usuario tras
la Fase 5: "aún no está bien hecho... el tutorial aún casi no explica nada adecuadamente paso a
paso". Causa raíz: 12 de las 17 secciones (más el tramo shelf de Listas) usaban
`buildEntityTutorial()` para reciclar el copy de `home-content.ts` — texto tipo "qué hay en esta
sección" (3-4 líneas, pensado para la card de la home), no instrucciones paso a paso. Un step
como "Click en el libro abre el lector con flip 3D real. PageUp/Down pasa página, Alt+←/→ salta
de capítulo, Ctrl+. activa focus mode, Ctrl+' abre el índice" mete 4 gestos distintos en una sola
tarjeta. Esta decisión (§4.11.15b) queda revertida para las 13 secciones de abajo — pasan al
mismo patrón que ya usaban Goals/Lists (chalk)/History/Dashboard/Tags desde antes: `TutorialStep[]`
escrito a mano, copy propio con claves `<feature>.tutorial.<slug>.title`/`.body`, un gesto
concreto por step.

- **`buildEntityTutorial()` y `entity-tutorial.builder.ts` se eliminan** (`core/tutorials/`) — sin
  callers después de este cambio, y la regla que los motivó ("nunca inventar copy") es exactamente
  la que se revirtió. `home-content.ts` no se toca: sigue siendo el contenido de las cards de `/`
  (visión general), un consumidor totalmente distinto de la definición del tutorial en cada página.
- **13 tutoriales reescritos** con copy dedicado y, donde hay un gesto real y seguro de detectar,
  `action`: Notes (4 steps, crear/formato/tags/buscar — Ctrl+K real vía `keydown` global), Tasks (4,
  crear/fecha/trasplantar vía Shift+→/cosechar), Reminders (4, crear/abrir paloma/estados/filtros),
  Books (5, subir/organizar por DnD/densidad/abrir/atajos del lector), Files (4,
  subir/abrir casillero/tags/descarga), Lists-shelf (2, crear/rail A-Z), Images (3,
  crear sala/subir-pegar/navegar), Music (5, subir/álbum/reproducir con Espacio/buscar con "/"
  /mini-player), Calendar (4, vistas/día/crear entrada/filtrar wallboard), Settings (4, ícono del
  rail/tabs/aplicar en General/instantáneo en Tema), Trash (3, aparece/buscar/restaurar-purgar),
  Variants (5, crear/confirmar con Ctrl+Enter/seleccionar/activar/merge), Writings (4,
  crear/editor/autosave/modo foco).
- **`TutorialStepAction` suma `shiftKey?: boolean`** (Tasks: Shift+→ trasplanta) y el evento
  `'dragstart'` (Books: arrastrar un lomo entre estantes) — mismo mecanismo de la Fase 5, dos
  variantes más de gesto real detectable.
- **Dos anchors nuevos** para destrabar steps que antes no tenían dónde anclar un gesto real:
  `[data-tutorial="calendar-wallboard"]` (`.cards-col`, filtro por tipo de entidad) y
  `[data-tutorial="images-plan"]` (`.planta-grid`, plano de salas — solo existe con ≥1 galería,
  igual que otros anchors gateados por contenido de fases anteriores) y `[data-tutorial="mini-player"]`
  (`layout/containers/mini-player.container.ts`, `.bar` — solo existe con un track cargado).
- **Límite reconocido, no forzado**: varios gestos siguen viviendo en una ruta de detalle distinta
  y gateada por contenido (tags de Notes en `/notes/:id`, sala/mini-mapa de Images en
  `/images/:id`, editor de Writings en `/writings/:id`, atajos del lector de Books en la ruta de
  lectura) — esos steps describen el gesto con precisión pero quedan sin `action`, como ya
  documentó la Fase 4 para el problema de anchors.
- **Regla §4.11.15b actualizada** (`reglas.md`): ya no dice "el builder lee el copy ya
  documentado... nunca inventado" — ahora refleja que cada tutorial de página escribe su propio
  copy paso a paso, independiente del copy de la home.
- Verificado: `bun run typecheck` limpio, `bun run test` 548/548 verde, `ng lint` sin errores
  nuevos.

**Fase 8 — cuatro huecos frente al estándar de onboarding, diseño cerrado.** _Pendiente de
ejecución — este bloque es el hand-off completo para el chat que la implemente, no hace falta
releer la conversación de diseño (2026-07-25) para retomarla._ Disparado por revisar el diseño
actual contra un framework externo de onboarding para plataformas complejas (visitas guiadas
interactivas, progressive disclosure, checklist inicial, empty states educativos, salida siempre
disponible, micro-aprendizaje, activadores inteligentes, centro de ayuda accesible). De esos 8
puntos, 5 ya están cubiertos (tours con acción real desde la Fase 5, salida con Escape/skip desde
la Fase 1, activadores inteligentes vía `autoStartIfUnseen`, micro-pasos de un gesto por step
desde la Fase 6/7, centro de ayuda vía el botón ✨ "Guía de la página"). Quedan 4 puntos,
investigados con 19 sub-agentes de exploración (uno por sección: las 17 con tutorial + Command
Palette + Sync) y luego discutidos y decididos en el chat de diseño. Onboarding (`features/onboarding/`,
el wizard de arranque) y Dev (`features/dev/`, herramienta interna) quedan fuera del conteo de
cobertura — no ameritan tutorial sobre sí mismos.

Redefinición clave surgida en la discusión: "cobertura" no es solo "¿existe `*.tutorial.ts`?" —
es que **todo lo enseñable de una página quede consultable por tutorial**, aunque no se
auto-dispare. Progressive disclosure y cobertura exhaustiva son la misma estructura de datos
vista desde dos ángulos: el tour corto (auto-arranque, solo lo básico) y la referencia completa
(re-lanzada a demanda, básico + avanzado) usan el mismo `TutorialDefinition`, no dos definiciones
separadas.

**Subdividido en 17 ítems (8.1-8.17), pensados para un chat de ejecución por ítem.** Cada uno
lista su prerequisito explícito — la mayoría de los ítems de contenido por página solo necesitan
8.1 cerrado antes de poder usar `tier`/`moreDetail`; el resto no depende de nada. No hace falta
ejecutarlos en orden salvo que un ítem lo pida.

### 8.1 — Engine: `tier`, `moreDetail`, `start(id, mode)` — _Cerrado._

_Prereq: ninguno. Desbloquea: 8.8-8.17 (cualquier ítem que use `tier`/`moreDetail`)._

**Cambios de engine** (`core/tutorials/`):

- **`TutorialStep.tier?: 'basico' | 'avanzado'`** (`tutorial.types.ts`). Ausente = `'basico'`
  (no hace falta anotar los steps que no cambian). Un step "avanzado" es un gesto de poder,
  atajo de teclado, o acción no necesaria para el primer uso real de la página — el mismo
  criterio que ya usó cada uno de los 19 reportes de investigación al clasificar sus steps
  (ver 8.8-8.15 para el detalle por página).
- **`TutorialStep.moreDetail?: { titleKey?: TranslationKey; bodyKey: TranslationKey }`**
  (`tutorial.types.ts`). Contenido opcional, más profundo, sobre el **mismo anchor** del step —
  para cubrir un gesto que ya tiene step propio pero merece más explicación (ej. qué hace cada
  botón de la toolbar de tiza) sin fragmentar en steps nuevos ni mover el spotlight.
  `TutorialOverlayComponent` suma un toggle "Ver más detalle" en la tarjeta que expande
  `moreDetail.bodyKey` in-place; colapsa de nuevo al cambiar de step. Esto es distinto de un
  step nuevo: un step nuevo hace falta cuando el gesto vive en **otro elemento** (otro anchor);
  `moreDetail` alcanza cuando es el mismo elemento con más para decir.
- **`TutorialService.start(id: string, mode: 'auto' | 'manual' = 'manual')`** (`tutorial.service.ts`).
  `mode: 'auto'` (llamado internamente desde `register()` cuando `autoStartIfUnseen` dispara)
  filtra `definition.steps` a solo `tier !== 'avanzado'` antes de arrancar. `mode: 'manual'`
  (default) corre la secuencia completa, básico + avanzado, en su orden original — es el modo
  que usa el botón ✨ "Guía de la página" (`page-help-control.component.ts:95`, ya no necesita
  cambio porque el default cubre el caso) y "Recorrer este flujo" (`home.container.ts:82`, mismo
  motivo). Implementación: construir un `TutorialDefinition` filtrado (mismo `id`, `steps`
  recortado) y guardarlo en `activeSignal` — **gotcha real**: el disposer de `register()` hoy
  compara `this.activeSignal()?.definition !== definition` por referencia (`tutorial.service.ts:56`);
  con un clon filtrado esa igualdad se rompe siempre. Cambiar la comparación a
  `activeSignal()?.definition.id !== definition.id` como parte de este mismo cambio.
- Los 2 tutoriales cross-página (`home-flows.tutorial.ts`) no usan `tier` — se lanzan siempre en
  modo `'manual'` (completos) porque no tienen auto-arranque (`autoStartIfUnseen: false`).

_Definition of done: `tier`/`moreDetail` existen en `tutorial.types.ts`, `start(id, mode)` filtra
correctamente, el disposer compara por `id`, y al menos un tutorial existente (elegir uno chico,
ej. Trash) queda anotado con 1 step `avanzado` de prueba para validar el filtro end-to-end._

**Implementado:** `TutorialStep.tier?: 'basico' | 'avanzado'` y
`TutorialStep.moreDetail?: { titleKey?; bodyKey }` en `tutorial.types.ts`.
`TutorialService.start(id, mode: 'auto' | 'manual' = 'manual')`: `'auto'` (llamado desde
`register()` cuando `autoStartIfUnseen` dispara) construye un clon filtrado
(`steps.filter(s => s.tier !== 'avanzado')`) y lo pasa a `goToStep`; `'manual'` (default, usado por
`page-help-control.component.ts:95` y `home.container.ts:82`, ninguno de los dos necesitó cambio)
corre la secuencia completa. El disposer de `register()` pasó de comparar
`activeSignal()?.definition !== definition` a `activeSignal()?.definition.id !== definition.id`
para sobrevivir al clon filtrado. `TutorialOverlayComponent` suma un toggle "Ver más detalle" /
"Ver menos" (nuevo estado `moreDetailOpenSignal`, colapsa al cambiar de step) que expande
`moreDetail.bodyKey` (+ `titleKey` opcional) in-place sobre la misma tarjeta, sin mover el
spotlight — nuevas claves `tutorial.nav.moreDetail`/`tutorial.nav.lessDetail` en `es.ts`. Validado
end-to-end en `trash.tutorial.ts`: el step `restore` quedó anotado `tier: 'avanzado'`.
Verificado: `bun run typecheck` limpio, `bun run test` 548/548 verde.

### 8.2 — Bug: Goals steps 5-6 describen un gesto que no existe en `/goals`

_Prereq: ninguno (no depende de `tier`, es un fix de copy/anchor)._

`goals.tutorial.ts` steps 5-6 describen Shift+click multi-selección + drag de **toda la
constelación**, un gesto que no existe en `/goals` — vive en
`goal-constellation-editor.component.ts`, ruta `/goals/:id`. `goals-wall.container.ts:174-250`
confirma que `onStarTap`/`onStarDown` mueven una sola estrella y navegan, no hay `contextmenu`
handler en la wall. Corregir copy + anchor para describir el gesto real de `/goals`, o mover esos
dos steps a `route: '/goals/:id'` si el gesto multi-select vale la pena enseñarlo ahí.

### 8.3 — Bug: Music `mini-player` step sin `skipIfMissing`

_Prereq: ninguno._

`music.tutorial.ts`, step `mini-player`: anchor `[data-tutorial="mini-player"]` solo existe con
un track cargado (`mini-player.container.ts:14`, `@if (player.currentTrack())`) pero el step no
tiene `skipIfMissing: true` — reproduce el bug de "tarjeta flotando en (0,0)" documentado en la
Fase 4, para cualquier usuario sin nada sonando. Agregar `skipIfMissing: true`.

### 8.4 — Empty state roto: Calendar wallboard sin bloque `@empty`

_Prereq: ninguno._

`calendar.container.html:128`, wallboard `.cards-col`/`wallGroups()`: no tiene ni bloque `@empty`
— filtrar a cero no muestra nada, ni siquiera texto. Peor que "pasivo": es invisible. Agregar el
bloque `@empty` y un CTA "Limpiar filtro".

### 8.5 — Empty state que miente: Notes `/notes/:id` sin nota seleccionada

_Prereq: ninguno._

`notes.container.html:48`: el texto dice "Elegí una nota o creá una nueva" pero no hay ningún
control que cree una — viola la regla del proyecto de que la UI no debe mentir. Agregar un botón
real de crear, o cambiar el copy para no prometer una acción que no existe.

### 8.6 — Empty states: resto del pase (Goals, Lists, Writings, Tags, Music, Files)

_Prereq: ninguno. Se puede hacer en un solo chat porque son cambios chicos y del mismo tipo
(agregar un CTA dentro de un bloque de empty state ya existente), o partirse por página si un
chat se queda corto de contexto._

Todos pasan de texto pasivo a un CTA real (botón/link accionable dentro del propio bloque del
empty state, no solo un control adyacente):

- **Goals** (`goals-wall.container.html:220`, `noMatch`): agregar CTA "Limpiar filtro".
- **Lists** (`lists.container.html:46-49`, detalle sin lista seleccionada; `chalk-entry.component.ts:101`,
  card de lista vacía): el primero sin botón (solo "Volver"); evaluar agregar acceso directo a
  crear. El segundo depende del click en la card entera — aceptable, no requiere cambio si el
  click-through ya funciona (confirmar al ejecutar).
  Nota: `lists-shelf.container.html:52` (sin listas, sin filtro) y
  `chalk-layers-panel.component.html:25-27` (sin capas) **ya tienen CTA real** — no tocar.
- **Writings** (`writings-shelf.container.html:262-264`, `noMatch`): agregar CTA "Limpiar
  filtros" (el botón existe en otra parte de la página pero no dentro de este bloque).
- **Tags** (`tags.container.html:23`, `tags.empty`; más `tags.detail.empty`): ambos texto puro,
  sin explicar que los tags nacen de etiquetar contenido en otras páginas. Agregar esa explicación
  como mínimo; un link a Notes/Tasks es opcional.
- **Music** (`playlists-panel.container.html:12-16`, sin playlists): agregar CTA "Crear playlist"
  — falta pese a ser obvio.
- **Files** (`files.container.html:38-41` y `file-grid.component.html:21-41`): ambos ya tienen
  copy que referencia un botón, pero el botón vive en el toolbar exterior, no dentro del bloque
  del empty state — mover o duplicar el CTA adentro.

**No tocar** (ya son CTA real, o son pasivos correctamente por diseño): Books shelf, Images index/
room, Sync not-configured, Lists shelf, Goals wall (primer empty), Trash (ambos — un trash vacío
no debe tener CTA, es correcto que sea pasivo), History (no hay acción de "crear un commit" que
ofrecer), Settings (no tiene empty states).

### 8.7 — Checklist de onboarding en Home

_Prereq: ninguno._

Ubicación confirmada: `home.container.html`, entre el hero y la sección `.workflows` ("Flujos
típicos") — como primer beat, no mezclado en la lista de cards. Nuevo componente dumb
`features/home/components/onboarding-checklist.component.ts` + servicio nuevo
`core/onboarding/onboarding-checklist.service.ts` + `core/onboarding/onboarding.types.ts` (un
`core/` nuevo porque `features/home/` no puede importar de `features/notes|goals|...` — regla 10;
mismo motivo que ya forzó `dashboard.types.ts` a existir). Persistencia de qué se completó:
patrón try/catch sobre `localStorage`, mismo molde que `dashboard-resurface-storage.ts`.

**4 ítems**, los 4 con señal ya detectable sin inventar estado nuevo salvo uno:

1. **"Creá tu primera nota"** — `NotesService.summaries().length >= 1`.
2. **"Elegí un tema"** — `SettingsService.state().theme` distinto del default (`override !== 'auto'`
   o cualquiera de `customBgHue`/`customBgSatLevel`/`customAccentId` definido) — único ítem que
   necesita leer un signal existente con una condición nueva, no un flag nuevo.
3. **"Armá tu primer objetivo"** — `GoalsService.summaries().length >= 1`.
4. **"Recorré un flujo típico"** — gratis: ya lo trackea `hasSeenTutorial()` para
   `PROJECT_FLOW_TUTORIAL`/`DAILY_FLOW_TUTORIAL` (`core/tutorials/home-flows.tutorial.ts`, ids
   `'project-flow'`/`'daily-flow'` — confirmar ids exactos al implementar), cero señal nueva.

### 8.8 — Notes: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado._

_Prereq: 8.1 (usa `tier`), 8.18 (usa `pageId`/picker)._

Re-scoped bajo el modelo multi-flujo: los gaps pasan el criterio de 8.85 (independientes,
3+ steps, nombrables), así que se reparten en **4 `TutorialDefinition` con `pageId: 'notes'`** en
vez de engordar el flujo único actual:

1. **`notes` — "Notas: lo esencial"** (existente, sin cambios de fondo, `autoStartIfUnseen: true`):
   crear/abrir/tags/buscar.
2. **`notes-folders` — "Organizar en carpetas"** (nuevo, manual): crear/renombrar/mover carpeta,
   breadcrumbs, + scheduling de nota como step `tier: 'avanzado'` (misma familia temática:
   organizar la nota en el tiempo/espacio).
3. **`notes-editor-advanced` — "Editor: formato avanzado"** (nuevo, manual, `route: '/notes/:id'`):
   toolbar de `shared/editor/editor-toolbar.component.ts` agrupada en 2-3 steps por categoría
   (texto: bold/italic/headings/blockquote/listas; estructura y media: scene-break/highlight/
   insertar imagen/focus mode) — no un step por botón, usar `moreDetail` para el detalle exhaustivo
   de cada grupo.
4. **`notes-drafts` — "Comentarios, borradores y voz"** (nuevo, manual, `route: '/notes/:id'`):
   panel de comentarios/drafts + TTS/bookmarks (misma "familia": contenido de apoyo a la lectura/
   escritura). El banner de lock por edición concurrente (§4.16) va acá como step `tier: 'avanzado'`
   (es informativo, no un gesto que se practique).

Ver también 8.5 (empty state de esta misma página, mismo archivo de trabajo — ya estaba resuelto:
`notes.container.html` ya tenía un botón real de "Nueva nota" en el empty state al momento de
implementar esto, sin cambios necesarios).

**Deviaciones al implementar:**

- **Sin `route: '/notes/:id'` en `notes-editor-advanced`/`notes-drafts`.** Un `TutorialStep.route`
  se navega literal con `router.navigateByUrl(step.route)` — `'/notes/:id'` no es una ruta real
  (no hay id fijo para poner ahí), así que estos dos flujos se registran directo en
  `NotesContainer` (montado sólo cuando hay una nota abierta) sin `route`, igual que
  `books-editor-advanced`/`books-collab`/`books-tts` (que tampoco lo llevan pese a vivir en
  `/books/:id`).
- **`notes-folders` sin gesto de arrastrar-y-soltar.** A diferencia de Books, `notes-wall.container.html`
  no cablea `(childDragOver)`/`(childDrop)` de `mc-folder-breadcrumb` — Notas no tiene forma de
  soltar una nota sobre una subcarpeta. Ese step se reemplaza por "abrir una carpeta con click"; el
  step de gestionar (⋮) cubre mover/renombrar/eliminar vía diálogo.
- **Step de scheduling con `skipIfMissing`, sin `route`.** Vive físicamente en `/notes/:id`
  (`notes-schedule` en `note-editor-pane.component.ts`), pero `notes-folders` se registra en el
  muro (`/notes`) sin id fijo para navegar. Queda `tier: 'avanzado'` + `skipIfMissing: true`: si se
  corre el flujo sin una nota abierta, ese último step se salta solo en vez de romper.
- **`notes-drafts` sin TTS ni bookmarks — el nombre dropea "y voz".** Auditado: `TtsService` sólo lo
  consume `book-reader.container.ts`, y el input `bookmarkable` de `mc-editor` es opt-in (sólo
  seteado por Books) — Notas no tiene ninguna de las dos funciones. Labelkey quedó
  `notes.tutorial.flow.drafts` = "Comentarios y borradores" en vez de "Comentarios, borradores y
  voz", para no prometer una función inexistente.
- **Anchors del toolbar compartido (`editor-toolbar-format`/`-structure`/`-insert-image`/
  `-view-combined`/`-comments-index`/`-drafts-index`) y `editor-host` se agregaron a
  `shared/editor/editor-toolbar.component.ts`/`editor.component.html` sin prefijo `notes-`** —
  son genéricos porque cualquier feature que use `mc-editor` los hereda (a diferencia de Books, que
  tiene su propio toolbar y no toca este archivo compartido).

### 8.9 — Tasks: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado._

_Prereq: 8.1, 8.18._

Re-scoped: patio y editor completo son independientes y sustanciales (3+ steps propios, viven en
otra ruta/vista) → flujos propios. Drag-and-drop de trasplante y el "cómo" del date-picker son
gestos únicos sobre anchors ya cubiertos → se quedan dentro del flujo existente.

1. **`tasks` — "Tareas: lo esencial"** (existente, `autoStartIfUnseen: true`): lo que ya cubre hoy
   - drag-and-drop de trasplante por mouse como step nuevo `tier: 'avanzado'` (hoy solo se enseña
     el atajo Shift+→) + `moreDetail` sobre el step del selector de fecha explicando el "cómo".
2. **`tasks-patio` — "Patio: cosecha y riego"** (nuevo, manual, `route: '/tasks/patio'`): archivo
   mensual, mecánica de riego/marchitamiento (`onWater()`, estado `wilted`), el gesto de cosecha en
   sí (hoy solo se enseña el resultado/canasta en el flujo esencial — mover esa explicación acá).
3. **`tasks-editor` — "Editor de tarea completo"** (nuevo, manual, `route: '/tasks/:id'`):
   recordatorios, tags, foco, borrar.

**Implementado 2026-07-27, con desvíos respecto al texto de arriba:**

- **`tasks-patio` no tiene riego ni el gesto de cosecha — auditado y confirmado que esas
  mecánicas no viven en `/tasks/patio`.** `tasks-patio.container.ts`/`.html` y
  `harvested-plant.component.ts` muestran que el patio es un archivo **de solo lectura**: agrupa
  tareas ya cosechadas por mes, con un único gesto real (abrir una planta, `(open)`). No hay botón
  de riego ni transición de estado ahí — `onWater()`, el toggle 🚿 y el estado `wilted` viven en
  `tasks-garden.container.ts`/`.html` (el jardín, `/tasks`), y el gesto de cosecha en sí (Enter con
  la tarea enfocada → menú → "Cosechar") también ocurre ahí, en `plant-card.component.ts`
  (`onTransplantKey`) — de hecho ya estaba bien cubierto por el `body` del step `harvest` existente
  (`tasks.tutorial.harvest.body`), así que ese step no cambió. Contenido real de `tasks-patio`:
  intro al archivo mensual, qué significa que una planta se archive como árbol en vez de flor
  (`TREE_LONGEVITY_DAYS = 14` días en Floración antes de cosechar), abrir una planta, volver al
  jardín. `labelKey` ajustado a "Patio: archivo de cosechas" (sin "riego", para no prometer una
  mecánica que esta pantalla no tiene).
- **La mecánica de riego/marchitamiento se sumó igual, pero al flujo `tasks` existente** (no a
  `tasks-patio`, por el punto anterior): step nuevo `tier: 'avanzado'`, anchor
  `[data-tutorial="tasks-water-toggle"]` (agregado al botón 🚿 en `tasks-garden.container.html`),
  `action: { event: 'click' }`. Sin `icon` — no hay glyph de gota en `shared/icon/icons.data.ts` y
  no ameritaba agregar uno nuevo solo para este step.
- **`tasks-patio` sí usa `route: '/tasks/patio'`** tal como pedía el texto original, pero registrado
  desde `TasksGardenContainer` (`/tasks`, no desde `TasksPatioContainer`) — así el picker "Guía de
  la página" puede ofrecerlo estando en el jardín y navegar solo al arrancarlo. A diferencia de
  `/tasks/:id`, `/tasks/patio` es una ruta literal sin id, así que sí calza con
  `router.navigateByUrl(step.route)`.
- **`tasks-editor` sin `route: '/tasks/:id'`**, mismo criterio que `notes-editor-advanced`/
  `goals-constellation`: no hay id fijo para navegar un flujo manual arrancado desde otro lado, así
  que se registra directo en `TasksContainer` (montado solo en `/tasks/:id`) — sólo aparece en el
  picker una vez que el usuario ya tiene una tarea abierta.
- **Step de tags sin `action`**: agregar una etiqueta es escribir en el input de búsqueda/creación
  de `shared/tags/tag-picker.component.ts` — no hay un click único que capturar (mismo caso ya
  resuelto en `tags.tutorial.ts`), queda descriptivo.
- **Step de foco reusa el anchor genérico `editor-host`** (`shared/editor/editor.component.html`,
  agregado en 8.8 sin prefijo por feature) en vez de crear uno nuevo por-feature — mismo mecanismo
  que cualquier otra feature que use `mc-editor`. `action.key` es el atajo global
  `Alt+Shift+F` (`FocusModeService`), `skipIfMissing: true` igual que el precedente de
  `writings.tutorial.ts`.
- Anchors nuevos: `tasks-water-toggle` (`tasks-garden.container.html`), `tasks-patio-header`,
  `tasks-patio-grove`, `tasks-patio-item`, `tasks-patio-back` (`tasks-patio.container.html`),
  `tasks-editor-reminder`, `tasks-editor-tags`, `tasks-editor-delete`
  (`task-editor-pane.component.html`). Reusado sin cambios: `editor-host`.
- Tasks no tiene gesto de arrastrar-y-soltar una tarea sobre una subcarpeta (a diferencia de Books)
  — no se tocó nada de `shared/folder-breadcrumb/`; un eventual flujo `tasks-folders` (mencionado
  como pendiente en 8.86) queda fuera del alcance de este ítem, sin asignar a ninguna fase.
- `bun run typecheck` limpio.

### 8.10 — Settings: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado._

_Prereq: 8.1, 8.18._

Implementado tal cual el plan: 4 flujos de contenido + General absorbido como step nuevo en
`settings` (existente). Ningún grupo resultó lo bastante profundo como para justificar partirse en
más flujos — Tema (la tab más cargada, con override, hue/sat/acento y contraste) se resolvió con
`moreDetail` sobre un único step, sin fragmentar. Un desvío de implementación (no de scope): dado
que el contenido de cada tab solo existe en el DOM una vez esa tab está activa, anclar un step ahí
directamente lo dejaría sujeto a `skipIfMissing` y el motor lo saltearía antes de mostrar la acción
que activa la tab (ver `tutorial-overlay.component.ts#measure`) — así que cada step de tab ancla en
el botón de la tab misma (`[data-tutorial="settings-tab-<id>"]`, agregado dinámicamente vía
`[attr.data-tutorial]` en el `@for` del nav) con `action: { event: 'click' }`, y el contenido real
de la tab se explica en `bodyKey`/`moreDetail` en vez de spotlightearse.

9 tabs es el caso límite que 8.85 usó para estresar el diseño del picker: un flujo por tab daría
9 entradas (10 con el de navegación), por encima del techo blando de ~5-6 antes de necesitar
categorías. Solución: agrupar tabs afines por tema en vez de por tab 1:1 — 4 flujos de contenido
en vez de 9, quedando la página en 5 entradas totales:

1. **`settings` — "Settings: navegación"** (existente, `autoStartIfUnseen: true`): mecánica
   genérica de cambiar de tab (sin cambios).
2. **`settings-remote-versioning` — "Remoto y versionado"** (nuevo, manual): tabs Remoto +
   Versionado + Variantes (las 3 tocan el mismo tema, backup/historial).
3. **`settings-reminders-goals` — "Recordatorios, objetivos y autor"** (nuevo, manual): tabs
   Recordatorios + Objetivos + Autor (config liviana, mismo patrón de toggles/campos simples).
4. **`settings-theme-export` — "Tema y export"** (nuevo, manual): tabs Tema (editor de tema
   custom) + Export.
5. **General** se suma como step nuevo al flujo `settings` existente (uso inmediato, no amerita
   flujo propio — es la tab que ya se ve al entrar).

Un tab por step dentro de cada flujo agrupado, `tier: 'avanzado'` salvo que algún campo sea de uso
tan inmediato que amerite básico (a criterio de quien ejecute). Si al escribir el contenido real
alguno de estos grupos resulta tener más profundidad de la esperada (ej. Versionado solo ya
justifica 4-5 steps), está bien partirlo en su propio flujo — el agrupamiento de arriba es el punto
de partida, no una regla rígida.

### 8.11 — Variants: cobertura completa, multi-flujo (re-scoped por 8.85)

_Prereq: 8.1, 8.18._

Segundo pase de 8.85 encontró dos zonas independientes que el mapeo original no había recorrido:
el drawer de detalle de una variante (rename/color/borrar/navegación por historial) y la página de
merge entera (`/variants/merge`, ruta propia, hoy totalmente fuera del `pageId: 'variants'`) — las
dos pasan el criterio (independientes, 3+ steps, nombrables) → flujos propios. El resto (filtro,
refresh, leyenda) son gestos sueltos sobre el canvas ya cubierto:

1. **`variants` — "Variantes: lo esencial"** (existente, `autoStartIfUnseen: true`): crear/
   seleccionar en canvas (sin cambios) + filtro de búsqueda y refresh de actividad como `moreDetail`
   sobre el step de canvas; popover de leyenda como **mención de existencia** (step sin `action`,
   demasiado situacional para practicarse).
2. **`variants-drawer` — "Editar y navegar una variante"** (nuevo, manual): rename inline, color
   picker, eliminar (con diálogo de confirmación y warning de cambios sin mergear — el único gesto
   destructivo real, hoy sin step), click en pills parent/milestone/HEAD/ahead-behind para navegar
   el historial.
3. **`variants-merge` — "Resolver un merge"** (nuevo, manual, `route: '/variants/merge'`): selector
   from/into, swap, aplicar-todo-de-un-lado, elegir por archivo, aplicar merge, reintentar/saltar en
   fallo parcial (8+ gestos propios, ruta dedicada — el candidato más claro de toda la auditoría).

### 8.12 — Files: cobertura moderada, multi-flujo (re-scoped por 8.85)

_Prereq: 8.1, 8.18._

Gestión de subcarpetas es el mismo patrón que Notes 8.8 (crear/renombrar/mover, breadcrumbs — 3+
steps, independiente del flujo principal) → flujo propio, por consistencia con la misma decisión
tomada ahí. El resto son gestos puntuales sobre anchors del flujo esencial, no ameritan flujo propio:

1. **`files` — "Files: lo esencial"** (existente, `autoStartIfUnseen: true`): + drag-and-drop de
   subida/reorden, renombrar ítem, editar/borrar título de colección como steps nuevos
   `tier: 'avanzado'`; completar el step de tags existente con `action` real (agrega/quita un tag)
   en vez de crear un step nuevo.
2. **`files-folders` — "Organizar en subcarpetas"** (nuevo, manual): crear/renombrar/mover
   subcarpeta, breadcrumbs.

### 8.13 — Tags: split del step `rowActions`, multi-flujo condicional (re-scoped por 8.85)

_Prereq: 8.1, 8.18._

El step `rowActions` empaqueta 4 gestos (recolor/rename/merge/eliminar) en un solo step — viola
la propia regla de "un gesto por step" (§4.6.15b). Segundo pase de 8.85: como las filas de tags
solo existen si hay datos, este split funciona mejor como un **segundo flujo condicional** en vez
de steps sueltos en el flujo principal — evita que el flujo esencial dependa de que ya existan tags
para completarse:

1. **`tags` — "Tags: lo esencial"** (existente, `autoStartIfUnseen: true`): filtro de texto como
   `moreDetail`; tag-detail (navegación por entidades agrupadas) como **mención de existencia**.
2. **`tags-organize` — "Organizar tags"** (nuevo, manual, solo se ofrece en el picker si
   `rows().length > 0`): recolor (básico), rename (básico), merge con selector de destino
   (avanzado), eliminar con contador de uso (avanzado) — los 4 con `action` real.

Nota aparte: merge no tiene diálogo de confirmación pese a ser irreversible — bug de UX real; si se
corrige acá, documentarlo como tal en el commit (no es parte del framework de onboarding, es un
hallazgo colateral más).

### 8.14 — Lists: multi-flujo, tiza + organización (re-scoped por 8.85)

_Prereq: 8.1, 8.18._

El plan original (`moreDetail` sobre el step `tools`) se quedaba corto: segundo pase de 8.85
encontró que "modo tiza" es una superficie completa (dibujar/borrar, color/grosor, undo/redo,
atajos de teclado `b`/`e`/`[`/`]`/1-5/Ctrl+Shift+T, panel de capas con agregar/renombrar/ocultar/
bloquear/reordenar/borrar, exportar PNG/SVG, limpiar pizarra) — sobra para su propio flujo, no solo
un `moreDetail`. Carpetas del shelf (mismo patrón que Notes/Files) también aparece sin cubrir:

1. **`lists` — "Listas: lo esencial"** (existente en `/lists/:id`, `autoStartIfUnseen: true`):
   activar modo tiza (sin cambios) + búsqueda/cambio de eje alpha-tag/borrar lista del shelf como
   `moreDetail`/steps nuevos.
2. **`lists-chalk` — "Herramientas del tablero de tiza"** (nuevo, manual): dibujar/borrar con
   `action`, elegir color/grosor, undo/redo, atajos de teclado (mención con `action: keydown` donde
   aplique), panel de capas, exportar, limpiar pizarra (`tier: 'avanzado'`, destructivo).
3. **`lists-folders` — "Organizar en carpetas"** (nuevo, manual, shelf): crear/renombrar/mover
   carpeta, breadcrumbs — mismo patrón que Notes (8.8) y Files (8.12); ver nota transversal en
   8.86 sobre no duplicar este flujo 5 veces si el volumen de contenido termina siendo idéntico
   entre páginas.

### 8.15 — Dashboard: ajuste menor. Music: multi-flujo (re-scoped por 8.85)

_Prereq: 8.1, 8.18._

**Dashboard** no cambia de forma: toggle related/random del resurface se plegó como `action` sobre
el step existente (falta mencionarlo en `dashboard.tutorial.resurface.body`) — un solo gesto sobre
un anchor ya cubierto, no amerita flujo propio.

**Music** sí se amplía: segundo pase de 8.85 encontró que "playlist-editor no tiene step propio"
se quedaba corto — es una superficie entera (crear/reproducir/shuffle/eliminar playlist, favorito,
reordenar tracks por drag, agregar tracks vía picker con búsqueda) más una función totalmente
aparte (descarga por YouTube URL) y una selección masiva con bulk actions:

1. **`music` — "Music: lo esencial"** (existente, `autoStartIfUnseen: true`): upload/álbum/play-
   pause/buscar (sin cambios) + `skipIfMissing: true` en el step `mini-player` (bug 8.3) + seek en
   waveform como `action` sobre el step de reproducir + drag&drop de tracks a playlist y cola de
   reproducción (jump-to/clear) como `moreDetail`.
2. **`music-playlists` — "Armar y curar playlists"** (nuevo, manual): crear/reproducir/shuffle/
   eliminar playlist, favorito, reordenar tracks por drag, agregar vía picker con búsqueda.
3. **`music-youtube` — "Traer música de YouTube"** (nuevo, manual): input de URL, estado de
   descarga — flujo chico pero autocontenido y muy distinto en naturaleza del resto (trae contenido
   externo en vez de organizar el existente), nombrable con claridad.
4. **Selección múltiple + bulk delete/agregar-a-playlist**: 3+ gestos propios pero comparten anchor
   y contexto con el flujo esencial (es un modo del mismo listado de álbum) — se pliegan ahí como
   steps `tier: 'avanzado'` en vez de flujo aparte.
5. **Letras** (toggle + búsqueda externa por artista/título): 3 steps posibles pero muy chico y
   secundario — queda como `moreDetail` dentro de `music-playlists` en vez de flujo propio; atajos
   `n`/`p` como **mención de existencia** (ya cubiertos por el diálogo global de shortcuts).

### 8.16 — Command Palette: tutorial nuevo + capacidad de engine "anclar dentro de overlay"

_Prereq: 8.1. Recomendado ejecutar después de tener 2-3 páginas ya migradas a `tier` (8.8-8.12),
para no ser el primer tutorial que valide el engine nuevo en simultáneo con contenido nuevo._

No tiene `*.tutorial.ts`. Problema estructural: su contenido solo existe montado
condicionalmente (`@if (open())`) — no hay precedente en el código de "una acción abre un overlay
→ el siguiente step ancla adentro de ese overlay recién montado". Abrir desde el botón
persistente `.search-btn` en `workspace-sidebar.container.html:176-183` (siempre en el DOM, a
diferencia del propio diálogo) con `action: { event: 'click' }` o `keydown Ctrl+K`, después
anclar steps con `skipIfMissing: true` sobre el input/resultados ya montados. Un solo flujo alcanza
(confirmado en 8.85 — todo es parte de un mismo gesto continuo "buscar y navegar", no hay sub-zona
independiente): abrir con Ctrl+K, escribir, navegar resultados con flechas, Enter para abrir,
Escape para cerrar (básico); sintaxis `tag:<label>` y modo dual recientes/resultados como
`moreDetail` (avanzado — hoy solo se enseña con un hint estático,
`command-palette.container.html:128`); "olvidar" una query reciente y ver un tag directo desde el
resultado quedan como **mención de existencia** (gestos secundarios, bajo impacto). Dos empty
states encontrados en esta página, ambos texto pasivo — evaluar si entran en el mismo commit o se
suman a 8.6.

### 8.17 — Sync: tutorial nuevo + gating por `isConfigured()`

_Prereq: 8.1 y, idealmente, 8.16 (comparten el patrón de engine "overlay/contenido condicional",
mejor no ser los dos primeros en validarlo a la vez)._

No tiene `*.tutorial.ts`. Problema más agudo que Command Palette: **todo** `.layout` (los 5
anchors candidatos: consola de estado, push, fetch, auto-push/throttle, timestamp) vive detrás de
`@if (isConfigured())`, así que un usuario sin configurar no puede ver el tutorial en absoluto,
no solo un step. Registrar el tutorial condicionado a `isConfigured()`, con un step 0 sobre
`.not-configured` (`sync.container.html:7-18`) que linkea a `/settings` (ya tiene CTA real, no
necesita fix). Un solo flujo alcanza (confirmado en 8.85): básico: push, fetch, lectura de la
consola de estado. Avanzado (`moreDetail`/steps `tier: 'avanzado'`): toggle auto-push + throttle,
leer un "tubo" divergente y saltar a `/variants/merge` desde ahí — **cross-reference, no duplicar
contenido**: el paso a paso de cómo resolver el merge en sí vive en `variants-merge` (8.11), acá
solo se enseña el punto de entrada. Excluido del checklist de onboarding (8.7) — depende de un PAT
externo de GitHub, no es acción de día uno.

### 8.18 — Engine: selector de tutorial (múltiples flujos por página) — _Cerrado._

_Prereq: ninguno. Desbloquea: contenido multi-flujo por página (ver "Contenido pendiente" abajo)._

Disparado por feedback directo tras cerrar 8.2-8.7: el modelo de "un flujo por página" sub-cubre
la realidad — cada página enseña varios flujos, no uno, y las páginas con tabs (Settings: 9,
Music: 2) necesitan como mínimo un flujo por tab más uno cross-tab. Investigado antes de tocar
código (dos hallazgos clave): solo Settings y Music tienen tabs reales hoy (`activeSection`/
`leftView`, ambos client-state sin URL, resto de las 15 páginas sin sub-vistas); y cambiar de tab
no pide capacidad nueva de engine — un step con `action: { event: 'click', selector:
'[data-tutorial="..."]' }` sobre el botón de la tab ya resuelve "practicá cambiar de tab" (mismo
mecanismo que cualquier gesto real), con `skipIfMissing: true` en el step siguiente por si el
usuario avanza sin practicar el click.

**Implementado:** `TutorialDefinition` suma `pageId: string` (agrupa definiciones para el picker;
en las 17 definiciones existentes `pageId === id`, sin renombrar nada — cero riesgo para
`hasSeenTutorial`/`start(id)`) y `labelKey?: TranslationKey` (nombre corto en el picker, sin uso
mientras la página tenga una sola definición). `TutorialService.hasTutorialFor` pasa a comparar
por `pageId`; nuevo `tutorialsForPage(pageId)` devuelve todas las definiciones de una página.
`PageHelpControlComponent.openGuide()`: si hay una sola definición, arranca directo (cero cambio
visible en las 16 páginas que se quedan con un flujo); si hay más de una, abre
`layout/components/tutorial-picker-menu.component.ts` (popover nuevo, dumb) listando cada
`labelKey`. Solo la definición pensada como flujo principal debe registrarse con
`autoStartIfUnseen: true` — el resto, manuales, solo descubribles desde el picker.
De paso: se aclaró que `lists.tutorial.ts`/`lists-shelf.tutorial.ts` comparten `id: 'lists'` a
propósito (rutas mutuamente excluyentes, nunca montadas a la vez) — no era el bug que parecía a
primera vista, se dejó como estaba, solo se les sumó `pageId: 'lists'` por consistencia.
Verificado: `bun run typecheck` y `bun run test` limpios.

**Contenido pendiente (no escrito en este ítem):** ver ítem 8.85 — antes de escribir flujos nuevos
para ninguna página, hace falta afinar el diseño de 8.18 para que el modelo fluya bien aplicado a
las 17 sin excepción, no solo a las 2 con tabs.

### 8.85 — Investigación + diseño: afinar 8.18 para que el multi-flujo fluya en las 17 páginas — _Cerrado._

_Prereq: 8.18 (el engine del picker, cerrado). Desbloquea: 8.8/8.9/8.10/8.12 re-scoped (ver abajo)._

**Esto fue un chat de investigación + diseño, sin tocar código.** Auditoría: `tutorial.types.ts`,
`tutorial.service.ts` y las 18 `*.tutorial.ts` existentes (conteo de steps por archivo), más
relectura de los gaps ya mapeados en 8.8-8.17 (que asumían el modelo viejo, un flujo lineal con
`tier`). Conclusiones:

**1. El modelo de 8.18 alcanza tal cual — no hace falta tocar el engine.** El picker sigue siendo
una lista plana usable mientras ningún página supere ~5-6 entradas; con el re-scope de abajo
(Settings agrupando tabs afines) ninguna de las 17 llega a superarlo, así que categorías/agrupación
visual en el popover quedan sin construir (YAGNI, regla 19) — se reconsidera solo si una página
concreta llega a necesitar más de 6, no antes. La regla de "un solo flujo con
`autoStartIfUnseen: true`" tampoco cambia: ese flujo es siempre el que ya existe hoy como tutorial
por defecto de la página (el que cubre el circuito CRUD central, lo que un usuario nuevo hace el
día uno); los flujos nuevos que salgan de 8.8-8.17 se registran todos con
`autoStartIfUnseen: false`, descubribles solo desde el picker. No hace falta un criterio nuevo de
"cuál es el principal" — ya existe implícitamente (es el que nunca dejó de ser el default).

**2. Criterio para separar un sub-flujo en su propio `TutorialDefinition`** (en vez de
`tier`/`moreDetail` dentro del flujo existente) — los tres deben cumplirse:

- **Independiente**: un usuario que solo quiere aprender ese sub-flujo no necesita haber hecho los
  steps de otro flujo antes (no hay estado ni contexto compartido más allá de estar en la página/
  ruta correcta).
- **Sustancial**: al menos 3 steps propios. Un gesto de 1-2 steps no amerita entrada de picker
  propia — va como step nuevo (si es otro anchor) o `moreDetail` (si es el mismo anchor) dentro del
  flujo que ya cubre esa zona de la página.
- **Nombrable**: se le puede poner un `labelKey` corto y distinto del resto de los flujos de esa
  página (si el nombre termina siendo casi el mismo que el del flujo principal, es señal de que en
  realidad es el mismo flujo).
- Vivir en una tab/sub-ruta distinta (Settings, Music) refuerza el caso pero no es requisito — el
  audit de abajo encuentra candidatos igual de válidos en páginas sin tabs (Notes, Tasks, Files).

**2b. Tercera categoría, aparte de "flujo propio" y "step plegado en un flujo existente": mención
de existencia, sin flujo estructurado.** No usa capacidad de engine nueva — es simplemente un
`TutorialStep` sin `action` (el mecanismo ya existe desde la Fase 1) colgado del flujo que ya cubre
esa zona de la página. Se usa para funciones reales pero **demasiado versátiles/situacionales para
tener una secuencia clara que enseñar** — no hay "el" gesto correcto a practicar, o el gesto
depende tanto del contexto del usuario que forzar un `action` sería inventar un caso de uso. Señal
de que algo cae acá: al intentar describir "practicá X" no sale una sola frase con sentido para
todos los casos (ej. "elegí qué agrupar/ordenar" en un buscador con muchas combinaciones válidas).
**No todo lo que se audita tiene que terminar en flujo ni en gesto practicado** — el audit de abajo
etiqueta explícitamente cada hallazgo con una de las 3 categorías (flujo propio / plegado con o sin
`action` / mención de existencia) para que quien escriba el contenido no tenga que re-derivar el
criterio página por página.

**3. Relación con 8.8-8.17 — re-interpretados donde corresponde, confirmados como estaban donde no**:

- **Notes (8.8), Tasks (8.9), Settings (8.10), Files (8.12)**: sus gaps mapeados sí describen
  sub-flujos independientes — re-scoped abajo en sus propias entradas con el desglose de flujos.
- **Corrección tras un segundo pase, más exhaustivo** (mismo día, sesión 8.85 extendida): el primer
  pase de esta sesión reusó el mapeo de gaps de la auditoría de 19 agentes (Fase 3), que buscaba
  "¿qué le falta al tutorial actual de esta página?" sin releer todo el código de la feature de
  cero. Encargo explícito del usuario: releer cada una de las 17 páginas función por función —
  no solo lo ya mapeado — para no dejar gestos reales sin clasificar. Ese segundo pase (4 agentes
  en paralelo, cada uno auditando containers/componentes completos contra su(s) `*.tutorial.ts`)
  encontró **flujos independientes enteros que el primer pase no había visto** porque vivían en una
  ruta/editor anidado que el mapeo original no recorrió: el editor de constelación de Goals
  (`/goals/:id`, sin tutorial hoy), la página de merge de Variants (`/variants/merge`, ruta propia),
  el editor de playlist y la descarga por YouTube de Music, el editor de capítulo + TTS de Books,
  el modal de biblioteca de Writings, el modo semana de Calendar, el menú de posponer de Reminders,
  y más — el detalle completo, página por página, está en las entradas de abajo. Conclusión
  revisada: **Variants, Tags, Music, Goals (nunca tuvo ítem propio pese al bug 8.2), y las 7
  páginas que la Fase 3 había dado por "sin gap grande" (Books, Images, Calendar, Reminders,
  History, Writings, Trash) sí tienen flujos propios legítimos** — se re-scopean en sus propias
  entradas (8.11, 8.13, 8.15, y los ítems nuevos 8.86 en adelante). Lists
  (8.14) se amplía también: el audit encontró que la barra de tiza tiene mucho más que `moreDetail`
  (atajos, panel de capas, export) — pasa a multi-flujo igual que las demás. Command Palette
  (8.16) y Sync (8.17) se confirman como estaban (un flujo cada uno alcanza, ver su detalle).

### 8.86 — Transversal: carpetas se repite en 5+ páginas — ¿un flujo por página o contenido compartido?

_Prereq: ninguno (decisión de diseño, no bloquea el resto)._

El primer agente del audit de 8.85 marcó el patrón: Notes (8.8), Files (8.12) y Lists (8.14) ya
tienen un flujo `*-folders`/`*-organize` propio con el mismo contenido genérico (crear/renombrar/
mover carpeta, navegar breadcrumbs); Tasks, Goals y Books lo repiten también. **Decisión**: no vale
la pena una abstracción de contenido compartido (viola YAGNI si el ahorro es solo de texto) — cada
página igual necesita su `TutorialDefinition`/`labelKey`/anchors propios porque el selector real
(`[data-tutorial="..."]`) y la ruta cambian por feature, así que no hay mecanismo de reuso limpio
sin acoplar features entre sí (regla 10, una feature nunca importa de otra). Lo que sí conviene
compartir: **el copy base** — al escribir el `bodyKey` de cada flujo `*-folders`, empezar del mismo
texto genérico ("creá una carpeta, arrastrá para mover, hacé click en el breadcrumb para volver")
y particularizar solo donde la entidad difiera (ej. Books permite soltar un libro sobre una
subcarpeta desde el estante, gesto que Notes no tiene). Evita que 6 personas distintas escribiendo
6 flujos terminen con 6 tonos distintos para el mismo gesto. Sin ítem de código propio — es una
convención para quien escriba cada flujo `*-folders`, ya anotada en 8.8/8.12/8.14 y a repetir en
8.87 (Tasks/Goals) y 8.90 (Books) de abajo.

### 8.87 — Goals: cobertura completa, multi-flujo (nunca tuvo ítem propio) — _Cerrado._

_Prereq: 8.1, 8.18. Corrige además el bug 8.2 (steps que describen un gesto inexistente en `/goals`)
como parte del mismo trabajo, en vez de arreglarlo aislado — están en el mismo archivo._

Gap más grande de toda la auditoría: el editor de constelación (`/goals/:id`,
`goal-constellation-editor.component.ts`) **no tiene ningún tutorial**, y es donde vive el gesto
que el bug 8.2 describía por error en el wall (shift+click multi-selección + drag). El wall en sí
también tiene gaps menores.

1. **`goals` — "Objetivos: lo esencial"** (existente, `autoStartIfUnseen: true`): crear (sin
   cambios) + filtros de la wall (búsqueda, tag toggle, ocultar completadas) como `moreDetail`;
   completar el peek overlay (rename inline, completed toggle, deadline, prioridad, delete, "abrir
   mapa") con `action` real en el step `openDetail` en vez de dejarlo solo mencionado.
2. **`goals-constellation` — "Mapa de la constelación"** (nuevo, manual, `route: '/goals/:id'`):
   crear paso (click canvas), arrastrar, toggle done, renombrar (click derecho→popover), borrar,
   multi-selección shift+click + toolbar de lote (el gesto real del bug 8.2, corregido acá con
   anchor y copy correctos), deadline+hora, prioridad, recordatorio (enabled/lead/dormant).
3. **`goals-folders` — "Organizar en carpetas"** (nuevo, manual): mismo patrón que 8.86.

**Implementado 2026-07-27, con desvíos respecto al texto de arriba:**

- **Sin `route: '/goals/:id'`.** No hay un id fijo para deep-linkear un flujo manual iniciado desde
  la wall. Resuelto igual que `books-tts`/`books-collab`/`books-editor-advanced` (registradas en
  `BookReaderContainer`, montado sólo en `/books/:id/:chapterId`, sin `route`): `goals-constellation`
  se registra desde `GoalsContainer` (`goals.container.ts`, montado sólo en `/goals/:id`), así que
  sólo aparece en el picker "Guía de la página" una vez que el usuario ya está parado en una meta
  concreta — `pageId: 'goals'` matchea `/goals` y `/goals/:id` por igual (`routePageId` sólo mira el
  primer segmento), sin necesitar navegación explícita del engine.
- **`openDetail` no cambió de gesto** (sigue siendo shift+click → navega directo al editor completo,
  la corrección real del bug 8.2, ya aplicada 2026-07-25) — sólo ganó `action`. El peek overlay
  (rename/completed/deadline/prioridad/delete/"abrir mapa") se cubrió con 6 steps nuevos propios
  (`openPeek` + 5 controles), no metidos dentro de `openDetail`, porque el gatillo real del peek es
  un click simple (sin shift) — un gesto distinto que ningún step anterior describía, y cramear los 6
  controles en un solo step violaba §4.6.15b.
- **`goals-folders` sigue el patrón de Notes, no el de Books**: verificado en `goals-wall.container.
ts`/`.html` que las estrellas de la wall no son `draggable` y el container no cablea `(childDragOver)`/
  `(childDrop)` hacia `<mc-folder-breadcrumb>` — no hay gesto de "soltar sobre una subcarpeta", así
  que ese step es "abrir subcarpeta con click" en vez de drop.
- Click derecho (`contextmenu`) no es un evento soportado por `TutorialStepAction` (sólo
  click/submit/keydown/dragstart) — el step "renombrar (click derecho→popover)" queda descriptivo,
  sin `action`, igual que cualquier otro gesto no detectable por el engine.
- Anchors nuevos: `goal-constellation-canvas`, `goal-star`, `goal-star-popover-delete`,
  `goal-selection-toolbar`, `goal-selection-toggle-done`, `goal-deadline-chip`, `goal-priority`,
  `goal-reminder-enabled`, `goal-reminder-lead`, `goal-reminder-dormant` (en
  `goal-constellation-editor.component.html`, `goal-selection-toolbar.component.html`,
  `goal-editor-pane.component.html`), `goal-peek-rename`, `goal-peek-completed`, `goal-peek-deadline`,
  `goal-peek-priority`, `goal-peek-delete`, `goal-peek-openmap` (`goal-peek-overlay.component.html`),
  `goals-filters`, `goals-hide-completed` (`goals-wall.container.html`). Reusados sin cambios:
  `folder-breadcrumb-add`/`-child`/`-child-manage`/`-root` (`shared/folder-breadcrumb/`).
- `bun run typecheck` limpio.

### 8.88 — Calendar: multi-flujo, agenda semanal

_Prereq: 8.1, 8.18. Independiente del fix 8.4 (empty state del wallboard), se puede hacer en el
mismo commit o por separado._

Vista semanal ("leather book") es una zona independiente y sustancial que el audit original no
había recorrido (navegación prev/next semana, click día, 4 botones de creación rápida por tipo,
cerrar) → flujo propio. El resto son gestos sueltos sobre el header/tabla ya cubiertos.

1. **`calendar` — "Calendario: lo esencial"** (existente, `autoStartIfUnseen: true`): + búsqueda
   del toolbar, date-picker "ir a fecha", drag-and-drop de tareas para reprogramar, toggle activo/
   crear por tipo en las kind-cards — todos como steps/`moreDetail` `tier: 'avanzado'` sobre los
   anchors `calendar-views`/`calendar-table`/`filter` ya existentes; botón "Hoy" y selects de mes/
   año como **mención de existencia**.
2. **`calendar-week` — "Agenda semanal"** (nuevo, manual): nav prev/next, click día, creación
   rápida por tipo, cerrar. "Abrir libro" desde el modal de día como **mención de existencia**
   dentro de este flujo (es el punto de entrada, no un gesto a practicar aparte).

### 8.89 — Reminders: multi-flujo, atajos + posponer

_Prereq: 8.1, 8.18._

Dos zonas autocontenidas que el tutorial actual no menciona: el sistema completo de atajos de
teclado, y el menú de posponer/gestionar (`⋮` overflow) — ambas con 3+ gestos propios y nombrables.

1. **`reminders` — "Recordatorios: lo esencial"** (existente, `autoStartIfUnseen: true`): + búsqueda
   por nombre con `action` (misma zona que el filtro de fecha ya cubierto); edición de recurrencia
   y toggle de pausa con `action` real en el step `states` (hoy solo mencionado); toast de undo y
   registro de "papelitos tomados" como **mención de existencia**.
2. **`reminders-shortcuts` — "Atajos de teclado"** (nuevo, manual): navegar con j/k, abrir con e,
   marcar/borrar con espacio/Delete, nueva paloma con N.
3. **`reminders-snooze` — "Posponer y gestionar un recordatorio"** (nuevo, manual): snooze 1h/1d/
   lunes/finde, duplicar, eliminar desde el menú `⋮`.

### 8.90 — Books: cobertura completa, la superficie más grande de la auditoría — _Cerrado._

_Prereq: 8.1, 8.18._

**Deviaciones al implementar:** (1) el índice de capítulos (agregar/reordenar/eliminar) vive en
`book-open.container.ts` (la tapa abierta, `/books/:id`), no en `book-reader.container.ts` como
suponía el guess inicial del ítem — `books-chapter-index` se registra ahí. (2)
`books-editor-advanced`/`books-collab`/`books-tts` se registran sin `route` explícito: como
`pageId: 'books'` ya agrupa las 3 sub-rutas (`routePageId` sólo mira el primer segmento) y el
picker sólo lista flujos de contenedores actualmente montados (`TutorialService.tutorialsForPage`
lee `definitionsSignal` en vivo), cada flujo nuevo aparece en el picker únicamente cuando su propia
página está montada — mismo mecanismo implícito que ya usaba el flujo `books` existente para sus
steps del lector (`skipIfMissing` + navegación real practicada), sin necesitar un `route` estático
que de todos modos no podría resolver un id de libro concreto. (3) los anchors de crear/mover/
gestionar subcarpeta se agregaron a `shared/folder-breadcrumb/` (componente reusado por varias
features) con nombres genéricos (`folder-breadcrumb-*`) en vez de anchors por-feature — sólo hay
una instancia montada por ruta a la vez, así que no hay colisión; se prioriza no duplicar el
componente sobre el "selector cambia por feature" literal de §8.86. (4) el toggle de bookmark
dentro del editor no tiene gesto único practicable (aparece al hover sobre cualquier párrafo) — va
como mención de existencia sin `action`, igual que el catálogo global y el menú `⋯`.

El lector de libros concentra casi tanto contenido sin cubrir como Notes+Settings juntos: toolbar
de editor completa, TTS, índice de capítulos, y comentarios/propose son 4 zonas independientes.

1. **`books` — "Books: lo esencial"** (existente, `autoStartIfUnseen: true`): + búsqueda/filtro y
   toggle grid↔lista de la estantería como `moreDetail`; flip de portada a sinopsis/autor e ir al
   marcador como **mención de existencia** plegada en el step de abrir libro; menú `⋯` (eliminar/
   duplicar/exportar) y catálogo global como **mención de existencia**.
2. **`books-folders` — "Organizar en carpetas"** (nuevo, manual): mismo patrón que 8.86, más el
   gesto propio de soltar un libro sobre una subcarpeta desde el estante.
3. **`books-chapter-index` — "Editar el índice de capítulos"** (nuevo, manual): agregar, reordenar,
   eliminar capítulo.
4. **`books-editor-advanced` — "Formato del editor"** (nuevo, manual, `route: '/books/:id/...'`):
   toolbar completa (negrita/itálica/headings/cita/listas/scene break/insertar imagen), typewriter
   mode, stats popover — agrupar por categoría igual que `notes-editor-advanced` (8.8), es la misma
   toolbar compartida (`shared/editor/`).
5. **`books-collab` — "Comentarios y propuestas"** (nuevo, manual): Alt+C/Alt+P — si para cuando se
   ejecute este ítem ya existe un flujo equivalente en Notes/Writings (comparten el mismo
   componente de comentarios), cross-reference en vez de duplicar contenido.
6. **`books-tts` — "Lectura en voz alta"** (nuevo, manual): Ctrl+Alt+R, controles de TTS, bookmark
   toggle dentro del editor, export de capítulo a markdown.

### 8.91 — Images: ajustes menores, sin flujo nuevo

_Prereq: 8.1._

A diferencia de Books/Goals, acá el audit no encontró una zona independiente sustancial — todo se
pliega en el flujo `images` existente: abrir imagen + lightbox (Escape cierra) y eliminar imagen/
galería (destructivo, `tier: 'avanzado'`) como steps nuevos con `action`; drag-and-drop de archivos
como `moreDetail` sobre el step de subida (que hoy solo practica Ctrl+V); botón "Recorrer"/next-
prev cuarto como `moreDetail`; búsqueda, orden, filtro por tag, título/tags de galería y carpetas
como **mención de existencia** (demasiado situacionales para practicarse uno por uno).

### 8.92 — Writings: flujo nuevo para el modal de biblioteca

_Prereq: 8.1, 8.18._

El modal "Biblioteca" (buscar, filtrar por tag, cambiar vista estante/tabla/lista, agrupar por
carpeta, ordenar) es 5 gestos cohesivos e independientes del flujo de creación/edición → flujo
propio. El resto se pliega:

1. **`writings` — "Writings: lo esencial"** (existente, `autoStartIfUnseen: true`): + fecha límite/
   recordatorio y tag picker del editor como steps/`moreDetail`; borrar escrito como
   `tier: 'avanzado'`; typewriter mode como **mención de existencia** (infraestructura compartida
   del editor, no propia de Writings).
2. **`writings-library` — "Explorar la biblioteca"** (nuevo, manual): abrir biblioteca, buscar,
   cambiar vista, agrupar/ordenar, cerrar con Escape.

### 8.93 — History: flujo nuevo para restaurar

_Prereq: 8.1, 8.18._

Ningún step actual tiene `action` (los 3 steps existentes son solo mención). Restaurar (commit
completo o entidad individual, con confirmación tipeada) es la única zona con 3+ pasos propios y
consecuencia real (irreversible) → flujo propio, el resto se pliega con `action` real donde hoy
falta:

1. **`history` — "Historial: lo esencial"** (existente, `autoStartIfUnseen: true`): agregar
   `action: keydown` a los atajos `+`/`-`/`[`/`]`/Esc en el step de zoom existente; marcar/renombrar/
   borrar hito como steps `tier: 'avanzado'` junto al filtro de milestones ya cubierto; sintaxis de
   búsqueda `facet:`/`since:`/`sha:`, chips de faceta, compactar diff, agrupar por tipo, colapsar
   timeline y banner "compactar ahora" como **mención de existencia** (`moreDetail` sobre el step
   `history-timeline`).
2. **`history-restore` — "Restaurar una versión"** (nuevo, manual): elegir commit, elegir alcance
   (completo vs. entidad individual), confirmar (con el input de confirmación tipeada).

### 8.94 — Trash: ajustes menores, sin flujo nuevo

_Prereq: 8.1._

Página más chica de la auditoría — todo se pliega en el flujo `trash` existente: filtro por tipo de
entidad y ver detalle (modal preview) como steps nuevos con `action`; purgar individual y vaciar
papelera completa como `tier: 'avanzado'` junto al step de restore ya cubierto (ninguno de los dos
amerita flujo propio, son gestos únicos aunque destructivos); Escape cierra modal como **mención de
existencia**.

### Orden sugerido (no estricto)

8.1 y 8.18 primero (desbloquean el resto — el segundo en particular a todo ítem multi-flujo, que ya
asume el picker). 8.2-8.6 (bugs + empty states) y 8.7 (checklist) no dependen de nada, se pueden
intercalar en cualquier momento. 8.86 (decisión de copy compartido para `*-folders`) conviene
resolverlo antes de escribir el primero de esos flujos (8.8), aunque no bloquea nada técnicamente.

Contenido por página, multi-flujo (2+ `TutorialDefinition`): **8.8 Notes, 8.9 Tasks, 8.10 Settings,
8.11 Variants, 8.12 Files, 8.13 Tags, 8.14 Lists, 8.15 Music, 8.87 Goals, 8.88 Calendar, 8.89
Reminders, 8.90 Books, 8.92 Writings, 8.93 History** — 14 de las 17 páginas. Orden sugerido dentro
de este grupo: por tamaño de gap (Books 8.90 y Notes 8.8 primero — la mayor superficie sin cubrir
de toda la auditoría — después Settings 8.10 y Goals 8.87, el resto sin orden estricto).

Contenido de un solo flujo, sin split (gap ya cabe en `tier`/`moreDetail`): **8.15 Dashboard, 8.91
Images, 8.94 Trash**. Se pueden hacer en cualquier momento, incluso antes que el grupo multi-flujo
— son los más chicos de toda la fase.

8.16-8.17 (Command Palette, Sync) al final: son los únicos que siguen ejercitando la capacidad de
engine "anclar dentro de overlay condicional" (no el picker), y 8.17 depende del `route` de merge
que 8.11 debería dejar ya nombrado (`variants-merge`) para el cross-reference.
