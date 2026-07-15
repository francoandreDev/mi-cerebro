# Diferidos — Editor, historial y FS

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Editor — `:global()` no llega al contenido de ProseMirror (origen: cierre §19.16e-i, 2026-07-06)

### ~~Auditar y arreglar las reglas `:global(...)` de `editor.component.css`~~ (resuelto 2026-07-08)

- **Qué**: al cerrar 16e-i (highlighting) se descubrió que **todas** las reglas `.editor-host :global(...)` de `editor.component.css` compilaban mal: Angular adjuntaba el atributo de scoping `[_ngcontent-x]` directo al mismo compuesto que `:global(...)` (ej. `.editor-host[ngcontent] [ngcontent]:global(.mc-image-ref)`), en vez de dejar ese compuesto realmente global. Como los nodos que ProseMirror renderiza (`<mark>`, `<img>` de image-ref, las nubes de comentario, el propio `.ProseMirror`) son DOM crudo fuera del compilador de templates de Angular, **nunca tenían ese atributo** y la regla no matcheaba nunca. Confirmado en runtime (`getComputedStyle`): `.ProseMirror` no recibía `min-height: 180px` (daba `0px`), y el CSS compilado de `.mc-image-ref`/`.mc-comment-range` mostraba el mismo patrón roto. Afectaba: `.mc-comment-range`, `.mc-comment-cloud` (+ hover/focus), `.mc-image-ref`, `.mc-image-ref img`, `.mc-image-ref--missing`, `.ProseMirror` (outline, min-height), `.mc-draft-mutate`, `.mc-draft-strike`, `.mc-draft-insert` (+ hover/focus/hijos), y el placeholder `.ProseMirror p.is-editor-empty:first-child::before`.
- **Cómo**: las 9 reglas se movieron de `editor.component.css` (scoped) a una hoja global nueva `src/styles/_editor-content.scss` (`mc-editor .editor-host <selector> {...}`, sin `:global()`), importada en `styles.scss` — mismo patrón que `_editor-highlight.scss` (16e-i) y `_book-editor.scss` ya usaban para el mismo motivo. `editor.component.css` quedó solo con reglas que targetean elementos reales del template Angular (`.shell`, `.index-popover`, `.editor-host` base/focus/draft-session), que sí funcionaban scoped. Verificado en runtime: `.ProseMirror` ahora da `min-height: 180px` y `.mc-comment-cloud` matchea (`cursor: pointer`, color desde `--comment-accent`).

## Historial — Dejar de trackear campos "de la app" (origen: /history rediseño, 2026-07-02)

### ~~No versionar `fields.system` de las entidades del usuario~~ (resuelto 2026-07-03)

- **Qué**: los campos que la app mantiene mecánicamente (ids, timestamps, `schemaVersion`, `position` fractional-index, y extras por familia — `enteredHoyAt` en tasks, `progress`/`wallCenter` en goals, `bookId`/`pageCount` en chapters, `nextPingAt` en reminders) ya no aparecen en el diff de historial.
- **Cómo**: filtro downstream en `diff.utils.ts` (`computeUserFields` + `systemKeysFor` con set universal + overrides por familia). El JSON en disco los conserva porque runtime los usa; el pipeline de diff los ignora al leerlos, así que la historia vieja se ve limpia retroactivamente sin migrar datos. El shape del diff colapsó de `{ user, system }` a un array plano; el `systemExpandedSignal` del container quedó eliminado.

## Fs — Antipatrón `MCB-FS-003` mal usado, deuda restante (origen: §20a, 2026-07-08)

### Migrar `findPath()` de Notes/Tasks/Goals/Lists/Writings y `findChapterFile` de Books a `MCB-FS-008`

- **Qué**: `§20a` migró `bookDir`/`requireLoc` de `BooksService`/`GalleriesService`/`FilesService` (las 3 entidades directorio-por-entidad) de tirar `MCB-FS-003` a `MCB-FS-008` cuando un `id` no aparece ni tras re-caminar el filesystem. El mismo antipatrón sigue vivo en el `findPath()` interno de `NotesService`/`TasksService`/`GoalsService`/`ListsService`/`WritingsService` (entidades archivo-plano-con-sufijo, patrón preexistente que §20a tomó como referencia pero no tocó) y en `BooksService#findChapterFile` (resolución de capítulo dentro de un libro, walk-based igual que `findPath`, mismo throw final).
- **Por qué se difirió**: `§20a` acotó su alcance explícitamente a los "dos usos indebidos" nombrados en el roadmap (`books.service.ts`, `bookDir`/`requireLoc`); generalizar a los otros 6 sitios es mecánico pero son call sites adicionales fuera de ese texto, y tocarlos ameritaba su propia revisión (ej. decidir si `findChapterFile` amerita un código distinto de `findLoc`/`findPath` al nivel de libro, dado que resuelve una sub-entidad).
- **Target**: sin asignar.
