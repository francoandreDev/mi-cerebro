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

### Drag-and-drop de tracks de la biblioteca a una playlist

- **Qué**: en v1 las playlists vivían en una columna lateral persistente: el usuario podía arrastrar tracks desde la tabla de biblioteca y soltarlos sobre una fila de playlist para mergearlos. v2 alterna la columna izquierda entre vista "Álbumes" y vista "Playlists" — las dos vistas son mutuamente excluyentes, así que el gesto "arranco un drag desde un álbum y suelto sobre una fila de playlist" no es posible sin un switch de vista en medio del drag.
- **Por qué se difirió**: la alternativa accesible (auto-switch de tab al pasar el drag sobre el tab "Playlists", o un mini-rail flotante de playlists durante el drag) ramifica la UX sin caso de uso claro. La acción equivalente sigue cubierta sin DnD por la vista del editor de playlist (`mc-playlist-editor` → "+ Añadir canciones" con buscador), así que no se pierde la operación, sólo la conveniencia del drag global.
- **Target**: sin asignar — abrir si el flujo "agregar tracks a playlist desde la biblioteca" se siente lento en uso real.
- **Origen**: redesign-music-v2 Fase 11 (modal) → reafirmado en Fase 12 (tab alternable).

---

## Música — Cover art / Waveform ID3 (origen: redesign-music Fase 9)

### Cover art y duración leídos de ID3 con `jsmediatags`

- **Qué**: extraer `picture`, `title`, `artist`, `album` y duración real de cada MP3 al subirlo. Mostrar carátula en Now Playing y como pequeña miniatura en la columna de título de la tabla.
- **Por qué se difirió**: agrega una dependencia npm (~30KB) + decisiones de persistencia (carátula como archivo aparte en `music/covers/<id>.<ext>` vs base64 inline en `_library.json`) + migración del schema de `Track` para nuevos campos opcionales. El layout 3-zonas, drag-and-drop, bulk actions, cola y atajos ya cierran el redesign de UI; las carátulas son enhancement visual, no bloquean uso.
- **Target**: sin asignar — abrir cuando se planifique fase de "música rica" o cuando el usuario explícitamente lo pida.

### Waveform pre-renderizado

- **Qué**: dibujar la forma de onda en Now Playing y permitir click para seek.
- **Por qué se difirió**: implica decodificar todo el MP3 en `AudioContext` al subir (costo: ~3-10s por archivo) y persistir el peak array. Bonito pero pesado para una PWA personal.
- **Target**: sin asignar — junto con cover art si se hace fase de "música rica".

---
