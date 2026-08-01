# Conexiones entre entidades

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

## Modelo

`core/relations/` define el modelo genérico de "A se conecta con B", independiente de features — mismo nivel que `core/tags/`:

- `EntityRef = { kind: EntityKind; id: string }`.
- `Relation = { id, from: EntityRef, to: EntityRef, origin: 'editor' | 'manual', contextSnippet?: string, createdAt }`. `contextSnippet` es la frase seleccionada al vincular desde el editor; queda congelada a propósito (mismo criterio que el subject de un commit compactado en versionado — "se congela al momento", no se rederiva).
- Storage: `.mi-cerebro/relations.json` (`RelationsFile { schemaVersion, relations: Relation[] }`), mismo molde que `tags.json`. Escritura atómica vía `fs.writeFileAtomic`, registrado en `MigrationsService`.

`RelationsService` expone `outgoingFor(ref)` / `backlinksFor(ref)` — dos `computed` agrupados por `refKey(ref)` (`kind:id`), no un filter lineal por llamada. `create()` es idempotente (mismo `from`+`to` devuelve la fila existente). `remove()` es no-op silencioso sobre un id inexistente. No hay lock explícito — igual que `TagsService`, se confía en que `writeFileAtomic` es seguro a nivel de archivo.

**Resolución de título/ruta en vivo:** `Relation` no guarda título ni ruta de sus extremos, sólo `{kind, id}`. `core/relations/resolve-relation.ts` (`resolveRelations`) resuelve cada extremo contra `SearchIndexService.getTitle()` en cada render — así un rename no invalida nada, y una entidad borrada (soft-delete a `.mi-cerebro/trash/`) simplemente deja de resolver (`title === null` = huérfana) hasta que se restaure. No hay flag `orphaned` persistido.

**Borrado y purga:** las filas de `relations.json` no se purgan automáticamente al borrar una entidad — el archivo es chico (un id + un kind por extremo) y quedan como filas muertas hasta que la entidad se restaure o se purgue de la papelera.

## Vincular desde el editor

- `core/tiptap/entity-ref/entity-ref.node.ts`: nodo inline `entityRef` (mismo molde que `image-ref.node.ts`), attrs `{kind, entityId, label}`, persistido como `<span data-entity-ref data-kind data-entity-id data-label>`. El label queda congelado al insertar, sin fetch async. El ícono por kind se arma con `entityKindIcon()` + `ICON_DATA` envuelto a mano en `<svg>` (el NodeView de ProseMirror no tiene acceso a `IconComponent`).
- `shared/editor/entity-link-picker-dialog.component.ts`: picker que busca sobre `SearchIndexService.query()` — el mismo índice de búsqueda global, sin estructura nueva.
- **Punto de entrada:** botón fijo "Vincular a…" en la barra del editor (`editor-toolbar.component.ts`), siempre visible cuando el editor es editable — no depende de selección ni de la vista `combined`. También disponible como entrada de la bubble menu cuando hay selección de texto en vista `combined` (dos caminos al mismo `EditorComponent.triggerLink()`). Con selección, el chip envuelve el texto elegido (ese texto pasa a ser el `contextSnippet`); sin selección, inserta el chip en el cursor sin snippet. El mismo botón está replicado en `chapter-editor-pane.component.ts` para capítulos de libro (que esconden el toolbar interno de `mc-editor` por su paginación).
- Montado en los 7 puntos de entrada de `mc-editor`: notas, tareas, metas, escritos, listas, capítulos de libro (`entityKind` input identifica el extremo `from`).
- Click en el chip navega a la entidad vinculada vía `routeFor()` (`core/search/kind-routes.ts`).

## Panel "Conexiones"

`shared/connections/connections-panel.container.ts` — mismo molde que los paneles de comentarios/borradores del editor (self-contenido dado `entityKind`/`entityId`), pero **sin toggle**: se auto-oculta cuando no hay ninguna conexión en vez de vivir detrás de un ícono. Dos grupos — "Salientes" (`outgoingFor`) y "Referenciado desde" (`backlinksFor`) — cada fila con ícono por kind, título, snippet entre comillas si `origin: 'editor'`, y botón "Desvincular". Reactivo: ambos lados de una relación se actualizan solos al desvincular, sin reload, porque dependen de la misma señal `RelationsService.relations()`.

Montado en el detalle de las 7 entidades vinculables (notas, tareas, metas, escritos, listas, archivos, imágenes) — para archivos e imágenes, cuyas vistas de detalle no comparten el patrón `*-editor-pane`/`mc-editor`, el panel se monta directo en `files.container.html`/`galleries.container.html`.

`WorkspaceRefreshService.refreshAll()` incluye `relations.refresh()` junto a `tags.refresh()` — sin esto, `RelationsService.relations()` queda vacío para siempre después del boot.

## Mapa de conexiones (grafo de 1 salto)

Botón "Ver en el mapa" dentro del panel "Conexiones", abre `shared/connections/connections-graph-overlay.component.ts`: muestra el nodo central + sus vecinos directos (salientes + backlinks fusionados por par, línea `both` si hay ambas direcciones). No es el grafo completo del workspace — sólo 1 salto desde la entidad activa, sin física de repulsión/springs (posiciones por ángulo determinístico `i/n * 2π`). Click en un vecino **recentra el grafo sobre él** (no navega) con una pila de historial para "Volver"; botón "Abrir" al pie navega de verdad a la entidad central actual y cierra el diálogo.

## Hilos manuales en `/files`

Drag-and-drop nativo (HTML5, no pointer-capture) entre casillas del wall-grid de `/files`: soltar una colección sobre otra crea `RelationsService.create({from, to, origin: 'manual'})` directo, sin picker — el destino ya está a la vista. Sin `contextSnippet` (no hay frase de origen en un gesto de drag). Feedback visual: opacidad reducida en la casilla origen mientras se arrastra, outline punteado en las demás.

## Explícitamente fuera de alcance

Grafo completo del workspace con layout de fuerzas, sugerencias automáticas por similitud/tags compartidos, y extender los kinds vinculables a recordatorios/música.

---

## Vista de lista + atajos de fila en tasks y goals

`/tasks` (kanban de buckets) y `/goals` (wall de constelación) ganan un **modo lista** — toggle en el header, persistido en `localStorage` (`mc.tasks.garden.viewMode` / `mc.goals.wall.viewMode`), mismo patrón que el toggle grid/list de `/books`. El modo lista muestra las entidades en su orden real ya existente (`TaskSummary.position` / `GoalSummary.position`, los mismos campos que ya ordenaban el drag-reorder y el listado por defecto) — sin ese orden visible, J/K no tendría un mapeo honesto a la disposición en pantalla (kanban/wall no tienen "fila").

Con el modo lista activo, J/K/Space/E/Del navegan la fila enfocada (mismo primitivo que reminders usa desde su rediseño):

- `shared/utils/list-cursor.ts` (`createListCursor`): trackea el id enfocado (no un índice, sobrevive a reordenamiento/filtrado).
- `shared/utils/row-nav.controller.ts` (`RowNavController`): centraliza el registro de los 5 bindings (J siguiente, K anterior, E abrir, Space toggle, Delete borrar) sobre `ShortcutsService`, reutilizado por tasks y goals en vez de duplicar el bloque que reminders tiene inline.
- En tasks, Space cosecha la fila enfocada; en goals, marca/desmarca "lograda". E navega a la entidad; Delete abre el diálogo de confirmación existente de borrado.

## Filtro por tipo en la búsqueda global

El palette (`Ctrl+K`) acepta un token `kind:<tipo>` combinable con `tag:<etiqueta>` y texto libre — mismo parser que `tag:` (`core/search/palette-query.ts`), matchea contra la etiqueta traducida del tipo (`kind:tareas`) o su literal en inglés (`kind:task`), insensible a mayúsculas/acentos. `SearchQuery.kinds` y el filtrado en `SearchIndexService.query()` ya existían desde la búsqueda global original — este cambio sólo expuso el control.
