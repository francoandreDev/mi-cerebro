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

### Quick-capture global con tag de contexto (Ctrl+Shift+N)

- **Qué**: un atajo global que abre una captura rápida sin salir de donde estás — pensado en particular para el reader de libros (`/books/:id/:chapterId`) — con dos destinos posibles: (a) crear una nota rápida en `/notes`, (b) adjuntar una imagen desde el portapapeles a una galería de `/images`. En ambos casos, el tag "del tema" que se está leyendo/trabajando viene preseleccionado en vez de que el usuario tenga que ir a buscarlo.
- **Por qué se difirió**: no existe hoy ningún mecanismo de "capturar sin navegar" — `Ctrl+N` (§19.16a-v, ver `docs/sistema/temas-export-empaquetado.md`) navega a la sección de la entidad y crea ahí, lo que interrumpe exactamente el caso de uso que motiva este ítem (seguir leyendo). Además hay que resolver de dónde sale el "tag de contexto" antes de escribir código — no es solo UI, es una decisión de qué señal usar.
- **Target**: sin asignar.
- **Origen**: tarjeta "Estudiar profundizando un tema" en la home (`home.flow.study.*`, `HOME_WORKFLOWS_FUTURE`).
- **Enfoque técnico** (boceto, a validar al implementar):
  - Combo global nuevo en `ShortcutsService` (ej. `Ctrl+Shift+N`, `scope: 'global'`), separado de `Ctrl+N` — no reemplaza la creación contextual existente, es un canal distinto que no navega.
  - UI: un overlay liviano (no una ruta), nuevo `QuickCaptureOverlayComponent` montado una sola vez en `AppShellContainer` (mismo nivel que `TutorialOverlayComponent`/`ReminderToastContainer`) — input de texto + dos botones (Nota / Imagen desde portapapeles) + chip del tag resuelto, editable antes de confirmar para que la captura nunca aplique un tag sin que el usuario lo vea.
  - **Resolución del tag de contexto**: la señal más simple y honesta es leer los tags de la entidad actualmente abierta (si estás en un capítulo de libro, los tags del `Book` activo) — mismo tipo de inferencia por `Router.url` que ya usa `core/intents/creation-intent.service` para resolver el kind contextual de `Ctrl+N`, extendida con un segundo lookup a los tags del summary activo. Si no hay entidad abierta o no tiene tags, el overlay pide elegir uno (reusa el picker existente, `mc-tag-picker`) en vez de crear sin tag en silencio.
  - **Nota rápida**: `NotesService.create(title)` + asignar tags — reusa el servicio existente, sin modelo nuevo.
  - **Imagen desde portapapeles**: mismo mecanismo que ya usa `GalleriesContainer` (listener de `paste` + filtro `image/*`, ver `docs/sistema/entidades.md`), pero disparado globalmente. Falta decidir el destino: ¿una galería nueva por tag si no existe, o elegir entre las existentes? — decisión de producto, no de implementación.
  - El mecanismo es genérico (cualquier página con una entidad-con-tags abierta se beneficia), no exclusivo del reader — el reader es sólo el caso que lo motivó.
