# Música

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Reproductor de música con mini-player global y una sección dedicada `/music`. No es un entity-kind del sistema de entidades: vive como pieza transversal del shell, análoga a calendario/papelera/recordatorios en el rail de navegación.

## Almacenamiento en disco

Carpeta `music/` en el workspace del usuario:

- `music/_library.json` — manifest único: `{ tracks: Track[] }`.
- `music/tracks/<id>.mp3` — binarios de audio.
- `music/playlists/<slug>.json` — un archivo por playlist (estructura flat, sin subcarpetas).

## Servicios

**`MusicLibraryService`** (`features/music/services/`) administra la biblioteca:

- `refresh()` — lee el manifest, tolera su ausencia (biblioteca vacía).
- `addTracks(files)` — filtra por MIME `audio/mpeg` o extensión `.mp3`, escribe cada blob con `FsService.writeFileAtomicBinary` y actualiza el manifest de forma atómica.
- `removeTrack(id)` — borra el archivo y actualiza el manifest.
- `readBlob(id)` — devuelve el `Blob` del track para reproducción o exposición.

**`PlaylistsService`** reusa el patrón flat de persistencia: `refresh` enumera `playlists/*.json`; `create` / `read` / `save` / `delete` sobre una playlist; `removeTrackFromAll(trackId)` limpia referencias colgantes cuando se borra un track de la biblioteca.

## Reproducción — `PlayerService`

`@core/music/player.service` es un singleton root que encapsula un único `HTMLAudioElement`.

Estado en signals:

- `queue: { trackIds, index }`
- `isPlaying`
- `shuffle` (default `true`)
- `currentTrackId` / `currentTrack`

API: `playTrack(id)`, `playPlaylist(trackIds, startIndex)` (si `shuffle` está activo, baraja la cola con `shuffleFrom`, poniendo el track seleccionado al frente), `next()` / `prev()` (módulo de la longitud de la cola ⇒ loop infinito), `toggle()` / `stop()` / `toggleShuffle()`.

El servicio crea y revoca blob URLs por track según se necesitan. El evento `ended` del elemento de audio dispara `next()` automáticamente.

**Por qué `shuffle` default `true`:** la expectativa de producto es reproducción aleatoria en bucle (ver spec §16), no una lista lineal.

## Mini-player global

`MiniPlayerContainer`, en `layout/`, se monta dentro del shell sólo cuando hay `currentTrack`. Es una barra fija en la parte inferior con:

- Título del track (link a `/music`).
- Controles ⏮ ▶/⏸ ⏭.
- 🔀 toggle de aleatorio, resaltado cuando está activo.
- ✕ para detener la reproducción.

## Sección `/music`

`MusicContainer` con grid de 2 columnas:

- **Biblioteca**: subida múltiple de MP3 vía `<input type="file">` oculto, lista de tracks con ▶/⏸ individual, botón "+" para agregar el track a la playlist activa, ✕ para borrar de la biblioteca (dispara `removeTrackFromAll`).
- **Playlists**: lista clickable de playlists + editor de la playlist activa (título editable, ▶ Reproducir, ↑/↓ para reordenar, ✕ por track, borrar playlist).

El sidebar tiene un rail-icon 🎵 "Música" después de ⏰ (recordatorios), con una `RailKey` análoga a calendario/papelera/recordatorios — no es un entity-kind. El sidebar refresca `MusicLibraryService` y `PlaylistsService` en su constructor para que el mini-player tenga tracks disponibles desde el primer arranque de la app.

## Fuera de alcance

Drag-and-drop para reordenar tracks de playlist, papelera para tracks/playlists (el borrado es directo, sin recuperación), formatos de audio distintos de MP3, edición de metadata (tags ID3), duración real del archivo (se persiste `null`), control de volumen, scrubbing sobre la timeline de reproducción.
