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

### Estantería con forma creativa / no lineal (árbol, curva, etc.)

- **Qué**: el shelf actual es una pared rectangular con tablas horizontales y bookends a los lados — metáfora "biblioteca clásica". Una versión avanzada permitiría layouts no rectangulares: ramas de árbol con shelves angulados, espirales, formas custom que el usuario elija o defina. Las referencias mostradas en la sesión incluían un shelf con forma de árbol (ramas con libros agrupados por copa/tronco) que carga significado adicional ("estos son mis raíces", "estos son los frutos recientes", etc.).
- **Por qué se difirió**: el v1 todavía no resuelve los básicos (legibilidad del lomo, reorden, múltiples estanterías nombradas). El layout creativo agrega complejidad de posicionamiento (cada shelf necesita su propio ángulo + ancla en una grilla 2D), modelo de "shape" persistido, y editor visual para que el usuario configure. Primero hay que pulir la metáfora clásica.
- **Target**: sin asignar — abrir cuando el shelf clásico esté funcional (legible, reordenable, multi-estante) y aparezca demanda real de "quiero mi biblioteca con forma de X".
- **Origen**: sesión 2026-06-29 (rediseño /books shelf — el usuario referenció una estantería en forma de árbol como inspiración).

### Paginación real persistida fila por fila (no global)

- **Qué**: hoy `Chapter.pageCount` se actualiza cuando el editor abre el capítulo (totalSpreads\*2, medido con `ResizeObserver` sobre el layout multi-columna real — ver `chapter-editor-pane.component.ts`). Capítulos nunca abiertos caen a `ceil(words/250)`.
- **Por qué se difirió (revalidado 2026-08-03)**: no es sólo una optimización pendiente — `totalSpreads` depende del ancho real del viewport donde se abre el capítulo (columnas CSS), así que no existe un "número exacto" único e independiente del contexto. Precalcularlo off-screen a un ancho de referencia fijo produciría una cifra con apariencia de precisión que puede no coincidir con lo que el usuario ve al abrir el capítulo en su propia ventana — eso es peor que la estimación por palabras, que es honesta sobre ser aproximada (regla "la UI no debe mentir"). La estimación palabras/250 se mantiene como fallback; libros nuevos se autocorrigen apenas el usuario abre el capítulo.
- **Target**: sin asignar.

### Subset latin-extended de Crimson Pro

- **Qué**: las tres variantes de Crimson Pro ya se sirven como `.woff2` (conversión local con `woff2_compress`, ~61% menos peso, `.ttf` original como fallback vía `src` en cascada) — ver `_fonts.scss`. Queda por hacer: un subset latin-extended de cada `.woff2` recortaría otro ~30%.
- **Por qué se difirió**: el subset requiere `pyftsubset` (paquete `fonttools`), no disponible en este entorno; instalarlo agrega una dependencia de build nueva para un ahorro incremental sobre una ganancia ya conseguida.
- **Target**: sin asignar.

---
