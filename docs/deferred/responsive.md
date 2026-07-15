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
- **Target**: sin asignar — el usuario dijo que haría su propia pasada de revisión tras esta sesión.

### History — rediseño mobile dedicado de los 3 modos de zoom

- **Qué**: `history.container.css` tiene 3 modos de zoom (`zoom-strata`, `zoom-panorama`, y el modo default) con layouts de 2 columnas de ancho fijo/mixto (`360px 1fr`, `minmax(240-300px) 1fr`, `1fr minmax(300-360px)`), cada uno con su propia metáfora visual (rail de switcher, aside de libreta de campo). La sesión 11 sólo aplicó un `@media (max-width: 480px)` que los colapsa a `grid-template-columns: 1fr` como red de seguridad contra el overflow duro — no replica el comportamiento fino de cada metáfora en mobile (ej. el rail de switcher de strata debería verse distinto apilado que al costado). `zoom-detail-stack` no se tocó porque ya es mobile-first (una sola columna con filas). También quedaron sin tocar, por ser de menor riesgo: `.polaroid-btn { width: 160px }` y `.milestone-band-name { max-width: 220px }`.
- **Por qué se difirió**: es la pantalla más grande y compleja de las 7 (3227 líneas, 3 metáforas visuales distintas); diseñar cómo se ve cada modo en mobile es una decisión de UX por modo, no un fix mecánico como el resto de §21d.
- **Target**: sin asignar.

### Music — sub-componentes sin @media propio

- **Qué**: al colapsar `.zones` a 1 columna bajo 480px (sesión 11), no se auditaron los sub-componentes que viven dentro de cada zona (`album-library`, `now-playing`, `playlist-editor`, `queue-panel`, `resonant-surface`) — ninguno tiene su propio `@media`, así que podrían tener overflow interno propio aun con el contenedor ya apilado.
- **Por qué se difirió**: fuera del alcance acotado de la sesión 11 (huecos en breakpoints de contenedor, no auditoría de cada sub-componente); sin verificación visual tampoco había forma de confirmar si hacía falta.
- **Target**: sin asignar.
