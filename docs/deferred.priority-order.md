# Diferidos — orden de prioridad por facilidad de implementación

Ranking de `docs/deferred.md` (ítems no resueltos) de más fácil a más difícil de implementar. Criterio: tamaño de superficie tocada (UI-only vs. schema/migración vs. infraestructura nueva), si depende de una decisión de UX ya tomada o pendiente, y si requiere nuevas dependencias o motores (three.js, jsmediatags, crypto, git interno).

No reemplaza a `deferred.md` — es una lente de secuenciación. Cuando se aborde un ítem, sigue cerrándose ahí.

---

## Tier 1 — Triviales (config/wiring que ya existe, sólo falta exponer UI)

1. **Snooze próximo lunes / fin de semana / menú overflow `⋯` (reminders)** — "Posponer 1 día" y "Duplicar" ya se agregaron (2026-07-04); queda sólo el preset de día-de-semana y el agrupamiento en menú overflow si la fila de botones se satura.
2. **Color picker custom para tag** — UI-only, el color ya se deriva de un campo; se agrega override.
3. **Lead-time por meta** — override per-goal de un campo que hoy es global.
4. **Toggle "ver sólo cambios" en diffs largos** — la alternativa conservadora (reducir contexto a ~3 líneas) ya está identificada como más simple.

## Tier 2 — Fáciles (UI nueva o mediana, sin migración de schema)

5. **Snippet centrado en la coincidencia (con highlight)** — necesita un re-scan por hit, sin tocar schema.
6. **Hora del deadline configurable** — toca `DeadlinePickerComponent` + el modelo `Goal.deadline`, acotado.
7. **Snooze inteligente del goal-reminder** — requiere decisión de UX (skip-one vs delay) pero lógica chica.
8. **Atajos directos a herramientas y colores (listas/tiza)** — sólo registro en `ShortcutsService`.
9. **Navegación por carpetas / DnD entre carpetas en /files** — el backend (`FoldersService`, `moveCollectionToFolder`) ya existe; falta sólo UI.
10. **UI dedicada de gestión de tags** — pantalla nueva pero sobre datos/servicios existentes.
11. **Cargar más en backlog (tasks)** — paginación simple con animación de "emerger".
12. **Filtros por tipo de entidad** — bloqueado más por falta de otras entidades que por dificultad técnica en sí.
13. **Sobreescritura completa de defaults del navegador** — trabajo de QA combo-por-combo + posibles refactors puntuales, no arquitectura nueva.

## Tier 3 — Medios (UI + lógica nueva, algo de estado nuevo, sin dependencias externas)

14. **Vista de papelera** — UI transversal a entidades, pero sobre el soft-delete que ya existe.
15. **Carpetas / jerarquía real dentro de notas** — el árbol ya soporta hijos arbitrarios; falta UI de crear/renombrar/mover + persistencia de jerarquía.
16. **Pin/fijado de estantes (books)** — estado nuevo (set en localStorage) + reordering + ícono.
17. **Multi-select de pasos (goals)** — selección visual (shift+click/lasso) + barra de acciones batch.
18. **Drag-to-reposition de estrellas (goals)** — distinguir click corto de drag con threshold + touch.
19. **Layout libre de la constelación (goals wall)** — bump de schema + resolver colisiones/overflow.
20. **Reschedule de tareas con DnD en el calendario** — reusa el listener de drop del jardín de tareas.
21. **Recordatorios automáticos para tareas/escritos con deadline** — extiende un patrón ya construido para goals.
22. **Header del editor "n commits desde milestone"** — walk del log + computed reactivo + slot visual en un header ya cargado.
23. **Tooltip por-día en la panorámica (/history)** — componente flotante posicionado sobre SVG con manejo de escape/scroll.
24. **Granularidad por faceta dentro del bundle de merge** — UI de 3× botones por delta; decisión de producto ya está tomada como "no ahora".
25. **Compactación manual sobre rango específico** — respeta barreras existentes (tags, `before-restore`), UI nueva sobre lógica ya presente.
26. **Hilos entre items relacionados (/files)** — grafo nuevo en `FileCollection`/`FileItem` + manejo de huérfanos + UX de crear/borrar.
27. **Posición libre real (drag x/y) en /files** — migración de schema + colisiones + hit-test sobre el board.
28. **Parser de fecha natural — alcance ampliado** — más complejidad de parser y ambigüedad UX, pero sin nueva infra.
29. **Animaciones de snooze / gestos manuales (palomar)** — coreografía sobre un scheduler que ya dispara las animaciones críticas.
30. **Detalles bonitos: plumitas, plumaje, ronroneo (palomar)** — requiere modelo extra (`cyclesCompleted`) + SVG más rico.
31. **Palomares temáticos por categoría** — complejidad de navegación multi-palomar sobre filtros que ya existen.
32. **Menú ⋯ con duplicar / exportar a Markdown (books)** — duplicar toca `BooksService`; exportar requiere converter ProseMirror→Markdown.
33. **Thumbs reales 2×2 para galerías en la papelera** — lectura de blobs + lifecycle de object URLs, cross-feature pero acotado.
34. **Volumen real (`BookVolumeComponent`) en la papelera** — mismo patrón que el ítem anterior.
35. **Atajos de navegación de fila (J/K, Space, E, Del)** — requiere diseñar el patrón compartido de "fila enfocada" (roving tabindex / ARIA listbox) una sola vez.
36. **Typewriter focus línea-por-línea (editor)** — extensión de ProseMirror sobre `selectionUpdate`, la máscara CSS ya cubre ~70%.
37. **Typewriter mode en /writings** — mismo tipo de extensión ProseMirror + decisión de dimming.
38. **Textura realista de tiza (jitter + grano)** — filtros SVG/canvas pattern sobre trazos ya existentes.
39. **Undo/redo dedicado para trazos (listas)** — conflicto de scope con `Ctrl+Z` de TipTap a resolver.
40. **Export PNG/SVG de las capas (listas)** — serialización de capas ya persistidas en JSON.
41. **Estilo "pizarra de verdad" en todo el pane** — restyle de CSS variables transversales del editor, riesgo de romper modo lectura.
42. **Cesta de cosecha con salto en arco (tasks)** — falta sólo la animación FLIP; la pieza visual ya existe.
43. **Riego con cursor regadera (tasks)** — captura de mouse global + animación SVG + reorder (`setPosition` ya existe).
44. **Animaciones orgánicas de DnD (tasks)** — drag-image custom + partículas + morfismo SVG.
45. **Drag-and-drop de tracks a playlist (música)** — requiere resolver UX de auto-switch de tab o mini-rail flotante durante el drag.
46. **Investigar por qué falla `pushAll` contra el remoto** — diagnóstico acotado (auth vs transporte vs refspec) con pasos ya identificados, pero requiere sesión dedicada con remoto real.

## Tier 4 — Difíciles (schema/migración no trivial, nuevas dependencias, o varias piezas cross-feature)

47. **Subset + conversión a woff2 de Crimson Pro** — bloqueado por tooling (`woff2_compress` no disponible en el entorno), no por complejidad de código.
48. **Override de imágenes para portada/reverso y miniaturas (books)** — picker + storage + generación de miniaturas + nuevo código de error.
49. **Paginación real persistida fila por fila (books)** — requiere render headless o cálculo de altura frágil dependiente del CSS.
50. **Cover art y duración ID3 (`jsmediatags`)** — nueva dependencia npm + decisión de persistencia + migración de schema de `Track`.
51. **Waveform pre-renderizado (música)** — decodificar todo el MP3 al subir (costo alto) + persistir peak array.
52. **Crypto-at-rest para PAT en `secrets.json`** — Web Crypto + passphrase caching entre boots, sin romper el flujo actual.
53. **CORS proxy propio para push/fetch a GitHub** — requiere infraestructura externa al repo (Cloudflare Worker).
54. **Índice de búsqueda persistido por familia (`idx-main`)** — cache en IndexedDB, ramifica la API de `SearchIndexService`.
55. **Índice de búsqueda global para comentarios** — necesita walk de priming de la rama comments al boot/family-switch.
56. **Índice de búsqueda global para borradores** — mismo razonamiento, conviene diseñar junto con el de comentarios.
57. **Vista unificada cross-section por tag** — componente nuevo de "card universal" + servicio que cruza todas las secciones.
58. **Quick-capture global de nota desde cualquier sección** — layer de overlay/dialog global inexistente hoy + decisiones de tagging.
59. **IDs de libros legibles / acortados en la URL** — decisión de esquema (slug/hash), migración de URLs viejas, resolución de colisiones — cross-feature (no sólo books).
60. **Referencias / links entre entidades desde el editor** — sintaxis de link, picker, resolución ante borrado, render editor vs. lectura.
61. **Re-mapping de offsets de `range` ante ediciones (editor)** — plugin TipTap que aplique `tr.mapping` a anchors persistidos + orphan-flag + spec dedicado.
62. **Anchor `range` multi-bloque** — nuevo modelo de anchor (lista o par start/end) + orphan handling + renderer nuevo.
63. **Widget render para diff-marks insertion-only** — mini-renderer JSON→DOM consistente con el theme dentro de ProseMirror.
64. **Estantería con forma creativa (books)** — modelo de "shape" persistido + editor visual de posicionamiento 2D por shelf.
65. **Pulido visual general de `/history`** — ítem agrupador sin límite claro (tipografía, densidad, micro-interacciones); difícil de estimar y de cerrar.

## Tier 5 — Muy difíciles / cross-cutting (nueva arquitectura o motor)

66. **Variantes sobre el fallback sin isomorphic-git** — reinventar branching + merge desde cero si el adapter principal no es viable.
67. **`.git/` en OPFS** — mover el modelo de FS a dos clientes separados (workdir vs gitdir), serializar accesos entre main thread y workers, impacto en export ZIP.
68. **Sala 3D real (three.js + angular-three) para /images** — motor 3D completo (cámara, raycasting, sombras) pensado como fase transversal a /images, /books, /lists.

---

## Notas de uso

- Los ítems marcados "sin asignar" en `deferred.md` no tienen un paso de roadmap fijo — este orden es orientativo para decidir cuál tomar primero si se abre una sesión libre de "pulido".
- Varios ítems del Tier 3-4 comparten infraestructura (los tres índices de búsqueda persistidos, por ejemplo) — conviene abordarlos juntos aunque estén en tiers distintos.
- Este documento es una foto; si `deferred.md` cierra o agrega ítems, este ranking debería regenerarse (no editarse a mano ítem por ítem).
- 2026-07-04: se cerraron 5 ítems del antiguo Tier 1 (umbral de compactación configurable, dev panel de compactación, badge de vencidas en el rail, error code `MCB-MUS-001`, y parcialmente snooze/duplicar en reminders) — ver `deferred.md` para el detalle de cada cierre.
