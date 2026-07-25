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

**Fase 8 — cuatro huecos frente al estándar de onboarding, propuesta.** _Pendiente, sin empezar._
Disparado por revisar el diseño actual contra un framework externo de onboarding para plataformas
complejas (visitas guiadas interactivas, progressive disclosure, checklist inicial, empty states
educativos, salida siempre disponible, micro-aprendizaje, activadores inteligentes, centro de
ayuda accesible). De esos 8 puntos, 5 ya están cubiertos (tours con acción real desde la Fase 5,
salida con Escape/skip desde la Fase 1, activadores inteligentes vía `autoStartIfUnseen`, micro-pasos
de un gesto por step desde la Fase 6/7, centro de ayuda vía el botón ✨ "Guía de la página").
Quedan 4 sin cubrir, más un quinto encontrado en la misma conversación (cobertura incompleta):

1. **Progressive disclosure**: hoy no existe la noción de "usuario que ya domina lo básico" — un
   tutorial muestra siempre los mismos steps a un usuario en su primera visita y a uno que ya lo
   completó 20 veces (más allá de `hasSeenTutorial`, que solo decide si auto-arranca, no qué
   steps mostrar). Requiere decidir qué significa "básico" vs. "avanzado" por sección antes de
   tocar código — es una decisión de producto, no solo de engine.
2. **Onboarding checklist**: no existe ningún equivalente a una barra de progreso de 3-4 tareas
   para el arranque del workspace (ej. "creá tu primera nota", "elegí un tema", "armá tu primer
   libro"). Haría falta un componente nuevo (persistencia de qué tareas están hechas, dónde vive
   la barra — candidato natural: la home, cerca de las cards de "Flujos típicos") y una lista
   corta y explícita de qué 3-4 tareas cuentan.
3. **Empty states educativos**: sin auditar todavía cuáles de los estados vacíos actuales
   (galería sin imágenes, tablero sin tareas, papelera vacía, etc.) tienen un CTA real +
   explicación de cómo generar ese contenido, y cuáles son solo texto pasivo. Primer paso al
   retomar esta fase: recorrer las páginas y clasificar cada empty state encontrado.
4. **Cobertura incompleta**: no todas las funcionalidades tienen tutorial hoy. De
   `src/app/features/`, tres quedan sin `*.tutorial.ts`: **Command Palette** (`features/search/`,
   Ctrl+K), **Sync** (`features/sync/`) y **Onboarding** (`features/onboarding/`, el propio wizard
   de arranque — dudoso que necesite un tutorial sobre sí mismo). `Dev` (`features/dev/`) es
   herramienta interna, no una sección de usuario final — se propone excluirla explícitamente del
   conteo de cobertura. Falta decidir si Command Palette/Sync entran en esta fase o si abren su
   propio ítem.

Sin diseño ni código todavía — esta entrada solo fija el alcance para cuando se retome. Ver
conversación del 2026-07-25 para el framework externo que originó los primeros 3 puntos.
