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

### 8.8 — Notes: cobertura completa

_Prereq: 8.1 (usa `tier`)._

Steps nuevos a escribir, cada uno con su propio anchor/`data-tutorial` donde no exista todavía:
sistema de carpetas (crear/renombrar/mover, breadcrumbs), scheduling de nota, toolbar completa
del editor (`shared/editor/editor-toolbar.component.ts` — bold/italic/headings/blockquote/listas/
scene-break/highlight/insertar imagen/focus mode — candidato a varios steps, es mucho contenido),
panel de comentarios/drafts, TTS/bookmarks, banner de lock por edición concurrente (§4.16).
Marcar básico lo que ya cubre el tutorial actual (crear/abrir/tags/buscar) y avanzado lo nuevo,
salvo que algún ítem nuevo sea de uso tan inmediato que merezca básico (a criterio de quien
ejecute). Ver también 8.5 (empty state de esta misma página, mismo archivo de trabajo).

### 8.9 — Tasks: cobertura completa

_Prereq: 8.1._

Steps nuevos: vista patio (`/tasks/patio`, archivo mensual de cosecha), mecánica de riego/
marchitamiento (`onWater()`, estado `wilted`), el "cómo" del selector de fecha, editor de tarea
completo (`/tasks/:id` — recordatorios, tags, foco, borrar), drag-and-drop de trasplante por
mouse (hoy solo se enseña el atajo Shift+→), el gesto de cosecha en sí (solo se enseña el
resultado/canasta).

### 8.10 — Settings: cobertura completa

_Prereq: 8.1._

9 tabs (general/remoto/versionado/variantes/recordatorios/objetivos/autor/tema/export) — el
tutorial actual (4 steps) solo enseña la mecánica de navegación genérica, ningún tab explica su
propio contenido. Un step por tab con `tier: 'avanzado'` salvo General y Tema (uso más
inmediato, quedan básico).

### 8.11 — Variants: cobertura completa

_Prereq: 8.1._

Steps nuevos: renombrar, color picker, diálogo de confirmación de borrado (con warning de
cambios sin mergear), pills de parent/milestone/HEAD, pill de ahead/behind, filtro de búsqueda,
refresh de actividad, popover de leyenda. El único gesto real destructivo (borrar) hoy no tiene
step — el tutorial actual solo llega hasta merge; priorizar ese step.

### 8.12 — Files: cobertura moderada

_Prereq: 8.1._

Steps nuevos: gestión de subcarpetas, drag-and-drop de subida/reorden, renombrar ítem, editar/
borrar título de colección, el gesto real de agregar/quitar tags (el step existe pero sin
`action`, nunca demuestra el gesto — completar con `action` en vez de crear un step nuevo).

### 8.13 — Tags: split del step `rowActions`

_Prereq: 8.1._

El step `rowActions` empaqueta 4 gestos (recolor/rename/merge/eliminar) en un solo step — viola
la propia regla de "un gesto por step" (§4.6.15b). Separar en steps propios: recolor/rename como
básico, merge/eliminar como avanzado. Nota aparte: merge no tiene diálogo de confirmación pese a
ser irreversible — bug de UX real; si se corrige acá, documentarlo como tal en el commit (no es
parte del framework de onboarding, es un hallazgo colateral más).

### 8.14 — Lists: `moreDetail` para la barra de tiza

_Prereq: 8.1 (usa `moreDetail`)._

El step `tools` (chalk) nombra paleta/grosores/deshacer/capas/exportar todo junto — en vez de
fragmentarlo en steps nuevos (todos viven en el mismo control, la barra de tiza), usar
`moreDetail` para el detalle expandible de cada herramienta sobre el mismo anchor.

### 8.15 — Dashboard + Music: ajustes menores

_Prereq: 8.1 (si se anota `tier`; el contenido en sí no depende de nada)._

- **Dashboard**: falta mencionar el toggle de modo related/random del resurface en
  `dashboard.tutorial.resurface.body`.
- **Music**: `playlist-editor` no tiene step propio — agregar uno.

### 8.16 — Command Palette: tutorial nuevo + capacidad de engine "anclar dentro de overlay"

_Prereq: 8.1. Recomendado ejecutar después de tener 2-3 páginas ya migradas a `tier` (8.8-8.12),
para no ser el primer tutorial que valide el engine nuevo en simultáneo con contenido nuevo._

No tiene `*.tutorial.ts`. Problema estructural: su contenido solo existe montado
condicionalmente (`@if (open())`) — no hay precedente en el código de "una acción abre un overlay
→ el siguiente step ancla adentro de ese overlay recién montado". Abrir desde el botón
persistente `.search-btn` en `workspace-sidebar.container.html:176-183` (siempre en el DOM, a
diferencia del propio diálogo) con `action: { event: 'click' }` o `keydown Ctrl+K`, después
anclar steps con `skipIfMissing: true` sobre el input/resultados ya montados. Contenido: búsqueda
libre + navegación por teclado + lista de recientes (básico), sintaxis `tag:<label>` (avanzado —
hoy solo se enseña con un hint estático, `command-palette.container.html:128`). Dos empty states
encontrados en esta página, ambos texto pasivo — evaluar si entran en el mismo commit o se suman
a 8.6.

### 8.17 — Sync: tutorial nuevo + gating por `isConfigured()`

_Prereq: 8.1 y, idealmente, 8.16 (comparten el patrón de engine "overlay/contenido condicional",
mejor no ser los dos primeros en validarlo a la vez)._

No tiene `*.tutorial.ts`. Problema más agudo que Command Palette: **todo** `.layout` (los 5
anchors candidatos: consola de estado, push, fetch, auto-push/throttle, timestamp) vive detrás de
`@if (isConfigured())`, así que un usuario sin configurar no puede ver el tutorial en absoluto,
no solo un step. Registrar el tutorial condicionado a `isConfigured()`, con un step 0 sobre
`.not-configured` (`sync.container.html:7-18`) que linkea a `/settings` (ya tiene CTA real, no
necesita fix). Contenido básico: push, fetch, lectura de la consola de estado. Avanzado:
resolución de divergencia/merge, toggle de auto-push, tuning de throttle. Excluido del checklist
de onboarding (8.7) — depende de un PAT externo de GitHub, no es acción de día uno.

### Páginas sin ítem propio en esta fase

Books, Images, Calendar (fuera del fix puntual de 8.4), Reminders, History, Writings, Trash: el
audit de los 19 agentes no encontró en ellas un gap grande o moderado — quedan con su cobertura
actual. Nota igual: ningún tutorial de la app cubre el 100% literal de su página (ninguno de los
19 reportes encontró una sección "completa" en sentido estricto); estas 7 quedan fuera del scope
inicial porque el gap restante es marginal comparado con los ítems de arriba, no porque estén
terminadas. Abren su propio ítem si al cerrar 8.1-8.17 queda apetito de seguir.

### Orden sugerido (no estricto)

8.1 primero (desbloquea el resto). 8.2-8.6 (bugs + empty states) y 8.7 (checklist) no dependen de
nada, se pueden intercalar en cualquier momento, incluso en paralelo a 8.1 si se prefiere no
bloquear. 8.8-8.15 (contenido por página) en el orden de impacto ya reflejado en su numeración
(Notes → Tasks → Settings → Variants → Files → Tags → Lists → Dashboard/Music). 8.16-8.17
(Command Palette, Sync) al final, por la capacidad de engine nueva que ejercitan.
