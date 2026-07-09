# Redesign `/calendar` v2 — bitácora

Persistencia del rediseño de `/calendar` v2 (mesa de luz + agenda de cuero). Sirve para retomar el trabajo en otra sesión sin perder contexto. Convive con `docs/redesign.md` (índice general por página); este archivo guarda el detalle del trabajo en curso y se elimina cuando la tabla principal marque `/calendar` como ✅.

Ver la idea completa y el orden de trabajo original en `docs/redesign.md` → sección `/calendar v2`.

## Fases (orden de implementación)

| #   | Fase                                                     | Estado                                         |
| --- | -------------------------------------------------------- | ---------------------------------------------- |
| 1   | Servicio unificado consultable + auditoría               | ✅ 2026-07-09                                  |
| 2   | Mesa de luz básica: grilla de mes + capa de eventos      | ✅ 2026-07-09                                  |
| 3   | Capas restantes (recordatorios/tareas/notas) una por una | ✅ 2026-07-09 (fusionada con fase 2)           |
| 4   | Libro de cuero (zoom semana/día)                         | ✅ 2026-07-09                                  |
| 5   | Transición mesa↔libro                                    | ✅ 2026-07-09 (versión conservadora, ver nota) |

## Notas por fase

### Fase 1 — Servicio unificado + auditoría (✅)

**Hallazgo clave:** ya existía `CalendarEventsService` (`src/app/core/calendar/calendar-events.service.ts`) proyectando tasks (`dueDates`)/goals (`deadline`)/reminders (`dueAt`) en `CalendarEvent[]` reactivo (`events`, `eventsByDay`). No hacía falta construir el servicio desde cero — sólo cerrar el gap de notas.

**Gap encontrado:** `Note` no tenía ningún campo de fecha (solo `createdAt`/`updatedAt`). Usar esos timestamps como "fecha del ítem" habría mentido sobre qué representan (viola el principio de "la UI no debe fingir datos que no medimos" ya aplicado en `/music` v2 y `/sync`).

**Decisión (con el usuario):** agregar `scheduledFor?: string | null` opcional a `Note` — el usuario lo asigna explícitamente, nunca se infiere. Alternativa descartada: diferir notas del calendario v2 completamente.

**Archivos tocados:**

- `src/app/features/notes/models/note.types.ts` — `NOTE_SCHEMA_VERSION` 3→4, `Note.scheduledFor?: string | null`, `NoteSummary.scheduledFor: string | null`.
- `src/app/features/notes/services/scheduled-for.migration.ts` — nuevo, step v3→v4 no-op (bump only, campo default `undefined`).
- `src/app/features/notes/services/notes.service.ts` — step registrado en el constructor; `toSummary` incluye `scheduledFor`; nuevo `setScheduledFor(id, date|null)`.
- `src/app/features/notes/services/notes.service.spec.ts` — cubre default `null`, set y clear.
- `src/app/features/notes/components/note-editor-pane.component.ts` — chip `📅` con `<input type="date">` + botón limpiar (oculto en focus mode, junto al tag-picker). Nuevo output `scheduledForChange`.
- `src/app/features/notes/containers/notes.container.ts` / `.html` — `onScheduledForChange` sigue el mismo patrón que `onTitleChange`/`onAddTag` (mutación local + `scheduleSave`, autosave persiste).
- `src/app/core/i18n/locales/es.ts` — `notes.scheduledFor`, `notes.scheduledForClear`, `calendar.kind.note`, `calendar.day.newNote`.
- `src/app/core/calendar/calendar-event.types.ts` — `CalendarEventKind` gana `'note'`; `ALL_CALENDAR_KINDS` y `eventRoute` (→ `/notes/:id`) actualizados.
- `src/app/core/calendar/calendar-events.service.ts` — proyecta `NotesService.summaries()` filtrando por `scheduledFor` no-nulo; nuevo spec `calendar-events.service.spec.ts` (2 tests).
- `src/app/features/calendar/components/{kind-card,day-panel,toolbar}.component.ts` + `containers/calendar.container.ts` — el wallboard v1 tenía cadenas `if/else` que hacían fallback a "reminder" para cualquier kind no reconocido; sin este fix, una nota agendada se habría mostrado mal etiquetada como recordatorio. Se agregó rama explícita `'note'` en cada mapeo (icono, label, color de header, `onCreateForKind` → navega a `/notes`).

**Por qué no se tocó `eventsByDay`/rango:** el servicio ya es 100% reactivo sobre signals en memoria (no hay fetch por rango que optimizar); filtrar por mes/semana es un `.filter()` barato sobre el array ya materializado. El riesgo de performance del plan original ("evaluar SVG/canvas vs DOM") aplica al _render_ de la mesa de luz, no a la fuente de datos.

**Gate:** `tsc --noEmit` limpio; 9/9 tests en `notes.service.spec.ts`; 2/2 en `calendar-events.service.spec.ts`. Verificado en browser (ver Fase 2): fecha en nota → aparece en calendario agrupada como "Notas" → click navega de vuelta → limpiar fecha funciona.

### Fases 2+3 — Mesa de luz con las 4 capas de una vez (✅, fusionadas)

**Por qué se fusionaron:** el plan original preveía "una sola capa (eventos), toggles vacíos para el resto" para no cargar con la complejidad de las 4 capas de entrada. Pero la auditoría de la Fase 1 ya había dejado el `kindFilter`/`onToggleKind` funcionando de forma genérica para cualquier `CalendarEventKind` (`ALL_CALENDAR_KINDS` ya incluía las 4), y el conteo por-kind del viejo `month-grid` (`Partial<Record<CalendarEventKind, number>>`) ya era genérico también. Construir toggles "vacíos" (deshabilitados a propósito) habría sido trabajo descartable — el esfuerzo real y nuevo era puramente visual (el material mesa de luz/vidrio/acetatos), y ese esfuerzo es el mismo para 1 o para 4 capas. Se optó por cerrar ambas fases juntas en vez de fingir una limitación que ya no existía.

**Componente nuevo:** `src/app/features/calendar/components/light-table.component.ts` (`CalendarLightTableComponent`) reemplaza a `CalendarMonthGridComponent` (eliminado, sin otros consumidores) en la vista mes. Estructura:

- `.light-table` — marco exterior con gradiente madera oscura, simulando el borde de la mesa.
- `.glass` — panel interior con gradiente radial sutil + `box-shadow` inset simulando luz de abajo.
- Grilla de 42 celdas (reusa `buildMonthGrid` de `calendar-dates.ts`) — cada celda con número de día + un `.acetate-stack`: pila vertical de barritas de 4px, una por cada `CalendarEventKind` presente ese día (`task`/`goal`/`reminder`/`note`), coloreadas con `KIND_COLOR` y opacidad 0.75 para leerse como láminas semitransparentes apiladas.
- `.legend` — fila de chips toggle (uno por kind de `ALL_CALENDAR_KINDS`), atenuados cuando están apagados (`opacity: 0.55`), wireados al mismo `kindFilter`/`onToggleKind` del container — no hay lógica de filtro duplicada, sólo una vista más cerca de la grilla para prender/apagar capas sin bajar la vista al aside.

**Colores por kind:** `goal` = `--mc-warn` (ámbar), `reminder` = `--mc-danger` (rojo), `task` = `--mc-accent-primary`, `note` = `--mc-note` (violeta, fallback `#8a7ad1` — token nuevo sin entrada en `_tokens.scss`, siguiendo el mismo patrón no-tokenizado que `--mc-warn`/`--mc-danger`/`--mc-success` ya usan en el resto del código).

**Qué no cambió:** el aside `cards-col` (kind-cards con lista + crear + toggle) sigue igual — sirve doble propósito (lista de ítems del período + crear) que la mesa de luz no reemplaza, sólo complementa visualmente. Vista año, toolbar/buscador y day-modal intactos.

**Fix colateral necesario:** el wallboard v1 (`kind-card`, `day-panel`, `toolbar`, `calendar.container`) tenía cadenas `if/else` que hacían _fallback_ a `'reminder'` para cualquier kind no reconocido — sin este fix, toda nota agendada se habría mostrado mal etiquetada como recordatorio (ícono 🔔 y label "Recordatorios"). Se agregó rama explícita `'note'` en cada mapeo de icono/label/color, más `onCreateForKind` → navega a `/notes`.

**Verificación:** en browser (Vivaldi vía bridge Chrome↔WSL) se confirmó: nota con `scheduledFor` aparece en `/calendar` bajo "Notas" (no "Recordatorios"); día-modal agrupa correctamente; click navega a la nota; limpiar fecha la saca del calendario. Screenshot automatizado falló por un timeout intermitente del bridge CDP (no relacionado con la app — confirmado sin errores de consola y con el árbol de accesibilidad completo vía `read_page`); verificación visual pixel-perfect queda para revisión manual del usuario.

**Gate:** `tsc --noEmit` limpio; suite completa 458/462 (las 4 fallas son `tree-state.service.spec.ts`, pre-existentes, entorno sin `localStorage` — archivo no tocado en esta sesión); lint sin errores (sólo warnings de largo de archivo y `no-inline-styles`, ambos patrones ya aceptados en el resto del código para estilos dinámicos por-item).

**Verificación visual mesa de luz (Fase 2-3):** el bridge Chrome↔WSL siguió fallando este sesión también (timeout `Page.captureScreenshot`, mismo síntoma que la sesión anterior — confirmado no es la app: DOM completo vía `read_page`). El usuario decidió avanzar sin screenshot; queda pendiente que la revise manualmente en Vivaldi cuando pueda.

### Fase 4 — Libro de cuero: zoom semana/día (✅)

**Componente nuevo:** `src/app/features/calendar/components/leather-book.component.ts` (`CalendarLeatherBookComponent`). Reusa el mismo patrón visual "papel" (`--mc-book-paper-*` + `var(--mc-font-serif)`) que ya existe en `book-open.container.css` (lector de libros) en vez de inventar una paleta nueva — mismo look & feel de "página" en toda la app, con un marco exterior de cuero (gradiente marrón) que lo diferencia visualmente de la mesa de luz (madera+vidrio).

- `.spread` — dos páginas + `.spine` central (mismo truco de gradiente que el book reader).
- Página izquierda: `buildWeekDays` (helper nuevo en `calendar-dates.ts`, junto con `addDays`/`startOfWeek`) — 7 filas clickeables con puntitos de color (`.pin`) por kind presente ese día, nav prev/next semana.
- Página derecha: día seleccionado, agrupado por kind. Recordatorios se renderizan como **post-its** reales (rotación CSS alternada, fondo amarillo, ícono `push-pin`) — el resto (tareas/metas/notas) como lista "manuscrita" (itálica, serif, separadores punteados). Botones de creación por kind arriba a la derecha.
- Inputs: `weekStart`, `selected`, `events` (ya filtrados por kind/tag desde el container, mismo patrón que `light-table`). Outputs: `pick`, `prevWeek`, `nextWeek`, `close`, `openEvent`, `createTask/Goal/Reminder/Note`.

**Container:** `ViewMode` gana `'week'`. Nuevo computed `weekStart` (a partir de `cursor().day ?? todayIso()`) y `weekEvents` (rango de 7 días sobre `visibleEvents()`). Nuevos handlers `onPrevWeek`/`onNextWeek` (shift ±7 días), `onPickBookDay`, `onCloseBook` (vuelve a `view=month`). Nuevo chip "Semana" en el header, al lado de Mes/Año.

**Verificado en browser** (una vez reiniciado el dev server — ver nota abajo): libro renderiza 7 días + nav; click en un día muestra sus entradas agrupadas (confirmado con datos reales: 1 meta "manuscrita" + 2 recordatorios como post-its en un día); cerrar libro vuelve a `view=month` conservando `cursor`.

**Gotcha de sesión — dev server no recargaba:** Vite/Angular CLI seguía sirviendo el build inicial pese a múltiples ediciones; el watcher de archivos no disparó rebuild (probable limitación de inotify sobre `/mnt/c` en WSL). Hubo que matar y reiniciar `ng serve` para que los cambios se reflejaran. Si en una próxima sesión el browser no refleja ediciones recientes, reiniciar el dev server antes de asumir que el código está mal.

### Fase 5 — Transición mesa↔libro (✅, versión conservadora)

**Decisión:** el plan original decía "click en un día de la mesa → el día se levanta como acetato y se convierte en la página derecha del libro", lo que implicaba reemplazar el click-en-día de la mesa (que hoy abre el day-modal, ya cerrado y verificado en Fases 2-3) por una apertura directa del libro. Se optó por **no** tocar ese contrato ya probado. En su lugar:

- El día-modal (`day-modal.component.ts`) gana un botón nuevo "Ver en la agenda" (ícono `books`) que cierra el modal y navega a `view=week` con ese día seleccionado — mismo efecto ("un click en un día termina en la página del libro"), pero pasando por el preview rápido que ya existía en vez de saltarlo.
- El libro en sí entra con `mc-anim-pop` (animación ya existente en el sistema, usada por el propio day-modal) para dar el efecto de aparición ["wow"] sin construir una animación FLIP de "acetato que se levanta" a medida — hubiera sido trabajo nuevo no reusable y el spec ya marcaba este paso como el de menor prioridad ("dejalo para el final").

**Por qué no un lift literal:** habría significado remover o esconder el day-modal (con su propia UX ya validada por el usuario) para el flujo de un click, arriesgando una regresión sobre algo cerrado, a cambio de una animación más vistosa. Se prefirió sumar el libro como un paso explícito adicional.

**Gate:** `tsc --noEmit` limpio; suite 458/462 (mismas 4 fallas pre-existentes de `tree-state.service.spec.ts`, no tocado); `ng lint` 0 errores / 165 warnings (todos pre-existentes en otros archivos, patrón ya aceptado). Lint sí encontró un error real propio de esta sesión: el output `close` de `leather-book.component.ts` colisionaba con el evento DOM nativo `close` (`@angular-eslint/no-output-native`) — renombrado a `dismiss`, mismo nombre que ya usa `day-modal.component.ts` para el mismo propósito.

**Nota sobre el lint en este entorno:** `ng lint` tardó ~10-14 min en correr (dos veces) — mucho más que `tsc`/tests. Probable I/O lento de `/mnt/c` bajo WSL, igual que el gotcha del dev server arriba. Si hace falta lint en una sesión futura, correrlo en background y no bloquear el resto del trabajo esperándolo.

**Pendiente:**

- Revisión visual manual del usuario en Vivaldi (mesa de luz y libro de cuero, ninguno se vio en screenshot real todavía — bridge Chrome↔WSL sigue fallando en ambas sesiones).
- Si el usuario pide el lift literal del acetato más adelante, evaluar como iteración aparte sobre esta base ya funcional.
