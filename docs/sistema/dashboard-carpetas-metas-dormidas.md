# Dashboard, navegación por carpetas y metas dormidas

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

## Dashboard combinado (`/dashboard`)

`/dashboard` junta widgets de lectura de varias entidades sin abandonar el modelo de páginas separadas por entidad: tareas de hoy, objetivos activos, recordatorios próximos, notas/escritos recientes y una sección de resurfacing pasivo ("Redescubrí esto"). Home (`/`) no se toca — sigue siendo la guía estática de onboarding.

**Servicio central**: `core/dashboard/dashboard.service.ts` (`providedIn: 'root'`) inyecta `TasksService`/`GoalsService`/`RemindersService`/`NotesService`/`WritingsService`/`ListsService` y deriva `computed()` signals sobre sus `summaries()` — mismo molde que `core/calendar/calendar-events.service.ts` (regla 10, §4.2 de [`reglas.md`](../proyecto/reglas.md)). La lógica de filtro/orden vive en funciones puras en `core/dashboard/dashboard-filters.ts` (testeadas sin `TestBed`):

- Tareas de hoy o vencidas (no `done`).
- Objetivos activos (no `completed`), ordenados por vencimiento con prioridad como desempate.
- Recordatorios próximos (no `done`/`paused`).
- Notas + escritos recientes, fusionados por `updatedAt`.

Los componentes de `features/dashboard/` no pueden tipar sus `input()` directamente con los `Summary` de cada entidad (el lint `no-restricted-imports` que refuerza la regla 10 bloquea también imports de solo-tipo desde `features/*/*`), así que `core/dashboard/dashboard.types.ts` define tipos de vista propios (`DashboardTaskItem`, `DashboardGoalItem`, `DashboardReminderItem`, `DashboardRecentEntry`) que el servicio arma antes de exponer los signals.

`features/dashboard/` contiene `dashboard.routes.ts`, un container inteligente (`containers/dashboard.container.ts`, con click-through a `/tasks`, `/goals`, `/notes`, `/writings`; recordatorios van a la lista `/reminders`, sin ruta de detalle propia) y componentes "dumb" por widget (`components/dashboard-*-widget.component.ts`, solo `I18nService` inyectado). La ruta vive justo después de `''` (home) en `app.routes.ts`. El rail (`workspace-sidebar.container.ts`) trata `dashboard` como un `RailKey` transversal, igual que `calendar`/`reminders` (no es un `EntityKind`), con ícono `squares-four` primero entre los transversales.

### Resurfacing pasivo ("Redescubrí esto")

Mecanismo de recuperación pasiva para notas/escritos/listas/capítulos de libro: antes de este dashboard la única forma de reencontrar contenido viejo era la búsqueda activa.

- `DashboardEntryKind` incluye `'note' | 'writing' | 'list' | 'book-chapter'`; `dashboardEntryRoute` resuelve la ruta por kind vía un `Record<DashboardEntryKind, string>`.
- `dashboard-filters.ts` expone `mergeResurfacePool` (pool completo, sin recortar ni ordenar) y `selectResurfaceEntries(pool, excludedIds, now, random?)`: filtra candidatos con `updatedAt` de más de `DASHBOARD_RESURFACE_STALE_DAYS` (14) días y hace un muestreo ponderado sin reemplazo — peso lineal según antigüedad en días — hasta `DASHBOARD_RESURFACE_LIMIT` (3 entradas). Si la exclusión deja el pool elegible vacío, se ignora la exclusión (mismo patrón "agotar el pool" usado en otras partes del sistema para no bloquearse cuando se acaban los candidatos). `random` es inyectable (default `Math.random`) para poder testear los pesos con rolls fijos.
- `DashboardService` mantiene `resurfaceEntries` (computed) y `resurfaceExcluded` en memoria, con `reshuffleResurface()` moviendo lo mostrado a la exclusión para el próximo pick. El widget (`DashboardResurfaceWidgetComponent`) tiene un botón "🔀 Otra" que dispara el reshuffle sin salir de `/dashboard`, y una preview de texto de 2 líneas (clase `.preview`, `line-clamp`) — para `ListSummary`, que no tiene campo `preview`, se deriva de `previewItems.join(' · ')`.
- **Capítulos de libro**: `BooksService` expone `chaptersIndex` (signal) con `refreshChaptersIndex()`/`ensureChaptersIndexLoaded()` cargado de forma lazy — solo `/dashboard` paga el costo de aplanar capítulos a `BookChapterEntry`, no el boot de la app.
- **Modo "Relacionado"**: toggle en el widget que cambia la query a la última entidad visitada antes de entrar a `/dashboard` (`ContinuityService.getPreviousRoute()`, distinto de `getLastRoute()` que ya apunta a `/dashboard` cuando se lo lee). Esa entidad se resuelve contra el propio pool (`resolveContinuityEntry`) y se busca vía `SearchIndexService.query(...)` (`selectRelatedEntries`, top-N sin umbral), usando `combineWith: 'OR'` — el modo `'AND'` (default del índice, usado por el command palette) exige que el candidato contenga todas las palabras del título+preview de contexto, lo cual no devuelve nada para prosa real de más de 1-2 palabras.
- **Persistencia**: `resurfaceExcluded` se guarda en `localStorage` (`dashboard-resurface-storage.ts`) con TTL de 14 días; usa `Map<id, excludedAtMs>` en vez de `Set` para no resetear el TTL de una entrada ya excluida en cada save. Hay un botón "✕" por fila para descartar un ítem puntual, sobre el mismo store que el shuffle.
- Selección por similitud de texto (MiniSearch) como modo adicional al aleatorio queda fuera de alcance — ver `docs/deferred/index.md`.

### Índice de búsqueda compartido: `rebuildKind`

El cierre de este ítem destapó un bug preexistente que afectaba a todo el buscador, no solo al dashboard: 6 de los 8 servicios de entidad (`notes`/`tasks`/`goals`/`lists`/`writings`/`books`) llamaban `search.rebuild(indexDocs)` en su `refresh()`, vaciando **todo** el índice compartido antes de resembrar solo sus propios docs. Como `WorkspaceRefreshService.refreshAll()` los corre en secuencia fija y `books.refresh()` es siempre el último de los 6, ese servicio ganaba de forma determinística y borraba los otros 5 kinds en cada boot. `files`/`galleries` ya evitaban el problema con `upsert()` aditivo por doc.

Fix: `SearchIndexService.rebuildKind(kind, docs)` descarta y resiembra solo las entradas de ese kind puntual, dejando el resto intacto (conmutativo en vez de last-write-wins). Los 6 call sites migraron de `rebuild()` a `rebuildKind(<KIND>, ...)`.

## Navegación por carpetas: breadcrumb en las secciones de tarjetas

Los rediseños de sección a tarjetas (wall/garden/shelf/museo/corkboard) habían ido agregando su prefijo a `PANE_HIDDEN_PREFIXES`, ocultando el árbol de carpetas del sidebar sin dejar reemplazo: `FoldersService` seguía funcionando pero quedaba inalcanzable desde ninguna ruta. La solución adoptada es breadcrumb + drill-down tipo explorador de archivos (decisión del usuario sobre un dropdown/filtro o un panel lateral); el sidebar viejo no se reintroduce.

**Contrato de URL**: query param `?folder=<path>` por sección; ausencia de query param = raíz (nunca `?folder=` vacío). Mismo patrón que Calendar: `toSignal(route.queryParamMap)` para leer, `router.navigate([], { queryParams: { folder: path || null }, queryParamsHandling: 'merge' })` para escribir.

**Componente compartido**: `shared/folder-breadcrumb/` (`FolderBreadcrumbComponent` + helpers puros `immediateChildFolders`/`folderCrumbs`/`folderLeafName` en `folder-children.ts`), sin imports de `features/*` (regla 4.2.10 de [`reglas.md`](../proyecto/reglas.md)). Suma outputs opcionales `childDragOver`/`childDrop` (path + `DragEvent` nativo) para soltar un ítem arrastrado directo sobre la tarjeta de una subcarpeta sin tener que entrar primero — aditivo, no rompe a los consumidores que no los usan.

**Filtro por carpeta actual**: match exacto (`entity.folder === currentFolder()`), no el `isInsideFolder` recursivo usado para cascade-delete — en un drill-down las subcarpetas no deben sangrar contenido a la vista del padre.

**CRUD de carpetas**: `handleFolderAction`/`handleCreateFolder` viven ahora en `core/folders/folder-crud.ts` (sin imports de features), así que cualquier container puede llamarlos directo. `layout/containers/folder-actions.ts` re-exporta ambos para no romper el call site del sidebar y conserva solo `handleEntityAction`. El CRUD sigue usando `prompt()`/`confirm()` nativo — no hubo rediseño de UI de carpetas en este paso.

Todas las secciones (`notes`, `tasks`, `goals`, `lists`, `images`, `files`, `books`, `writings`) siguen el mismo patrón: bloque `params`/`currentFolder`/`allFolders` + `computed` `inCurrentFolder`/`visibleCollections` + `<mc-folder-breadcrumb>` en el template + handlers que llaman a `core/folders/folder-crud.ts`. `tasks-patio` (archivo histórico de tareas cosechadas) y el overlay de detalle de `files`/`images` quedan fuera de alcance a propósito: son vistas cross-carpeta por diseño, no de navegación jerárquica.

`books` y `writings` tenían de antes una UI de carpetas propia (un "estante" simultáneo por cada folder-string, plana, sin jerarquía real). En `books`, el viejo mecanismo de shelf-CRUD in-app (rename inline, creación de estante, drag&drop entre shelves en memoria) se eliminó por completo: no tocaba `FoldersService` real y quedaba duplicado y divergente del mecanismo genérico que ya usan las otras 7 entidades. `shelves()` se separó en `allShelvesGrouped` (privado, sigue agrupando todo — alimenta el catálogo/índice global) y `currentShelfBooks` (público, un solo estante = carpeta actual). En `writings`, el toggle "Agrupar por carpeta" (`groupingEnabled`) no necesitó cambios: al acotar la vista a `inCurrentFolder()`, agrupar sobre un conjunto que ya comparte carpeta colapsa solo a un único grupo. `continueReading` ("seguir donde dejaste") queda deliberadamente global, no acotado a la carpeta actual — es acceso rápido al ítem editado más recientemente en todo el workspace, no una vista de navegación.

## Testing: smoke visual como gap conocido

Un bug de layout real (grid de dos filas rota al insertar el breadcrumb como tercer hijo) solo se detectó con una pasada visual en Chrome — ni el build ni `tsc` lo atraparon. Hoy el proyecto solo corre `ng test` (Vitest sobre jsdom vía `TestBed`), que cubre lógica de componentes/servicios pero no calcula layout real, así que bugs puramente visuales quedan fuera de esa capa sin importar cuántos tests se agreguen. No hay Playwright ni otra herramienta de e2e/regresión visual en el repo; la regla general de qué se testea y qué no está en §4.7.18 de [`reglas.md`](../proyecto/reglas.md) ("tests donde duele"). La inversión en smoke e2e o regresión visual quedó como investigación pendiente, sin implementar y sin sesión asignada — ver `docs/deferred/index.md`.

## Metas dormidas

Las metas guardaban plazo y progreso pero nada detectaba que llevaran tiempo sin tocarse. El schema de `Goal`/`GoalSummary` (v8) suma `lastProgressAt`; sobre ese campo se deriva `isGoalDormant`, comparado contra el umbral configurable `settings.goals.dormantThresholdDays` (placeholder ya existente, cableado acá; default 30 días).

**Superficies que muestran el estado dormido**, todas leyendo el mismo cálculo:

- Dashboard (`DashboardGoalsWidgetComponent`): ícono 🌙 junto al progreso cuando `goal.dormant`.
- Wall (`/goals`): la estrella se desatura y deja de titilar vía clase CSS `.dormant` — sin sumar otro color, porque la dormancia es un eje distinto de "urgente por plazo" y no deben pisarse visualmente.
- Editor individual (`/goals/:id`, `GoalConstellationEditorComponent`): `GoalsContainer` calcula `isGoalDormant` con `SettingsService` y lo pasa como input `dormant` a través de `GoalEditorPaneComponent`; mismo ícono 🌙 junto al título en el nameplate.

Como prerequisito, `goals-wall.container.ts` (ya en 479 líneas, sobre el límite duro de 300 de la regla 4.4) se dividió en dos extracciones antes de sumarle la lógica de `dormant`: `buildStars`/`buildConstellationLinks` y los tipos `StarVm`/`LinkVm`/`StarState` pasaron a `goal-wall-layout.utils.ts` (funciones puras, sin dependencias de Angular); el CRUD del peek overlay se extrajo a `GoalPeekController`, una clase plana instanciada como class field, mismo patrón que `EntityLockController` de `core/locks/`. El container quedó en 297 líneas.
