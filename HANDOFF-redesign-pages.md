# Handoff — Redesign de páginas (`/notes`, `/tasks`, `/goals`, `/lists`, `/writings`)

## Contexto

Migración progresiva descripta en `docs/redesign.md`: cada página deja de depender del **section pane** intermedio de la sidebar global y adopta un layout propio que aprovecha todo el ancho. El rail vertical de íconos se mantiene; lo que se oculta es el panel intermedio.

Estas 5 páginas quedan pendientes en la tabla de `docs/redesign.md`. Este handoff las cierra una por una, cada una en una sesión independiente (commit + verde de build/tests + tabla actualizada antes de pasar a la siguiente).

Ideas elegidas (variante **A** de la conversación de diseño):

| Ruta        | Idea                                                                  |
| ----------- | --------------------------------------------------------------------- |
| `/notes`    | Muro de stickies (masonry) + card "nueva" al frente + chips de filtro |
| `/tasks`    | Tres columnas por horizonte temporal (Hoy / Semana / Backlog)         |
| `/goals`    | Wallboard tipográfico (objetivo = póster)                             |
| `/lists`    | Estantería de cards con preview de primeros ítems                     |
| `/writings` | Index "biblioteca de borrador" + editor TipTap full-bleed             |

## Reglas comunes a todas las sesiones

Aplican siempre (refuerzo de PROYECTO.md):

- TS strict, sin `any`, signals como estado primario, OnPush, standalone.
- Soft 200 líneas / hard 300 por archivo. Container que crezca → split en dumb components.
- Sin cross-feature imports (regla 10).
- I18n centralizado: todo string visible en `i18n/es.ts` (sin hardcode en templates).
- Atajos con modificador via `ShortcutsService` (§4.6 regla 15). Si la página introduce uno nuevo, declarar combo + scope + preventDefault.
- Accesibilidad: foco visible, navegación por teclado completa, ARIA, contraste AA.
- Commits frecuentes y atómicos, mensaje en imperativo inglés. UI en español.
- **No tocar el handoff anterior (`HANDOFF.md`, `HANDOFF-13e.md`).** Editar/extender este archivo solo si hace falta dejar caveats al cierre de cada sesión.

## Checklist genérico por sesión (aplicar a las 5)

1. Leer `PROYECTO.md` (§1, §2, §4) y `docs/redesign.md` antes de tocar nada.
2. Mirar el container actual de la página (`features/<entity>/containers/<entity>.container.{ts,html,css}`) para entender qué datos consume y de qué service tira.
3. Agregar el prefijo (`/notes`, `/tasks`, etc.) a `PANE_HIDDEN_PREFIXES` en `src/app/layout/containers/workspace-sidebar.container.ts`.
4. Implementar el nuevo layout siguiendo la idea elegida (subpasos por sesión más abajo).
5. Splittear en dumb components dentro de `features/<entity>/components/` cualquier pieza visual reutilizable; el `.container.ts` queda smart.
6. CSS variables para todo lo temable; sin hardcode de colores.
7. Verificar:
   - `bun x ng test --watch=false` — no introducir regresiones nuevas (los 6 fallos pre-existentes documentados en `HANDOFF.md` siguen tolerados, no agregar más).
   - `bun run build` verde.
   - Lint verde (`bun x ng lint` o equivalente del repo).
   - Pasada manual: navegar a la ruta, crear / leer / editar / borrar la entidad, probar atajos, probar tab/shift+tab.
8. Actualizar `docs/redesign.md`: cambiar `⏳` por `✅` y resumir la idea final implementada en una línea.
9. Si algo quedó afuera, registrarlo en `docs/deferred.md` con motivo y fase target (regla 25b).
10. Commit. Mensaje sugerido: `feat(<entity>): redesign page to <idea> (drop section pane)`.

## Sesión 1 — `/notes` (muro de stickies) ✅

**Cerrado.** Implementado como `NotesWallContainer` separado del editor (`NotesContainer`) — el router de notas ahora apunta a wall en `''` y al editor en `':id'`. Wall = filter bar (búsqueda + chips de tags usados) + masonry CSS `column-count` (1-5 cols responsive) con `new-note-card` inline al frente y `note-sticky` por nota. Preview del body persistido en `NoteSummary.preview` (calculado al refresh/create/save). i18n nuevo bajo `notes.wall.*`. Prefix `/notes` agregado a `PANE_HIDDEN_PREFIXES`. Build + lint verdes; tests pasan salvo los 6 pre-existentes de `variant-tree.spec`.

**Idea original.** Grid masonry de cards de altura variable. Tag(s) como banda lateral o footer de color. Card "nueva nota" siempre primera. Chips de filtro arriba (tag, "todas / favoritas / archivadas" si aplica) + buscador local.

Subpasos:

1. **Audit del state actual.** Identificar el signal/service que ya entrega la lista de notas (probablemente `NotesService` + algún signal con la colección). Anotar qué fields tiene una nota (título, body preview, tags, updatedAt, color/tag-color, pin/fav).
2. **Wireframe en código.** Crear `features/notes/components/note-card.component.ts` (dumb): inputs = `note`, output = `open`, `togglePin`, `delete` (los que apliquen). Card mostrando título, snippet de body, chips de tags. Altura intrínseca al contenido.
3. **`new-note-card.component.ts` (dumb).** Card especial con un input de captura inline. Emite `create` con el texto inicial. Foco al montar si la ruta entra con `?focus=new` (o vía un signal del container).
4. **`notes-masonry.component.ts` (dumb).** Recibe `notes: Note[]` y renderiza el grid. Implementación: CSS `column-count` responsive (3-5 columnas según ancho) + `break-inside: avoid`. Alternativa si el orden de columnas importa: `grid-template-rows: masonry` detrás de `@supports` y fallback a `column-count`.
5. **Container.** Reescribir `notes.container.{ts,html,css}` para componer: `<filter-chips>` arriba (reutilizar `shared/tags` si existe), `<new-note-card>`, `<notes-masonry>`. Manejar filtros como signals derivados (`computed`).
6. **Sidebar prefix.** Sumar `'/notes'` a `PANE_HIDDEN_PREFIXES`.
7. **Atajos.** Confirmar que `Ctrl+N` (nueva nota — si ya existe global) sigue funcionando; si no existe, no agregar uno nuevo en esta sesión, dejar diferido.
8. **A11y.** Cards = `role="article"` con `tabindex="0"`, Enter abre, Delete (con confirmación) borra. Foco visible.
9. **Tests.** Si hay tests viejos de `notes.container`, actualizarlos al nuevo shape. Tests nuevos sólo si hay lógica no trivial en components (regla 18).
10. **Doc + commit.** `docs/redesign.md` → ✅. Commit.

Riesgos / caveats a vigilar:

- Masonry CSS nativo aún es spec experimental; el fallback `column-count` rompe el orden visual (lee top-to-bottom por columna). Si el orden importa, considerar JS-driven masonry (no agregar librería pesada — escribir uno chico en `shared/` o aceptar el orden por columna).
- Notas muy largas: clampear el preview a N líneas con `-webkit-line-clamp`.

## Sesión 2 — `/tasks` (tres columnas por horizonte) ✅

**Cerrado.** Board en `TasksBoardContainer` (ruta `''`), editor sigue en `TasksContainer` (ruta `:id`). Bucketing puro en `services/task-buckets.ts` con spec — define "esta semana" como próximos 7 días desde hoy (no "hasta domingo"); tareas con `dueDates[0] < today` viven en "Hoy" con flag `overdue` para badge rojo. Card (`task-card`) muestra título, checkbox done, due chip (Hoy/Vencida/N mes), tags y botones de mover; column (`task-column`) tiene header, lista y captura inline (`createInline`). Container compone 3 columnas + search local + toggle "ocultar hechas". Prefix `/tasks` agregado a `PANE_HIDDEN_PREFIXES`. i18n bajo `tasks.board.*`. Build verde, tests pasan salvo los 6 pre-existentes de `variant-tree.spec`.

**Caveat / diferido.** DnD entre columnas (HTML5 nativo + atajo de teclado) no entró: en su lugar, cada card expone botones para mover a las otras columnas (accesibles por teclado vía tab). Registrado en `docs/deferred.md` apuntando a fase posterior.

**Idea original.** Tres columnas: **Hoy** / **Esta semana** / **Backlog**. Tareas vencidas pintan badge rojo dentro de "Hoy". Card arrastrable entre columnas (cambia la fecha). Captura inline al final de cada columna (Enter crea). "Sin fecha" cae a Backlog. Toggle "ocultar hechas" en header.

Subpasos:

1. **Audit del state.** `TasksService` (o equivalente): cómo entrega la colección, qué fields tiene (dueDate, status, tags). Confirmar cómo se persiste la fecha.
2. **Bucket puro.** En `features/tasks/services/` crear `task-buckets.ts` (función pura): `(tasks, now) -> { today, week, backlog, overdue }`. Tests unitarios obligatorios (es la regla del juego: planner puro testeable).
3. **Dumb component `task-card.component.ts`.** Muestra título, fecha relativa ("hoy", "vie", "12 jul"), tags, checkbox de done. Outputs: `toggle`, `open`, `move(toBucket)`.
4. **Dumb `task-column.component.ts`.** Inputs: `title`, `tasks`, `accentColor`. Output: `createInline(text)`, `move(taskId, toBucket)`. Render header + lista de cards + input inline al final.
5. **Drag & drop.** Mínimo viable: HTML5 DnD nativo (no librería). Helper en `shared/utils/dnd.ts` si no existe. Al drop, container llama a `tasksService.update(id, { dueDate: bucketToDate(bucket) })`.
6. **Container.** `tasks.container` compone 3 columnas + header con toggle "ocultar hechas" + buscador. Signals derivados desde `task-buckets()`.
7. **Sidebar prefix.** Sumar `'/tasks'`.
8. **Atajos.** `N` con foco en una columna crea inline allí. Si se introduce, registrarlo en `ShortcutsService` con scope editable-safe.
9. **A11y.** DnD debe tener alternativa por teclado (ej. focused card + Shift+→ mueve a columna siguiente). Si no entra en esta sesión, diferir explícitamente.
10. **Tests + verificación + doc + commit.**

Riesgos:

- "Esta semana" ambigua: definir explícitamente como "próximos 7 días desde hoy" (no "hasta domingo"). Documentar en código.
- Tareas recurrentes — fuera de alcance acá; si el modelo ya las tiene, dejarlas caer en su bucket por la próxima ocurrencia.

## Sesión 3 — `/goals` (wallboard tipográfico)

**Idea.** Cada objetivo es una card grande tipográfica (título enorme, una línea de "por qué"/subtítulo, opcional barra de progreso o métricas). Grid de 2-3 columnas. Sensación "póster". Click → modal o ruta de detalle.

Subpasos:

1. **Audit.** Modelo de Goal: title, subtitle/why, progress (si existe), tags. Confirmar cómo se edita hoy.
2. **Dumb `goal-poster.component.ts`.** Tipografía dominante (font-size grande, peso bold), espacio generoso, color de acento. Inputs: `goal`, opcional `compact`. Output: `open`, `edit`, `archive`.
3. **`goals-wall.component.ts` (dumb).** Recibe `goals[]`, render en grid `repeat(auto-fit, minmax(360px, 1fr))` con `min-height` para que los posters respiren.
4. **Empty state fuerte.** Si no hay goals: una sola card central tipográfica que invita a crear el primero ("¿Qué querés lograr?"). No mostrar grid vacío.
5. **Container.** `goals.container` compone wall + acción "nuevo objetivo" (modal o inline expand). Mantener `goal-reminder.container` separado si hoy se monta en otra parte; sólo migrar el index.
6. **Sidebar prefix.** Sumar `'/goals'`.
7. **A11y.** Cards focuseables, Enter abre, navegación con flechas opcional.
8. **Tests + verificación + doc + commit.**

Riesgos:

- 1-2 objetivos = grid casi vacío. Solución: cuando `goals.length <= 2`, agrandar columnas (CSS `:has` o un signal `posterScale`).
- Wallboard puede pisar visualmente al `goal-reminder` global; verificar que ambos contextos se diferencian (tipografía / fondo).

## Sesión 4 — `/lists` (estantería con preview)

**Idea.** Grid de cards medianas estilo tarjeta. Cada card: título, 3-4 primeros ítems en preview (truncados), contador "+N más", tags. Click → expande a modal o vista detalle full-screen con la lista editable.

Subpasos:

1. **Audit.** Modelo de List: title, items[], tags. Cómo se editan ítems hoy (inline? modal?).
2. **Dumb `list-card.component.ts`.** Header (título + count), preview de 3-4 ítems (líneas tachables si tienen estado, aunque la spec dice sin estado — solo render plano), footer con tags. Output: `open`.
3. **Dumb `lists-shelf.component.ts`.** Grid responsivo `repeat(auto-fill, minmax(280px, 1fr))`.
4. **Detalle.** Decidir: modal vs ruta hija (`/lists/:id`). Recomendación: ruta hija para deep-link. Container detalle = vista a pantalla completa para editar/reordenar ítems (drag handles, Enter agrega).
5. **Container index.** `lists.container` compone shelf + búsqueda + botón "nueva lista" (que crea y navega al detalle vacío).
6. **Sidebar prefix.** Sumar `'/lists'`.
7. **A11y.** Cards focuseables, ítems del detalle con drag accesible por teclado (mismo criterio que tasks: si no entra, diferir).
8. **Tests + verificación + doc + commit.**

Riesgos:

- Si el detalle se hace ruta hija, asegurar que `PANE_HIDDEN_PREFIXES` cubra `/lists` y no haga falta listar `/lists/:id` aparte (el `startsWith` ya lo cubre — verificar).
- Preview vs item largo: clamp a 1 línea por ítem.

## Sesión 5 — `/writings` (biblioteca + editor full-bleed)

**Idea.** Index sobrio tipo estantería de borrador: cada escrito como card tipográfica (título, primeras líneas, wordcount, updatedAt). Click → editor TipTap ocupando toda la pantalla (sin chrome extra) con barra mínima superior (volver, título editable, menú). Modo typewriter opcional vía toggle.

Subpasos:

1. **Audit.** Modelo Writing: title, body (TipTap doc), wordcount, updatedAt. Confirmar cómo está cableado el editor hoy (`shared/editor` wrapper según §11).
2. **Dumb `writing-card.component.ts`.** Tipografía dominante en título (serif si combina con el tema), 2-3 líneas de preview, footer con wordcount + "hace X".
3. **Dumb `writings-shelf.component.ts`.** Grid `repeat(auto-fill, minmax(320px, 1fr))`. Ordenable por updatedAt / título / wordcount (signal de sort).
4. **Editor full-bleed.** Ruta hija `/writings/:id` que monta un container con el editor a pantalla completa. Layout: header sticky muy delgado (volver, título editable inline, menú overflow), TipTap en column central con `max-width: 72ch` para legibilidad pero fondo full-bleed.
5. **Typewriter mode (opcional, último).** Toggle en menú. Implementación: scroll-padding-bottom: 40vh para que la línea activa quede al medio. Si no entra, diferir.
6. **Container index.** `writings.container` = shelf + búsqueda + sort + "nuevo escrito".
7. **Sidebar prefix.** Sumar `'/writings'`.
8. **Atajos.** Dentro del editor: `Ctrl+S` ya cubierto por autosave (no agregar). `Esc` vuelve al index (con guard si hay save in-flight). Registrar `Esc` como listener local del container del editor, no global.
9. **A11y.** Editor TipTap ya cumple base; verificar foco al entrar/salir, foco visible en header del editor.
10. **Tests + verificación + doc + commit.**

Riesgos:

- TipTap puede tener estado de selección sensible al re-mount: navegar entre escritos no debe perder cursor del anterior si no se guardó (el autosave del proyecto debería cubrirlo — confirmar).
- El header sticky del editor pisa el rail global si no se respeta el ancho. Verificar con sidebar plegado y abierto.

## Cierre del handoff

Cuando las 5 sesiones estén ✅ en `docs/redesign.md`, este handoff queda obsoleto. Las únicas filas que pueden quedar `⏳` en la tabla son `/reminders` y `/sync` (fuera de este handoff).

Si alguna sesión queda parcial:

- Marcarla como `🚧` en `docs/redesign.md` con una nota corta.
- Anotar acá, debajo de la sesión, qué subpaso quedó pendiente y por qué.
- Registrar lo diferido en `docs/deferred.md`.

## Recordatorios para el próximo

- **Antes de cualquier cambio:** releer `PROYECTO.md` completo (regla del `CLAUDE.md`).
- Si alguna idea de redesign choca con `PROYECTO.md`, **decirlo antes de implementar** y proponer actualizar el documento primero (regla §4.11.25).
- No tocar las otras 5 páginas en una misma sesión: una página, un commit, un cierre limpio.
