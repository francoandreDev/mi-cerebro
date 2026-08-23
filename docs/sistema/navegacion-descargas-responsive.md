# Navegación, descarga de MP3 y soporte responsive

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Cubre tres áreas del shell y las features de detalle: rutas de detalle con slug legible, descarga de MP3 desde YouTube en `/music`, y el tratamiento responsive del shell y las pantallas principales.

## Rutas de detalle con slug legible

Las 8 entidades con ruta de detalle (notes/tasks/goals/lists/writings/books/images/files) navegan con un segmento de URL legible en vez del UUID crudo: `/kind/<slug-del-título>-<id>`. `/books/:id/:chapterId` sigue el mismo patrón en ambos segmentos (`/books/<slug-libro>/<slug-capítulo>`).

El helper vive en `core/routing/entity-slug.ts`:

- `entitySlugSegment(title, id, fallback?)` arma `<toSlug(title)>-<id>`, con el mismo `toSlug()` de normalización que ya usa el filesystem (ver `filesystem.md` §8). El **id va completo, no truncado** — el componente de detalle sigue resolviendo por el UUID completo embebido en el segmento; el slug es cosmético/mnemónico, no reemplaza al id como fuente de verdad, así que renombrar el título no rompe links guardados.
- `extractEntityId(segment)` matchea un UUID v4 al final del string y devuelve ese grupo; si no matchea nada devuelve el string completo tal cual. Esto da compatibilidad automática con links viejos que eran el UUID crudo sin slug — el regex los trata como "el UUID al final" del segmento.

Todos los containers de detalle (`notes`/`tasks`/`goals`/`lists`/`writings`/`images`/`files`.container.ts, más `book-open`/`book-reader`.container.ts) extraen el id real con `extractEntityId()` antes de pasarlo a los servicios; `book-reader.container.ts` lo aplica por separado a `id` y `chapterId`. Todo call site que arma una URL de detalle (wall/shelf/garden/index containers, atajos de creación del sidebar, `kind-routes.ts#routeFor` usado por el command palette, `calendar-event.types.ts#eventRoute`, el link cruzado goal↔reminder del toast) construye el segmento con `entitySlugSegment(title, id)`, usando el mismo fallback por kind que ya usa `toSlug()` puertas adentro (`'libro'`/`'galeria'`/`'coleccion'`/`'capitulo'`, default `'nota'`). `kind-routes.ts#parseDetailUrl` (usado por `PaletteRecentsService` para trackear visitas recientes) pasa el segmento por `extractEntityId()` en vez de asumirlo id crudo.

### Resolución robusta en reload

Cada `*Service` mantiene un mapa en memoria (`idToLoc`/`idToPath`, UUID → carpeta/slug real en disco) poblado por `refresh()`. Dos piezas lo hacen confiable sin persistirlo:

- **Fallback de re-walk.** `NotesService`/`TasksService`/`GoalsService`/`ListsService`/`WritingsService` ya tenían `findPath(id)`, que re-camina el filesystem si el id no está en caché. `BooksService`/`GalleriesService`/`FilesService` (directorio-por-entidad, no archivo-plano) suman el mismo patrón con `findLoc(id)` + `walkForLoc()` privados que buscan el meta file (`_book.json`/`_gallery.json`/`_collection.json`) cuyo `id` interno matchea, sembrando `idToLoc` en cada acierto. `requireLoc()` (que tiraba `MCB-FS-003` directo si el id no estaba cacheado) se eliminó; sus call sites pasan a `await findLoc(id)`. El caso "id no existe ni tras el re-walk" (borrado real) usa el código nuevo `MCB-FS-008`, dejando `MCB-FS-003` reservado sólo para cuando la carpeta raíz del workspace realmente no está.
- **Resolver de boot.** `entityReadyResolver` (`core/fs/entity-ready.guard.ts`, `ResolveFn<boolean>`) espera a que `WorkspaceService.state` se asiente en un estado terminal y, si es `ready`, awaitea `WorkspaceRefreshService.ensureReady()` — que dedupea contra el boot de `WorkspaceSidebarContainer` (primer llamador dispara el walk real y cachea la promesa en vuelo; llamadores concurrentes esperan la misma promesa). Cableado en las 8 rutas de detalle vía `resolve: { ready: entityReadyResolver }`. `refreshAll()` (sin dedupe, usado tras un checkout de variant y por el resync manual de `/settings`) sigue existiendo para forzar un re-walk real, y también marca `ready = true` al completar.

**Nota de alcance:** el mapa `id → ruta` sigue siendo in-memory por servicio, no persistido en el índice. `findPath()` de las 5 entidades archivo-plano y `BooksService#findChapterFile` todavía usan `MCB-FS-003` para "id no encontrado tras el walk" (mismo antipatrón que sólo se corrigió en `bookDir`/`requireLoc` de las 3 entidades directorio-por-entidad) — deuda conocida, registrada en `docs/deferred/index.md`.

## Descarga de MP3 desde YouTube

Disponible en `/music` (`AlbumLibraryContainer`): un input + botón junto al botón "Subir MP3" existente. El usuario pega un link de YouTube; en Tauri/Capacitor el botón dice "Descargar" y el track entra a la biblioteca auto-organizado (título del video → `originalName`), sin pasar por el picker de archivos. En navegador (donde no se puede spawnear procesos, §4.14) el mismo botón dice "Generar comando" y abre `YoutubeCommandModalComponent` en vez de descargar.

`features/music/services/youtube-download.service.ts` expone:

- `isAvailable()` — gate por `PlatformService.current` (`'tauri'` o `'capacitor'`), doble-chequeado también dentro de `download()` como defensa en profundidad. En navegador nunca se llama a `download()`; `AlbumLibraryContainer` bifurca en el template según `youtubeAvailable`.

### Generador de comando (navegador)

`features/music/components/youtube-command-modal.component.ts` (+ `.html`/`.css`) es un modal que arma, en el cliente, un script listo para copiar y pegar en la terminal del usuario — la única vía real de descargar en navegador, dado que la Web Platform no permite ejecutar binarios. La lógica de armado del script vive separada en `features/music/utils/youtube-command.ts` (funciones puras, sin Angular):

- **Opciones del modal:** formato (audio MP3 / video MP4), carpeta de destino, nombre de archivo (opcional — sin valor usa `%(title)s` de yt-dlp), y terminal (PowerShell / bash), cada combinación regenerando el script vía `computed()`.
- **Script generado:** invoca `yt-dlp` (mismo binario/flags conceptuales que el sidecar de Tauri — `-x --audio-format mp3` para audio, `-f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4` para video) contra la carpeta y nombre elegidos. Antes de la descarga, chequea con `Get-Command`/`command -v` si `yt-dlp` y `ffmpeg` están instalados; si falta alguno, imprime instrucciones de instalación por gestor de paquetes (`winget`/`scoop`/`pip` en Windows, `apt`/`brew`/`pip` en Linux/macOS) y corta con `exit 1` en vez de fallar a mitad de la descarga. Un comentario al inicio del script documenta el método alternativo (binario estático de la página de releases de yt-dlp) para cuando ninguno de los gestores de paquetes está disponible.
- **Copiar:** `navigator.clipboard.writeText()`; si falla (permisos del navegador), el `<pre>` sigue seleccionable a mano — sin fallback adicional.
- No hay llamada a red ni ejecución de nada del lado de la app — el script es texto, coherente con §4.14 (cero red no iniciada por el usuario).
- `isValidUrl()` — regex sobre `youtube.com/watch?v=` / `youtu.be/`.
- `download(url)` — orquesta la extracción y devuelve el archivo a `MusicLibraryService.addTracks`, que reusa el pipeline existente (ID3, cover, write atómico) sin código adicional.

**En Tauri:** tres binarios sidecar (`yt-dlp`, `ffmpeg`, `ffprobe`, declarados en `bundle.externalBin`, capability `shell:allow-execute` con scope de sidecar) no se commitean al repo — se traen con `scripts/fetch-yt-dlp.mjs`/`fetch-ffmpeg.mjs` antes de build/dev. `yt-dlp` corre dos veces vía `Command.sidecar`: una rápida sólo para el título (`--skip-download --print "%(title)s"`) y otra real (`-x --audio-format mp3 --audio-quality 0 --ffmpeg-location <path>`) que escribe a un temporal nombrado con `crypto.randomUUID()`. `ffmpeg`/`ffprobe` no los invoca la capa JS — son subprocesos que `yt-dlp` spawnea directo vía `--ffmpeg-location`, sin necesitar capability propia. Ambas corridas pasan `--extractor-args youtube:player_client=android` para evitar el desafío de cifrado de firma del cliente `web` (que requeriría un runtime JS extra). La ruta de los sidecars se resuelve con el comando Rust `sidecar_path(name)`, que busca primero el nombre pelado (`ffmpeg[.exe]`, sin sufijo de target-triple — así es como Tauri los copia junto al ejecutable) y cae al prefijo `"<name>-"` como fallback.

**En Capacitor:** plugin propio `YoutubeDlPlugin` (Android, `@CapacitorPlugin(name = "YoutubeDl")`) respaldado por `youtubedl-android` (bundlea yt-dlp sobre runtime Python + ffmpeg nativo por ABI — Android no permite spawnear binarios arbitrarios fuera del sandbox de la app). Escribe al cache dir privado y devuelve el mp3 como `base64` (el WebView no tiene acceso a rutas `file://` del sandbox nativo); `YoutubeDownloadService.downloadCapacitor()` decodifica con `atob` + `Uint8Array`. La corrida real en dispositivo/emulador queda pendiente de verificación manual (sin Android SDK en este entorno de desarrollo).

Códigos de error: `MCB-MUS-002` (plataforma no soportada — sólo aplica a browser), `MCB-MUS-003` (URL inválida), `MCB-MUS-004` (yt-dlp/ffmpeg/ffprobe fallaron, o causas nativas del lado Capacitor).

## Responsive mobile

La convención general de breakpoints (desktop-first, sin token centralizado, `@media (max-width: …)` hardcodeado por componente) está documentada en `reglas.md` §4.6.14. `480px` es el valor de facto para "viewport de celular" en las pantallas de este alcance, salvo donde ya existía un breakpoint más laxo para ventana angosta de escritorio (600-1280px).

### Rail global

El rail de íconos del shell (`workspace-sidebar.container.ts`) deja de estar siempre visible por debajo de 480px: se reemplaza por una barra inferior de un solo botón (`.mobile-toggle`, ícono + label de la sección activa) que al tocarse abre el rail como grilla overlay de 4 columnas (`repeat(4, minmax(0, 1fr))` — el mínimo automático de un track de grid es `auto`, no `0`, así que hace falta forzarlo) con backdrop semitransparente, cerrable por click-fuera o Escape. El signal `mobileMenuOpen` se resetea a `false` en cada `goTo()`. `app-shell.container.ts` apila `.shell` en columna bajo 480px, con el contenido arriba y el rail como barra fija de 56px abajo.

### Pantallas con tratamiento responsive dedicado

Home, Notes, Tasks, Goals, Files, Tags, Trash, Images, Bookshelf/book-reader, Variants + Merge, Calendar, History, Music, Settings, Sync y Writings-shelf tienen al menos un `@media` cubriendo overflow horizontal y contenido cortado en viewports de celular. Patrones recurrentes: grillas con mínimo fijo que exceden el contenedor angosto colapsan a `1fr`; paneles con `min-width` fijo (modales, buscadores) lo pierden bajo el breakpoint; vistas de comparación lado-a-lado (Merge) o de columnas fijas (Calendar, History por modo de zoom) usan scroll horizontal (`overflow-x: auto` + `min-width`) en vez de aplastar el contenido hasta volverlo ilegible.

**Reminders** ya tenía la mejor cobertura previa (breakpoint a 960px que convierte el panel de detalle en bottom-sheet) y no requirió cambios.

### Pendiente

- **Goals**: la verificación visual quedó parcial por una falla del bridge de navegador en la sesión de trabajo — revisar en dispositivo real antes de darlo por cerrado del todo.
- **Files** y las 5 pantallas de la primera pasada sin `@media` previo (Tasks/Goals/Files/Tags/Trash/Images/Bookshelf): el cambio sigue el patrón ya verificado visualmente en otras pantallas, pero varias quedaron sin confirmación visual final por el mismo problema de bridge.
- **History**: el fix cubre sólo overflow básico (columnas fijas de los 3 modos de zoom colapsan a `1fr`); no replica el comportamiento fino de cada modo (rail de switcher en strata, aside en panorama) en mobile — pendiente una pasada de diseño dedicada por modo, registrada en `docs/deferred/index.md`.
- **Music**: sin verificar si los sub-componentes internos (`album-library`, `now-playing`, `playlist-editor`, `queue-panel`, `resonant-surface`, ninguno con `@media` propio) rompen dentro de la columna única a la que colapsa `.zones`.
- El mobile real vía navegador (Chrome Android) no soporta `showDirectoryPicker`; la vía mobile funcional para escritura en el FS es el empaquetado Capacitor.
