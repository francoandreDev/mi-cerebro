# Diferidos — Papelera y books

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Books / UI (origen: rediseño de /books)

### Drag-and-drop en modo árbol

- **Qué**: el modo `tree` (ver `docs/sistema/entidades.md`, sección Libros) permite abrir libros y navegar carpetas, pero no reordenar/mover libros arrastrando — a diferencia de `shelf`, que sí lo soporta (`bookshelf-dnd.ts`).
- **Por qué se difirió**: el hit-testing de drop sobre puntos dispersos en una curva SVG (en vez de una fila lineal) es una coreografía de pointer events más compleja que la de `shelf`; el modo árbol es principalmente una vista panorámica de navegación/lectura, `shelf` ya cubre el caso de reordenar.
- **Target**: sin asignar — abrir si el usuario nota falta de reordenar sin salir del modo árbol.
- **Origen**: sesión 2026-08-03 (implementación del árbol, ítem original de 2026-06-29 cerrado).

### Paginación real persistida fila por fila (no global)

- **Qué**: hoy `Chapter.pageCount` se actualiza cuando el editor abre el capítulo (totalSpreads\*2, medido con `ResizeObserver` sobre el layout multi-columna real — ver `chapter-editor-pane.component.ts`). Capítulos nunca abiertos caen a `ceil(words/250)`.
- **Por qué se difirió (revalidado 2026-08-03)**: no es sólo una optimización pendiente — `totalSpreads` depende del ancho real del viewport donde se abre el capítulo (columnas CSS), así que no existe un "número exacto" único e independiente del contexto. Precalcularlo off-screen a un ancho de referencia fijo produciría una cifra con apariencia de precisión que puede no coincidir con lo que el usuario ve al abrir el capítulo en su propia ventana — eso es peor que la estimación por palabras, que es honesta sobre ser aproximada (regla "la UI no debe mentir"). La estimación palabras/250 se mantiene como fallback; libros nuevos se autocorrigen apenas el usuario abre el capítulo.
- **Resuelto parcialmente 2026-08-05**: la propia razón de diferir describía la estimación como "honesta sobre ser aproximada", pero no lo era en la UI — `chapter-index-card.component.ts` mostraba `pageCount` real y estimado con el mismo formato (`pag. N (M p.)`), sin distinción visual. `ChapterSummary.pageCountEstimated` nuevo (`books.service.ts`, `ch.pageCount === undefined`) hace que la card muestre `~M p.` cuando es estimado. Esto **no** resuelve el ítem original (seguir sin la paginación real persistida por fila para capítulos nunca abiertos, que sigue bloqueada por el problema del ancho de referencia) — sólo corrige que la UI mentía por omisión mostrando la estimación con la misma precisión aparente que una medición real.
- **Target**: sin asignar.

---
