# Export ZIP, temas custom, focus mode y empaquetado nativo

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Cubre el backup descargable en ZIP, el sistema de temas custom con validación WCAG, algunos pulidos generales de UI que quedan como hechos permanentes, el modo pantalla completa de edición, y el empaquetado nativo (Tauri desktop + Capacitor mobile) que envuelve la SPA.

## Export ZIP

Backup descargable del workspace completo, pensado para mover la data a otra máquina, archivarla, o entregarla a otra persona sin depender del File System Access API. Vive como una sección "Exportar" en `/settings` (no tiene ruta dedicada) con tres checkboxes:

- `includeAllVariants` (default `false`) — si está activo, incluye `.git/` entero (historial + variantes + ramas `comments`/`draft`). Si está apagado, el ZIP es un snapshot plano del `main` actual de la variante activa.
- `includeAssets` (default `true`) — incluye `files/`, `images/`, `music/`. Si está apagado, el ZIP queda liviano, sólo con metadata y texto en JSON (notes, tasks, goals, etc.).
- El árbol `.mi-cerebro/` (config, `settings.json`, índices) siempre se incluye — sin él el ZIP no es restaurable como workspace.

`ExportZipService` (`core/export/`) recorre el root con `FsService` + `walkEntities`, filtra según las opciones, junta cada archivo en memoria como `Uint8Array` y arma el ZIP con **fflate** (~8KB gzipeado, sin dependencias, streaming friendly). La descarga se dispara con un `<a href={blob:URL} download>` programático; el nombre de archivo sigue el patrón `mi-cerebro-${rootName}-${YYYY-MM-DD-HHmm}.zip`.

Progreso: signal `progress: {phase: 'idle'|'walking'|'compressing'|'done', count, total}`, consumido por la UI para mostrar "Procesando N/M archivos…" en vez de un spinner ciego.

Helpers puros testeables sin DOM, en `export-zip.ts`: `buildZipFilename(rootName, now)`, `shouldIncludeEntry(path, opts)`, `partitionFiles(files, opts)`.

La operación es 100% local (sin red — ver §4.14 en [`reglas.md`](../proyecto/reglas.md)). No hay restore automático desde la app: el usuario descomprime el ZIP manualmente en una carpeta nueva y la abre con el picker normal del onboarding. Restore automático queda diferido, ver `docs/deferred/index.md`.

### Errores

- `MCB-EXP-001` — lectura del FS falló a mitad del recorrido.
- `MCB-EXP-002` — fflate falló al comprimir.
- `MCB-EXP-003` — no hay workspace listo para exportar.

## Temas custom

El usuario puede personalizar el matiz del fondo y el color de acento del tema, además de asignar colores custom a tags individuales (que por default salen de un hash determinístico del label).

**Fondo:** la luminosidad se mantiene fija por tema (light L≈0.78, dark L≈0.085) para preservar el contraste mínimo contra `--mc-fg-primary`; el usuario sólo controla el matiz (slider 0-360°) y un nivel de saturación discreto (`low | mid | high`).

**Acento:** paleta cerrada de 12 swatches curados. Cada swatch trae variante `light`/`dark` y un color de texto (blanco o casi-negro) pre-validado contra AA — no hay selector de color libre, para que la validación de contraste no dependa de que el usuario elija bien.

**Colores de tag:** paleta separada de 12 swatches, también con variante light/dark, cada una ≥3:1 de contraste contra su respectivo fondo. Se editan desde un mini-picker inline en `mc-tag-picker`: click en el dot del chip abre una grilla de swatches; un botón "✕" vuelve al color hash determinístico. El schema de `Tag` suma el campo aditivo `colorSwatchId?: string` (sin bump de versión).

**Validación WCAG:** AA como mínimo exigido, AAA como preferido. Un badge en vivo en `/settings` muestra el ratio de contraste del acento contra su color de texto. El warning de contraste es informativo (inline en la UI), nunca bloquea la elección ni se muestra como toast — no hay código de error asociado, porque toda la paleta ofrecida ya está pre-validada; el warning sólo cubre combinaciones fuera de la paleta cerrada si llegaran a existir.

**Persistencia:** `Settings.theme.customBgHue` / `customBgSatLevel` / `customAccentId`, todos opcionales (`undefined` = default del tema). `ThemeService` aplica los overrides como CSS custom properties vía `style.setProperty` sobre `<html>`, reactivo al tema resuelto.

**Helpers puros** (con specs que verifican que cada entrada de paleta cumple su umbral WCAG contra el tema correspondiente):

- `core/theme/wcag.ts` — `parseHex`, `contrastRatio`, `levelOf`, `hslToHex`.
- `core/theme/theme-palette.ts` — `ACCENT_PALETTE`, `TAG_SWATCHES`, `computeBgHex`, `deriveBgScale`, `reportContrast`.

## Continuidad de sesión y atajos

- **Continuidad de ruta y scroll.** `core/continuity/continuity.service` persiste la última ruta visitada en `localStorage` (`mc.continuity.lastRoute.v1`) en cada navegación, y un mapa de posición de scroll por ruta en `sessionStorage` (`mc.continuity.scroll.v1`, efímero por pestaña). Al bootear en `/`, la app navega a la última ruta guardada (fallback a `/notes`). El mapa de scroll está acotado a las últimas 50 rutas (FIFO).
- **Paleta de comandos con historial.** La paleta de comandos (`Ctrl+K`) navega correctamente a los 9 kinds de entidad (antes sólo cubría notas) vía el helper puro `core/search/kind-routes.ts` (`routeFor(kind, id)`). Con la query vacía muestra dos secciones: "Recientes" (últimas 10 entidades visitadas, `core/search/palette-recents.service`, `localStorage` bajo `mc.palette.recents.v1`) y "Búsquedas anteriores" (últimas 10 queries de texto, `mc.palette.queries.v1`), cada entrada con un botón "✕" para olvidarla individualmente.
- **Atajos centralizados.** `core/shortcuts/shortcuts.service` es la fuente única de atajos de teclado (regla §4.6.15 en [`reglas.md`](../proyecto/reglas.md)): un listener `document.keydown` en capture phase, con registro `{combo, labelKey, scope}`. El scope `editable-safe` no dispara con foco en `input`/`textarea`/`[contenteditable]`; `global` dispara siempre. `?` (Shift+/) abre el diálogo de ayuda (`KeyboardHelpDialogComponent`), que lista los atajos leyendo directo del servicio. `Ctrl+N` crea una entidad contextual según la ruta activa, resuelta por `core/intents/creation-intent.service`.

## Búsqueda: reindexado manual y snippets

`/settings` → General incluye un botón "Reindexar" que llama `WorkspaceRefreshService.refreshAll()`. `SearchIndexService` guarda el body aplanado completo por documento (`DocMeta.body`) en vez de un snippet pre-truncado; en cada query, `buildSnippet()` re-escanea el texto normalizado para ubicar el término matcheado más temprano y recorta una ventana de ±70 caracteres a su alrededor. `SearchHit.snippet` es `{ pre, match, post }`, y la paleta de comandos renderiza `pre` + `<mark>{{ match }}</mark>` + `post` sin `innerHTML`. Sin match (browse por tag, o recientes) cae al fallback de los primeros 160 caracteres del body. `SEARCH_INDEX_VERSION` es v2.

## Árbol lateral: navegación y orden manual

- Scroll automático al match activo del filtro y dropdown de coincidencias navegable con teclado (↑/↓/Enter/Esc), con soporte de accesibilidad completo (`role=listbox`/`option`, `aria-activedescendant`).
- Orden manual de nodos vía **fractional indexing**: cada entidad y folder tiene un campo `position: string` (lexorank base-62, helper puro en `core/ordering/fractional-position.ts` con `between`/`initial`/`compare`). Drag & drop en el árbol reordena dentro del mismo folder, mueve entre folders del mismo kind, y reordena folders entre sí — todo vía `setPosition`/`setFolderPosition`, con confirmación por región `aria-live`.
- Introduce `MCB-SYS-003` (invariante interno violado) para casos donde `fractional-position` no puede honrar el orden pedido.

## Gestión de tags

Ruta `/tags` (`TagsContainer`, ícono 🏷 en el rail) centraliza administración de tags cross-kind: filtro por label, rename inline, recolor (misma paleta de swatches del picker), fusión ("Combinar con…") y borrado con confirmación que muestra cuántas entidades lo usan. La orquestación vive en `core/tags/tags-admin.service.ts`, que inyecta los 8 servicios de entidad taggeable vía adapters — ninguna feature importa directamente a otra (regla §4.2.10).

## Editor: resaltado, comentarios y diff-marks

- **Resaltado personalizable.** `@tiptap/extension-highlight` (modo `multicolor`), extendido en `core/tiptap/highlight/highlight.ext.ts` para persistir un id de swatch curado (`data-color`) en vez de un hex libre. Paleta cerrada de 5 colores en `core/theme/highlight-palette.ts`, mismo criterio que `ACCENT_PALETTE`/`TAG_SWATCHES` (cada entrada valida ≥4.5:1 contra el texto del cuerpo en ambos temas). Botón "🖌 Resaltar" persistente en `EditorToolbarComponent`, visible tanto en vista `combined` como fuera de ella.
- **Comentarios con range que sobrevive ediciones.** El plugin TipTap `core/tiptap/comment-range-mapping/comment-range-mapping.ext.ts` trackea la posición absoluta de cada `Comment.range`/`Comment.span` a través de `tr.mapping` en cada transacción y recalcula el offset relativo al bloque en cada `view.update`, marcando el comentario `orphaned: true` si el span colapsa. Antes de este plugin, el range persistido quedaba congelado al valor de creación y la marca visual "saltaba" a la posición vieja tras guardar.
- **Comentarios multi-bloque.** `CommentAnchorType: 'range'` soporta `Comment.span: { startBlockId, startOffset, endBlockId, endOffset }` — un par de endpoints, sin lista intermedia de bloques, porque los offsets de cada extremo alcanzan para reconstruir el span aunque el contenido intermedio cambie. Un bloque borrado entre ambos extremos no orphana el comentario, sólo reduce lo que cubre.
- **Preview de diff-marks tipo insertion-only.** `core/tiptap/draft-decorations/diff-mark-preview.ts` es un renderer JSON→DOM puro (sin Angular ni ProseMirror) que cubre el subset de nodos/marcas que produce el editor. Cada mark `insert` de alcance `block` se pinta como widget decoration clickeable (clase `mc-draft-insert`, borde punteado) que abre el popover de borradores con ese mark pre-seleccionado.

## Modo pantalla completa (focus mode)

`core/focus-mode/focus-mode.service.ts` expone un signal `active: boolean` y se registra en `ShortcutsService` con el combo **`Alt+Shift+F`** (scope `global`, funciona con el cursor dentro del editor). El combo original era `F11`, pero eso es fullscreen nativo del navegador y no se puede interceptar de forma confiable con `preventDefault()` — ver el audit en `docs/deferred/shortcuts-cross-section.md`.

Activo, oculta: la sidebar del workspace, el rail, el banner de divergencia remota, el toast de recordatorios y el mini-reproductor. Los overlays on-demand (paleta de comandos, diálogo de ayuda, switch de variantes) siguen montados porque sólo aparecen cuando el usuario los invoca.

El alcance es "sólo el editor de la entidad activa": los seis editor-panes con `mc-editor` (notes/tasks/goals/lists/writings/books) ocultan su propio header/tag-picker/meta y dejan visible únicamente el editor. Images y files, al ser grids/galerías sin `mc-editor`, quedan fuera de alcance. El lector de libros (`BookReaderContainer`) tiene su propio focus mode local (`Ctrl+.`); ambos atajos activan el mismo estado visual (`localFocusMode() || globalFocusMode.active()`).

El fallback "por menú" para descubrir el atajo es el listado automático en `KeyboardHelpDialogComponent`.

## Empaquetado nativo (Tauri + Capacitor)

La instalación como PWA de escritorio (manifest + service worker, ícono placeholder, funcionamiento offline) ya está descripta en [`infraestructura.md` §18](../proyecto/infraestructura.md#18-pwa). Lo que sigue es la capa adicional: envolver la misma SPA Angular en binarios nativos de escritorio (**Tauri**) y mobile (**Capacitor**), sin bifurcar el core de la app.

El código de features sigue siendo el mismo Angular en las tres plataformas. Lo que cambia es la implementación de acceso al filesystem por debajo de una interfaz común, `NativeFs` (`core/fs/native-fs.ts`, `InjectionToken` `NATIVE_FS`). `core/platform/platform.service.ts` detecta la plataforma en runtime (`'__TAURI_INTERNALS__' in window` / `window.Capacitor?.isNativePlatform?.()`) y `provideNativeFs()` resuelve el adapter correspondiente una sola vez en `app.config.ts`:

- **`BrowserNativeFs`** — File System Access API (el comportamiento original, sin cambios de lógica).
- **`TauriNativeFs`** — `@tauri-apps/plugin-fs`/`plugin-dialog`/`plugin-store`. `queryPermission`/`requestPermission` son no-ops que resuelven `'granted'` siempre, porque el modelo de capabilities de Tauri se valida en build/config, no con un prompt en runtime.
- **`CapacitorNativeFs`** — `@capacitor/filesystem` sobre una carpeta fija (`Directory.Documents/mi-cerebro`), sin picker — decisión de alcance explícita para no depender de un plugin SAF de terceros. `pickDirectory()` lanza error en vez de no-op silencioso si algo lo invoca por accidente.

Los tres adapters comparten clasificación de errores del filesystem (`core/fs/adapters/native-fs-errors.ts`, `classifyFsError`): `NotAllowedError`/`SecurityError` mapean a `MCB-FS-004` en cualquier plataforma; cada adapter elige su propio código de fallback para una falla de IO genérica que no sea revocación de permiso (capability que no cubre el path, IO nativo rechazado, disco lleno) — browser sigue en `MCB-FS-001`, `TauriNativeFs` pasa `MCB-FS-005`, `CapacitorNativeFs` pasa `MCB-FS-006`. `MCB-FS-007` es un guard defensivo (`assertPathRef`) para el caso "un adapter nativo recibió una ref de tipo browser" — estructuralmente inalcanzable mientras `provideNativeFs()` siga resolviendo el adapter correcto por plataforma, lanzado directo en vez de vía `classifyFsError` porque no es una falla de IO sino una ruptura del invariante de DI. `FsService` pasa a ser un delegate fino sobre el adapter activo. `GitFsAdapter` y `ExportZipService` corren sobre `NativeFs` igual que cualquier otro consumidor — no tienen rama browser-only.

El empaquetado nativo habilita rutas que el sandbox del navegador no permite: spawn de procesos, binarios embebidos, notificaciones del SO con la app cerrada, e integración con el reproductor de medios del sistema (MPRIS/SMTC/MediaSession nativa). Es prerequisito de cualquier feature que necesite ejecutar código fuera del sandbox del navegador.

**Gating del service worker:** `provideServiceWorker` en `app.config.ts` sólo activa el SW cuando `detectPlatform() === 'browser'` (fuera de modo dev). Tauri y Capacitor sirven desde esquemas custom (`tauri://`, `capacitor://`) con su propio empaquetado offline, así que un service worker ahí es redundante o puede interferir con el bridge IPC nativo.

**Estados de onboarding inalcanzables:** `WorkspaceService` documenta en el tipo `WorkspaceState` qué estados nunca ocurren en cada plataforma (`needs-permission` inalcanzable en Tauri y Capacitor porque sus `queryPermission`/`requestPermission` siempre resuelven `'granted'`; `needs-root`/`foreign-folder` inalcanzables sólo en Capacitor, que no tiene picker), en vez de forkear el servicio por plataforma o agregar guards defensivos para casos estructuralmente imposibles.

**Fuera de alcance:** verificación end-to-end de Capacitor en dispositivo/emulador Android o iOS real — este entorno de desarrollo no tiene Android SDK ni Xcode, así que queda a cargo del usuario lanzar y validar manualmente. La descarga de música por link permanece deshabilitada en Capacitor a propósito (ver la sección de música en el roadmap 19-21).
