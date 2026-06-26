# Redesign `/music` v2 — bitácora

Persistencia de la v2: membrana/superficie resonante con waveform real, biblioteca de álbumes ID3, cola lateral, playlists en modal. Convive con `docs/redesign.md` (índice general) y con la bitácora de la v1 ya cerrada (`docs/redesign-music.md`, hist órica). Este archivo se elimina cuando `/music` quede ✅ en `docs/redesign.md`.

## Decisiones de diseño cerradas

- **Biblioteca = álbumes ID3 reales.** No se renombran playlists como álbumes (la UI mentiría). Reactiva el alcance que estaba diferido en la v1 (fase 9). Lib: `jsmediatags` (~30KB).
- **Tracks sin metadata** → bucket "Sin álbum" honesto al final, no se inventa carátula.
- **Playlists** se mueven a un modal accesible desde el rail/atajo. Siguen existiendo y editables; sólo dejan de ocupar columna.
- **Portada faltante** → placeholder genérico claramente vacío. Sin carátulas inventadas.
- **Variante visual del centro:** arrancar por pileta con ondas concéntricas (pipeline FFT+canvas modular, Chladni después como swap del componente de dibujo). Menos fricción a futuro.
- **Persistencia de portadas:** archivo separado en `music/covers/<sha1-de-bytes>.<ext>`. Dedup por hash de contenido (tracks del mismo álbum reusan archivo). Tracks apuntan vía `coverPath` relativo. JSON queda chico, blob URL para mostrar.
- **Migración de schema:** `MusicLibrary.schemaVersion: 2`. Backfill lazy en `refresh()` para tracks existentes (lectura ID3 batched, escritura JSON al final).

## Audit del estado base (2026-06-26)

- `Track` actual: `id, originalName, addedAt, bytes, durationMs, playCount?, lastPlayedAt?`. Cero metadata musical.
- `MusicLibrary` sin `schemaVersion`. Persistido en `music/_library.json`.
- Archivos en `music/tracks/<id>.mp3`.
- `PlayerService` tiene `HTMLAudioElement` privado, no expuesto. Para FFT/waveform hay que sumar `AudioContext` + `MediaElementAudioSourceNode` + `AnalyserNode`. Gotcha: `AudioContext` necesita user gesture; `restoreFromStorage` queda paused hasta primer play.
- Layout actual (v1): `playlists rail | biblioteca/editor | now-playing+cola`. v2 cambia a `biblioteca-álbumes | superficie+waveform+metadata | cola`.

## Plan de fases (orden multi-sesión)

Principio: cada fase termina con la app **funcionando**. Las fases de datos/persistencia van primero para no rehacer UI dos veces.

| #   | Fase                                                                                                  | Estado        |
| --- | ----------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Schema migration: Track gana campos opcionales + `MusicLibrary.schemaVersion: 2` + lectura backcompat | ✅ 2026-06-26 |
| 2   | Infra cover: `sha1(blob)` + helpers de FS para `music/covers/`                                        | ✅ 2026-06-26 |
| 3   | ID3 extractor (`jsmediatags`) + hook en `addTracks` (imports nuevos completos)                        | ✅ 2026-06-26 |
| 4   | Backfill batched en `refresh()` para tracks viejos                                                    | ✅ 2026-06-26 |
| 5   | WebAudio en `PlayerService`: AudioContext lazy + AnalyserNode expuesto                                | ✅ 2026-06-26 |
| 6   | Layout reflow a 3 columnas finales con placeholders                                                   | ⏳ pendiente  |
| 7   | `album-library.component` (izq): agrupar + search + click → cola                                      | ⏳ pendiente  |
| 8   | `resonant-surface.component` (centro arriba): canvas 2D + pileta + RAF + analyser                     | ⏳ pendiente  |
| 9   | Centro abajo: waveform real + metadata + progreso + portada                                           | ⏳ pendiente  |
| 10  | Cola a columna derecha (reubicación, no rewrite)                                                      | ⏳ pendiente  |
| 11  | `playlists-modal.component` reusando editor existente                                                 | ⏳ pendiente  |
| 12  | Pulido + `errors.md` + `deferred.md` + marcar ✅ en `docs/redesign.md`                                | ⏳ pendiente  |

## Razones del orden

- **1→4 primero (datos):** si dejo el schema para el final, rehago UI dos veces. Cada fase de datos termina con la app funcionando y la biblioteca igual o mejor.
- **5 antes de 6:** el pipeline de audio es independiente del layout, pero tenerlo listo cuando se monta la zona central evita ir y volver al servicio.
- **6 reflowa una vez:** placeholders en las 3 zonas; las fases 7-10 sólo reemplazan in-place.
- **11 (playlists modal) al final:** hoy las playlists funcionan; sólo cambian de lugar. Postergar reduce riesgo.

## Checklist al cerrar cada fase

- Actualizar el estado de la fila en la tabla (⏳ → 🚧 → ✅, fecha).
- Notas breves debajo (decisiones, archivos clave creados/modificados).
- Si una mejora se descarta o difiere → entrada en `docs/deferred.md` y nota acá.
- Si hay códigos de error nuevos → `docs/errors.md` antes de mergear.
- App tiene que quedar navegable. No mergear estados intermedios rotos.

## Notas por fase

### Fase 1 — schema migration (2026-06-26)

- `Track` ahora admite (opcionales) `title`, `artist`, `album`, `albumArtist`, `year`, `trackNumber`, `discNumber`, `genre`, `coverPath`, `metadataProbedAt`. Todos undefined para tracks legacy hasta que el backfill de Fase 4 los rellene.
- `MusicLibrary` gana `schemaVersion: number` (obligatorio en runtime); el JSON legacy sin la clave se interpreta como v1 y se migra al leer.
- `MUSIC_LIBRARY_KIND = 'music-library'`, `MUSIC_LIBRARY_SCHEMA_VERSION = 2`. Constante `COVERS_DIR = 'covers'` agregada para Fase 2.
- Migración `musicLibraryV2MigrationStep` (no-op semántico: bump de version + defensivo `tracks: []`). Registrada en `MusicLibraryService` constructor.
- `refresh()` ahora hace `migrations.migrate()` antes de set; las cuatro escrituras de library setean `schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION`.
- Archivos: `models/music.types.ts`, `services/music-library.migration.ts` (nuevo), `services/music-library.service.ts`.
- Sin entradas a `errors.md` (reusa MIG\_\*). Sin entradas a `deferred.md`.

### Fase 2 — cover infra (2026-06-26)

- `services/cover-hash.ts` (nuevo): `sha1Hex(blob)` (SubtleCrypto SHA-1 → hex) y `extFromMime(mime)` (acepta jpg/png/webp/gif, otros → null).
- `MusicLibraryService.storeCover(blob, mime)` → escribe en `music/covers/<sha1>.<ext>` si no existe (dedup por contenido), devuelve `coverPath` relativo (`covers/<sha1>.<ext>`) o null si mime no soportado.
- `MusicLibraryService.readCoverBlob(coverPath)` → null si el path no es `covers/<file>` o si el archivo no existe; sino Blob.
- Decisión: el cover store vive como métodos de `MusicLibraryService` en vez de servicio aparte. Comparten el handle de `music/` y Fase 3 (`addTracks`) los llama desde el mismo contexto.
- Mime no soportado (jpg/png/webp/gif son los esperados de ID3 APIC) → devolvemos null y el caller deja el track sin coverPath. No se lanza error: en Fase 3 esto es un "no probamos cover" honesto (placeholder en UI).
- Archivos: `services/cover-hash.ts` (nuevo), `services/music-library.service.ts`.
- Sin entradas a `errors.md`/`deferred.md`.

### Fase 3 — ID3 extractor + hook en addTracks (2026-06-26)

- `package.json`: dep `jsmediatags@3.9.7`, devDep `@types/jsmediatags`.
- `services/id3-reader.ts` (nuevo): `readId3(file): Promise<Id3Result | null>`. Promisifica `jsmediatags.read`; on error/throw devuelve null (track queda sin metadata, honesto — "Sin álbum"). Lee shortcuts (`title`/`artist`/`album`/`genre`/`year`/`track`/`picture`) y frames `TPE2` (albumArtist) y `TPOS` (discNumber) por bracket access. `year` se parsea con regex `\d{4}`, `track`/`disc` con primer `\d+` (acepta formato `5/12`). `picture` se convierte a Blob (`{blob, mime}`) usando `Uint8Array` desde `picture.data` (number[]).
- `addTracks` en `MusicLibraryService`: tras `probeDurationMs`, llama `readId3(file)`. Si hay `picture`, llama `storeCover(blob, mime)` (Fase 2). Spread condicional para no escribir keys `undefined` en JSON. Setea `metadataProbedAt: now` siempre (probamos; otra cosa es haber encontrado algo).
- Tracks que no tienen ID3 → todos los campos opcionales quedan ausentes; `metadataProbedAt` se setea igual (probamos honestamente). El backfill de Fase 4 sólo correrá sobre tracks legacy sin `metadataProbedAt`.
- Sin entradas a `errors.md` (los failures de parser ID3 son no-op silenciosos, no errores del sistema). Sin entradas a `deferred.md`.
- Archivos: `package.json`, `bun.lock`, `services/id3-reader.ts` (nuevo), `services/music-library.service.ts`.
- **Hotfix bundler (mismo día):** Vite no resolvía `jsmediatags` porque el `browser` field de su `package.json` apunta a `dist/jsmediatags.js` (no existe en el tarball; sólo está el `.min.js`). Cambiamos el import a la ruta UMD explícita `jsmediatags/dist/jsmediatags.min.js` y agregamos shim `src/types/jsmediatags-shim.d.ts` que re-exporta el tipo default desde el paquete bare para que TS siga viendo la firma tipada. Sin impacto en runtime.

### Fase 4 — backfill batched en refresh (2026-06-26)

- `MusicLibraryService.refresh()` ahora corre `backfillMetadata(root, tracks)` después de la migración. Si el método devuelve tracks actualizados, se reemplaza `lib.tracks` antes de ordenar y publicar al signal.
- `backfillMetadata` (privado): filtra tracks sin `metadataProbedAt` (legacy v1), por cada uno verifica que el `.mp3` exista en `tracks/`, lee el blob desde FS, llama `readId3`, opcionalmente `storeCover`, y acumula updates en un `Map<id, Track>`. Al final reescribe la library JSON una sola vez con el array reconstruido (`tracks.map(t => updates.get(t.id) ?? t)` preserva orden).
- Failure por track (FS read throw, mp3 ausente) → `console.warn` y skip; el track queda como estaba y se reintenta en el próximo `refresh()`. Failure de `readId3` ya devuelve `null` (Fase 3) → el track gana `metadataProbedAt` honesto sin metadata, no se reintenta.
- Sin entradas a `errors.md` (los failures de FS/parser son no-ops silenciosos, ya capturados por logs de capa inferior cuando corresponde). Sin entradas a `deferred.md`.
- Archivos: `services/music-library.service.ts`.

### Fase 5 — WebAudio en PlayerService (2026-06-26)

- `core/music/audio-graph.ts` (nuevo): clase `AudioGraph` que envuelve el ciclo `AudioContext` → `MediaElementAudioSourceNode` → `AnalyserNode` → `destination`. `fftSize: 2048`, `smoothingTimeConstant: 0.8`. Expone `analyser: Signal<AnalyserNode | null>` (null hasta que el grafo se haya inicializado). Method `ensure()` idempotente: crea el grafo en la primera llamada, en posteriores sólo hace `resume()` si el contexto quedó suspendido por el navegador.
- `PlayerService.analyser` re-exporta la signal del grafo. Listo para que Fase 8 (resonant-surface) y Fase 9 (waveform real) la consuman sin tocar el servicio.
- `ensure()` se invoca sólo desde paths con gesto del usuario: `toggle()` cuando viene de pausa, y `loadCurrent(autoPlay=true, …)` (que cubre `playTrack`, `playPlaylist`, `next`, `prev`, `jumpTo`). `restoreFromStorage` llama `loadCurrent(false, currentTime)` → el grafo **no** se inicializa al boot, respetando la regla de "AudioContext sólo tras user gesture" del audit. La cola queda restaurada y paused; el primer play del usuario monta el grafo.
- Gotcha resuelto: `createMediaElementSource` intercepta el output por defecto del `<audio>`; **siempre** hay que conectar el analyser a `destination` o se corta el sonido. Cubierto dentro del `ensure()`.
- Failure honesto: si `AudioContext` no está definido (caso teórico fuera de Chromium) o si el constructor tira, `failed = true` y el analyser queda `null` para siempre. La música igual reproduce porque el flag se setea **antes** de crear el `MediaElementAudioSourceNode` — sin source node, el audio sigue por el path por defecto. Log a consola, sin toast: la UI de Fase 8 leerá `analyser() === null` como "sin visualización" y lo mostrará así (no miente).
- Sin error code nuevo: el branch es no-fatal y no hay UI todavía que pueda surface el código con feedback. Cuando Fase 8 monte la superficie, se decide si vale crear `MCB-MUS-001` con banner contextual. Entrada en `docs/deferred.md` (sección Música).
- Sin cambios en `PROYECTO.md`: la fase implementa una pieza ya prevista del rediseño, no muta decisión arquitectónica.
- Archivos: `core/music/audio-graph.ts` (nuevo), `core/music/player.service.ts`.
