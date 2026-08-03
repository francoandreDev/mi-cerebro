# Entidades

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Cubre el roster completo de tipos de entidad (notas, tareas, metas, listas, escritos, libros, imágenes, archivos): el patrón compartido de servicio y editor, y qué es específico de cada uno. La concurrencia entre pestañas (locks) y las migraciones de schema son transversales a todas — ver [`fundamentos.md`](./fundamentos.md); acá solo se nota cómo cada entidad se integra con esos sistemas.

## El patrón compartido

Notas fue la primera entidad implementada end-to-end y estableció el patrón que copian el resto. Cada entidad tiene:

- **Un servicio de features** (`XxxService`) que expone `refresh` (relee el índice de la entidad desde disco), `create`, `read`, `save` (escritura atómica), `deleteToTrash` (mueve a la papelera en vez de borrar; ver `core/trash`) y `moveToFolder`. El guardado dispara autosave e indexado de búsqueda, y respeta el `schemaVersion` de la entidad (migraciones automáticas al leer, ver [`fundamentos.md`](./fundamentos.md)).
- **Un componente editor-pane** (`XxxEditorPane`) con los campos propios de la entidad más los transversales: tag-picker y body TipTap.
- **Una o más rutas** (`/<entidad>/:id`) registradas en el router.
- **Integración con `EntityLockController`** (parametrizado por `kind`) para la concurrencia entre pestañas — acquire al abrir, release al cerrar o cambiar de ruta, solo-lectura cuando el lock es ajeno. Ver [`fundamentos.md`](./fundamentos.md#concurrencia-entre-pestañas).
- **Integración con la papelera y carpetas**: `TrashKind`/`KIND_DIRS` incluyen la entidad, y `TrashService`, `FoldersService`, `folder-actions` y `tree-node` saben manejar su kind.

La sidebar global (`WorkspaceSidebarContainer`, vive en el layout, no dentro de cada container) ofrece un chip por entidad (`Todo / Notas / Tareas / Metas / Listas / Escritos / Libros / Imágenes / Archivos`), botón de creación, árbol unificado agrupado por entidad y un filtro de texto/dirección compartido (ver [`busqueda-tags.md`](./busqueda-tags.md) para el árbol y la búsqueda). Los containers de cada entidad quedan reducidos al editor pane; solo libros, galerías y colecciones de archivos —al no tener una vista de detalle "plana"— llevan lógica adicional de listado interno (capítulos / grid de items).

A continuación, cada entidad con lo que la distingue del patrón base.

## Notas

Primera entidad end-to-end. Modelo mínimo: `title`, `body` (TipTap), `tags`. Se listan en el árbol, se editan con el editor básico TipTap y se guardan a disco con escritura atómica. `NotesContainer` fue el primer integrador de `EntityLockController` (entonces `NoteLockController`, luego generalizado). Ruta `/notes/:id`.

## Tareas

Modelo `Task`: `done: boolean`, `dueDates: string[]` (fechas ISO, ordenadas ascendente). `TasksService` sigue el patrón compartido. `TaskEditorPane` agrega checkbox `done`, picker de fechas con chips removibles (badge ámbar si la tarea está vencida), tag-picker y body TipTap. La introducción de tasks como segunda entidad fue el punto en que la sidebar se extrajo del container hacia el shell global y el lock controller se generalizó de `NoteLockController` a `EntityLockController` (parametrizable por kind). Ruta `/tasks/:id`.

## Metas

Modelo `Goal`: `deadline: string | null` (un único plazo opcional) y `completed: boolean`. `GoalsService` sigue el patrón compartido. `GoalEditorPane` agrega checkbox `completed`, `DeadlinePickerComponent` de fecha única (chip removible, ámbar si vencida), tag-picker y body TipTap. La sidebar suma el chip `Metas` y el grupo del árbol muestra badge de plazo.

Además, `GoalReminderContainer` vive globalmente en el shell: en cada navegación fuera de `/goals`, con probabilidad 1/4, muestra un banner discreto abajo a la derecha con una meta no completada (prioriza vencidas, luego las que vencen en ≤7 días, luego cualquier pendiente), con acciones para abrirla o cerrarla, y evita repetir la misma meta hasta agotar el pool disponible. Ruta `/goals/:id`.

## Listas

Modelo `List`: solo `title`, `body` (TipTap; el documento vacío arranca con un bullet list para reforzar el formato), `tags` — sin fecha ni estado. `ListsService` sigue el patrón compartido completo, incluyendo `moveToFolder`. `ListEditorPaneComponent` tiene título, tag-picker y body TipTap. Sidebar con chip `Listas`, botón de nueva lista y botón de nueva carpeta. Ruta `/lists/:id`.

## Escritos

Cubre artículos sueltos (forma de archivo único: `writings/<slug>.json`). Modelo `Writing`: `title`, `body` (TipTap; el documento vacío arranca con un párrafo vacío en lugar de bullets, para enmarcar prosa larga en vez de listas), `tags` — sin fecha ni estado. `WritingsService` sigue el patrón compartido completo. `WritingEditorPaneComponent` tiene título, tag-picker y body TipTap. Sidebar con chip `Escritos`, botón de nuevo escrito y botón de nueva carpeta. Ruta `/writings/:id`.

## Libros

Forma "carpeta + capítulos", en un kind separado (`books/`, no anidado bajo `writings/`, para no colisionar con el recorrido de archivo único de escritos).

**Disco:** `books/<carpeta-opcional>/<libro-slug>/_book.json` + `chapters/<capitulo>.json`.

**Modelo:** `Book` con `title`, `tags`, `order: string[]` (ids de capítulo que definen el orden visual, independiente del orden en el file system), `cover`/`back` (`BookFaceRef = {kind:'auto'} | {kind:'image', file}`) y `Chapter` con `bookId`, `title`, `body` (TipTap), `image` (`ChapterImageRef`, misma forma). Por defecto (`kind:'auto'`) portada/reverso/capítulo son procedurales (gradiente/glyph derivados del hash del id); `kind:'image'` apunta a un blob subido por el usuario.

**Servicio:** `BooksService` no sigue el patrón CRUD genérico al pie de la letra porque un libro es una colección de sub-documentos; ofrece `refresh` (recorrido custom que distingue una carpeta-libro por la presencia de `_book.json`), `createBook`, `readBook`, `saveBook`, `deleteBookToTrash` (empaqueta `{book, chapters}` como bundle JSON y borra el directorio), `restoreFromBundle`, `moveBookToFolder`, `bookDirFor`/`chaptersDirFor` (wrappers públicos sobre los resolvers de directorio privados, para que `BookImagesService` no duplique el walk de `findLoc`), y a nivel capítulo `listChapters`, `addChapter`, `readChapter`, `saveChapter`, `removeChapter` (hard-delete, sin pasar por papelera) y `reorderChapters`. La búsqueda indexa el libro y cada capítulo por separado.

**Imágenes de portada/reverso/capítulo:** `BookImagesService` (mismo dominio, servicio aparte para no crecer el ya-grande `BooksService`) guarda el blob subido directo junto al JSON del libro — `cover.<ext>`/`back.<ext>` en la carpeta del libro, `<capituloId>.img.<ext>` en `chapters/` — sin generar thumbnail (a diferencia de galerías: acá cada imagen es una instancia única por libro/capítulo, no una grilla, así que CSS puede escalar el original sin costo real). `setFace`/`clearFace`/`setChapterImage`/`clearChapterImage` actualizan el JSON vía los métodos públicos de `BooksService`; `readFaceBlob`/`readChapterImageBlob` lanzan `MCB-IMG-001` si el archivo referenciado no está en disco. El resize/encode a WebP compartido con galerías vive en `@core/images/render-thumb.util` (`renderThumb`, `guessMimeFromName`) — extraído de `GalleriesService` para que ambos consumidores usen la misma lógica sin que `books` importe de `features/images` (regla 10).

**UI:** `BooksContainer` orquesta un único `EntityLockController('book')` por libro (no uno por capítulo), una book-meta-bar (título + tags + estado + borrar), una chapter-list (mover arriba/abajo, agregar, quitar) y un chapter-editor-pane (título + body). `BookOpenContainer` cachea blob URLs de cover/back/chapter-images vía dos `effect()` sobre `active()`/`chapters()` (revocados en `DestroyRef.onDestroy` y en cada refresh), y expone un picker de archivo + botón de quitar por cara (tapa/contratapa cerradas) y por capítulo (`ChapterIndexCardComponent`, botones en `.ops` junto a mover/borrar). Rutas `/books`, `/books/:id`, `/books/:id/:chapterId`. Sidebar con chip `Libros`, botón de nuevo libro y botón de nueva carpeta.

**Papelera:** al ser una entrada-directorio, `TrashService` tiene una rama especial para `kind === 'book'` (lee el bundle, llama `restoreFromBundle`, purga el archivo); `parseEntry` extrae el título desde `raw.book.title` para bundles.

## Imágenes

Primera entidad con binarios. Forma "carpeta = galería + originales + thumbs" — toda imagen vive dentro de una colección, no hay imagen suelta.

**Disco:** `images/<carpeta-opcional>/<galería-slug>/_gallery.json` + `original/<id>.<ext>` + `thumbs/<id>.webp`.

**Modelo:** `Gallery` con `title`, `tags`, `order: string[]`, `images: GalleryImage[]` (cada una con `id`, `originalName`, `mime`, `ext`, `width`, `height`, `bytes`, `addedAt`).

**Servicio:** `GalleriesService` ofrece `refresh` (recorrido custom por presencia de `_gallery.json`), `createGallery`, `readGallery`, `saveGallery`, `addImage` (escribe el original y genera un thumb WebP de hasta 320px de lado largo vía `OffscreenCanvas`, con fallback al original si `createImageBitmap` falla — resize/encode en `@core/images/render-thumb.util`, compartido con el override de portada/capítulo de libros), `readOriginalBlob`, `readThumbBlob`, `removeImage` (hard-delete del par original+thumb), `reorderImages`, `deleteGalleryToTrash`, `restoreFromDir`, `moveGalleryToFolder`. `FsService` expone para esto `writeFileAtomicBinary(Blob|ArrayBuffer)` y `readFile(): Promise<File>`.

**UI:** `GalleriesContainer` orquesta `EntityLockController('image')`, gallery-meta-bar, un image-grid (thumbs en grid CSS, drop-zone para archivos, reordenar/quitar por imagen) y un image-lightbox (overlay con el original, se cierra con click o Escape). El container administra blob URLs por id de imagen: `thumbUrls` para todas, `originalUrls` de forma lazy al abrir el lightbox, revocadas al destruir. Rutas `/images`, `/images/:id`. Sidebar con rail-icon 🖼 "Imágenes", botón de nueva galería y botón de nueva carpeta.

**Papelera extendida a directorios:** `TrashEntry` tiene un campo `shape: 'file' | 'directory'`; `TrashService.refresh` lista tanto subdirectorios (`image__<id>__<slug>/`) como archivos `.json`; `parseDirEntry` lee el título desde el `_gallery.json` interno; `restore` tiene una rama especial para `kind === 'image'` que mueve la carpeta entera de vuelta a `images/` con un slug libre; `purge` usa `{recursive: true}` para directorios.

**Pegado desde clipboard:** `GalleriesContainer` registra un listener de `paste` en el documento (removido al destruir el componente) que ignora el evento si no hay galería activa, si el lock no es editable, o si el target del evento está dentro de un `input`/`textarea`/`[contenteditable]` (para no robarle el paste a la barra de título o al tag-picker); extrae los archivos de `event.clipboardData.items` filtrando por `kind === 'file'` y `type.startsWith('image/')`, y reusa `onAddFiles(files)`.

**Reordenamiento por drag-and-drop:** compartido entre imágenes, archivos y capítulos de libro (las tres entidades con `order: string[]`) vía el helper `reorderById(order, from, to)` en `@shared/utils/reorder` (mueve `from` al slot de `to`, idempotente si son iguales, tolera ids ausentes). `@shared/utils/dnd` define `MC_INTERNAL_DND_TYPE = 'application/x-mc-id'` y `hasInternalDnd(event)` para distinguir un drag interno de un drop de archivos del sistema operativo (que trae `dataTransfer.files`) sin que colisionen en el mismo grid. Cada grid expone `reorder({from, to})`; el estado visual de arrastre (`draggingId`, `dropTargetId`) es local con signals.

**Imagen-referencia en editores:** cualquier editor TipTap (notas, escritos, capítulos de libro, metas) puede insertar una referencia a una imagen de galería. Las constantes de convención de paths (`IMAGES_DIR`, `GALLERY_META_FILE`, `ORIGINAL_DIR`, `THUMBS_DIR`, `THUMB_EXT`) viven en `@core/images/image-paths` como fuente única; `@core/images/image-reader.service` mantiene un cache `Map<galleryId, {folder, slug, gallery}>` poblado por `GalleriesService` en `refresh`/`createGallery`/`saveGallery`/`moveGalleryToFolder` y limpiado en `deleteGalleryToTrash`. El nodo TipTap `@core/tiptap/image-ref/image-ref.node.ts` es un nodo inline atom con attrs `{galleryId, imageId, alt}`, serializado a `<span data-image-ref data-gallery-id data-image-id data-alt>` (HTML plano, para que copy/paste y la búsqueda no rompan); su NodeView resuelve el thumb (o el original como fallback) vía `ImageReaderService` y arma un blob URL revocado al destruirse. `@shared/editor/image-picker-dialog.component.ts` es el modal de selección (galerías a la izquierda, thumbs a la derecha); `EditorComponent` registra la extensión y muestra el botón "🖼 Insertar imagen" solo cuando el editor es editable y hay galerías disponibles. Como `EditorComponent` es compartido, este wiring alcanza a las cuatro entidades sin tocarlas individualmente.

## Archivos

Segunda entidad con binarios; cierra la familia de adjuntos. Forma "carpeta = colección + items" — todo archivo vive dentro de una colección, igual que imágenes, para mantener uniforme el patrón de papelera-directorio.

**Disco:** `files/<carpeta-opcional>/<colección-slug>/_collection.json` + `items/<id>.<ext>`.

**Modelo:** `FileCollection` con `title`, `tags`, `order: string[]`, `items: FileItem[]` (cada uno con `id`, `originalName`, `mime`, `ext`, `bytes`, `addedAt`, `x?`, `y?`), y `freeLayout?: boolean`. `FILE_COLLECTION_SCHEMA_VERSION = 3` (v3 sólo agrega estos campos opcionales, sin backfill).

**Servicio:** `FilesService` ofrece `refresh` (recorrido custom por presencia de `_collection.json`), `createCollection`, `readCollection`, `saveCollection`, `addFile` (escribe el binario, sin generar thumb), `readBlob`, `removeFile` (hard-delete), `reorderFiles`, `setFreeLayout`, `setItemPosition`, `deleteCollectionToTrash`, `restoreFromDir`, `moveCollectionToFolder`. No hay generación de miniaturas: el grid usa iconos por mime/extensión (📄 PDF, 🎵 audio, 🎬 video, 📦 zip, 📝 texto, 📎 fallback), salvo la vista previa inline descrita abajo.

**UI:** `FilesContainer` orquesta `EntityLockController('file')`, una file-collection-meta-bar (título + tags + estado + borrar) y un file-grid (cards con icono + nombre + tamaño, drop-zone, reordenar/quitar por item). Click en una card descarga el archivo original (blob URL + `<a download>`, revocada después). El header del grid tiene un toggle "Fijar en el corcho" / "Volver a la grilla" (`freeLayout`): en modo grilla el layout es CSS grid con jitter determinista por hash de id (rotación/offset, sin persistir nada); en modo libre cada item se arrastra con pointer events (umbral de 4px para distinguir click de drag, igual patrón que `goal-constellation-editor`) y su posición `x/y` (0-100, porcentaje del tablero) se persiste en el `FileItem` al soltar. Items sin `x/y` (nunca arrastrados) se renderizan con un scatter determinístico por hash — mismo truco que el jitter de grilla — para no apilarse en el origen sin escribir nada a disco hasta el primer drag real. Rutas `/files`, `/files/:id`. Sidebar con rail-icon 📎 "Archivos", botón de nueva colección y botón de nueva carpeta.

**Papelera:** `parseDirEntry` acepta `kind === 'image' | 'file'` y selecciona el meta file correcto (`_gallery.json` vs `_collection.json`) para leer el título; `restore` tiene rama especial para `kind === 'file'`.

**Vista previa inline:** `FilesContainer` mantiene `previewUrls = signal<Record<itemId, string>>({})`. Para cada item con mime `image/*` o `application/pdf`, lee el blob vía `filesService.readBlob` y genera un `URL.createObjectURL`, cacheando URLs existentes y revocando las huérfanas; se recalcula al cargar la colección y tras agregar/quitar items, y se revoca todo al destruir el componente. `FileGridComponent` renderiza `<img>` o `<embed type="application/pdf">` cuando hay preview disponible; el resto de los mimes (audio, video, zip, texto, binarios) sigue mostrando el icono.
