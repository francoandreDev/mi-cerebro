# Diferidos — Responsive mobile

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Responsive mobile — pantallas pendientes (origen: §21, 2026-07-10)

### Verificación visual real (dispositivo/navegador) de todo §21

- **Qué**: las 12 pantallas tocadas en sesiones 9-11 (shell, home, notes, tasks, goals, files, tags, trash, images, bookshelf/book-reader, variants, calendar/history/music/settings/sync/writings-shelf) tienen sus `@media` aplicados pero **casi ninguno verificado visualmente** — el bridge de captura de pantalla de Chrome (`Page.captureScreenshot`) quedó colgado la mayor parte de esas sesiones (problema recurrente, no nuevo). Sólo se confirmó en navegador real: tasks (393px y 745px), goals (419px). Todo lo demás se verificó por lectura de código + balance de llaves, no visualmente.
- **Por qué se difirió**: el bridge no se pudo destrabar reiniciando la navegación ni con reintentos (se probó, sin éxito, varias veces por sesión) — seguir insistiendo violaba el criterio de "verificar sin loopear". Se optó por avanzar por código con alta confianza (mismos patrones ya probados) y dejar la confirmación visual para cuando el bridge esté sano o el usuario lo revise a mano.
- **Avance parcial (2026-07-20)**: `Page.captureScreenshot` sigue sin destrabarse de forma confiable, así que la verificación **visual** (layout, legibilidad, jerarquía) sigue pendiente. Lo que sí se hizo, vía DOM real dentro de un `<iframe>` inyectado (ancho controlado con `style.width`, sin depender de `resize_window` que resultó no confiable con la ventana real) más `scrollWidth` vs `clientWidth` del documento: se confirmó **ausencia de overflow horizontal** (ningún corte/scroll lateral duro) en `/notes`, `/files`, `/tags`, `/images`, `/writings`, `/sync`, `/calendar`, `/settings`, `/variants`, `/books`, `/history`, `/` (home+shell), cada una en 375px, 700px, ~900px (límite de breakpoint donde aplica) y 1300px. Esto es un chequeo estructural mínimo (no hay clipping/scroll lateral), no reemplaza una revisión visual real de si cada layout se ve bien — no confirma legibilidad, jerarquía ni que las metáforas visuales de cada pantalla funcionen en angosto.
- **Target**: sin asignar — el usuario dijo que haría su propia pasada de revisión tras esta sesión.

### History — rediseño mobile dedicado de los 3 modos de zoom

- **Qué**: los 3 modos de zoom (`mc-history-panorama`, `mc-history-strata`, `mc-history-cordel` — desde la sesión 2026-08-03 cada uno es su propio componente con su propio `.css`, antes vivían juntos en `history.container.css`) tienen layouts de 2 columnas de ancho fijo/mixto (`1fr minmax(300-360px)`, `minmax(240-300px) 1fr`, cordel ya es una sola columna), cada uno con su propia metáfora visual (rail de switcher, aside de libreta de campo). La sesión 11 sólo aplicó un `@media (max-width: 480px)` que colapsa panorama/estratos a `grid-template-columns: 1fr` como red de seguridad contra el overflow duro — no replica el comportamiento fino de cada metáfora en mobile (ej. el rail de switcher de strata debería verse distinto apilado que al costado). El achique de `.polaroid-btn` (cordel) / `.milestone-band-name` (strata) a 480px ya se aplicó — sigue pendiente sólo el rediseño fino por modo descripto abajo.
- **Por qué se difirió**: es la pantalla más grande y compleja de las 7 (3227 líneas, 3 metáforas visuales distintas); diseñar cómo se ve cada modo en mobile es una decisión de UX por modo, no un fix mecánico como el resto de §21d.
- **Target**: sin asignar.
