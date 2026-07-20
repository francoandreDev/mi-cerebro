# Diferidos — Atajos y vista cross-section

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Cross-section / vista unificada (origen: home guide audit, 2026-06-30)

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
