# Tutoriales guiados y atajos por página

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Sistema de tutoriales interactivos por página (fallback del diseño auto-explicativo, nunca su reemplazo) más el diálogo de atajos de teclado filtrado por página. La arquitectura completa — `TutorialStep`/`TutorialDefinition`, `TutorialStepAction`, `tier`/`moreDetail`/`skipIfMissing`, flujos cross-página, el picker multi-flujo, `ShortcutBinding.pageScope` — está especificada en `docs/proyecto/reglas.md` §4.6.15b y el párrafo "Varios flujos por página, seleccionables" que le sigue. Este documento no repite esa spec: es el inventario de qué existe hoy sobre ese motor.

## Piezas del motor (resumen, ver reglas.md para el detalle)

- `core/tutorials/` — `TutorialService` (`register()`/disposer estilo `ShortcutsService`, `start(id, mode)`, `tutorialsForPage(pageId)`, `hasTutorialFor(pageId)`), `tutorial.types.ts`, `tutorial-storage.ts` (visto/no visto en `localStorage`), `tutorial-action-matching.ts`.
- `shared/tutorial-overlay/` — `TutorialOverlayComponent`, montado una sola vez en `AppShellContainer`. Spotlight sobre `anchorSelector`, listener de `action` en capture phase, toggle "Ver más detalle" para `moreDetail`, salto automático (`skipIfMissing`) cuando el anchor no existe en el DOM.
- `layout/components/page-help-control.component.ts` — control fijo del shell con dos íconos: "Guía de la página" (arranca la definición única o abre `tutorial-picker-menu.component.ts` si `pageId` agrupa varias) y "Atajos de la página" (abre el diálogo de `?` ya filtrado).
- `core/shortcuts/route-page-id.ts` — única fuente de "ruta → slug de página", usada tanto por el picker de tutoriales como por el filtrado de atajos.

## Historia de una pieza que ya no existe: `entity-tutorial.builder.ts`

Durante la Fase 3 se introdujo `core/tutorials/entity-tutorial.builder.ts` (`buildEntityTutorial()`) para generar 14 tutoriales reciclando el copy de `core/home-content/home-content.ts` (el contenido de las cards de la home) y evitar reescribir texto 14 veces. La Fase 6 revirtió esa decisión: el copy de home-content está pensado como "qué hay en esta sección" (3-4 líneas para una card), no como instrucciones paso a paso con un gesto concreto por step — violaba la regla de "un gesto por step". El builder se eliminó por completo; **hoy no hay generador compartido de tutoriales**, cada `<feature>.tutorial.ts` escribe su propio `TutorialStep[]` a mano, con copy dedicado bajo claves `<feature>.tutorial.<slug>.title`/`.body`. `home-content.ts` sigue existiendo, pero es un consumidor totalmente distinto (las cards de `/`), sin relación con los tutoriales de página.

## Patrón compartido: carpetas (`*-folders`)

Notes, Files, Lists, Tasks, Goals y Books repiten el mismo sub-flujo (crear/renombrar/mover subcarpeta, navegar breadcrumbs) porque las seis usan `shared/folder-breadcrumb/`. La decisión registrada (ítem 8.86) fue **no** abstraer un generador de contenido compartido — cada página igual necesita su propia `TutorialDefinition`, anchors y ruta, y una feature no puede importarle contenido a otra (regla 10). Lo que sí se comparte es la convención de copy: empezar del mismo texto base ("creá una carpeta, arrastrá para mover, click en el breadcrumb para volver") y particularizar solo donde el gesto real difiera — por ejemplo Books permite soltar un libro sobre una subcarpeta desde el estante (gesto real de `dragstart`), mientras que Notes, Goals, Files y Lists no tienen drag-and-drop hacia el breadcrumb y ese step queda como "abrir subcarpeta con click".

## Selector multi-flujo por página (`pageId`)

Una página puede registrar más de una `TutorialDefinition`. `pageId` (no `id`) agrupa definiciones para el botón ✨: si `tutorialsForPage(pageId)` devuelve una sola, arranca directo; si devuelve varias, abre `tutorial-picker-menu.component.ts` listando el `labelKey` de cada una. Solo la definición pensada como recorrido principal de la página lleva `autoStartIfUnseen: true` — es siempre la que cubre el circuito CRUD central, la que un usuario nuevo necesita el día uno. El resto son manuales, descubribles solo desde el picker.

**Criterio para separar un sub-flujo en su propia `TutorialDefinition`** en vez de plegarlo con `tier`/`moreDetail` dentro del flujo existente (los tres deben cumplirse):

- **Independiente** — no requiere haber hecho los steps de otro flujo antes.
- **Sustancial** — al menos 3 steps propios.
- **Nombrable** — un `labelKey` corto y distinto del resto de los flujos de esa página.

Vivir en una tab o sub-ruta distinta refuerza el caso pero no es requisito. Existe además una tercera categoría, sin flujo ni step con `action`: **mención de existencia** — un `TutorialStep` puramente descriptivo para funciones reales pero demasiado situacionales para tener un único gesto que practicar (ej. combinaciones libres de un buscador).

El picker es hoy una lista plana; se mantiene usable mientras ninguna página supere ~5-6 entradas (ninguna lo hace agrupando tabs afines, ver Settings más abajo) — categorías visuales quedan sin construir por YAGNI hasta que haga falta.

## Inventario por sección (17/17 con tutorial)

Cada línea nombra la/s `TutorialDefinition` de la página (`pageId`) y el conjunto de gestos que cubre, no el texto exacto de cada step.

- **Notes** (`notes`) — 4 definiciones: lo esencial (crear/abrir/tags/buscar con Ctrl+K real), organizar en carpetas, editor avanzado (toolbar por categorías vía `moreDetail`), comentarios/borradores.
- **Tasks** (`tasks`) — 3: lo esencial (crear, trasplantar con Shift+→, cosechar, riego/marchitamiento como avanzado), patio de cosechas (archivo mensual de solo lectura), editor completo (recordatorio, tags, foco, borrar).
- **Goals** (`goals`) — 3: lo esencial (crear, filtros, peek overlay completo con rename/completed/deadline/prioridad/borrar/abrir mapa), mapa de la constelación (crear paso, arrastrar, multi-selección shift+click + toolbar de lote, deadline/prioridad/recordatorio), organizar en carpetas.
- **Lists** (`lists`, compartido entre shelf y detalle) — 3: lo esencial (modo tiza, búsqueda/eje/borrar del shelf), herramientas del tablero de tiza (dibujar/borrar, color/grosor, undo/redo, atajos `b`/`e`/`[`/`]`/1-5/Ctrl+Shift+T, panel de capas, exportar, limpiar), organizar en carpetas.
- **Writings** (`writings`) — 1 definición hoy: lo esencial (crear/editor/fecha límite/tags/borrar). Un segundo flujo "Explorar la biblioteca" está diseñado pero no implementado, ver "Estado abierto".
- **Books** (`books`) — 6: lo esencial (estantería, búsqueda/filtro, flip de portada), organizar en carpetas (incluye drop de libro sobre subcarpeta), índice de capítulos, formato del editor (toolbar completa + typewriter + stats), comentarios y propuestas (Alt+C/Alt+P), lectura en voz alta (TTS, bookmark, export a markdown).
- **Images** (`images`) — 1 definición (registrada tanto en el índice como en la sala): abrir imagen + lightbox, eliminar imagen/galería, subida por Ctrl+V + drag-and-drop, navegación de plano/mini-mapa.
- **Files** (`files`) — 2: lo esencial (subida, tags, drag-and-drop de reorden, renombrar/editar/borrar colección), organizar en subcarpetas.
- **Calendar** (`calendar`) — 2 (mismo container): lo esencial (búsqueda, ir a fecha, drag-and-drop de tareas para reprogramar, toggle/crear por tipo), agenda semanal (nav prev/next, click día, creación rápida por tipo, cerrar).
- **Reminders** (`reminders`) — 3: lo esencial (crear, recurrencia, pausa, búsqueda), atajos de teclado (j/k navegar, e abrir, espacio/Delete marcar/borrar, N nueva paloma), posponer y gestionar (snooze 1h/1d/lunes/finde, duplicar, eliminar desde el menú ⋮).
- **Music** (`music`) — 3: lo esencial (subir, álbum, play/pause con espacio, buscar con "/", seek en waveform, selección múltiple + bulk actions como avanzado), armar y curar playlists (crear/reproducir/shuffle/eliminar, favorito, reordenar por drag, agregar vía picker), traer música de YouTube (input de URL, estado de descarga).
- **History** (`history`) — 1 definición hoy: lo esencial (zoom Cordillera/Estratos/Cordel, timeline, filtro de milestones). Un segundo flujo "Restaurar una versión" está diseñado pero no implementado, ver "Estado abierto".
- **Variants** (`variants`) — 1 definición hoy: lo esencial (crear/seleccionar en canvas, filtro y refresh como `moreDetail`). Dos sub-flujos ("Editar y navegar una variante", "Resolver un merge") están diseñados pero no implementados, ver "Estado abierto".
- **Tags** (`tags`) — 2: lo esencial (filtro de texto, navegación por tag-detail), organizar tags (recolor, rename, merge con selector de destino, eliminar con contador de uso — condicional, solo se ofrece si existe ≥1 tag).
- **Settings** (`settings`) — 5: navegación (cambiar de tab + General), remoto y versionado (tabs Remoto + Versionado + Variantes), recordatorios/objetivos/autor (config liviana), tema y export (editor de tema custom con `moreDetail`, export).
- **Dashboard** (`dashboard`) — 1 definición: los 5 widgets + resurface, toggle related/random como `action` sobre el step existente.
- **Home** (`home`) — no tiene tutorial de página propio (es el punto de entrada a los flujos cross-página, ver abajo).

Dos definiciones adicionales no viven bajo ningún `pageId` de sección porque su contenido está gateado por un overlay o por configuración, no por ruta:

- **Command Palette** (`command-palette`) — abrir (click en el botón nuevo del rail o Ctrl+K), escribir, navegar resultados con flechas, Enter abre; sintaxis `tag:<label>` y modo dual recientes/resultados como `moreDetail`. Registrado desde `CommandPaletteContainer`, `autoStartIfUnseen: true` (dispara la primera vez que se abre la app).
- **Sync** (`sync`) — condicionado a `isConfigured()`: step 0 sobre `.not-configured` con link real a `/settings` cuando no hay remoto configurado; si está configurado, push/fetch/consola de estado (básico) y toggle auto-push/throttle + salto a `/variants/merge` desde un tubo divergente (avanzado, cross-reference sin duplicar el paso a paso del merge). `skipIfMissing: true` en los 6 steps permite que una sola definición cubra ambas situaciones.

`features/onboarding/` (wizard de arranque) y `features/dev/` (herramienta interna) quedan fuera del conteo de cobertura — no ameritan tutorial sobre sí mismos.

## Flujos cross-página (`home.flow.*`)

`core/tutorials/home-flows.tutorial.ts`, registrado una sola vez en `AppShellContainer` (siempre montado), `autoStartIfUnseen: false` — un flujo cross-página nunca se dispara solo, lo arranca el botón "Recorrer este flujo" de las cards de "Flujos típicos" en la home:

- **`PROJECT_FLOW_TUTORIAL`** (`/goals → /writings → /tasks → /calendar`).
- **`DAILY_FLOW_TUTORIAL`** (`/calendar → /goals → /tasks → /reminders`).

Ambos reusan los anchors ya existentes de cada página (cero anchors nuevos) y navegan con `TutorialStep.route` antes de medir el siguiente anchor. Dos flujos "de hoy" no se construyen como flujo cross-página aparte porque ocurren enteros dentro de una sola página: _Capturar una idea suelta_ (`/notes`) y _Escribir algo largo_ (`/writings`) — sus botones "Recorrer" llaman directo a `tutorials.start('notes'|'writings')`, navegando primero si hace falta. Dos flujos "próximamente" (`study`, `tagview`) no están construidos porque las funciones que describirían (quick-capture global desde el reader, vista cross-tag unificada) todavía no existen.

## Diálogo de atajos ("Atajos de la página")

`ShortcutBinding.pageScope?: string` filtra el diálogo de `?` (`KeyboardHelpDialogComponent`) a un tercer grupo "De esta página", además de los grupos `global`/`editable-safe` de siempre (que excluyen los bindings con `pageScope` para no duplicarlos). El slug de página viene de `core/shortcuts/route-page-id.ts`, la misma fuente que usa el picker de tutoriales. El ícono "Atajos de la página" en `page-help-control.component.ts` abre el diálogo ya filtrado a la página activa; a diferencia del ícono de tutorial, está siempre visible (no depende de que la página tenga tutorial registrado).

## Práctica de gestos reales (`TutorialStepAction`)

Un step puede pedir la interacción real en vez de solo lectura + "Siguiente": `{ event: 'click' | 'submit' | 'keydown' | 'dragstart', selector?, key?, ctrlOrMeta?, shiftKey?, altKey? }`. El botón "Siguiente" nunca se deshabilita (regla de accesibilidad §4.13) — practicar el gesto es un premio, no la única vía de avance. Eventos **no soportados**: `input` (texto libre — todos los buscadores del proyecto quedan sin `action` por este motivo) y `drop` (soltar archivos externos desde el SO — el drag-and-drop de reorden interno sí se detecta vía `dragstart`), ni `contextmenu` (click derecho — los gestos que dependen de él quedan descriptivos).

## Estado abierto (no implementado a la fecha de este documento)

El roadmap (`docs/proyecto/roadmap-26-tutoriales.md`, ítem 26) deja los siguientes puntos diseñados pero pendientes de ejecución — no son parte del sistema hoy:

- Checklist de onboarding en Home (4 ítems: primera nota, elegir tema, primer objetivo, recorrer un flujo).
- Fix de copy/anchor en Goals steps 5-6 y `skipIfMissing` faltante en el step `mini-player` de Music.
- Bloque `@empty` faltante en el wallboard de Calendar.
- **Variants** — dos sub-flujos diseñados y no escritos: editar/navegar una variante (rename, color, borrar con confirmación, navegar pills de historial) y resolver un merge (`/variants/merge`, 8+ gestos: selector from/into, swap, aplicar por archivo, reintentar/saltar).
- **Writings** — sub-flujo "Explorar la biblioteca" (buscar, filtrar por tag, cambiar vista estante/tabla/lista, agrupar/ordenar, cerrar con Escape) diseñado y no escrito.
- **History** — sub-flujo "Restaurar una versión" (elegir commit, elegir alcance completo vs. entidad individual, confirmación tipeada) diseñado y no escrito.
