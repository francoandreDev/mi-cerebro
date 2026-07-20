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

- **Qué**: `history.container.css` tiene 3 modos de zoom (`zoom-strata`, `zoom-panorama`, y el modo default) con layouts de 2 columnas de ancho fijo/mixto (`360px 1fr`, `minmax(240-300px) 1fr`, `1fr minmax(300-360px)`), cada uno con su propia metáfora visual (rail de switcher, aside de libreta de campo). La sesión 11 sólo aplicó un `@media (max-width: 480px)` que los colapsa a `grid-template-columns: 1fr` como red de seguridad contra el overflow duro — no replica el comportamiento fino de cada metáfora en mobile (ej. el rail de switcher de strata debería verse distinto apilado que al costado). `zoom-detail-stack` no se tocó porque ya es mobile-first (una sola columna con filas). También quedaron sin tocar, por ser de menor riesgo: `.polaroid-btn { width: 160px }` y `.milestone-band-name { max-width: 220px }`.
- **Por qué se difirió**: es la pantalla más grande y compleja de las 7 (3227 líneas, 3 metáforas visuales distintas); diseñar cómo se ve cada modo en mobile es una decisión de UX por modo, no un fix mecánico como el resto de §21d.
- **Target**: sin asignar.

### ~~Music — sub-componentes sin @media propio~~ (resuelto 2026-07-20)

- **Qué**: al colapsar `.zones` a 1 columna bajo 480px (sesión 11), no se auditaron los sub-componentes que viven dentro de cada zona (`album-library`, `now-playing`, `playlist-editor`, `queue-panel`, `resonant-surface`) — ninguno tiene su propio `@media`, así que podrían tener overflow interno propio aun con el contenedor ya apilado.
- **Estado**: cerrado, los 5 auditados contra los anchos reales que `music.container.css` deja disponibles (zone-left `minmax(260px,1fr)` entre 481-1100px, todo a `1fr` apilado bajo 480px, `zone-right` en `display:none` bajo 1100px):
  - **Bug real encontrado y corregido**: `album-library.container.css` — `.zone-head-actions` (form de descarga YouTube + botón de subida) tenía `flex-wrap: nowrap`; a 260-480px de ancho ambos no entran en una fila y el botón de subida quedaba recortado fuera del contenedor. Agregado `@media (max-width: 1100px)` que permite wrap y fuerza el form de YouTube a su propia fila.
  - **Bug real encontrado y corregido (2da pasada, verificado en navegador)**: `now-playing.container.css` — `.np-card` (grid arte+meta) se rompía de verdad, no sólo "apretado": con viewport ancho (ej. 696px, por encima de cualquier `@media` razonable) pero `zone-left` cerca de su mínimo de 260px, `zone-center` quedaba en ~330px reales y `.np-meta-block` colapsaba a ~150px, partiendo el título letra por letra. Un `@media` por viewport nunca puede ver esto porque el ancho real de `zone-center` lo define el ratio `fr` del grid `.zones` (`minmax(260px,1fr) minmax(0,1.4fr)`), no el viewport. Primer intento (commit previo, sólo verificado por lectura de código) usó `@media (max-width: 560px)` y no disparaba en este caso — confirmado roto al probar en navegador real vía iframe redimensionado. Corregido con container query real: `.zone-center` (`music.container.css`) ahora es `container-type: inline-size; container-name: mc-zone-center`, y `now-playing.container.css` usa `@container mc-zone-center (max-width: 440px)` en vez de `@media`. Verificado en navegador (DOM real, iframe a 700px y 1400px de ancho total): a zone-center ~334px el grid colapsa a 1 columna y el título mide 163px legible; a zone-center ~607px se mantiene 2 columnas sin stacking innecesario.
  - **Auditados sin cambios — ya seguros**: `playlist-editor.container.css` (`.pl-edit-head` tiene 4 botones de 32px fijos + input con `flex:1; min-width:0`, se angosta sin overflow ni corte); `queue-panel.container.css` (vive en `zone-right`, oculto por completo bajo 1100px — nunca se renderiza en ancho angosto, no aplica ningún caso mobile real); `resonant-surface.container.css` (100% fluido, sin anchos fijos).
- **Target**: cerrado.
