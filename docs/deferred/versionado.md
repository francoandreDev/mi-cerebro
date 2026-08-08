# Diferidos — Versionado y variantes

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Versionado y variantes (origen: paso 13)

### Pulido visual general de `/history`

- **Qué**: cuando cerramos 13a el usuario confirmó que la información está completa y legible pero "mucha info, poco visual". Queda como ítem único agrupador para futuras iteraciones de tipografía, densidad, jerarquía y micro-interacciones del historial.
- **Por qué se difirió**: estructura y funcionalidad están; el polish entra cuando 13a-d estén cerrados y tengamos uso real para saber qué duele.
- **Resuelto parcialmente 2026-08-06**: la vista de estratos (`history-strata.component.css`) era la única de las 3 LOD sin transición de hover/selección — panorama y cordel ya las tenían. Se agregó separador visual entre estratos, transición de hover/selección en `.commit`/`.ficha-commit`, animación `commit-select-pop` al cambiar de selección, y columna del rail ensanchada.
- **Resuelto parcialmente 2026-08-08**: cordel ya estaba completo (transición + `.selected` con detach animado + dimming de hermanas + hover preview) y no necesitó cambios. Panorama sí tenía un gap real: el marcador de fósil (`<g class="panorama-fossil">`) heredaba `pointer-events: none` de su propia regla, así que un click de mouse nunca disparaba `onFossilClick()` — caía al hit-rect del día debajo; sólo Enter (foco+teclado) andaba. Corregido a `pointer-events: auto` + hover/focus-visible con scale-pop en la concha/núcleo del fósil, transición de fill en el hit-rect del día, animación `band-select-pop` al aparecer la banda de selección de día, y hover feedback en los chips `.notebook-fossil` (no tenían ninguno). El resto del grab-bag (densidad, jerarquía general) sigue abierto — sin caso concreto que lo pida todavía.
- **Target**: §19.16f.

### Índice de búsqueda persistido por familia (`idx-<family>-main`)

- **Qué**: §12 13b-ii describe un índice MiniSearch por familia cacheado en IndexedDB, así el switch sólo paga rebuild la primera vez.
- **Por qué se difirió**: confirmado 2026-08-04 al implementar comments/draft (ver abajo) que esto **no aporta nada real** con la arquitectura actual — `WorkspaceRefreshService.refreshAll()` ya recorre disco en cada switch de variante para repoblar el estado propio de cada feature (listas, walls, no sólo el índice), así que cachear aparte el índice `main` no ahorra ese walk, sólo agrega complejidad sin beneficio medible. Dejaría de aplicar si `refreshAll()` alguna vez deja de walkear disco en cada switch por otra razón.
- **Target**: sin asignar (no vale la pena reabrir sin un cambio de arquitectura en `refreshAll()` primero).

### Índice de búsqueda de commits (full-text sobre mensajes + entidades tocadas)

- **Qué**: un índice MiniSearch sobre el log de commits (mensaje + entidades tocadas) integrado al palette global, para poder buscar "¿cuándo toqué X?" sin abrir `/history` y escanear estratos a mano.
- **Por qué se difirió**: misma familia de problema que los índices de `main`/`comments`/`draft` diferidos arriba — requiere decidir priming al boot y si comparte infraestructura con esos índices. Se agrupa con ellos para diseñarse una sola vez.
- **Target**: §19.16d (pulido de búsqueda) — junto con los índices por familia ya diferidos.

### `.git/` en OPFS para acelerar operaciones git

- **Qué**: mover `.git/` (loose objects + refs + index) al Origin Private File System del browser, dejando sólo el workdir visible en la carpeta del usuario via FS Access. isomorphic-git acepta nativamente `dir` (workdir) y `gitdir` separados. La ganancia esperada es 10-100×: cada syscall sobre OPFS cuesta ~5-10 ms vs ~100-200 ms sobre FS Access. Eso bajaría el commit base de ~3 s a ~200 ms.
- **Por qué se difirió**: las mediciones del validador en 13a (`DevPerfService`) confirmaron el piso de 3 s/commit, pero la decisión de producto fue aceptar pantallas de carga contextuales para las operaciones git disparadas por el usuario (switch de variante, merge, accept de diff-mark, crear/borrar variante) en vez de invertir 2-3 horas y duplicar el modelo de FS clients. Patrón estándar de clientes git; se entiende como aceptable hasta que el uso real demuestre lo contrario.
- **Implicaciones si se aborda**: el export ZIP (paso 14) tiene que leer también OPFS. Si el usuario limpia datos del sitio, pierde el historial git (pero conserva sus notas y puede recuperar el historial desde GitHub si tenía push configurado en 13e). Riesgo nuevo: races entre main thread (autosave) y posibles workers de git — habría que serializar accesos.
- **Target**: sin asignar (sólo si la UX con loading screens resulta intolerable en uso real, especialmente en 13b switches frecuentes o 13d accept-spam).

---
