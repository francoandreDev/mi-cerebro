# Calendario, recordatorios y configuración

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Reglas generales de arquitectura en [`../proyecto/reglas.md`](../proyecto/reglas.md).

## Calendario

Feature consumidora-pura: no tiene modelo propio, lee fechas de otras entidades. Hoy agrega tareas (`dueDate`) y objetivos (`deadline`) — únicas entidades con fecha — más recordatorios (ver más abajo). Notas todavía no tienen campo de fecha.

### Cross-feature decoupling

- `@core/calendar/calendar-event.types` define:
  - `CalendarEvent { id, entityId, kind: 'task' | 'goal' | 'reminder', title, date, tags, done }`
  - `CalendarFilters { kinds, tagIds }`
  - `eventRoute(event)`, que resuelve a qué ruta navegar al clickear un evento.
- `@core/calendar/calendar-events.service` inyecta `TasksService`, `GoalsService` y `RemindersService` (mismo patrón que `TrashService`/`FoldersService`: servicios agregadores multi-entidad que viven en `core`, no en una feature). Expone:
  - `events` — computed plano, ordenado por fecha y luego título.
  - `eventsByDay` — computed `Map<isoDay, events[]>`.
  - `filter(events, filters)`.
- `features/calendar` solo importa el service de `core`, nunca de una feature hermana (regla §4.2).

### Rutas y vistas

Ruta `/calendar` con query params `?view=month|year&cursor=YYYY-MM-DD&day=YYYY-MM-DD`. `CalendarContainer` lee los params con `toSignal(route.queryParamMap)` y deriva `view`, `cursor` y los eventos filtrados por mes o año.

- **Month grid** (`CalendarMonthGridComponent`): siempre 6 semanas / 42 celdas (`buildMonthGrid(year, month)`), para que el layout no salte entre meses. Dots por kind (azul tarea, naranja meta) en los días con eventos. Resalta el día de hoy y el día seleccionado.
- **Year grid** (`CalendarYearGridComponent`): 12 mini-meses, tinte `--mc-bg-selected` en días con eventos. Click en un día abre la vista mes y lo selecciona; click en el nombre de un mes abre la vista mes en ese mes.
- **Day panel** (`CalendarDayPanelComponent`): se monta debajo del grid cuando hay `day` en los query params. Agrupa eventos por kind ("Tareas" / "Metas" / recordatorios), tachado en done/completed. Botones **"+ Nueva tarea"** y **"+ Nueva meta"** navegan a `/tasks` y `/goals` respectivamente.
- **Filtros** (`CalendarFiltersComponent`): chips para los kinds y chips para tags globales (`TagsService.tags()`); con tags seleccionados aparece "Limpiar tags".

Sidebar suma rail-icon 📅 "Calendario", con tratamiento de `RailKey` análogo a `trash`/`reminders`/`settings`: no es un entity-kind, no abre árbol de navegación.

### Fuera de alcance

- Prefijar fecha al crear una entidad desde el calendario.
- Drag-and-drop entre días.
- Vista semana.
- Notas fechadas (pendiente de que `Note` gane un campo de fecha).

## Recordatorios

La UI actual es un **palomar**: cada recordatorio es una paloma mensajera en un nicho de la pared (`/reminders`), agrupados por proximidad de vencimiento. Sin folders, sin tags, sin body.

### Modelo

- `title: string`, `dueAt: string` (ISO local sin timezone, `YYYY-MM-DDTHH:mm`), `done: boolean`, `paused: boolean`.
- `recurrence: { every: number; unit: 'day' | 'week' | 'month' | 'year' } | null`.
- `sourceKind` / `sourceId` — presentes cuando el recordatorio es auto-derivado de otra entidad (ver "Recordatorios derivados" abajo); `null` para uno creado a mano.

`RemindersService` (`features/reminders/services/`) reutiliza el patrón single-file simplificado: `refresh`/`create`/`read`/`save`/`deleteToTrash`, sin `walkEntities` ni folders, archivos en `reminders/<uuid>.json`.

### Buckets y metáfora visual

`bucketOf(reminder)` clasifica cada pendiente en `overdue | today | tomorrow | thisWeek | later | undated`; los `done` forman un bucket aparte. La pared distingue dos zonas:

- **Nichos** (`inNichos`) — todo lo no vencido, agrupado por bucket. Cada nicho tiene una puerta con apertura 0-3 según cuán cerca está el vencimiento (`today` = 3, bien abierta; `later`/`undated` = 0, cerrada) — un recordatorio `paused` siempre muestra puerta cerrada.
- **Perch** (`onPerch`) — los `overdue` viven en una repisa aparte, ya "posados" en vez de en su nicho.

Cada paloma lleva un anillo de color derivado de `recurrence.unit` (uno por day/week/month/year; transparente si no es recurrente) — la única señal visual de que es recurrente, sin texto.

### Recordatorios derivados

Metas, metas dormidas, tareas y escritos pueden generar su propio recordatorio automáticamente vía servicios de sync dedicados (`GoalRemindersSyncService`, `GoalDormantRemindersSyncService`, `TaskRemindersSyncService`, `WritingRemindersSyncService`) — el título se mantiene sincronizado con la entidad origen (de solo lectura en el detalle) y la paloma lleva una insignia identificando la fuente. "Borrar" uno de estos en realidad apaga el toggle correspondiente en la entidad origen; el propio servicio de sync es quien finalmente borra el `Reminder` en su próximo tick.

### Scheduler in-app

`@core/reminders/reminder-scheduler.service` (singleton root): computa el próximo pendiente no disparado, arma un `setTimeout`, y al disparar agrega el recordatorio a una signal `active` que dispara el toast. Se re-arma en cada cambio de summaries vía `effect`. `dueAt` se parsea como wall-clock local, sin manejo explícito de zonas horarias. Un `Set` `firedIds` en memoria evita re-disparar durante la sesión — al recargar arrancan limpios (consistente con que sólo funciona in-app, con la app abierta).

### UI

- **Toast:** `ReminderToastContainer` en `AppShellContainer`. Botones "Ver" (navega a `/reminders`) y "✕".
- **Pantalla `/reminders`:** quick-add con parseo de fecha en lenguaje natural (`parseQuickAdd`), búsqueda de texto y filtro por rango de fechas, panel de detalle al seleccionar una paloma (título si no viene de fuente, `dueAt`, recurrencia + intervalo, pausa), registro plegable de los `done`. Menú de acciones por paloma (posponer con presets — horas, próximo lunes, próximo fin de semana —, duplicar, borrar). Borrar uno normal hace soft-delete con toast de deshacer (6 s). También tiene **modo lista** con atajos J/K/Space/E/Del — ver [`conexiones.md`](./conexiones.md), que documenta ese primitivo compartido (`createListCursor`) porque reminders fue el primero en adoptarlo.

Sidebar suma rail-icon ⏰ "Recordatorios", con el mismo tratamiento de `RailKey` no-entity-kind que calendario/trash.

### Integraciones

- **Papelera:** `TrashKind` y `KIND_DIRS` extendidos con `reminder → reminders`; `parseEntry` acepta el prefijo `reminder`; `refreshKind` llama a `RemindersService.refresh`.
- **Carpetas:** como los recordatorios no tienen folders, `FolderKind` dejó de ser un alias de `TrashKind` — se define explícitamente como todos los kinds menos `reminder`, para que el switch exhaustivo de `FoldersService` no tenga una rama imposible.
- **Calendario:** `CalendarEventKind` suma `'reminder'`, incluido en `ALL_CALENDAR_KINDS`; `eventRoute(reminder)` apunta a `/reminders` (sin id de detalle — no existe vista individual de un recordatorio). `CalendarEventsService` inyecta `RemindersService` y proyecta cada summary con `tags: []`. Filtros y day-panel ganan chip y botón "+ Nuevo recordatorio".

### Fuera de alcance

- Notificaciones del sistema operativo con la app cerrada.
- Palomares temáticos por categoría/tag (hoy se resuelve con los filtros de búsqueda + fecha).
- Animaciones de snooze/marcar-hecho manual (plumitas, plumaje enriquecido por recurrencia, ronroneo en hover) — pulido visual de baja prioridad, sin fecha asignada.
- Folders, tags y body en recordatorios.
- Snooze.
- Repetición / recurrencia.

## Configuración del usuario

`SettingsService` y la pantalla `/settings` centralizan los knobs que otras features necesitan pero no tenían dónde vivir (timer de autocommit, lifecycle de variantes, push opt-in, override de tema, umbral de objetivos dormidos, entre otros).

### `SettingsService` (`@core/settings/settings.service`)

Singleton root. Estado en un `signal<Settings>`, con `schemaVersion` para futuras migraciones (ver regla §4.15 sobre versionado de schema). API: `state` readonly + un `set<Key>` por campo, con validación inline antes de aceptar el nuevo valor.

### Persistencia dual

- **Fuente de verdad:** archivo `.mi-cerebro/settings.json` en el workspace del usuario — viaja con la carpeta, respetando la portabilidad real del proyecto.
- **Cache espejo:** `localStorage` bajo la key `mc.settings.v1`, para evitar flicker antes de que el handle del workspace esté autorizado.

Carga inicial: arranca desde el cache de `localStorage` (o defaults si está vacío o inválido). Cuando `WorkspaceService.isReady()` pasa a `true`, un `effect` dispara `syncWithWorkspaceFile`: si el archivo existe y el schema coincide, sobreescribe el estado en memoria y refresca el cache; si no existe, lo siembra con el estado actual.

Cada `set*` persiste a ambos lados: escritura atómica al archivo vía `FsService.writeFileAtomic` (fire-and-forget) y actualización del cache. Si el workspace todavía no está listo, solo persiste a `localStorage`; el sync posterior se encarga de reconciliar.

### Inventario de settings

Organizado por dominio, una entrada por feature dueña:

| Key                                                                 | Default                                         | Estado                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timezone`                                                          | `'America/Lima'` (IANA, UTC-5 sin DST)          | Cableado activamente desde este paso. Valida con `new Intl.DateTimeFormat('en', { timeZone })`, rechaza inválidos.                                                                                                                                                                                                                                 |
| `versioning.autocommitMinutes`                                      | `5`                                             | Cableado por el cierre de este mismo paso (11bis): `setAutocommitMinutes` (clamp 1-180); `AutocommitService` lo consume en `start()` y reacciona en vivo vía `effect` que llama `resetTimer(ms)` sin reiniciar el servicio. Helper `autocommitMinutesToMs` reemplaza la constante hardcodeada (queda `DEFAULT_AUTOCOMMIT_TIMER_MS` de referencia). |
| `versioning.pushAfterAutocommit` / `versioning.pushThrottleMinutes` | —                                               | Cableado por la feature de sync (UI real en `/sync`).                                                                                                                                                                                                                                                                                              |
| `variants.dormantThresholdDays`                                     | `30`                                            | Cableado por la feature de variantes (control 1-365).                                                                                                                                                                                                                                                                                              |
| `goals.dormantThresholdDays`                                        | `30`                                            | Cableado por la feature de objetivos (control 1-365), mismo patrón number-input + Apply que el de variantes.                                                                                                                                                                                                                                       |
| `theme.override`                                                    | `'auto' \| 'light' \| 'dark'`, default `'auto'` | Cableado desde el día uno de este paso: `SettingsService.setThemeOverride` + `ThemeService` como consumidor + control segmentado en `/settings → Tema` con preview del tema resuelto. Migración one-shot de `localStorage['mc.theme']` (legacy) al primer arranque.                                                                                |

Los campos todavía-placeholder se persisten con su default desde este paso, pero la lógica de lectura/escritura activa la implementa cada feature dueña cuando le toca — este servicio solo provee el contenedor y la validación de forma.

### Pantalla `/settings`

`SettingsContainer` con secciones plegables por dominio: General, Versionado, Variantes, Objetivos, Tema.

- **General:** único control funcional desde el origen del paso — `<input list>` con `<datalist>` alimentado por `Intl.supportedValuesOf('timeZone')` (fallback a lista curada si el runtime no lo expone). Autocompletado nativo combinado con escape hatch: cualquier IANA name válido se acepta libremente. Enter aplica, Escape revierte; validación pre-commit con `isValidTimezone()` muestra error inline.
- **Versionado / Objetivos / Variantes:** valores guardados, con controles reales (number input + Apply) para cada knob a medida que su feature dueña los cablea; badge "Próximamente" mientras siguen de solo lectura.
- **Tema:** segmented control `auto/light/dark` con preview del tema resuelto, más hue/sat/accent custom y badge WCAG.

Sidebar suma rail-icon ⚙ "Configuración", con el mismo tratamiento de `RailKey` no-entity-kind que calendario/recordatorios/papelera.

### Integración con `McDatePipe`

El pipe deja de hardcodear un offset fijo (`-5`) y consume `settingsService.timezone()`, formateando con `Intl.DateTimeFormat` + `formatToParts` para garantizar el layout literal `dd/mm/yyyy hh:mm:ss` independiente del locale del sistema operativo. Como necesita re-renderizar cuando cambia la timezone, el pipe es `pure: false` (costo aceptable: formatea date strings cortos en cada ciclo de detección de cambios).

### i18n

Strings bajo el namespace `settings.*` (título, secciones, labels, hints).

### Fuera de alcance

- Import/export manual del archivo de settings (el usuario puede copiar `.mi-cerebro/settings.json` directamente si lo necesita).
- Sincronización de settings entre pestañas (`BroadcastChannel`).
- Reset a defaults global.
- Conflict resolution si dos pestañas escriben simultáneamente (last-write-wins, aceptado por ser una feature de baja frecuencia de escritura).
- Knobs no listados en el inventario — cada feature suma los suyos cuando los necesita.
