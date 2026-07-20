# Diferidos — Recordatorios y metas

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Recordatorios automáticos por meta (origen: unificación 2026-06-23)

### Lead-time por meta

- **Qué**: hoy el `settings.goals.reminderLeadMinutes` es global. Una versión avanzada permite override per-goal (este objetivo arranca antes / después que el default).
- **Por qué se difirió**: YAGNI mientras un único lead-time alcance. Sumar UI + campo en `reminder` config + migración solo se justifica si el usuario pide tratar metas distinto entre sí.
- **Target**: sin asignar.

### Hora del deadline configurable / deadline con hora propia

- **Qué**: hoy el deadline es solo `YYYY-MM-DD` y se trata como 23:59 local. Una versión avanzada permite que cada meta tenga `deadlineTime?: HH:mm` (o un setting global "considero el deadline a las HH:mm").
- **Por qué se difirió**: el modelo `Goal.deadline` es date-only y agregarle hora implica migración + UI en `DeadlinePickerComponent`. 23:59 es razonable para casi todo plazo "fin del día".
- **Target**: sin asignar.

### ~~Recordatorios automáticos para tareas / escritos con deadline~~ (resuelto, cierre documentado 2026-07-20)

- **Qué**: extender el patrón goal-sourced a otras entidades con fecha (tareas con `dueDate`, escritos con plazo planificado), abriendo `sourceKind: 'task' | 'writing' | ...`.
- **Estado**: cerrado. Ya implementado en el commit `8128516` ("add automatic reminders for tasks and writings with a deadline") — `TaskRemindersSyncService`/`WritingRemindersSyncService` (`core/reminders/`) existen y están inyectados en `AppShellContainer`, `TaskReminderConfig`/`WritingReminderConfig` (default `{ enabled: false }`) viven en los schemas respectivos. Sólo esta entrada de `deferred/` había quedado sin cerrar (violaba regla 24, doc desactualizada) — descubierto de rebote mientras se verificaba el modo "Relacionado" del dashboard (§22bis), que reveló además que ese mismo commit había roto la compilación de tests: `TaskSummary.reminder`/`WritingSummary.deadline` pasaron a requeridos pero `dashboard-filters.spec.ts`, `task-buckets.spec.ts` y `tasks.service.spec.ts` (schemaVersion esperado quedó en 4, el schema real ya estaba en 5) no se habían actualizado — toda la suite de tests no compilaba. Corregido de paso (mecánico, sin tocar producción): factories de test con los campos nuevos, assertion de schemaVersion actualizada. Suite: 532/536 en verde tras el fix (las 4 fallas restantes son el baseline preexistente de `tree-state.service.spec.ts`).

---

## Metas — pasos como estrellas (origen: schema v6, 2026-06-24; canvas editor v7, 2026-06-24)

### Drag-to-reposition de estrellas existentes en el editor

- **Qué**: hoy en el editor `/goals/:id` se "siembran" pasos clickeando el lienzo (persiste `x/y` en el step), pero no hay forma de reposicionar uno ya creado salvo borrarlo y recrearlo. Agregar drag desde la estrella misma con preview de líneas MST recalculadas en vivo.
- **Por qué se difirió**: el flujo de creación con click cubre el caso principal; reposicionar requiere distinguir "click corto" (toggle done) de "drag" (mover) con threshold de píxeles, manejar touch, y mantener responsive al resize. Implementación tarea aparte.
- **Target**: sin asignar.

### Layout libre de la constelación en la wall (drag de la meta entera)

- **Qué**: en `/goals` el centroide de cada meta deriva del hash de su id. Una versión avanzada permite arrastrar la constelación entera en la wall y persistir esa posición (en el `Goal` o side-car de layout).
- **Por qué se difirió**: el layout hash-based cubre el caso sin nuevo estado. Persistir requiere otro bump de schema y resolver colisiones/overflow al resize.
- **Target**: sin asignar.

### Multi-select de pasos para acciones por lote

- **Qué**: marcar varios pasos a la vez (shift+click o lasso) para toggle/eliminar en batch.
- **Por qué se difirió**: el caso "marco 3 pasos a la vez" no apareció todavía como necesidad real; agregar selección visual + barra de acciones contextual es trabajo medible.
- **Target**: sin asignar.

---

## Recordatorios — Palomar (origen: rediseño palomar 2026-06-25)

### Animaciones de snooze / "tomar papelito" manual

- **Qué**: gestos manuales del paso 5 todavía sin cablear. El disparo del scheduler ya está implementado (puerta de la jaula se abre progresivamente, paloma vuela hasta el rail icon de `/reminders`, picotea, vuelve a la jaula si es recurrente o cae si es puntual). Falta: snooze posa la paloma en la repisa con animación; marcar hecho manual hace volar la paloma fuera de pantalla.
- **Por qué se difirió**: las animaciones disparadas por el scheduler son las críticas para que el palomar "funcione" como metáfora; los gestos manuales pueden quedar para una pasada de pulido sin perder lectura del estado.
- **Target**: sesión siguiente del redesign de `/reminders`.

### Detalles bonitos: plumitas que caen, plumaje rico, ronroneo

- **Qué**: paso 6 del plan. El aleteo ya quedó (la paloma voladora flapea el ala durante el vuelo). Faltan: plumitas que caen al pasar la paloma, plumaje más detallado en palomas recurrentes con muchos ciclos cumplidos, ronroneo/preview de mensaje en hover sostenido.
- **Por qué se difirió**: pulido visual de baja prioridad. Requiere modelo extra (`recurrence.cyclesCompleted`) para el plumaje y SVG más rico — no entra en el MVP del palomar.
- **Target**: sesión siguiente, después de las animaciones manuales.

### Palomares temáticos por categoría (como salas del museo)

- **Qué**: opcional mencionado en el plan original: separar el palomar en sub-palomares por tag/categoría, navegables como las salas del museo. Hoy se resuelve con filtros (fecha + nombre) sobre un único palomar.
- **Por qué se difirió**: los filtros del MVP ya resuelven el riesgo de saturación visual. Multi-palomar agrega complejidad de navegación que sólo vale si el usuario lo pide.
- **Target**: sin asignar.

---

## Recordatorios — Mejoras UI (origen: rediseño 2026-06-19)

### Atajos de navegación de fila (J/K, Space, E, Del)

- **Qué**: navegación por teclado dentro de la lista (J/K), Space para toggle done, E para editar, Del para borrar — todos con scope `editable-safe`.
- **Por qué se difirió**: hoy la lista no tiene concepto de "fila enfocada" (no hay roving tabindex ni signal de cursor). Implementarlo bien implica patrón reutilizable (`listbox` ARIA + cursor signal) que conviene resolver una sola vez para reminders/tasks/goals juntos. Por ahora solo `N` (nuevo) y `/` (buscar) están registrados.
- **Target**: cuando se aborde patrón compartido de listas navegables.
