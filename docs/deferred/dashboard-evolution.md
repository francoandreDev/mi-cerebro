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

## Resurfacing pasivo en dashboard (origen: §19.22bis, `docs/evolution.md` idea 1)

### Capítulos de libros en el pool de resurfacing

- **Qué**: el primer corte de "Redescubrí esto" cubre notas, escritos y listas — quedan afuera los capítulos de libros, aunque el alcance pedido era "todas las entidades con body de texto".
- **Por qué se difirió**: a diferencia de notes/writings/lists, `BooksService` no expone ningún signal reactivo con texto/preview cross-libro — sólo `summaries()` a nivel libro (sin body propio, un libro es un contenedor) y `listChapters(bookId)` async por libro individual. Sumar capítulos exige un índice agregado nuevo en `BooksService` (recorrer todos los libros, cachear preview+updatedAt+tags heredados del libro padre por cada capítulo) — trabajo de tamaño propio, no un mapeo directo como los otros tres.
- **Diseño decidido (2026-07-15, sin implementar)**: nuevo signal `chaptersIndex` en `BooksService`, poblado por `refreshChaptersIndex()` (recorre `summaries()` y llama `listChapters(bookId)` por libro, aplana a `{ id, bookId, title, updatedAt, preview, tags heredados del libro }`). Carga **lazy**: se dispara la primera vez que se visita `/dashboard`, no en el boot general — evita penalizar a quien nunca abre esa pantalla. `mergeResurfacePool` suma un cuarto input; nuevo `kind: 'book-chapter'` en el union de `DashboardRecentEntry`; "abrir" navega a `/books/:bookId/:chapterId`.
- **Target**: sin asignar — depende de si el primer corte demuestra que vale la pena.

### Selección por similitud de texto (modo adicional, no sustituto)

- **Qué**: hoy `selectResurfaceEntries` sólo pesa por antigüedad (aleatorio ponderado). Quedó afuera un segundo modo que use el índice MiniSearch existente para encontrar contenido parecido a lo que el usuario está viendo/editando en ese momento — explícitamente aditivo, no en reemplazo del modo aleatorio (así lo pidió el usuario).
- **Por qué se difirió**: exige decidir qué documento usar como query (¿la última entidad abierta? ¿la ruta actual?), tunear umbrales de similitud y resolver qué pasa cuando no hay contexto (ej. usuario recién entra a `/dashboard` sin haber abierto nada). Más caro que el modo aleatorio y con más superficie de bugs; el usuario prefirió no bloquear el primer corte en esto.
- **Diseño decidido (2026-07-15, sin implementar)**: toggle explícito en el widget (modo "Relacionado" vs. modo aleatorio actual). Query = última entidad abierta según `ContinuityService` (ya existe, sin trackear "lo que se edita ahora" en tiempo real). Se usa `SearchIndexService.query(título+preview de esa entidad)`, se filtra a los kinds candidatos, se excluye la propia entidad, se recorta a `DASHBOARD_RESURFACE_LIMIT`. Sin umbral mínimo de score — **top-N tal cual**, para no inventar un número arbitrario en el primer corte. Sin entidad "última abierta" (usuario recién entra sin historial), cae automáticamente al modo aleatorio en vez de mostrar el toggle roto.
- **Target**: sin asignar.

### Persistencia de `resurfaceExcluded` entre sesiones

- **Qué**: `DashboardService.resurfaceExcluded` vive sólo en memoria — se resetea en cada carga de la app, así que lo mismo puede volver a aparecer al recargar aunque se haya mostrado segundos antes.
- **Por qué se difirió**: persistirlo (IndexedDB o `localStorage`) es trivial en mecánica pero abre preguntas de producto sin resolver: ¿cuánto dura la exclusión (para siempre / N días / hasta agotar todo el pool una vez)? Sin esa decisión, cablear la persistencia ahora arriesga tener que deshacerla.
- **Diseño decidido (2026-07-15, sin implementar)**: persistir en `localStorage` (side-car de UI liviano, no dato de dominio) como `{ [entityId]: excludedAtMs }`. TTL fijo de **14 días**, reusando `DASHBOARD_RESURFACE_STALE_DAYS` — una entrada excluida vuelve a ser candidata justo cuando volvería a caer en el pool "stale" de todos modos; cero parámetro nuevo. `DashboardService` lee el storage al construirse, descarta entradas vencidas, siembra el signal inicial con el resto; cada `reshuffleResurface()` persiste el estado actualizado.
- **Target**: sin asignar.

### Acción "no me interesa esto" / snooze

- **Qué**: no hay forma de descartar permanentemente una entrada del pool de resurfacing (aparte de tocarla, lo que la saca del pool stale por 14 días al actualizar su `updatedAt`) ni de posponerla.
- **Por qué se difirió**: fuera del alcance del primer corte; depende de si la persistencia entre sesiones (ítem anterior) se implementa primero, porque un dismiss sin persistencia no sirve de nada.
- **Diseño decidido (2026-07-15, sin implementar)**: nuevo `output<DashboardRecentEntry>()` `dismiss` en `DashboardResurfaceWidgetComponent` (botón "✕" por fila, aparte del click de "abrir"). Handler → `dashboard.dismissResurfaceEntry(id)` reusa el mismo store persistido del ítem anterior (mismo TTL de 14 días) y saca la entrada de la vista al toque, sin esperar el próximo shuffle. Fundido con el "snooze" automático por touch — un solo mecanismo, un solo TTL, sin distinguir "posponer" de "descartar" para no sumar superficie sin necesidad probada.
- **Target**: sin asignar.
