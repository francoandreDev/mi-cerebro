# Diferidos — Recordatorios y metas

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Recordatorios — Palomar (origen: rediseño palomar 2026-06-25)

### Detalles bonitos: plumaje rico, ronroneo

- **Qué**: paso 6 del plan. El aleteo ya quedó, y las plumitas que caen al pasar la paloma se resolvieron 2026-08-05 (`spawnFeathers()` en `paloma-flight.ts`, disparado en el vuelo de disparo del scheduler y en el vuelo manual de "tomar papelito"). Falta: plumaje más detallado en palomas recurrentes con muchos ciclos cumplidos, ronroneo/preview de mensaje en hover sostenido.
- **Por qué se difirió**: pulido visual de baja prioridad. El plumaje rico requiere modelo extra (`recurrence.cyclesCompleted`, migración de schema) que no entra en el MVP del palomar; el "ronroneo" no tiene contenido real que previsualizar todavía — `Reminder`/`ReminderSummary` sólo tienen `title`, no un campo de nota/mensaje separado, así que un preview de "mensaje" hoy repetiría el título ya visible.
- **Target**: sin asignar.

### Palomares temáticos por categoría (como salas del museo)

- **Qué**: opcional mencionado en el plan original: separar el palomar en sub-palomares por tag/categoría, navegables como las salas del museo. Hoy se resuelve con filtros (fecha + nombre) sobre un único palomar.
- **Por qué se difirió**: los filtros del MVP ya resuelven el riesgo de saturación visual. Multi-palomar agrega complejidad de navegación que sólo vale si el usuario lo pide.
- **Target**: sin asignar.
