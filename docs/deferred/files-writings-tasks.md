# Diferidos — Archivos, escritos y tareas

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Archivos (origen: rediseño /files — tablero de evidencia)

### Hilos entre items relacionados

- **Qué**: el rediseño "cork board" sugiere visualmente la idea de items vinculados con hilos. Hoy no hay modelo de relaciones entre `FileItem`s, así que la pieza queda como puro decorado pendiente.
- **Por qué se difirió**: introducir relaciones requiere extender `FileCollection`/`FileItem` con un grafo (id origen, id destino, opcional label), persistirlo en `_collection.json`, manejar deletes (limpiar hilos huérfanos), y diseñar UX para crear/borrar el hilo. Es un feature autónoma de tamaño propio, no parte del cambio visual.
- **Target**: sin asignar — abrir si aparece demanda real de "agrupar archivos relacionados dentro de una colección".

### ~~Navegación por carpetas / DnD entre carpetas en /files~~ (resuelto en §19.23b)

- **Qué**: el `files-index-rail` viejo exponía un árbol jerárquico de carpetas con DnD para mover colecciones entre carpetas, crear/renombrar carpetas y filtro de búsqueda. Con el rediseño "cork shelf", `/files` mostraba una grilla plana de colecciones sin esa jerarquía visual.
- **Estado**: cerrado. Resuelto junto con el resto de secciones huérfanas en §19.23b — breadcrumb + drill-down (`?folder=<path>`, `shared/folder-breadcrumb/`) reemplaza al árbol viejo, no lo reintroduce.

### Posición libre real (drag x/y) en el tablero

- **Qué**: en lugar de grilla con jitter determinista, dejar que el usuario arrastre cada artefacto a una coordenada arbitraria del corcho y persistirla.
- **Por qué se difirió**: implica nuevo `x,y` por item en el schema (migración + bump de `FILE_COLLECTION_SCHEMA_VERSION`), resolver overflow/colisiones al resize de ventana, hit-test de drop sobre el board, y modo "auto-acomodar" para colecciones nuevas. El jitter determinista ya transmite el feeling sin tocar disco ni schema.
- **Target**: sin asignar.

## Escritos (origen: rediseño /writings)

### Typewriter mode dentro del editor full-bleed

- **Qué**: toggle en el editor full-bleed de `/writings` que active "typewriter mode" — la línea activa queda visualmente al centro del viewport (scroll-padding-bottom: 40vh o equivalente) y opcionalmente atenúa los párrafos no activos.
- **Por qué se difirió**: el rediseño cerró con shelf + editor centrado a `max-width: 80ch` y back/Esc para volver. Typewriter requiere extensión de ProseMirror que reaccione a `selectionUpdate`, decisión de UX sobre dimming y persistencia del toggle. Bonito pero no bloquea la migración del section pane.
- **Target**: §19.16f (pulido del editor) o sin asignar.

### Parser de fecha natural — alcance ampliado

- **Qué**: el `@hint` actual soporta hoy/mañana/pasado, días de la semana, "en Nh/Nm/Nd" y horas (24h y am/pm). Faltan: "viernes que viene", "fin de semana", "próximo mes", fechas absolutas "15/07", parsing dentro del título sin `@`.
- **Por qué se difirió**: cobertura actual cubre los casos cotidianos; lo demás suma complejidad de parser y ambigüedad UX (cuándo `Llamar 15` significa hora 15 vs día 15). Mejor evaluar uso real antes de extender.
- **Target**: sin asignar.

## Tareas (origen: rediseño /tasks — jardín de tres canteros)

### ~~Animaciones orgánicas de DnD (raíces colgando, terrones cayendo, plop)~~ (resuelto 2026-07-14)

- **Qué**: al arrastrar una card aparecen 3-4 hilitos de raíces colgando, microspans de tierra cayendo, y al soltar un "plop" + morfismo del glyph (⋄ → ╿ → ❀) con 260 ms ease-out.
- **Estado**: cerrado, con alcance acotado respecto al original. `card--lifted` (source, mientras `dnd.draggingId()` matchea) baja opacidad y agrega una raíz colgante con balanceo (`::after` + `roots-sway`, CSS puro). `planter--over .soil` (target bajo drag) anima brillo pulsante (`soil-crumble`) y un `::after` de puntos de tierra cayendo (`clods-fall`). Al aterrizar (mismo u otro cantero), `applyTransplant` setea `justSproutedId` por 450ms → clase `card--plop` (bounce squash&stretch). El morfismo de glyph SVG entre etapas (⋄→╿→❀) se descartó: el nodo se destruye/recrea al cambiar de cantero (arrays distintos en el `@for`), así que un cross-fade real requeriría trackear el mark fuera del array — el "plop" ya comunica el cambio de etapa sin ese costo. Todo respeta `prefers-reduced-motion`. Verificado en runtime con Chrome: dispatch manual de `dragstart`/`dragenter` + inspección de `getComputedStyle` confirmó las 3 animaciones aplicadas; `onTransplant` disparado por script confirmó `card--plop` en el DOM.
- **Implementación**: `plant-card.component.css` (keyframes `roots-sway`, `plant-plop`), `planter.component.css` (`soil-crumble`, `clods-fall`), `tasks-garden.container.ts` (`justSproutedId` signal + `[lifted]`/`[justSprouted]` inputs en las 3 planteras).

### ~~Riego con cursor regadera + click para subir prioridad~~ (resuelto 2026-07-14)

- **Qué**: con el toggle 🚿 activo, mostrar cursor regadera flotante; click sobre una task de semana/backlog dispara micro-chorro y la mueve una posición arriba en su cantero.
- **Estado**: cerrado. Cursor regadera vía `cursor: url(data:image/svg+xml...)` sobre `.garden--watering` (SVG inline con el emoji 🚿, sin tracking de mouse por JS — más barato que un div flotante y logra el mismo efecto). Botón 💧 aparece en `mc-plant-card` sólo cuando `wateringMode() && stage() !== 'bloom'` (no en HOY). Al click, `onWater(id, bucket)` calcula la nueva posición con `between(posDosArriba, posUnaArriba)` de `core/ordering/fractional-position` (ya existía, sin tocar) y llama a `TasksService.setPosition` (ya existía, estaba sin uso desde la UI). Destello CSS (`plant-splash`) marca la card regada. El output `water` y el método `onWaterClick` en `PlantCardComponent` ya estaban armados sin usar de una sesión anterior — sólo faltaba el input `wateringMode`, el template del botón, y el wiring en el container. Verificado en runtime: activar el toggle mostró el cursor y los botones 💧 sólo en semana/backlog, y un click real movió "tarea semana dos" por encima de "tarea semana uno" en la lista.
- **Implementación**: `plant-card.component.ts/html/css` (`wateringMode`/`watered` inputs, botón, `plant-splash`), `tasks-garden.container.ts` (`onWater`, `wateredId` signal), `tasks-garden.container.css` (cursor `.garden--watering`).

### ~~Cesta de cosecha con salto en arco~~ (resuelto 2026-07-14)

- **Qué**: al marcar done, la card vuela en arco hasta la cesta del borde inferior del cantero HOY. Hoy se mueve por re-render sin animación.
- **Estado**: cerrado. `TasksGardenContainer.flyToBasket` clona el nodo DOM de la card (`cloneNode(true)`, conserva el atributo de scoping de Angular así que el CSS del componente sigue aplicando aunque el clon termine en `document.body`), lo posiciona `fixed` sobre su rect original y lo anima con `plant-arc` (keyframes con offset negativo en Y a mitad de camino, simulando el arco) hasta el centro de `.basket-stack .basket`, encogiéndose y desvaneciéndose; se autodestruye en `animationend` (+ `setTimeout` de seguridad). Respeta `prefers-reduced-motion` (se salta el clon entero). Verificado en runtime: conteo de la cesta subió correctamente tras cosechar, cero nodos `.plant-flying` huérfanos post-animación, sin errores de consola.
- **Implementación**: `tasks-garden.container.ts` (`flyToBasket`, `data-task-id` en las cards para el query), `plant-card.component.css` (`.plant-flying`, `@keyframes plant-arc`).

### ~~"Cargar más" en backlog (semillas que emergen)~~ (resuelto 2026-07-14)

- **Qué**: paginar el cantero de backlog cuando supera N elementos; mostrar contador de "sumergidas" + botón "cargar más" con animación de emerger.
- **Estado**: cerrado. `visibleBacklogCount` signal (default 24, `BACKLOG_PAGE_SIZE`) recorta `pending().backlog` en `visibleBacklog()`; botón "cargar más · N semillas sumergidas" (reusa la key `tasks.garden.loadMore`, que ya existía en `es.ts` sin usar, de una sesión anterior) suma otra página. Los ítems recién revelados (índice ≥ `emergingFrom()`) entran con `card--emerging` (translateY + scale, se desactiva sola a los 500ms). La paginación se resetea al buscar/limpiar el filtro. Verificado en runtime creando 27 tareas de prueba: el botón mostró "3 semillas sumergidas" al llegar a 24 visibles, y el click reveló el resto correctamente sin dejar el botón residual.
- **Implementación**: `tasks-garden.container.ts` (`visibleBacklogCount`, `emergingFrom`, `onLoadMoreBacklog`), `tasks-garden.container.html` (backlog `@for` sobre `visibleBacklog()` + botón), `plant-card.component.css` (`card--emerging`, `@keyframes seed-emerge`).
