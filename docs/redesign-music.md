# Redesign `/music` — bitácora

Persistencia del rediseño de `/music`. Sirve para retomar el trabajo en otra sesión sin perder contexto. Convive con `docs/redesign.md` (índice general por página); este archivo guarda el detalle del trabajo en curso y se elimina cuando la tabla principal marque `/music` como ✅.

## Idea (Opción A — "estudio")

Layout sin section pane, 3 zonas en grilla:

```
┌──────────────┬──────────────────────────────┬───────────────┐
│ Playlists    │ Biblioteca                   │ Reproduciendo │
│ (rail ~220) │ (buscador, tabla densa,      │ (carátula,    │
│ ★ favoritas  │  drop zone, bulk actions)    │  controles,   │
│ + Nueva      │                              │  cola)        │
└──────────────┴──────────────────────────────┴───────────────┘
```

Cuando hay una playlist activa, la columna central pasa a ser el editor (lista de tracks de la playlist + buscador inline para sumar). El rail sigue mostrando las playlists con la activa resaltada.

## Las 10 mejoras concretas

1. Drag-and-drop everywhere (subida + sumar a playlist + reorder en playlist).
2. Tabla densa en biblioteca (título, duración, tamaño, fecha, tags).
3. Buscador de la biblioteca (filtrado global con `/` para foco).
4. Selección múltiple (shift/cmd-click) + bulk delete / bulk add.
5. Indicador "reproduciendo" más fuerte (EQ animado en fila + marca en playlist activa).
6. Picker de tracks dentro de playlist por drag-and-drop (no por toggle "+ Agregar").
7. Cola visible y editable (skip, reorder, remove, clear).
8. Cover art + waveform vía ID3 tags client-side (sin red).
9. Atajos: Espacio play/pause (editable-safe), N nueva playlist, `/` foco buscador.
10. Empty state con drop zone visible + CTA grande.

## Fases (orden de implementación)

| #   | Fase                                                     | Cubre            | Estado                 |
| --- | -------------------------------------------------------- | ---------------- | ---------------------- |
| 1   | Shell + grilla 3 zonas + ocultar pane + persistencia doc | layout base      | ✅ 2026-06-18          |
| 2   | Tabla densa biblioteca + buscador                        | #2, #3           | ✅ 2026-06-18          |
| 3   | Drop zone empty state + drag upload                      | #10, parte de #1 | ✅ 2026-06-18          |
| 4   | Multi-select + bulk actions                              | #4               | ✅ 2026-06-18          |
| 5   | Drag a rail + drag reorder en playlist                   | resto de #1, #6  | ✅ 2026-06-18          |
| 6   | Now Playing card + EQ indicator + marca playlist activa  | #5               | ✅ 2026-06-18          |
| 7   | Cola visible y editable                                  | #7               | ✅ 2026-06-18          |
| 8   | Atajos                                                   | #9               | ✅ 2026-06-18          |
| 9   | Cover art ID3 (o diferir)                                | #8               | ⏭️ diferida 2026-06-18 |
| 10  | Cierre: errors.md, deferred.md, redesign.md → ✅         | docs             | ✅ 2026-06-18          |

## Checklist al cerrar cada fase

- Actualizar el estado de la fila en la tabla de arriba (🚧 → ✅, fecha).
- Notas breves debajo (decisiones, archivos clave creados/modificados).
- Si una mejora se descarta o difiere → entrada en `docs/deferred.md` (regla §4.11.25b) y nota acá.
- Si hay códigos de error nuevos → `docs/errors.md` antes de mergear.

## Notas por fase

### Fase 1 — Shell 3 zonas + persistencia (✅)

Archivos tocados:

- `docs/redesign-music.md` (este archivo, creado).
- `src/app/layout/containers/workspace-sidebar.container.ts` — `PANE_HIDDEN_PREFIXES += '/music'`.
- `src/app/features/music/containers/music.container.{html,css,ts}` — grilla 3 zonas. La columna central swapea entre biblioteca (cuando no hay playlist activa) y editor de playlist (cuando hay). La derecha es Now Playing placeholder con controles básicos.
- `docs/redesign.md` — fila `/music`: idea + estado en curso.

Decisiones:

- Columna izquierda (`rail`) ~220px, derecha (`now-playing`) ~280px, centro flexible.
- El estado "playlist activa" deja de tener pantalla aparte: convive con el rail (selección resaltada) y reemplaza el contenido central.
- Now Playing en Fase 1 es mínimo (track + play/pause/prev/next). La carátula y la cola llegan en Fases 6–7.
- No se rompió la API de `MusicLibraryService`, `PlaylistsService` ni `PlayerService` en Fase 1: solo cambia el container de la página.

### Fase 2 — Tabla densa + buscador (✅)

Archivos tocados:

- `src/app/features/music/utils/music-format.ts` — nuevo: `formatDuration`, `formatBytes`, `formatShortDate`.
- `src/app/features/music/containers/music.container.ts` — `libraryQuery` signal, `filteredTracks` y `libraryRows` computed, handlers `onPlayRow` / `onDeleteRow`. Interface `LibraryRow` exportada (la consumirá el componente de tabla cuando se extraiga).
- `src/app/features/music/containers/music.container.html` — biblioteca ahora es `<div role="table">` con columnas: play | título | duración | tamaño | añadido | borrar. Input de búsqueda arriba.
- `src/app/features/music/containers/music.container.css` — estilos `.lib-table` / `.lib-thead` / `.lib-row` (grid de 6 columnas, sticky header).
- `src/app/core/i18n/locales/es.ts` — keys `music.col.{title,duration,size,added}` y `music.duration.unknown`.

Notas:

- `durationMs` hoy se persiste como `null` siempre (la biblioteca no extrae duración todavía). La columna muestra "—" hasta que llegue Fase 9 (ID3) o un decoder de duración.
- `music.container.ts` quedó en 238 líneas (warning blando, hard cap 300). Si Fase 4 lo empuja >280 se extrae `library-table.component` y `playlist-editor.component` antes.

### Fase 3 — Drop zone + drag upload (✅)

- Empty state es ahora un `.drop-zone` con icono, título y hint; click abre file picker.
- `.lib-zone` envuelve la lista/empty state y captura `dragover/dragleave/drop`. Resalta con outline accent cuando `dragOver()` es true.
- Helper `hasFiles(event)` chequea `dataTransfer.types` para no reaccionar a drags internos.
- 3 keys i18n nuevas: `music.dropZone.{title,hint,dragging}`.
- Container: `dragOver` signal + handlers `onDragOver/Leave/Drop`, helper privado `addFilesToLibrary`.

### Fase 4 — Multi-select + bulk (✅)

- Nuevo container `playlist-editor.container` (smart) absorbe todo el estado de edición de playlist. `music.container` queda como orquestador (rail + library + now playing + slot del editor).
- `MusicContainer.active` se conserva; el editor emite `back`, `changed(playlist)`, `deleted(id)` para mantener sincronizado.
- Selección: `selectedIds` (set), shift+click extiende rango sobre la lista filtrada visible, click suma/quita.
- Barra de acciones masivas aparece sobre la tabla con: contador, "Borrar", `<select>` de playlists para "Agregar a…", "Limpiar".
- Si una playlist activa fue tocada por bulk-add o bulk-delete, se relee de disco para actualizar la vista.
- 7 keys nuevas en es.ts (`music.bulk.*`).
- Container post-extracción: 236 líneas (warn 200, hard 300). OK para seguir.

### Fase 5 — Drag a rail + reorder (✅)

- Library rows ahora son `draggable`. Drag payload usa MIME `application/x-mc-track-ids` con `JSON.stringify(ids)`. Si la fila arrastrada está en `selectedIds`, se envía toda la selección.
- Rail de playlists acepta drop: `(dragover/dragleave/drop)`. Highlight via `railDropTargetId` + clase `.drop-target`.
- Playlist editor: rows draggable con MIME `application/x-mc-playlist-reorder` (string idx origen). Drop reordena la lista y persiste. Adiós ↑/↓ buttons.
- Drag handle visible (`⋮⋮`) en cada row del editor para affordance.
- Warnings de complejidad pendientes (`onRailDrop` 12, `onTrackDrop` 11) — limpiar en Fase 10.

### Fase 6 — Now Playing card + EQ + playlist activa (✅)

- `PlayerService.currentSourceId` nuevo (string | null). Indica qué playlist disparó la cola actual; null = ad-hoc/single-track.
- `playPlaylist(ids, startIdx, sourceId?)` — sourceId opcional. Callers actualizados: `playlist-editor` y `workspace-sidebar` ahora pasan el id de la playlist.
- Componente CSS-only EQ bars (3 i animadas con keyframe staggered) en filas reproduciendo. Si está pausado, anima `paused` y altura mínima.
- Rail marca con `.now-playing` la playlist cuya fuente está sonando; reemplaza la estrella favorita por mini-EQ inline.
- Nuevo container `now-playing.container` (smart) inyecta player/library/playlists. Concentra card + controles + (cola, ver Fase 7).
- `music.container` adelgaza: sale `currentTrack`, `currentSourceTitle`, `shuffle`, handlers de prev/next/toggle/shuffle/stop. Queda en 275 líneas efectivas.

### Fase 7 — Cola visible y editable (✅, junto con Fase 6)

- `PlayerService.jumpTo(index)` y `removeAt(index)` nuevos. `jumpTo` valida rango y dispara `loadCurrent(true)`. `removeAt` corre splice y ajusta `index` si la remoción es antes del actual; rechaza intento de remover la current (la UI lo deshabilita).
- `now-playing.container` muestra cola con: indicador EQ en current, click en fila = `jumpTo`, X = `removeAt`, "Vaciar" = `stop()`.
- 4 keys i18n nuevas: `music.queue.{title,clear,jumpTo,remove}`.
- Cola se oculta cuando la lista tiene ≤1 (un solo track ad-hoc).

### Fase 8 — Atajos (✅)

- Nuevo `music.shortcuts.ts` con helper `registerMusicShortcuts(handlers)` paralelo a `book-reader.shortcuts.ts`.
- 3 bindings: `Space` toggle play/pause, `N` nueva playlist, `/` foco al search de biblioteca. Todos `editable-safe`.
- `music.container` registra los bindings en su constructor; `DestroyRef` los limpia al salir de la ruta.
- `viewChild('libSearch')` en el `<input>` de búsqueda permite que el handler haga `.focus()`.
- 3 keys nuevas en es.ts (`music.shortcuts.*`) — quedan listas para el diálogo de ayuda global.

### Fase 9 — Cover art ID3 (⏭️ diferida)

Diferida. Razón: agrega dependencia npm (`jsmediatags` ~30KB) + decisión de persistencia (archivo aparte vs base64 inline) + migración del schema `Track`. El redesign de UI ya cierra; las carátulas son enhancement, no bloquean uso. Entrada formal en `docs/deferred.md` ("Música — Cover art / Waveform ID3"), target "sin asignar". Waveform también difer.

### Fase 10 — Cierre docs (✅)

- `docs/redesign.md`: fila `/music` → ✅ con la idea final.
- `docs/deferred.md`: entradas nuevas para cover art ID3 y waveform (Fase 9).
- `docs/errors.md`: sin cambios — el redesign no introduce throws nuevos. Las paths que pueden fallar (FS, permisos) reusan los códigos existentes (`FS_001`, `FS_003`) vía `ErrorService.report`.
- Complejidad: `onRailDrop` y `onTrackDrop` se redujeron extrayendo helpers puros (`parseTrackDragPayload`, `reorderIds`). Quedan dentro de cap.
- `music.container.ts` en 297 líneas efectivas (warn 200, hard 300). Si una fase futura suma más, extraer `library-table.component` (dumb) sería la siguiente división natural.

## Estado final

Todas las mejoras de scope original están implementadas excepto #8 (cover art / waveform), explícitamente diferida con razón documentada. Este archivo se puede borrar cuando se cierre la próxima iteración de música, o conservarse como referencia histórica del rediseño.
