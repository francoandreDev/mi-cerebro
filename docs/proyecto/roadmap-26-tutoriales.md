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
