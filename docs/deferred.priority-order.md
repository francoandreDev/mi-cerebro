# Diferidos — orden de prioridad por impacto/esfuerzo

Ranking de `docs/deferred.md` (ítems no resueltos). A diferencia de la versión anterior de este documento (que ordenaba solo por esfuerzo), esta versión cruza dos ejes:

- **Impacto** — Alto / Medio / Bajo. Alto = rompe algo que ya debería funcionar (bug), o bloquea un flujo prometido explícitamente en otro doc (home guide, redesigns), o toca una sección de uso diario (notas, tasks, reminders, calendario, búsqueda, sync). Medio = mejora real en una sección de uso frecuente sin bloquear nada, o cierra un gap de UX notorio. Bajo = polish visual, casos raros/baja frecuencia, o ítems que el propio `deferred.md` marca como YAGNI/optimización prematura.
- **Esfuerzo** — Tier 1 (trivial) a Tier 5 (nueva arquitectura), mismo criterio que la versión anterior: superficie tocada, dependencia de decisión UX, nuevas dependencias/migraciones.

Orden final dentro de cada nivel de impacto: esfuerzo ascendente. No reemplaza a `deferred.md` — es una lente de secuenciación; cuando se aborde un ítem, sigue cerrándose ahí.

**Los ratings de impacto son un juicio editorial, no una medición real de uso.** Si algo se siente mal priorizado en la práctica, decilo y se recalibra — no hay telemetría detrás de esto, es lectura de los propios docs (qué se prometió, qué está roto, qué se usa a diario según el roadmap).

---

## Impacto Alto

Órden actualizado 2026-07-09: dentro de "listo para tomar ya" el criterio sigue siendo esfuerzo ascendente. El árbol de carpetas huérfano bajó al final del grupo porque dejó de ser un ítem de esfuerzo estimable — su propia entrada en `deferred.md` dice "discutir antes de tocar código"; no hay Tier de esfuerzo que aplicar hasta que exista esa decisión de diseño.

1. **Vista unificada cross-section por tag** (esfuerzo: alto, Tier 4 — componente "card universal" + servicio cross-kind nuevo) — el home promete "ver todo lo de un tema" y hoy no existe.
2. **[BLOQUEADO — requiere decisión de diseño previa] Árbol de carpetas huérfano tras los rediseños de tarjetas** (esfuerzo: sin asignar) — backend y UI de árbol ya existen completos y tratan las 8 entidades por igual, pero el panel está oculto (`PANE_HIDDEN_PREFIXES`) en las 8 secciones desde que cada una migró a vista de tarjetas. No es un fix puntual: hace falta decidir primero cómo se ve/crea/mueve una carpeta dentro de la metáfora de tarjetas de cada sección, antes de poder estimar esfuerzo o tocar código. Ver `deferred.md` → "Árbol de carpetas huérfano tras los rediseños de tarjetas".

Cerrado: ~~Auditar y arreglar las reglas `:global(...)` de `editor.component.css`~~ (esfuerzo: medio) — resuelto 2026-07-08, las 9 reglas afectadas se movieron a `src/styles/_editor-content.scss`.
Cerrado: ~~Quick-capture global de nota desde cualquier sección~~ (esfuerzo: alto, Tier 4) — resuelto 2026-07-09, atajo `Alt+Shift+N` + overlay global que crea la nota sin salir de la sección actual, ver `deferred.md` para el detalle completo.

## Impacto Medio

6. **Snooze próximo lunes / fin de semana + menú overflow `⋯` (reminders)** (esfuerzo: trivial, Tier 1 — sólo faltan los presets de día-de-semana y el agrupamiento) — reminders es sección de uso diario; "Posponer 1 día"/"Duplicar" ya cerraron, esto es pulido de una acción frecuente.
7. **Toggle "ver sólo cambios" en diffs largos (`/history`)** (esfuerzo: trivial, Tier 1) — mejora legibilidad de una pantalla que se usa cada vez que se revisa historial de versionado.
8. **Snooze inteligente del goal-reminder** (esfuerzo: fácil, Tier 2 — requiere decisión skip-one vs delay) — reminders/goals uso diario, hoy el "no me molestes hoy" no tiene atajo directo.
9. **Navegación por carpetas / DnD entre carpetas en `/files`** (esfuerzo: fácil, Tier 2 — backend `FoldersService`/`moveCollectionToFolder` ya existe) — mejora directa si el usuario acumula colecciones; la sidebar global ya cubre parcialmente, así que el impacto es medio y no alto.
10. **Sobreescritura completa de defaults del navegador en combos consumidos** (esfuerzo: fácil, Tier 2 — QA combo-por-combo) — riesgo de que un atajo esperado dispare comportamiento nativo del browser en vez de la acción de la app; afecta confianza en todos los atajos.
11. **Migrar `findPath()`/`findChapterFile` a `MCB-FS-008`** (esfuerzo: fácil, Tier 2 — mecánico, mismo patrón que §20a) — mejora la calidad de los mensajes de error en 6 servicios de entidad; deuda técnica con impacto directo en debugging cuando algo falla.
12. **Vista de papelera** (esfuerzo: medio, Tier 3 — UI transversal sobre soft-delete ya existente) — red de seguridad para cualquier borrado accidental, cross-entidad.
13. **Recordatorios automáticos para tareas / escritos con deadline** (esfuerzo: medio, Tier 3 — extiende el patrón goal-sourced) — reminders es de uso diario; hoy sólo goals dispara recordatorio automático.
14. **Menú ⋯ con duplicar / exportar a Markdown (books)** (esfuerzo: medio, Tier 3 — `BooksService` + converter ProseMirror→MD) — exportar a MD es portabilidad real de contenido propio, no sólo cosmético.
15. **Atajos de navegación de fila (J/K, Space, E, Del)** (esfuerzo: medio, Tier 3 — patrón compartido "fila enfocada" nuevo) — aplica a reminders/tasks/goals a la vez; alto apalancamiento aunque el esfuerzo de diseñarlo bien una vez sea real.
16. **Reschedule de tareas con DnD en el calendario** (esfuerzo: medio, Tier 3 — reusa listener del jardín de tareas) — el home lo promete como parte de "planificar proyecto"; no urgente porque la edición manual funciona, pero cierra una brecha visible.
17. **IDs de libros legibles / acortados en la URL** (esfuerzo: alto, Tier 4 — decisión de esquema + migración de URLs + cross-feature) — calidad de vida real al compartir/recordar URLs, pero toca todo el patrón de ids de la app, no sólo books.
18. **Cover art y duración ID3 (`jsmediatags`)** (esfuerzo: alto, Tier 4 — nueva dependencia + migración de schema de `Track`) — música tuvo desarrollo activo reciente (sidecars de yt-dlp/ffmpeg); carátula real es la mejora visual más notoria pendiente en esa sección.
19. **Referencias / links entre entidades desde el editor** (esfuerzo: alto, Tier 4 — sintaxis + picker + resolución ante borrado) — pieza grande de UX/datos, útil transversalmente pero no bloquea ningún flujo prometido hoy.
20. **CORS proxy propio para push/fetch a GitHub** (esfuerzo: alto, Tier 4 — infraestructura externa, Cloudflare Worker) — el bug de `pushAll` (cerrado 2026-07-08) resultó no tener nada que ver con el proxy — era client-side puro. El proxy público sigue siendo un single point of failure operado por terceros, pero deja de ser sospechoso de nada concreto.

## Impacto Bajo

Polish visual, casos de baja frecuencia, o ítems que el propio `deferred.md` marca como YAGNI/optimización prematura. Orden aproximado por esfuerzo ascendente, sin discriminar mucho dentro del grupo — la diferencia de impacto entre estos ítems es chica.

21. Filtros por tipo de entidad (Tier 2) — bloqueado más por falta de otras entidades indexadas que por dificultad.
22. Color picker custom para tag — ya resuelto, entrada obsoleta en `deferred.md` (podar).
23. Lead-time por meta (Tier 1) — YAGNI explícito mientras un único lead-time alcance.
24. Hora del deadline configurable (Tier 2) — 23:59 razonable para casi todo plazo.
25. "Cargar más" en backlog / tasks (Tier 2) — aún no hay dolor de scroll real.
26. Atajos directos a herramientas y colores (tiza) (Tier 2) — modo tiza es deliberadamente disruptivo, no se pide teclado.
27. Pin/fijado de estantes (books) (Tier 3) — YAGNI hasta N>10 estantes.
28. Multi-select de pasos (goals) (Tier 3) — el caso no apareció como necesidad real.
29. Drag-to-reposition de estrellas (goals) (Tier 3) — la creación con click ya cubre el caso principal.
30. Layout libre de la constelación (goals wall) (Tier 3) — el hash-based ya cubre sin nuevo estado.
31. Granularidad por faceta en merge bundle (Tier 3) — decisión de producto ya tomada como "no ahora".
32. Compactación manual sobre rango específico (Tier 3) — el background con buckets ya cubre el 95%.
33. Tooltip por-día en la panorámica (`/history`) (Tier 3) — marcado "no crítico" desde Fase 3.
34. Header del editor "n commits desde milestone" (Tier 3) — valor incremental marginal, dice el propio doc.
35. Hilos entre items relacionados (`/files`) (Tier 3) — puro decorado, sin demanda real.
36. Posición libre real (drag x/y) en `/files` (Tier 3) — el jitter determinista ya transmite el feeling.
37. Typewriter focus línea-por-línea (editor) (Tier 3) — la máscara CSS ya cubre ~70%.
38. Typewriter mode en `/writings` (Tier 3) — no bloquea la migración del section pane.
39. Parser de fecha natural — alcance ampliado (Tier 3) — cobertura actual cubre los casos cotidianos.
40. Animaciones orgánicas de DnD (tasks) (Tier 3) — polish puro, mecánica funcional ya está.
41. Riego con cursor regadera (tasks) (Tier 3) — bajo riesgo de uso real hasta que el jardín se llene.
42. Cesta de cosecha con salto en arco (tasks) (Tier 3) — falta sólo la animación FLIP.
43. Textura realista de tiza (Tier 3) — polish, entra si las capas se sienten "planchadas".
44. Export PNG/SVG de las capas (listas) (Tier 3) — conveniencia, no necesaria para no perder trabajo.
45. Undo/redo dedicado para trazos (listas) (Tier 3) — panel de capas + historial git ya cubren.
46. Estilo "pizarra de verdad" en todo el pane (Tier 3) — riesgo de romper modo lectura.
47. Animaciones de snooze / gestos manuales (palomar) (Tier 3) — las animaciones críticas del scheduler ya están.
48. Detalles bonitos: plumitas, plumaje, ronroneo (palomar) (Tier 3) — pulido visual de baja prioridad.
49. Palomares temáticos por categoría (Tier 3) — los filtros del MVP ya resuelven la saturación.
50. Drag-and-drop de tracks a playlist (música) (Tier 3) — el editor de playlist ya cubre la acción equivalente.
51. Thumbs reales 2×2 para galerías en la papelera (Tier 3) — baja frecuencia, vista de papelera no crítica.
52. Volumen real (`BookVolumeComponent`) en la papelera (Tier 3) — mismo razonamiento.
53. Pulido visual general de `/history` (Tier 4) — agrupador sin límite claro, entra cuando haya uso real.
54. Override de imágenes para portada/miniaturas (books) (Tier 4) — los faces procedurales ya dan identidad visual.
55. Paginación real persistida fila por fila (books) (Tier 4) — se autocorrige apenas el usuario abre el capítulo.
56. Subset + conversión a woff2 de Crimson Pro (Tier 4) — bloqueado por tooling, perf ya aceptable para PWA.
57. Waveform pre-renderizado (música) (Tier 4) — costoso (decodificar todo el MP3), bonito pero no bloquea.
58. Crypto-at-rest para PAT en `secrets.json` (Tier 4) — el threat model real (PAT no debe entrar a git push) ya está cubierto por `.gitignore`.
59. Índice de búsqueda persistido por familia (`idx-main`) (Tier 4) — optimización prematura sin métricas reales, dice el propio doc.
60. Índice de búsqueda global para comentarios (Tier 4) — mismo, además requiere walk de priming nuevo.
61. Índice de búsqueda global para borradores (Tier 4) — mismo, conviene diseñar junto con el anterior.
62. Estantería con forma creativa (books) (Tier 4) — visión a futuro, el shelf clásico aún no está pulido.
63. Variantes sobre el fallback sin isomorphic-git (Tier 5) — sólo aplica si el fallback se activa; contingencia, no roadmap.
64. `.git/` en OPFS (Tier 5) — aceptado explícitamente vivir con loading screens hasta que sea intolerable.
65. Sala 3D real (three.js) para `/images` (Tier 5) — fase futura transversal a /images, /books, /lists.

---

## Notas de uso

- Los ratings de impacto son juicio editorial basado en lo que los propios docs (`deferred.md`, redesigns, home guide) prometen o marcan como uso diario — no hay telemetría real detrás. Si algo no calza con el uso real, decilo y se recalibra.
- Dentro de "Impacto Bajo" no vale la pena pelear el orden exacto — la diferencia entre ítem #30 y #40 es marginal. El valor de la lista está en separar Alto/Medio del resto, no en el ranking fino de la cola.
- Varios ítems de esfuerzo alto comparten infraestructura (los tres índices de búsqueda persistidos, por ejemplo) — conviene abordarlos juntos aunque compartan nivel de impacto.
- Este documento es una foto (regenerado 2026-07-08); si `deferred.md` cierra o agrega ítems, este ranking debería regenerarse — no editarse a mano ítem por ítem.
- Historial de cierres previos (pre-2026-07-08): ver `deferred.md` para el detalle — incluye reindexar manual, snippet con highlight, UI de tags, badge de vencidas, umbral de compactación configurable, dev panel de compactación, error code `MCB-MUS-001`, colapsar chips de kind, continuidad de última ruta, historial de búsquedas recientes, anchor `range` multi-bloque, widget de diff-marks insertion-only, y `fields.system` fuera del diff de historial.
- 2026-07-08 (sesión 2): se cerró el ítem #1 de Impacto Alto ("Investigar por qué falla `pushAll`") — ver `deferred.md` para el detalle de los 4 bugs encontrados (clasificación de resultado exitoso como error, lookup de ref por nombre corto vs completo, branches de facet nunca creadas, y fetch roto por falta de `git.addRemote()`). La numeración de esta lista no se recorrió hacia atrás para compensar (mismo criterio que las sesiones previas) — tratar los números como referencias históricas y confirmar contra `deferred.md` antes de tomar el próximo ítem.
- 2026-07-08 (sesión 3): se cerró el ítem #1 original de Impacto Alto ("Auditar y arreglar las reglas `:global(...)` de `editor.component.css`") — las 9 reglas afectadas se movieron a una hoja global nueva `src/styles/_editor-content.scss`, mismo patrón que `_editor-highlight.scss`/`_book-editor.scss`. Verificado en runtime con el navegador: `.ProseMirror` pasó de `min-height: 0px` a `180px`, `.mc-comment-cloud` matchea. Ver `deferred.md` para el detalle. Mismo criterio de numeración: no se recorrió la lista hacia atrás.
- 2026-07-09 (sesión 6): se cerró el ítem #1 de Impacto Alto ("Quick-capture global de nota desde cualquier sección") — atajo `Alt+Shift+N` (no `Ctrl+Shift+N`, reservado por Chrome para incógnito) abre un overlay (`QuickCaptureDialogComponent`) sobre cualquier sección; primera línea del textarea = título, resto = párrafos del cuerpo; la nota cae en la raíz de `/notes` sin tags preseleccionados; confirmación vía toast informativo (`MCB-UI-001`) con acción "Abrir". Ver `deferred.md` para el detalle completo de la implementación. Verificado en runtime desde `/books`. La numeración no se recorrió hacia atrás (mismo criterio que sesiones previas).
- 2026-07-09 (sesión 5): reordenado el grupo Impacto Alto a partir del diagnóstico de la sesión 4 — el árbol de carpetas huérfano pasó al final del grupo (marcado bloqueado, sin Tier de esfuerzo asignable) porque requiere una decisión de diseño transversal antes de poder tocar código; quick-capture global y vista cross-section por tag (ambos Tier 4, listos para tomar sin decisión previa pendiente) subieron al #1 y #2. El ítem de `editor.component.css` (cerrado 2026-07-08) se movió a una línea de "Cerrado" al pie del grupo en vez de ocupar el #1 numerado.
- 2026-07-09 (sesión 4): investigado el ítem #2 original de Impacto Alto ("Carpetas / jerarquía real dentro de notas") — resultó ser un diagnóstico desactualizado. El backend y la UI de árbol/carpetas (`FoldersService`, `NotesService.moveToFolder`, `buildFolderTree`, context menu de `folder-actions.ts`) ya están completos y tratan `note` igual que las otras 7 entidades; no faltaba nada de código. El problema real, confirmado en runtime en el navegador: ese panel está oculto en las **8** secciones (`PANE_HIDDEN_PREFIXES` en `workspace-sidebar.container.ts` incluye hoy `/notes`, `/tasks`, `/goals`, `/lists`, `/writings`, `/books`, `/images`, `/files`), no sólo en notas — quedó huérfano a medida que cada sección se rediseñó a vista de tarjetas. También corrige de paso el ítem #9 de Impacto Medio ("Navegación por carpetas / DnD entre carpetas en `/files`"): la frase "la sidebar global ya cubre parcialmente" ya no es cierta para ninguna sección. Ver `deferred.md` → "Árbol de carpetas huérfano tras los rediseños de tarjetas" (nueva entrada consolidada, origen paso 6) para el detalle completo; esa entrada reemplaza tanto al ítem #2 de notas como a la mención de `/files`. Es una decisión de diseño transversal (cómo se ve la jerarquía dentro de la metáfora de tarjetas) — no se tocó código de producto esta sesión, sólo se corrigió la documentación. No se recorrió la numeración hacia atrás.
