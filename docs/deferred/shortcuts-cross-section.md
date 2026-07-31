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
