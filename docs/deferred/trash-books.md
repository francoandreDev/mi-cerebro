# Diferidos — Papelera y books

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Papelera / UI (origen: rediseño de /trash)

### Thumbs reales 2×2 para galerías en la papelera

- **Qué**: la card de galería en `/trash` muestra hoy un mosaico estilizado con íconos de cámara y el contador de imágenes (vía `trash.preview.images`). El objetivo es renderizar el `GalleryCoverComponent` real con hasta 4 thumbnails leídos del dir de la galería en `.mi-cerebro/trash/`.
- **Por qué se difirió**: requiere extender `TrashService` (o `GalleriesService`) con un método que, dado un `TrashEntry` de kind `image`, lea el `meta.json` del dir borrado y devuelva blobs de las primeras N imágenes, más gestión del lifecycle de object URLs en la container (createObjectURL/revokeObjectURL al cambiar visibilidad o desmontar). Es un trabajo cross-feature no trivial para una vista de baja frecuencia. El v1 da el salto visual con cards por kind + countdown + filtros + ops jerarquizadas; la fidelidad fotográfica queda como pulido posterior.
- **Target**: sin asignar.

### Volumen real (`BookVolumeComponent`) para libros en la papelera

- **Qué**: la card de libro en `/trash` muestra hoy un tratamiento tipográfico estilizado (inicial grande + byline) en una caja con aspect-ratio 3/4. El objetivo es reusar el `BookVolumeComponent` real con `accent` del bundle del libro borrado.
- **Por qué se difirió**: requiere leer el `BookBundle` desde el archivo de la papelera para extraer `accent` + cualquier otro metadato necesario por el volumen. Mismo razonamiento que los thumbs: baja frecuencia, no bloquea la UX nueva.
- **Target**: sin asignar.

---

## Books / UI (origen: rediseño de /books)

### Pin/fijado de estantes al tope del bookshelf

- **Qué**: poder "anclar" estantes al tope para que no se muevan del orden alfabético — útil cuando hay muchos estantes y querés acceso rápido a 1-2 frecuentes.
- **Por qué se difirió**: con densidad compacta + colapso el problema de scroll quedó razonable. Pin agrega estado nuevo (set de pinned folders en localStorage), reordering del computed `shelves`, y UI (icono pin en el shelf-head). Vale la pena recién con N>10 estantes; hoy con 1-3 estantes es overkill.
- **Target**: sin asignar — abrir cuando aparezca dolor real de "tengo muchos estantes y los importantes se pierden".
- **Origen**: sesión 2026-06-29 (rediseño /books shelf — mencionado en la propuesta de UX para el problema de espacio, postergado por YAGNI).

### Estantería con forma creativa / no lineal (árbol, curva, etc.)

- **Qué**: el shelf actual es una pared rectangular con tablas horizontales y bookends a los lados — metáfora "biblioteca clásica". Una versión avanzada permitiría layouts no rectangulares: ramas de árbol con shelves angulados, espirales, formas custom que el usuario elija o defina. Las referencias mostradas en la sesión incluían un shelf con forma de árbol (ramas con libros agrupados por copa/tronco) que carga significado adicional ("estos son mis raíces", "estos son los frutos recientes", etc.).
- **Por qué se difirió**: el v1 todavía no resuelve los básicos (legibilidad del lomo, reorden, múltiples estanterías nombradas). El layout creativo agrega complejidad de posicionamiento (cada shelf necesita su propio ángulo + ancla en una grilla 2D), modelo de "shape" persistido, y editor visual para que el usuario configure. Primero hay que pulir la metáfora clásica.
- **Target**: sin asignar — abrir cuando el shelf clásico esté funcional (legible, reordenable, multi-estante) y aparezca demanda real de "quiero mi biblioteca con forma de X".
- **Origen**: sesión 2026-06-29 (rediseño /books shelf — el usuario referenció una estantería en forma de árbol como inspiración).

### IDs de libros legibles / acortados en la URL

- **Qué**: hoy `/books/:bookId/:chapterId` usa UUIDs (`23ad559b-8c33-4817-bf85-2cf8a9eb0af9/35d67ec5-e808-4aaa-b04e-cd9064eda6f9`) — internamente está bien pero externamente es ilegible, impráctico para compartir/recordar y satura la barra del browser. El "patrón id" está extendido a toda la app así que probablemente conviene resolverlo de forma transversal, no sólo en books.
- **Por qué se difirió**: requiere decidir esquema (slug derivado del título con desambiguación numérica, hash corto base36 de 6-8 chars, mapping bidireccional id↔shortId con índice en disco), migración de URLs viejas (¿redirect 301-like?, ¿soportar ambas?), y resolver colisiones cuando dos entidades distintas generan el mismo slug. Decisión cross-feature (notas, tasks, listas, escritos, libros, galerías, etc.) que merece su propio paso de roadmap, no entra en una sesión de UI de books.
- **Target**: sin asignar — sub-paso transversal a definir.
- **Origen**: sesión 2026-06-29 (rediseño /books reader, anotado mientras se enfocaba el espacio desaprovechado en la página).

### Override de imágenes para portada/reverso de libro y miniaturas de capítulo

- **Qué**: los modelos `Book.cover/back` y `Chapter.image` admiten `kind: 'image'` con ref a un archivo blob en disco. Hoy sólo se usa `kind: 'auto'` (procedural: gradiente + glyph derivados del id) y el usuario no puede subir imagen propia.
- **Por qué se difirió**: implementar el picker + storage (`books/<book>/cover.{jpg,png}`, `back.*`, `chapters/<chId>.img.*`), generación de miniaturas (cacheo en IndexedDB tipo `GalleriesService.renderThumb`) y un nuevo código `MCB-IMG-*` para "blob ilegible" es una feature de tamaño propio. Los faces procedurales ya dan identidad visual al libro y al capítulo. Cuando se aborde, basar el flujo en `GalleriesService.addImage` y refactorizar a un helper compartido.
- **Target**: sin asignar — abrir cuando el usuario lo pida o cuando se haga "biblioteca rica con tapas reales".

### Paginación real persistida fila por fila (no global)

- **Qué**: hoy `Chapter.pageCount` se actualiza cuando el editor abre el capítulo (totalSpreads\*2). Capítulos nunca abiertos caen a `ceil(words/250)`. Esto significa que el rango "pag X–Y" del índice puede mentir hasta la primera apertura.
- **Por qué se difirió**: para tener páginas exactas sin abrir el capítulo habría que renderizar el editor en headless al cargar el libro (caro) o derivar la métrica de un cálculo de altura puro sobre el JSONContent (frágil, depende del CSS). Es una optimización para libros viejos que nunca pasaron por el editor v4; libros nuevos se autocorrigen apenas el usuario los abre.
- **Target**: sin asignar.

### Subset + conversión a woff2 de Crimson Pro

- **Qué**: las tres variantes de Crimson Pro viven en `public/fonts/` como `.ttf` (~98KB c/u, ~294KB total). Convertirlas a `.woff2` recortaría ~50% y un subset latin-extended bajaría otro ~30%.
- **Por qué se difirió**: `woff2_compress` no está en el entorno de desarrollo; bajar las versiones woff2 oficiales de Google Fonts requiere ajustar `User-Agent`. Funcionalmente las ttf funcionan idéntico y los 300KB son aceptables para una PWA (se cachean por el SW en el primer boot).
- **Target**: §19.16f.

### Typewriter focus línea-por-línea

- **Qué**: en modo foco actualmente se aplica una máscara CSS que oscurece arriba y abajo de la página. El target ideal es resaltar exactamente la línea/párrafo donde está el cursor (TipTap selectionUpdate → marca block actual con clase, el resto baja a opacity 0.3).
- **Por qué se difirió**: requiere extensión de ProseMirror que actualice el atributo en cada movimiento de cursor. La máscara CSS captura ~70% del efecto sin tocar el editor. Si en uso real se sienta corto, se hace.
- **Target**: §19.16f.

---
