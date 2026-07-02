# Historial v2 — handoff multi-sesión

**Meta-problema identificado (2026-07-02):** los tres zooms son metáforas visuales
sin carga informacional. Se ven como widgets decorativos. El usuario no puede
leer nada práctico de ellos hoy. Cada zoom debe aportar un valor **distinto**:
cordillera = navegación de rangos anuales; estratos = comparación de bloques
temporales con estructura por faceta; cordel = navegación de commit individual.

Complementa `docs/redesign.md §/history v2`. Este archivo captura el gap entre
implementación actual y objetivo real para que cualquier sesión posterior pueda
retomar sin perder contexto.

---

## Cordillera

### Estado actual

- `computePanoramaGeometry` genera silueta apilada por faceta con curvas Bezier
  Catmull-Rom cerradas en `strata.utils.ts`.
- Cielo con gradient atardecer + horizonte punteado.
- Banderines sobre picos con nombre en `<title>` tooltip.
- Detail pane derecha: "DIARIO DE EXCAVACIÓN" con papel envejecido +
  tipografía manuscrita, pero el contenido es la **misma tabla de diff** que
  estratos — un commit individual con `entities`, `antes/después`, restore.

### Problemas

- Sin eje X: nada de meses tickeados al pie. No se lee "esta parte de la
  cordillera es marzo".
- Sin eje Y visible: no dice "el pico son N commits/día".
- Click en pico no se refleja visualmente en la cordillera (sin línea guía,
  sin highlight, sin conexión visual al panel derecho).
- Libreta muestra un solo commit — no el rango temporal que el pico representa.
- Cordillera navega días individuales cuando su naturaleza es panorámica.

### Objetivo

- **Eje X:** meses tickeados al pie (`ENE FEB MAR … DIC`) alineados con las
  posiciones en X de los primeros aggregate de cada mes.
- **Eje Y:** nota superior o lateral: "máx N commits/día en este rango".
- **Selección visual:** al hacer click en un pico → línea vertical de guía baja
  del pico al pie + highlight de la joroba (opacidad más alta) + el resto de
  la silueta se atenúa levemente.
- **Libreta = resumen del rango del pico**, no de un commit. Contenido:
  - Título: "Semana del 24/03" o "24 de marzo" según granularidad
  - Total de commits en el rango
  - Mix de facetas (main/comentarios/borrador) como mini-barras o donut
  - Fósiles del rango (chips clickables → bajan a cordel con ese fósil)
  - CTA "Ver en estratos" → baja al zoom medio con el rango filtrado
- Doble-click en pico → sigue bajando a estratos con ese rango (ya está).

---

## Estratos

### Estado actual

- `computeDensity` (en `strata.utils.ts`) da `thicknessPx` por bucket
  (log-escalado 20-96px sobre `totalCount` real, sin filtros).
- Cabecera del estrato: bandas sedimentarias horizontales + gradient marrón,
  fósiles como chips ámbar en una fila del header, count en badge tierra.
- Commits listados debajo del header, seleccionables.
- Ficha de yacimiento al costado: **misma tabla de diff** que teníamos antes,
  con fondo manila y tipografía serif.

### Problemas

- Espesor apenas se distingue en la práctica — la barra 32-96px es poco espacio
  para "ver" la diferencia de un vistazo (los picos duros están comprimidos
  por el log).
- Facetas no se ven como capas sedimentarias reales — es un gradient de 3
  tramos en una sola barra, no franjas apiladas con altura por proporción.
- Fósiles quedan en el header en una fila, no incrustados en su posición Y
  dentro del estrato (donde su commit realmente cayó cronológicamente).
- La ficha de yacimiento no aporta valor por sobre lo que hacía la tabla
  vieja — es la misma info con serif y color papel.

### Objetivo

- **Estrato con altura macro-mayor:** min 40px, max viewport-relativo, mejor
  aprovechamiento del espacio ganado por sacar la sidebar.
- **Franjas por faceta dentro del estrato:** cada estrato se subdivide
  horizontalmente en tres capas (main abajo, comentarios medio, borrador
  arriba) con altura proporcional al conteo real de esa faceta. Se lee
  literal como sedimento — main dominante = base gruesa, borrador escaso
  = capa fina arriba.
- **Fósiles anclados en su Y dentro del estrato:** posición vertical según
  qué faceta tenía el commit (main = capa baja, etc.) y qué posición
  cronológica dentro del bucket. Se ven "incrustados" en la roca, no como
  chips flotantes en un rincón.
- **Ficha del estrato = resumen**, no diff de un commit:
  - Nombre del rango + total commits
  - Mix de facetas como donut o mini-barras
  - Fósiles del rango como chips
  - Lista scrollable de commits (título + hora + faceta)
  - Click en un commit → drop a cordel con ese commit; el diff completo
    aparece ahí, no en la ficha
- Value: comparar semanas por **espacio Y estructura** de un vistazo, no
  sólo por count.

---

## Cordel

### Estado actual

- Tira horizontal de polaroids con flip 3D preparado
  (`transform-style: preserve-3d`, `backface-visibility`).
- Cordel SVG con pandeo Bezier atrás.
- Broche visible arriba de cada polaroid.
- Reverso de cartón beige por defecto; frente tintado por faceta después
  de `HistoryDiffService.loadForCommit(oid)`.
- Mesa de revelado abajo con background madera oscura + luz cálida
  radial.

### Problemas

- Polaroids nunca se dan vuelta visualmente en las capturas — todas idénticas
  (todavía en dorso). Puede ser (a) prefetch fallando, (b) el `.revealed`
  no se agrega correctamente, o (c) el flip funciona pero visualmente el
  frente y el dorso son demasiado parecidos.
- **Overlap:** botones "Marcar este punto" y "Restaurar esta versión" del
  detail-head se muestran por encima de las polaroids en la captura. El
  layout de dos filas (`.zoom-detail-stack`) se aplica pero el contenido
  interno sigue asumiendo posición absoluta o z-index heredado del layout
  viejo.
- Cordel visible pero no destacado — se pierde entre las polaroids y sombras.
- Polaroids reveladas no muestran contenido distintivo — sólo gradient, no
  el mensaje del commit ni un ícono.

### Objetivo

- **Fix overlap primero:** garantizar que la mesa de revelado y las polaroids
  no se pisen. `grid-area` propio para cada zona, z-index explícito, o
  refactor del detail-head para tener versión colapsada en zoom detail.
- **Polaroid revelada distintiva:** cada polaroid muestra:
  - gradient tintado por faceta (ya está)
  - primera línea del mensaje en tipografía chica al pie de la "foto"
  - iconito de la entidad principal tocada (goal/reminder/track/note) si
    resuelve rápido
  - fecha visible arriba
- **Descuelgue al seleccionar:** la polaroid seleccionada se anima
  desprendiéndose del cordel (rotación + translate Y hacia abajo) y baja al
  centro de la mesa de revelado ampliada 2-3x.
- **Diff sobre la polaroid ampliada:** el diff no es una tabla al costado —
  es una anotación sobre la polaroid gigante (o al pie, en forma de
  "leyenda"). Metáfora coherente.
- **Cordel más presente:** stroke más visible, tal vez color cálido,
  broches con más detalle.

---

## Plan de trabajo

### Sesión 2026-07-02 (cerrada)

Foco: hacer que cada zoom cumpla función distinta + fix del overlap.

1. ✅ **Cordillera con ejes** (task 19): meses al pie como `<text>` con
   `computeMonthTicks` en `strata.utils.ts`; badge "máx N commits/día" flotante
   arriba a la izquierda; guía visual dashed cuando se clickea un pico
   (línea vertical + circle-cap en el pico). Silueta se atenúa al 55% cuando
   hay selección para que la joroba destacada resalte.
2. ✅ **Cordillera con libreta de rango** (task 20): al clickear (single-click)
   una columna, `panoramaSelectedDayStartSignal` guarda el día; la libreta
   renderiza `panoramaRangeSummary()`: fecha larga, total, mix de facetas
   como mini-barras porcentuales, fósiles del día como chips clickables, y
   CTA `panoramaZoomIntoRange()` que baja a estratos con ese rango. Ya NO
   se muestra la tabla de diff cuando el zoom es `panorama` — el @switch
   en la detail pane la reemplaza por `.panorama-notebook`.
3. ✅ **Fix overlap cordel** (task 21): `.split.zoom-detail-stack` ahora fija
   `grid-row` y `grid-column` explícitos para timeline y detail, con
   `overflow: hidden` + `flex column` en timeline y `overflow-y: auto` en
   detail. Hidde el `.detail-collapse-bar` en cordel porque no tiene sentido
   con layout stacked. `.cordel-scroll` toma `flex: 1; min-height: 0` para
   scrollear dentro de su fila.
4. ✅ **Detail template por zoom** (task 22): el pane detail usa
   `@if (zoom() === 'panorama')` para renderizar `.panorama-notebook` (task
   20), y `@else if (selectedEntry())` para el flujo tabular existente.
   Estrato y cordel siguen usando la tabla pero con estilos distintos
   (`.split.zoom-strata .detail` = ficha yacimiento manila,
   `.split.zoom-detail-stack .detail` = mesa de revelado). Deferido a
   sesión siguiente: templates propios de `<stratum-summary>` y
   `<mesa-revelado>` para eliminar del todo la tabla verde/roja
   compartida.

### Nota sobre pruebas visuales

Todos los cambios de esta sesión pasaron typecheck y los 9 tests de
`strata.utils.spec.ts`. **No se validó en navegador**: es responsabilidad
de la próxima iteración abrir `/history`, navegar entre los tres zooms,
y verificar (a) que la cordillera tenga meses legibles, (b) que la
libreta muestre resumen al clickear un pico, (c) que en cordel las
polaroids y la mesa no se pisen, (d) que en estratos siga funcionando
como antes.

### Sesión 2026-07-02 (b, cerrada) — capas de estratos + mesa de revelado

5. ✅ **Estratos con capas por faceta y fósiles anclados**.
   `computeStratumLayers(bucket, milestonesByOid)` en `strata.utils.ts`
   devuelve: `layers[]` con `yPct`/`heightPct` por faceta (draft arriba →
   comentarios medio → main abajo, se omiten facetas con cero commits) y
   `fossils[]` con `xPct` cronológica (viejo=izq, nuevo=der, edges pad 4%) y
   `yPct` centrada en la banda de la faceta del commit. `Stratum` ahora
   incluye `layers`. La barra plana `.stratum-thickness` (gradient 90deg de
   3 tramos) fue reemplazada por `<svg class="stratum-rock">` con `<rect>`
   por franja + `<g class="stratum-fossil-anchor">` por fósil (halo dorado +
   polígono fósil incrustado). Altura del estrato mapea `thicknessPx` 20–96
   a 40–140 para que las 3 franjas se lean. `stratumFacetMixStyle()`
   eliminado; `stratumRockHeightPx()` lo reemplaza. La lista `.stratum-fossils`
   de chips flotantes se sacó — quedó una `.stratum-fossil-legend` sobria
   abajo (nombre clickable + dot por faceta) como acompañamiento del SVG.
   Cubierto por 5 tests nuevos en `strata.utils.spec.ts` (14 tests total).
6. ✅ **Mesa de revelado con polaroid ampliada + descuelgue**.
   Cuando `zoom() === 'detail'` y hay `selectedEntry()`, el pane detail
   renderiza `<article class="mesa-revelado">` en vez de la tabla verde/roja:
   polaroid 2-3x sobre madera oscura, con `mesa-drop` (translateY + rotate
   - scale) como animación de caída, broche de bronce, "foto" gradient por
     faceta con fecha/oid en las esquinas, chip de fósil si tiene, mensaje en
     `Caveat` y anotaciones al pie (chips +/✎/− y lista compacta de entidades).
     Las acciones milestone/restore migraron al pie de la polaroid ampliada.
     Descuelgue del cordel: `.polaroid.selected` ahora `translateY(20px)
rotate(-2deg) scale(1.08)` con drop-shadow, y `.polaroid-strip:has(.polaroid.selected)
.polaroid:not(.selected)` a 75% opacidad. Al pin de la seleccionada se le
     baja opacidad para transmitir "el broche cedió".

### Nota sobre pruebas visuales (sesión 2026-07-02 b)

Typecheck + build (`ng build --configuration development`) pasan sin
warnings, tests 14/14 en `strata.utils.spec.ts`. `bun start` levanta y
compila limpio en 36s. **No se hizo captura de pantalla del /history**
(WSL sin browser headless); el usuario debería abrir /history y validar
(a) capas visibles y proporcionales dentro de cada estrato,
(b) fósiles como puntos incrustados en la roca (no chips arriba),
(c) al seleccionar una polaroid en cordel, cae y aparece ampliada en la
mesa con anotaciones al pie,
(d) que la ficha de yacimiento en estratos siga usando la tabla vieja
(pendiente de sesión próxima), no regresó.

7. ✅ **Ficha de yacimiento = resumen del estrato**. En zoom estratos el
   pane detail deja de renderizar la tabla verde/roja y muestra `<article
class="ficha-yacimiento">` con: cabecera (nombre del rango + total
   hallazgos), mix por faceta como mini-barras % (patrón del panorama-notebook
   pero con vocabulario geológico), lista de fósiles como pills clickables
   (`zoomIntoCommit` baja al cordel con ese oid), lista scrollable de
   commits (flattening de merge/auto-groups a miembros) con click = select
   (mantiene la selección en el estrato) y double-click = drop a cordel,
   y una CTA "Revelar en el cordel →" al pie que dispara `zoomIntoCommit`
   sobre el `selectedEntry` actual. El estrato "activo" se deriva del
   `selectedOid` (busca la bucket que lo contiene) con fallback al primero.
   Helpers nuevos: `selectedStratum`, `stratumFacetPct`,
   `flattenStratumCommits`. CSS de la ficha reutiliza patrones del panorama
   (mini-barras con `--facet-pct`) pero con serif Georgia (sin `Caveat`)
   para mantener el registro geológico distinto del naturalista.
   Nuevas keys i18n en `es.ts`: `stratum.rangeTotalOne/Many`,
   `stratum.fossilsInRangeOne/Many`, `stratum.commitsInRange`,
   `stratum.zoomToCordel`.

### Sesión siguiente — pendientes

8. Iconito de entidad principal en cada polaroid revelada (usa `entities`
   del diff cuando ya está cargado) — pendiente desde el plan original.
9. Refactor a subcomponentes `<mc-history-panorama>`, `<mc-history-strata>`,
   `<mc-history-cordel>` para bajar `history.container.{ts,html,css}` — por
   encima de warn 200 / err 300 §4.4.

---

## Referencias en código

- `src/app/features/history/services/strata.utils.ts` — geometry pura, tiene
  `computeDensity`, `computePanoramaGeometry`, `panoramaFossils`.
- `src/app/features/history/services/history-loader.service.ts` — `loadWindow`
  con `resolution: aggregate|summary|detail`.
- `src/app/features/history/containers/history.container.ts` — root del feature,
  ~946 líneas, contiene todo el estado de zoom, prefetch, revelado, etc.
- `src/app/features/history/containers/history.container.html` — plantilla
  monolítica que va a partirse en templates por zoom en task 22.
- `src/app/features/history/containers/history.container.css` — 1900+ líneas,
  con secciones por metáfora al final.
- `src/app/layout/containers/app-shell.container.ts` — oculta la workspace
  sidebar cuando la ruta empieza con `/history` (immersive mode).

## Reglas relevantes de PROYECTO.md

- §4.4: 200 warn / 300 err líneas por archivo. Los archivos históricos ya
  están por encima; toda extracción a subcomponentes ayuda a bajarlos.
- §4.11.25: cambio arquitectónico → actualizar `PROYECTO.md` en el mismo
  commit. En esta rediseño, las decisiones nuevas ya se registran en
  `docs/redesign.md`; este handoff funciona como bitácora operativa,
  no como norma arquitectónica.
