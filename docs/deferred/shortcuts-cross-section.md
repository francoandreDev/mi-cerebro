# Diferidos — Atajos y vista cross-section

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Atajos / defaults del navegador (origen: audit 2026-06-30)

### Sobreescritura completa de defaults del navegador en combos consumidos

- **Qué**: la regla §4.6.15 exige que toda combinación de tecla consumida por la app llame `event.preventDefault()` antes de la lógica. Se hizo un sweep agregando `preventDefault()` en handlers ad-hoc (HostListener + `(keydown.*)` en templates) y se confirmó que `ShortcutsService` lo hace en capture-phase, pero **falta una verificación end-to-end de que ningún default del navegador se cuela**. Casos que en navegadores reales pueden seguir disparándose: Ctrl+S (guardar página), Ctrl+P (imprimir — colisiona con palette), Ctrl+N (nueva ventana, en algunos navegadores no se puede prevenir desde JS), Ctrl+W, F1 (ayuda nativa), F3 (find next), F11 (fullscreen). También quedan listeners no auditados en bindings tipo `(keydown.enter)`, `(keydown.arrowdown)` en templates que pueden no estar previniendo aunque consuman.
- **Por qué se difirió**: el audit fue mecánico (preventDefault donde había un handler). Verificar comportamiento real exige probar combo por combo en cada navegador soportado (Chrome, Edge, Vivaldi, Brave) y ver si el navegador todavía actúa. Algunos defaults son **inprevenibles** desde la página (Ctrl+N, Ctrl+W en la mayoría de Chromium) — esos quedan documentados como "no usar".
- **Target**: sin asignar. Tarea de QA + posible refactor de combos que choquen con defaults inprevenibles.

## Cross-section / vista unificada (origen: home guide audit, 2026-06-30)

### ~~Quick-capture global de nota desde cualquier sección~~ (resuelto 2026-07-09)

- **Qué**: un atajo que abra un overlay para crear una nota nueva **sin salir de la sección actual** (sirve mientras leés un libro, mirás el museo, escuchás música, etc.). Hoy `Alt+N` (`CreationIntentService`) crea la entidad cuya URL estás visitando — en /books crea libro, en /tasks crea tarea. No hay forma de capturar una idea suelta sin perder el contexto visual.
- **Estado**: cerrado. `QuickCaptureService` (`core/intents/quick-capture.service.ts`) registra `Alt+Shift+N` con scope `global` en `ShortcutsService` (no `Ctrl+Shift+N`: ese combo lo captura Chrome para "ventana de incógnito" antes de llegar a la página en una pestaña normal). Abre `QuickCaptureDialogComponent` (`shared/quick-capture/`, mismo esqueleto que `confirm-dialog.component.ts`, montado una sola vez en `AppShellContainer` junto al resto de overlays globales) con un textarea: `Enter` guarda, `Shift+Enter` hace salto de línea, `Esc` cancela. La primera línea se usa como título de la nota y el resto de líneas no vacías se guardan como párrafos del cuerpo (`NotesService.create` + `save`). Decisiones tomadas: la nota siempre cae en la raíz de `/notes` (`folder: ''`, igual que el resto de creaciones vía `Alt+N`) y no se preseleccionan tags (no existe un concepto de "tag activo" persistente entre secciones — los `activeTagIds` de cada wall container son filtros locales efímeros). Confirmación vía toast informativo reutilizando `AppError`/`ErrorService` (`MCB-UI-001`, ver `docs/errors.md`), con una acción "Abrir" que navega a la nota — esto requirió extender `ErrorToastComponent` para renderizar `error().actions` como botones (antes sólo lo hacía el modal). Verificado en runtime: disparado desde `/books`, permanece en `/books` tras guardar (no navega), el toast aparece con el código y el botón "Abrir" lleva a `/notes/<slug>-<id>` con título y cuerpo correctos. 6/6 tests nuevos en `quick-capture.service.spec.ts`.
- **Target**: cerrado.

### ~~Vista unificada cross-section por tag~~ (resuelto 2026-07-09)

- **Qué**: una pantalla que mostrá **todo lo tagueado con X** en una sola vista, con preview visual nativo de cada tipo (sticky para nota, poster para goal, lomo para libro, cuadro para imagen, etc.). Hoy hay filtro por tag por sección y el palette (Ctrl+K) acepta `tag:nombre`, pero no hay vista que cruce todas las secciones simultáneamente con su look propio.
- **Estado**: cerrado. `TaggedItemsService` (`core/tags/tagged-items.service.ts`) fanea sobre las 8 entidades taggeables (mismo patrón que `CalendarEventsService`/`TagsAdminService`) y expone `forTag(tagId)`. Nueva ruta `/tags/:id` (`TagDetailContainer`) agrupa por kind y renderiza cada uno con su card nativo. Se llega desde `Ctrl+K` con `tag:nombre` → aparece un ítem "Ver todo lo de #tag" (nuevo `TagViewItem` en el palette) que navega ahí.
  - **Descubrimiento de arquitectura durante la implementación**: el plan original asumía reusar directo los dumb components de cada feature (`note-slip`, `chalk-entry`, `writing-card`, `file-locker`) — viola §4.2.10 (una feature nunca importa de otra feature), nunca hecho antes en el código. Se resolvió moviendo/creando twins de solo-lectura en `shared/entity-cards/` con **inputs primitivos** (id/title/tags como `string[]`, no el `Summary` completo de cada feature) en vez del objeto de la feature — así `shared/` tampoco termina importando tipos de `features/*`. `book-volume` se movió tal cual (ya era 100% primitivo); `note-slip-card`, `chalk-entry-card`, `writing-card-preview`, `file-locker-card` y `goal-star-mini` son ports nuevos (mismo look, sin botón de borrar/drag/highlight — esta vista es de solo lectura). Tasks e images no tienen un card propio reusable (uno acoplado al bucket del jardín, el otro requeriría carga async de thumbnails, ver incidente §4.1.3b) — usan un `TaggedGenericCardComponent` compartido.
  - **Música excluida**: `Track`/`Playlist` no tienen campo `tags` — queda como nueva entrada diferida abajo.
- **Target**: cerrado.

### Tags en música (Track/Playlist)

- **Qué**: `Track` y `Playlist` (`features/music/models`) no tienen campo `tags`, a diferencia de las otras 8 entidades. Quedan afuera de cualquier filtro/vista transversal por tag (búsqueda global, `/tags/:id`).
- **Por qué se difirió**: agregar `tags` implica una migración de schema (`playlists.json`/metadata de tracks) y decidir si aplica a `Track` (por archivo) o sólo a `Playlist` (por colección) — no se tomó esa decisión de producto todavía. Descubierto al construir la vista cross-tag por tag (ítem anterior), que la excluyó de su alcance por este motivo.
- **Target**: sin asignar.

### Reschedule de tareas con DnD en el calendario

- **Qué**: en /calendar, arrastrar una tarea desde un día a otro para reagendarla, sin abrir su detalle. Hoy el calendario muestra eventos del día en un modal y para mover una tarea hay que editarla manualmente.
- **Por qué se difirió**: requiere DnD entre celdas de la grilla del mes + reuse del listener de drop del jardín de tareas. No urgente — la edición manual funciona — pero el flow "planificar proyecto" del home lo prometía.
- **Target**: sin asignar.

### Referencias / links entre entidades desde el editor

- **Qué**: poder linkear entidades entre sí desde dentro del editor (una nota que referencie una imagen, un escrito que linkee otra nota, etc.) tipo `[[wiki-link]]` o picker de "insertar referencia". Hoy las imágenes se referencian visualmente desde notas/escritos (renderización), pero no hay un sistema de links navegables entre entidades arbitrarias.
- **Por qué se difirió**: implica decidir sintaxis del link, picker de UI, resolución (qué pasa si la entidad target se borra), y cómo se ve el link en el renderizado vs el editor. Pieza grande de UX/datos.
- **Target**: sin asignar.
