# Diferidos — Música

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Música — WebAudio (origen: redesign-music-v2 Fase 5)

### ~~Error code `MCB-MUS-001` para AudioContext no disponible~~ (resuelto 2026-07-04)

- **Qué**: el `AudioGraph` (`core/music/audio-graph.ts`) caía a `failed = true` y dejaba el analyser en `null` si `AudioContext` no estaba definido o si su construcción tiraba, sin código de error catalogado ni feedback al usuario.
- **Estado**: cerrado. `AudioGraph` acepta un callback `onFailed` invocado en ambos paths de fallo; `PlayerService` lo conecta a `ErrorService.report(new AppError(ERROR_CODES.MUS_001, ...))`. Código `MCB-MUS-001` catalogado en `error.codes.ts` + `docs/errors.md`. El toast genérico de `ErrorService` cubre el feedback — no hizo falta un banner dedicado; la superficie resonante (Fase 8) sigue pendiente y puede sumar su propio estado visual más adelante.
- **Origen**: redesign-music-v2 Fase 5.

---

## Música — Playlists tab (origen: redesign-music-v2 Fases 11–12)

### ~~Drag-and-drop de tracks de la biblioteca a una playlist~~ (resuelto 2026-07-18)

- **Qué**: en v1 las playlists vivían en una columna lateral persistente: el usuario podía arrastrar tracks desde la tabla de biblioteca y soltarlos sobre una fila de playlist para mergearlos. v2 alterna la columna izquierda entre vista "Álbumes" y vista "Playlists" — las dos vistas son mutuamente excluyentes, así que el gesto "arranco un drag desde un álbum y suelto sobre una fila de playlist" no era posible sin un switch de vista en medio del drag.
- **Estado**: cerrado. Se implementó la alternativa que este mismo ítem había descartado como "sin caso de uso claro": auto-switch del tab "Playlists" cuando el drag (ya cableado vía `TRACK_DRAG_MIME`, `album-library.container.ts`) pasa por encima del botón del tab (`onPlaylistsTabDragOver`/`onPlaylistsTabDragLeave` en `music.container.ts`, delay de 350ms tipo auto-expand de carpeta de SO para evitar flicker al pasar de largo). Las filas de `playlists-panel.container.ts` ya son drop target (`onRowDragOver`/`onRowDrop`) y mergean tracks vía `PlaylistsService.addTracks()` — método nuevo, reusado también por el bulk-add por selección de `album-library.container.ts` (antes duplicaba la misma lógica de merge inline). El buscador "+ Añadir canciones" del editor de playlist sigue existiendo como alternativa sin drag. Ronda de pulido posterior (mismo día): el auto-scroll de listas largas durante el drag (necesario para llegar a un track lejos en la biblioteca o a una playlist lejos en su lista) se extrajo de música a `core/dnd/drag-auto-scroll.ts` + `DragAutoScrollService` (arrancado desde `AppShellContainer`, mismo patrón que `ContinuityService`/`AutoPushService`) — un único listener `dragover` a nivel de documento que ubica el ancestro scrolleable bajo el cursor (`elementFromPoint` + walk-up) y lo empuja cerca de sus bordes, en ambos ejes. Queda disponible gratis para cualquier drag-and-drop de la app (music, tasks kanban, bookshelf, museum, chalk layers, file grid), no sólo música.
- **Origen**: redesign-music-v2 Fase 11 (modal) → reafirmado en Fase 12 (tab alternable).

---

## Música — Cover art / Waveform ID3 (origen: redesign-music Fase 9)

### ~~Cover art y duración leídos de ID3 con `jsmediatags`~~ (resuelto, cierre documentado 2026-07-18)

- **Qué**: extraer `picture`, `title`, `artist`, `album` y duración real de cada MP3 al subirlo. Mostrar carátula en Now Playing y como pequeña miniatura en la columna de título de la tabla.
- **Estado**: cerrado. La extracción ID3 (`services/id3-reader.ts`) y la persistencia content-addressed en `music/covers/<sha1>.<ext>` (`services/cover-hash.ts`, `MUSIC_LIBRARY_SCHEMA_VERSION` 2) ya se habían implementado en un paso anterior (commits `ffdff0c`/`472c165`) y Now Playing ya mostraba la carátula real — sólo esta entrada de `deferred/` había quedado sin cerrar (violaba regla 24, doc desactualizada). Lo que sí faltaba y se agregó ahora: la miniatura real en el header de cada grupo de álbum en la biblioteca (`album-library.container.ts`/`.html`) — antes mostraba un ícono genérico `music-note` aunque `AlbumGroup.coverPath` ya existía. Cache de blob URLs por `coverPath` (no por álbum, para no recargar si dos álbumes comparten cover), revocada al desmontar el componente o cuando un `coverPath` deja de estar en pantalla.
- **Origen**: redesign-music Fase 9.

### ~~Waveform pre-renderizado~~ (resuelto, cierre documentado 2026-07-18)

- **Qué**: dibujar la forma de onda en Now Playing y permitir click para seek.
- **Estado**: cerrado. Ya estaba implementado (`services/waveform-cache.service.ts` decodifica con `AudioContext` y cachea peaks por `track.id`; `components/track-waveform.component.ts` dibuja el canvas y soporta click/drag para seek) — no persistido en disco como planteaba la entrada original ("pre-renderizado" al subir), sino decodificado on-demand y cacheado en memoria por sesión, lo cual evita el costo de 3-10s por archivo al subir que la entrada original señalaba como motivo del diferimiento. Sólo esta entrada de `deferred/` había quedado sin cerrar.
- **Origen**: redesign-music Fase 9.

---
