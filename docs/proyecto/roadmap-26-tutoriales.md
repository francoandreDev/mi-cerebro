# Roadmap — item 26 (tutorial guiado por página)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

26. **Tutorial guiado por página, fallback del diseño auto-explicativo (§4.6.15b).** Disparado por dos auditorías de UX seguidas (descubribilidad y "usuario cero") que encontraron el mismo patrón: gestos reales (shift-click multi-selección en Metas, los 3 modos de Historial, la toolbar completa de "modo tiza" en Listas) sin ninguna vía de descubrimiento salvo tropezar con ellos o leer el manual estático en `/`. Decisión explícita: el tutorial es un **fallback**, no reemplaza el trabajo de hints/leyendas ya en curso — cubre lo que un hint estático no puede narrar (una secuencia, no solo el significado de un símbolo).

**Fase 1 — fundamento + piloto en Historial.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 2 — Metas y Listas.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 3 — cobertura completa (17/17) + flujos cross-página reales.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 4 — corrección de anchors mal colocados.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 7 — profundidad cross-página real.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 5 — pasos que se practican, no solo se leen.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 6 — copy dedicado, no reciclado de home-content.ts.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 8 — cuatro huecos frente al estándar de onboarding, diseño cerrado.** _Pendiente de
ejecución — este bloque es el hand-off completo para el chat que la implemente, no hace falta
releer la conversación de diseño (2026-07-25) para retomarla._ Disparado por revisar el diseño
actual contra un framework externo de onboarding para plataformas complejas (visitas guiadas
interactivas, progressive disclosure, checklist inicial, empty states educativos, salida siempre
disponible, micro-aprendizaje, activadores inteligentes, centro de ayuda accesible). De esos 8
puntos, 5 ya están cubiertos (tours con acción real desde la Fase 5, salida con Escape/skip desde
la Fase 1, activadores inteligentes vía `autoStartIfUnseen`, micro-pasos de un gesto por step
desde la Fase 6/7, centro de ayuda vía el botón ✨ "Guía de la página"). Quedan 4 puntos,
investigados con 19 sub-agentes de exploración (uno por sección: las 17 con tutorial + Command
Palette + Sync) y luego discutidos y decididos en el chat de diseño. Onboarding (`features/onboarding/`,
el wizard de arranque) y Dev (`features/dev/`, herramienta interna) quedan fuera del conteo de
cobertura — no ameritan tutorial sobre sí mismos.

Redefinición clave surgida en la discusión: "cobertura" no es solo "¿existe `*.tutorial.ts`?" —
es que **todo lo enseñable de una página quede consultable por tutorial**, aunque no se
auto-dispare. Progressive disclosure y cobertura exhaustiva son la misma estructura de datos
vista desde dos ángulos: el tour corto (auto-arranque, solo lo básico) y la referencia completa
(re-lanzada a demanda, básico + avanzado) usan el mismo `TutorialDefinition`, no dos definiciones
separadas.

**Subdividido en 17 ítems (8.1-8.17), pensados para un chat de ejecución por ítem.** Cada uno
lista su prerequisito explícito — la mayoría de los ítems de contenido por página solo necesitan
8.1 cerrado antes de poder usar `tier`/`moreDetail`; el resto no depende de nada. No hace falta
ejecutarlos en orden salvo que un ítem lo pida.

### 8.1 — Engine: `tier`, `moreDetail`, `start(id, mode)` — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.2 — Bug: Goals steps 5-6 describen un gesto que no existe en `/goals`

_Prereq: ninguno (no depende de `tier`, es un fix de copy/anchor)._

`goals.tutorial.ts` steps 5-6 describen Shift+click multi-selección + drag de **toda la
constelación**, un gesto que no existe en `/goals` — vive en
`goal-constellation-editor.component.ts`, ruta `/goals/:id`. `goals-wall.container.ts:174-250`
confirma que `onStarTap`/`onStarDown` mueven una sola estrella y navegan, no hay `contextmenu`
handler en la wall. Corregir copy + anchor para describir el gesto real de `/goals`, o mover esos
dos steps a `route: '/goals/:id'` si el gesto multi-select vale la pena enseñarlo ahí.

### 8.3 — Bug: Music `mini-player` step sin `skipIfMissing`

_Prereq: ninguno._

`music.tutorial.ts`, step `mini-player`: anchor `[data-tutorial="mini-player"]` solo existe con
un track cargado (`mini-player.container.ts:14`, `@if (player.currentTrack())`) pero el step no
tiene `skipIfMissing: true` — reproduce el bug de "tarjeta flotando en (0,0)" documentado en la
Fase 4, para cualquier usuario sin nada sonando. Agregar `skipIfMissing: true`.

### 8.4 — Empty state roto: Calendar wallboard sin bloque `@empty`

_Prereq: ninguno._

`calendar.container.html:128`, wallboard `.cards-col`/`wallGroups()`: no tiene ni bloque `@empty`
— filtrar a cero no muestra nada, ni siquiera texto. Peor que "pasivo": es invisible. Agregar el
bloque `@empty` y un CTA "Limpiar filtro".

### 8.5 — Empty state que miente: Notes `/notes/:id` sin nota seleccionada — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.6 — Empty states: resto del pase (Goals, Lists, Writings, Tags, Music, Files) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.7 — Checklist de onboarding en Home

_Prereq: ninguno._

Ubicación confirmada: `home.container.html`, entre el hero y la sección `.workflows` ("Flujos
típicos") — como primer beat, no mezclado en la lista de cards. Nuevo componente dumb
`features/home/components/onboarding-checklist.component.ts` + servicio nuevo
`core/onboarding/onboarding-checklist.service.ts` + `core/onboarding/onboarding.types.ts` (un
`core/` nuevo porque `features/home/` no puede importar de `features/notes|goals|...` — regla 10;
mismo motivo que ya forzó `dashboard.types.ts` a existir). Persistencia de qué se completó:
patrón try/catch sobre `localStorage`, mismo molde que `dashboard-resurface-storage.ts`.

**4 ítems**, los 4 con señal ya detectable sin inventar estado nuevo salvo uno:

1. **"Creá tu primera nota"** — `NotesService.summaries().length >= 1`.
2. **"Elegí un tema"** — `SettingsService.state().theme` distinto del default (`override !== 'auto'`
   o cualquiera de `customBgHue`/`customBgSatLevel`/`customAccentId` definido) — único ítem que
   necesita leer un signal existente con una condición nueva, no un flag nuevo.
3. **"Armá tu primer objetivo"** — `GoalsService.summaries().length >= 1`.
4. **"Recorré un flujo típico"** — gratis: ya lo trackea `hasSeenTutorial()` para
   `PROJECT_FLOW_TUTORIAL`/`DAILY_FLOW_TUTORIAL` (`core/tutorials/home-flows.tutorial.ts`, ids
   `'project-flow'`/`'daily-flow'` — confirmar ids exactos al implementar), cero señal nueva.

### 8.8 — Notes: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.9 — Tasks: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.10 — Settings: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.11 — Variants: cobertura completa, multi-flujo (re-scoped por 8.85)

_Prereq: 8.1, 8.18._

Segundo pase de 8.85 encontró dos zonas independientes que el mapeo original no había recorrido:
el drawer de detalle de una variante (rename/color/borrar/navegación por historial) y la página de
merge entera (`/variants/merge`, ruta propia, hoy totalmente fuera del `pageId: 'variants'`) — las
dos pasan el criterio (independientes, 3+ steps, nombrables) → flujos propios. El resto (filtro,
refresh, leyenda) son gestos sueltos sobre el canvas ya cubierto:

1. **`variants` — "Variantes: lo esencial"** (existente, `autoStartIfUnseen: true`): crear/
   seleccionar en canvas (sin cambios) + filtro de búsqueda y refresh de actividad como `moreDetail`
   sobre el step de canvas; popover de leyenda como **mención de existencia** (step sin `action`,
   demasiado situacional para practicarse).
2. **`variants-drawer` — "Editar y navegar una variante"** (nuevo, manual): rename inline, color
   picker, eliminar (con diálogo de confirmación y warning de cambios sin mergear — el único gesto
   destructivo real, hoy sin step), click en pills parent/milestone/HEAD/ahead-behind para navegar
   el historial.
3. **`variants-merge` — "Resolver un merge"** (nuevo, manual, `route: '/variants/merge'`): selector
   from/into, swap, aplicar-todo-de-un-lado, elegir por archivo, aplicar merge, reintentar/saltar en
   fallo parcial (8+ gestos propios, ruta dedicada — el candidato más claro de toda la auditoría).

### 8.12 — Files: cobertura moderada, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.13 — Tags: split del step `rowActions`, multi-flujo condicional (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.14 — Lists: multi-flujo, tiza + organización (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.15 — Dashboard: ajuste menor. Music: multi-flujo (re-scoped por 8.85)

_Prereq: 8.1, 8.18._

**Dashboard** no cambia de forma: toggle related/random del resurface se plegó como `action` sobre
el step existente (falta mencionarlo en `dashboard.tutorial.resurface.body`) — un solo gesto sobre
un anchor ya cubierto, no amerita flujo propio.

**Music** sí se amplía: segundo pase de 8.85 encontró que "playlist-editor no tiene step propio"
se quedaba corto — es una superficie entera (crear/reproducir/shuffle/eliminar playlist, favorito,
reordenar tracks por drag, agregar tracks vía picker con búsqueda) más una función totalmente
aparte (descarga por YouTube URL) y una selección masiva con bulk actions:

1. **`music` — "Music: lo esencial"** (existente, `autoStartIfUnseen: true`): upload/álbum/play-
   pause/buscar (sin cambios) + `skipIfMissing: true` en el step `mini-player` (bug 8.3) + seek en
   waveform como `action` sobre el step de reproducir + drag&drop de tracks a playlist y cola de
   reproducción (jump-to/clear) como `moreDetail`.
2. **`music-playlists` — "Armar y curar playlists"** (nuevo, manual): crear/reproducir/shuffle/
   eliminar playlist, favorito, reordenar tracks por drag, agregar vía picker con búsqueda.
3. **`music-youtube` — "Traer música de YouTube"** (nuevo, manual): input de URL, estado de
   descarga — flujo chico pero autocontenido y muy distinto en naturaleza del resto (trae contenido
   externo en vez de organizar el existente), nombrable con claridad.
4. **Selección múltiple + bulk delete/agregar-a-playlist**: 3+ gestos propios pero comparten anchor
   y contexto con el flujo esencial (es un modo del mismo listado de álbum) — se pliegan ahí como
   steps `tier: 'avanzado'` en vez de flujo aparte.
5. **Letras** (toggle + búsqueda externa por artista/título): 3 steps posibles pero muy chico y
   secundario — queda como `moreDetail` dentro de `music-playlists` en vez de flujo propio; atajos
   `n`/`p` como **mención de existencia** (ya cubiertos por el diálogo global de shortcuts).

**Implementado (Music):** el bug 8.3 (`mini-player` sin `skipIfMissing`) ya estaba resuelto en el
código al momento de encarar este ítem — no hizo falta tocarlo, solo se dejó documentado acá.
Los 3 flujos se implementaron sustancialmente como se diseñó, con desvíos menores frente al plan
original:

- **Seek en waveform** no es un `action` sobre el step `play` existente (ese step practica
  espacio para play/pause, un gesto distinto) sino un **step nuevo** inmediatamente después,
  anclado a `[data-tutorial="music-waveform"]` (`now-playing.container.html`, solo existe con
  `currentTrack()` → `skipIfMissing: true`) — separar ambos respeta la regla de "un gesto por
  step" (§4.6.15b) en vez de forzar dos gestos en un mismo step.
- **Drag&drop a playlist + cola (jump-to/clear)** quedó como `moreDetail` sobre el step `album`
  existente (mismo flujo esencial), tal como estaba planeado.
- **Selección múltiple + bulk actions** se implementó como 4 steps `tier: 'avanzado'` dentro de
  `music.tutorial.ts` (seleccionar, bulk-delete, bulk-agregar-a-playlist, limpiar selección) en
  vez de un solo step genérico — cada botón de la barra de selección (`.bulk-bar`,
  `album-library.container.html`) es un gesto propio y necesitaba su propio anchor
  (`data-tutorial="music-bulk-select/delete/add-select/clear"`, agregados en este commit).
- **`music-playlists`** suma un step inicial de cambio de pestaña (Álbumes → Playlists,
  `data-tutorial="music-tab-playlists"`, mismo patrón que Settings §4.6.15b) que el plan
  original no explicitaba pero que hace falta para que el resto de los steps (todos dentro de
  esa pestaña o del editor de una playlist activa) tengan sentido sin asumir que el usuario ya
  está ahí.
- **Letras** quedó como `moreDetail` sobre el step "agregar tracks vía picker" de
  `music-playlists` (no hay anchor propio de letras dentro del editor de playlist — la UI de
  letras vive en `now-playing.container.html`, fuera de ese flujo — pero `moreDetail` no requiere
  colocación física, solo texto suplementario sobre un step ya visitado).
- **`music-youtube`** no lleva `skipIfMissing` en ningún step: el bloque `.youtube-download`
  siempre está en el DOM (deshabilitado con tooltip fuera de Tauri/Capacitor,
  `YoutubeDownloadService.isAvailable()`), a diferencia de los anchors condicionales del resto de
  la página.

Verificado: `bun run typecheck`, `bun run test` y `bun run lint` limpios (sin errores nuevos).

### 8.16 — Command Palette: tutorial nuevo + capacidad de engine "anclar dentro de overlay" — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.17 — Sync: tutorial nuevo + gating por `isConfigured()` — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.18 — Engine: selector de tutorial (múltiples flujos por página) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.85 — Investigación + diseño: afinar 8.18 para que el multi-flujo fluya en las 17 páginas — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.86 — Transversal: carpetas se repite en 5+ páginas — ¿un flujo por página o contenido compartido?

_Prereq: ninguno (decisión de diseño, no bloquea el resto)._

El primer agente del audit de 8.85 marcó el patrón: Notes (8.8), Files (8.12) y Lists (8.14) ya
tienen un flujo `*-folders`/`*-organize` propio con el mismo contenido genérico (crear/renombrar/
mover carpeta, navegar breadcrumbs); Tasks, Goals y Books lo repiten también. **Decisión**: no vale
la pena una abstracción de contenido compartido (viola YAGNI si el ahorro es solo de texto) — cada
página igual necesita su `TutorialDefinition`/`labelKey`/anchors propios porque el selector real
(`[data-tutorial="..."]`) y la ruta cambian por feature, así que no hay mecanismo de reuso limpio
sin acoplar features entre sí (regla 10, una feature nunca importa de otra). Lo que sí conviene
compartir: **el copy base** — al escribir el `bodyKey` de cada flujo `*-folders`, empezar del mismo
texto genérico ("creá una carpeta, arrastrá para mover, hacé click en el breadcrumb para volver")
y particularizar solo donde la entidad difiera (ej. Books permite soltar un libro sobre una
subcarpeta desde el estante, gesto que Notes no tiene). Evita que 6 personas distintas escribiendo
6 flujos terminen con 6 tonos distintos para el mismo gesto. Sin ítem de código propio — es una
convención para quien escriba cada flujo `*-folders`, ya anotada en 8.8/8.12/8.14 y a repetir en
8.87 (Tasks/Goals) y 8.90 (Books) de abajo.

### 8.87 — Goals: cobertura completa, multi-flujo (nunca tuvo ítem propio) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.88 — Calendar: multi-flujo, agenda semanal — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.89 — Reminders: multi-flujo, atajos + posponer — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.90 — Books: cobertura completa, la superficie más grande de la auditoría — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.91 — Images: ajustes menores, sin flujo nuevo — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.92 — Writings: flujo nuevo para el modal de biblioteca

_Prereq: 8.1, 8.18._

El modal "Biblioteca" (buscar, filtrar por tag, cambiar vista estante/tabla/lista, agrupar por
carpeta, ordenar) es 5 gestos cohesivos e independientes del flujo de creación/edición → flujo
propio. El resto se pliega:

1. **`writings` — "Writings: lo esencial"** (existente, `autoStartIfUnseen: true`): + fecha límite/
   recordatorio y tag picker del editor como steps/`moreDetail`; borrar escrito como
   `tier: 'avanzado'`; typewriter mode como **mención de existencia** (infraestructura compartida
   del editor, no propia de Writings).
2. **`writings-library` — "Explorar la biblioteca"** (nuevo, manual): abrir biblioteca, buscar,
   cambiar vista, agrupar/ordenar, cerrar con Escape.

### 8.93 — History: flujo nuevo para restaurar

_Prereq: 8.1, 8.18._

Ningún step actual tiene `action` (los 3 steps existentes son solo mención). Restaurar (commit
completo o entidad individual, con confirmación tipeada) es la única zona con 3+ pasos propios y
consecuencia real (irreversible) → flujo propio, el resto se pliega con `action` real donde hoy
falta:

1. **`history` — "Historial: lo esencial"** (existente, `autoStartIfUnseen: true`): agregar
   `action: keydown` a los atajos `+`/`-`/`[`/`]`/Esc en el step de zoom existente; marcar/renombrar/
   borrar hito como steps `tier: 'avanzado'` junto al filtro de milestones ya cubierto; sintaxis de
   búsqueda `facet:`/`since:`/`sha:`, chips de faceta, compactar diff, agrupar por tipo, colapsar
   timeline y banner "compactar ahora" como **mención de existencia** (`moreDetail` sobre el step
   `history-timeline`).
2. **`history-restore` — "Restaurar una versión"** (nuevo, manual): elegir commit, elegir alcance
   (completo vs. entidad individual), confirmar (con el input de confirmación tipeada).

### 8.94 — Trash: ajustes menores, sin flujo nuevo — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### Orden sugerido (no estricto)

8.1 y 8.18 primero (desbloquean el resto — el segundo en particular a todo ítem multi-flujo, que ya
asume el picker). 8.2-8.6 (bugs + empty states) y 8.7 (checklist) no dependen de nada, se pueden
intercalar en cualquier momento. 8.86 (decisión de copy compartido para `*-folders`) conviene
resolverlo antes de escribir el primero de esos flujos (8.8), aunque no bloquea nada técnicamente.

Contenido por página, multi-flujo (2+ `TutorialDefinition`): **8.8 Notes, 8.9 Tasks, 8.10 Settings,
8.11 Variants, 8.12 Files, 8.13 Tags, 8.14 Lists, 8.15 Music, 8.87 Goals, 8.88 Calendar, 8.89
Reminders, 8.90 Books, 8.92 Writings, 8.93 History** — 14 de las 17 páginas. Orden sugerido dentro
de este grupo: por tamaño de gap (Books 8.90 y Notes 8.8 primero — la mayor superficie sin cubrir
de toda la auditoría — después Settings 8.10 y Goals 8.87, el resto sin orden estricto).

Contenido de un solo flujo, sin split (gap ya cabe en `tier`/`moreDetail`): **8.15 Dashboard, 8.91
Images, 8.94 Trash**. Se pueden hacer en cualquier momento, incluso antes que el grupo multi-flujo
— son los más chicos de toda la fase.

8.16-8.17 (Command Palette, Sync) al final: son los únicos que siguen ejercitando la capacidad de
engine "anclar dentro de overlay condicional" (no el picker), y 8.17 depende del `route` de merge
que 8.11 debería dejar ya nombrado (`variants-merge`) para el cross-reference.
