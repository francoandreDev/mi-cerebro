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

### Verificación visual real en viewport mobile

- **Qué**: `dashboard.container.css` tiene un `@media (max-width: 480px)` (grid a 1 columna, padding reducido) pero nunca se confirmó en un viewport angosto real ni en dispositivo — la sesión que cerró §19.22 sólo verificó desktop (1512px) con Chrome.
- **Por qué se difirió**: fuera del alcance de la verificación funcional de esa sesión (typecheck/lint/tests + click-through en desktop); mismo patrón de breakpoint ya usado y probado en el resto de §21, riesgo bajo pero no confirmado.
- **Target**: sin asignar — agrupable con la próxima pasada de verificación visual de §21 si el bridge de Chrome está sano.

### ~~Tags no se muestran en los widgets del dashboard~~ (resuelto 2026-07-14)

- **Qué**: `TaskSummary`/`GoalSummary`/`NoteSummary`/`WritingSummary` ya traen `tags: readonly string[]`, pero ninguno de los 4 widgets de `/dashboard` los renderiza (sin chips de tag, a diferencia de `note-slip-card`/`kind-card` en otras vistas).
- **Estado**: cerrado (widget de reminders no aplica: `ReminderSummary` no tiene `tags`). `DashboardTaskItem`/`DashboardGoalItem` suman campo `tags` en `dashboard.types.ts`, poblado en `DashboardService` desde los summaries reales. `DashboardRecentEntry` ya traía `tags` sin usar. Los 3 widgets (`tasks`, `goals`, `recent`) reciben `[availableTags]` (signal `TagsService.tags` inyectado en `DashboardContainer`) y resuelven `tagIds → Tag` con el mismo patrón que `note-slip-card`/`tagged-generic-card`, renderizando `<mc-tag-chip>` en una segunda fila bajo el título (`.row-main` + `.tags` en `dashboard-widget.component.css`). Sin dependencias nuevas ni cambios de schema — solo se expuso un dato ya calculado.

## Resurfacing pasivo en dashboard (origen: §19.22bis, `docs/evolution.md` idea 1)

### Capítulos de libros en el pool de resurfacing

- **Qué**: el primer corte de "Redescubrí esto" cubre notas, escritos y listas — quedan afuera los capítulos de libros, aunque el alcance pedido era "todas las entidades con body de texto".
- **Por qué se difirió**: a diferencia de notes/writings/lists, `BooksService` no expone ningún signal reactivo con texto/preview cross-libro — sólo `summaries()` a nivel libro (sin body propio, un libro es un contenedor) y `listChapters(bookId)` async por libro individual. Sumar capítulos exige un índice agregado nuevo en `BooksService` (recorrer todos los libros, cachear preview+updatedAt+tags heredados del libro padre por cada capítulo) — trabajo de tamaño propio, no un mapeo directo como los otros tres.
- **Target**: sin asignar — depende de si el primer corte demuestra que vale la pena.

### Selección por similitud de texto (modo adicional, no sustituto)

- **Qué**: hoy `selectResurfaceEntries` sólo pesa por antigüedad (aleatorio ponderado). Quedó afuera un segundo modo que use el índice MiniSearch existente para encontrar contenido parecido a lo que el usuario está viendo/editando en ese momento — explícitamente aditivo, no en reemplazo del modo aleatorio (así lo pidió el usuario).
- **Por qué se difirió**: exige decidir qué documento usar como query (¿la última entidad abierta? ¿la ruta actual?), tunear umbrales de similitud y resolver qué pasa cuando no hay contexto (ej. usuario recién entra a `/dashboard` sin haber abierto nada). Más caro que el modo aleatorio y con más superficie de bugs; el usuario prefirió no bloquear el primer corte en esto.
- **Target**: sin asignar.

### Persistencia de `resurfaceExcluded` entre sesiones

- **Qué**: `DashboardService.resurfaceExcluded` vive sólo en memoria — se resetea en cada carga de la app, así que lo mismo puede volver a aparecer al recargar aunque se haya mostrado segundos antes.
- **Por qué se difirió**: persistirlo (IndexedDB o `localStorage`) es trivial en mecánica pero abre preguntas de producto sin resolver: ¿cuánto dura la exclusión (para siempre / N días / hasta agotar todo el pool una vez)? Sin esa decisión, cablear la persistencia ahora arriesga tener que deshacerla.
- **Target**: sin asignar.

### Acción "no me interesa esto" / snooze

- **Qué**: no hay forma de descartar permanentemente una entrada del pool de resurfacing (aparte de tocarla, lo que la saca del pool stale por 14 días al actualizar su `updatedAt`) ni de posponerla.
- **Por qué se difirió**: fuera del alcance del primer corte; depende de si la persistencia entre sesiones (ítem anterior) se implementa primero, porque un dismiss sin persistencia no sirve de nada.
- **Target**: sin asignar.

## Acompañamiento adaptativo de metas (origen: §19.25, `docs/evolution.md` idea 3)

### Señal de dormancia en el editor de meta individual

- **Qué**: `isGoalDormant` sólo se consume en `DashboardGoalsWidgetComponent` y en `GoalsWallContainer` (`/goals`). El editor de una meta puntual (`/goals/:id`, `GoalConstellationEditorComponent`) no muestra si esa meta está dormida.
- **Por qué se difirió**: el usuario acotó explícitamente la superficie a "dashboard + wall" en esta sesión; el editor de meta individual no se tocó a propósito.
- **Target**: sin asignar.

### Notificación proactiva de meta recién dormida

- **Qué**: hoy la dormancia es puramente visual/pasiva — el usuario tiene que visitar `/dashboard` o `/goals` para verla. No hay push activo (banner, toast) cuando una meta cruza el umbral de dormancia, a diferencia del reminder por deadline que sí empuja (§14).
- **Por qué se difirió**: cruzar esto con el sistema de reminders (`RemindersCadenceService`) es una decisión de producto propia (¿un reminder más? ¿un banner nuevo? ¿con qué cadencia, para no volver a caer en "banner permanente" que §13 prohíbe explícitamente?) — no se armó en esta sesión.
- **Target**: sin asignar.

### Umbral de dormancia no configurable desde la UI

- **Qué**: `settings.goals.dormantThresholdDays` (30 días default) se lee pero no hay ningún control en `/settings` para cambiarlo — sigue siendo un placeholder de datos sin UI, igual que antes de este paso (sólo cambió que ahora tiene un consumidor real).
- **Por qué se difirió**: fuera de alcance; el mismo hueco ya existe para `variants.dormantThresholdDays` y otros knobs listados en 11bis, no es específico de este paso.
- **Target**: sin asignar — agrupable con el resto de knobs de 11bis pendientes de UI.
