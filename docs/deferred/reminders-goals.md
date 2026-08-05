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

### Detalles bonitos: ronroneo

- **Qué**: paso 6 del plan. El aleteo, las plumitas que caen y el plumaje rico ya quedaron: `spawnFeathers()` en `paloma-flight.ts` (2026-08-05, vuelo de disparo del scheduler y vuelo manual de "tomar papelito"); `Recurrence.cyclesCompleted` nuevo (2026-08-05, sin migración — campo opcional, incrementado por `RemindersCadenceService`'s `rollover()` en cada ciclo cumplido) alimenta `plumageTier` en `reminders.container.ts`, que dibuja plumas extra sobre el ala (≥5 ciclos) y jaspeado adicional (≥20 ciclos) en el nicho activo — el `.paloma-perch` de la repisa (overdue) se dejó sin este detalle, es transitorio por diseño. Falta sólo: ronroneo/preview de mensaje en hover sostenido.
- **Por qué se difirió**: el "ronroneo" no tiene contenido real que previsualizar todavía — `Reminder`/`ReminderSummary` sólo tienen `title`, no un campo de nota/mensaje separado, así que un preview de "mensaje" hoy repetiría el título ya visible sin agregar nada. Resolverlo bien requeriría primero decidir si los recordatorios ganan un campo de nota (decisión de producto, no de ejecución) — no es un bloqueo técnico, es una pregunta abierta.
- **Target**: sin asignar — requiere decisión de producto (¿reminders necesitan notas?) antes de ser un ítem de ejecución.

### Índice global de búsqueda / vista cross-tag para reminders

- **Qué**: descubierto al resolver "Palomares temáticos por categoría" (ver `Cerrado:` en `priority-order.md`) — los recordatorios ahora tienen `tags` como cualquier otra entidad, pero se quedaron afuera de `TaggedItemsService` (`core/tags/tagged-items.service.ts`, el fan-out que alimenta `/tags/:id`) y del índice de búsqueda global (`SearchIndexService` no indexa `reminder` en absoluto todavía). `routeFor('reminder', ...)` ya existe y resuelve a `/reminders` (igual que track/playlist, sin detalle propio) así que la integración con `TaggedItemsService` sería mecánica — agregar un branch más al `allItems()` fan-out y a `tag-detail.container.ts`/`.html` (10+ puntos de contacto: el tipo `TaggedItem`, el computed + `isEmpty`, el bloque de card en el template). No se hizo en la misma sesión por alcance — el pedido original era sólo la agrupación visual dentro del propio palomar.
- **Por qué se difirió**: alcance — completar la integración cross-section es una tarea propia con varios puntos de contacto, no una consecuencia automática de agregar el campo `tags`.
- **Target**: sin asignar.
