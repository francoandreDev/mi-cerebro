# Diferidos — Dashboard y docs/evolution.md

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Dashboard combinado (origen: §19.22)

### ~~Verificación visual real en viewport mobile~~ (resuelto 2026-07-20)

- **Qué**: `dashboard.container.css` tiene un `@media (max-width: 480px)` (grid a 1 columna, padding reducido) pero nunca se confirmó en un viewport angosto real ni en dispositivo — la sesión que cerró §19.22 sólo verificó desktop (1512px) con Chrome.
- **Estado**: cerrado. Verificado vía DOM real dentro de un `<iframe>` inyectado en `/dashboard` (375px de ancho, mismo patrón que el resto de §21 en `responsive.md`): `scrollWidth === clientWidth`, sin overflow horizontal, con los 5 widgets (incluido el nuevo resurface con botón de descarte y toggle de modo) renderizados y funcionales dentro del viewport angosto.

## Resurfacing pasivo en dashboard (origen: §19.22bis, `docs/evolution.md` idea 1)

### ~~Capítulos de libros en el pool de resurfacing~~ (resuelto 2026-07-20)

- **Qué**: el primer corte de "Redescubrí esto" cubre notas, escritos y listas — quedan afuera los capítulos de libros, aunque el alcance pedido era "todas las entidades con body de texto".
- **Estado**: cerrado, según el diseño ya decidido acá: `BooksService` suma `chaptersIndex` (signal) + `refreshChaptersIndex()`/`ensureChaptersIndexLoaded()` (dedupeado tras el primer `refresh()` real — ver nota de bug abajo), aplanando cada capítulo de cada libro a `BookChapterEntry { id, bookId, title, updatedAt, preview, tags heredados del libro }` (`features/books/models/book.types.ts`). Carga lazy: sólo se dispara al visitar `/dashboard` (`DashboardContainer` constructor → `DashboardService.ensureChaptersIndexLoaded()`), no en boot general. `DashboardEntryKind` suma `'book-chapter'`; `dashboardEntryRoute` resuelve `/books/:bookId/:chapterId` con ids crudos (sin slug) — `extractEntityId` ya tolera esa forma. `mergeResurfacePool` (`dashboard-filters.ts`) gana un 4to parámetro opcional. Verificado en runtime contra el workspace real: 9 capítulos indexados, aparecen en el pool (`kind: 'book-chapter'`), y el click-through a `/books/:bookId/:chapterId` navega y renderiza el capítulo sin error.
  - **Bug real encontrado y corregido**: la primera versión de `ensureChaptersIndexLoaded()` deduplicaba con una promesa cacheada para siempre — si `/dashboard` montaba antes de que `WorkspaceRefreshService.refreshAll()` llegara a `books.refresh()`, `summaries()` todavía estaba `[]` y el resultado (vacío) quedaba cacheado por el resto de la sesión. Corregido con `firstRefreshDone` (una promesa interna a `BooksService`, resuelta al final de `refresh()`) que `ensureChaptersIndexLoaded()` espera antes de leer `summaries()` — sin depender de `WorkspaceRefreshService` para evitar un ciclo de imports (ese servicio ya inyecta `BooksService`).

### ~~Selección por similitud de texto (modo adicional, no sustituto)~~ (resuelto 2026-07-20)

- **Qué**: hoy `selectResurfaceEntries` sólo pesa por antigüedad (aleatorio ponderado). Quedó afuera un segundo modo que use el índice MiniSearch existente para encontrar contenido parecido a lo que el usuario está viendo/editando en ese momento — explícitamente aditivo, no en reemplazo del modo aleatorio (así lo pidió el usuario).
- **Estado**: cerrado, según el diseño ya decidido acá: toggle "Aleatorio"/"Relacionado" en el widget (`DashboardResurfaceWidgetComponent`, sólo visible cuando hay contexto — ver abajo). Query = última entidad abierta antes de `/dashboard`, vía `ContinuityService.getPreviousRoute()` (método nuevo, distinto de `getLastRoute()` — ese ya apunta a `/dashboard` para cuando se lo lee, por diseño de continuidad de boot). `resolveContinuityEntry` (`dashboard-filters.ts`) resuelve esa ruta a una entidad del propio pool de resurfacing por id. `SearchIndexService.query(título+preview, kinds: [note,writing,list])`, top-N sin umbral de score, excluyendo la propia entidad (`selectRelatedEntries`). Sin contexto (usuario entra directo a `/dashboard`, o la ruta previa no es una entidad de este pool), el toggle no se muestra — nunca un modo roto visible.
  - **Bug real encontrado y corregido, no menor**: `SearchIndexService.query()` sólo soportaba `combineWith: 'AND'` (hardcodeado en las `searchOptions` de MiniSearch) — buscar con `combineWith: 'AND'` un texto de varias palabras (título+preview de una entidad real) exige que el documento candidato contenga **todas** esas palabras, lo cual devuelve cero resultados casi siempre para prosa real (verificado en runtime contra el workspace real: 0 resultados con cualquier query de más de 1-2 palabras). `SearchQuery` suma `combineWith?: 'AND' | 'OR'` (default `'AND'`, no rompe el command palette); el modo "Relacionado" pasa `'OR'` explícito. Verificado en runtime: con `OR` el modo relacionado devuelve resultados reales y distintos del modo aleatorio.
  - **Bug real encontrado y corregido, mayor — afecta también al command palette (§7b)**: mientras se verificaba esto contra el workspace real, `svc.search.query({text:''})` (browse) devolvió sólo `book`/`image`/`file`, sin `note`/`task`/`goal`/`list`/`writing` — **el índice compartido se clobbereaba en cada boot**. 6 de los 8 servicios de entidad (`notes`/`tasks`/`goals`/`lists`/`writings`/`books`) llaman `search.rebuild(indexDocs)` en su propio `refresh()`, y `rebuild()` vacía **todo** el índice antes de re-sembrar sólo sus propios docs. `WorkspaceRefreshService.refreshAll()` los llama en secuencia (`tags→notes→tasks→goals→lists→writings→books→galleries→files→...`) — determinístico, no una race real: `books.refresh()` es el último de los 6 que llama `rebuild()`, así que siempre gana y borra los otros 5 kinds en cada boot. `files`/`galleries` ya evitaban esto con `upsert()` por doc (aditivo). Fix: `SearchIndexService` suma `rebuildKind(kind, docs)` — sólo descarta/resiembra las entradas de ese kind, dejando el resto intacto (las llamadas se vuelven conmutativas en vez de last-write-wins); los 6 call sites pasan de `rebuild(indexDocs)` a `rebuildKind(<KIND>, indexDocs)`. `rebuild()` (nuke-and-reseed completo) se deja intacto como primitiva aparte, no tiene otro consumidor hoy. Verificado en runtime: tras el fix, `search.size()` incluye los 8 kinds. Este bug preexistía y afectaba silenciosamente el command palette (`Ctrl+K`, §7b) desde que se cerró — no sólo al modo relacionado nuevo.
- **Target**: cerrado.

### ~~Persistencia de `resurfaceExcluded` entre sesiones~~ (resuelto 2026-07-20)

- **Qué**: `DashboardService.resurfaceExcluded` vivía sólo en memoria — se reseteaba en cada carga de la app, así que lo mismo podía volver a aparecer al recargar aunque se hubiera mostrado segundos antes.
- **Estado**: cerrado, según el diseño ya decidido acá: `localStorage` (`mc.dashboard.resurfaceExcluded.v1`) como `{ [entityId]: excludedAtMs }` (nuevo `dashboard-resurface-storage.ts`, `loadResurfaceExcluded`/`saveResurfaceExcluded`). TTL de 14 días reusando `DASHBOARD_RESURFACE_STALE_DAYS` — una entrada excluida vuelve a ser candidata cuando de todos modos volvería a caer en el pool stale. `DashboardService.resurfaceExcluded` pasó de `Set<string>` a `Map<string, number>` (id → timestamp de exclusión original) para que re-guardar en cada shuffle/dismiss no le reinicie el TTL a una entrada ya excluida. Verificado en runtime: la clave persiste en `localStorage` tras un dismiss, con el timestamp correcto.

### ~~Acción "no me interesa esto" / snooze~~ (resuelto 2026-07-20)

- **Qué**: no había forma de descartar permanentemente una entrada del pool de resurfacing (aparte de tocarla, lo que la sacaba del pool stale por 14 días al actualizar su `updatedAt`) ni de posponerla.
- **Estado**: cerrado, según el diseño ya decidido acá: botón "✕" por fila (`DashboardResurfaceWidgetComponent`, visible en hover/focus vía CSS, no compite por espacio en mobile) → `dismiss` output → `DashboardService.dismissResurfaceEntry(id)`, que reusa el mismo store persistido del ítem anterior (mismo TTL de 14 días). Fundido con el "snooze" automático por touch, un solo mecanismo — sin distinguir "posponer" de "descartar", tal como se había decidido. La entrada sale de la vista al toque porque `resurfaceEntries` (computed) depende de la señal `resurfaceExcluded`, así que el dismiss dispara un recompute inmediato del sample aleatorio (puede reacomodar también las otras filas visibles, no sólo la descartada — mismo comportamiento que "Otra", no se agregó lógica extra para pinnear las que no cambiaron). Verificado en runtime: click en "✕" saca la fila al instante y persiste la exclusión.
