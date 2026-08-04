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

### Granularidad por faceta dentro del bundle de merge

- **Qué**: en 13b–d el merge ofrece elegir por entidad el bundle entero (main + draft + comments de la variante origen). Una versión avanzada permitiría tomar `main` de la variante origen pero quedarse con el `draft` o los `comments` de la variante destino.
- **Por qué**: cubre un caso raro y agrega 3× botones por delta en la UI de merge. Decisión explícita de "simple gana".
- **Target**: sin asignar (se agrega si aparece demanda real).

### Variantes sobre el fallback sin isomorphic-git

- **Qué**: si el adapter de isomorphic-git resulta inviable en 13a y se cae al fallback de snapshots en `.mi-cerebro/history/`, las variantes (13b en adelante) no son soportables. La app degrada a una sola "Principal" implícita.
- **Por qué**: implementar variantes sin git significaría reinventar branching + merge desde cero. No vale la pena hasta confirmar que isomorphic-git no funciona.
- **Target**: sin asignar (sólo se aborda si el fallback se activa en 13a).

### Pulido visual general de `/history`

- **Qué**: cuando cerramos 13a el usuario confirmó que la información está completa y legible pero "mucha info, poco visual". Queda como ítem único agrupador para futuras iteraciones de tipografía, densidad, jerarquía y micro-interacciones del historial (anchos de columna, separadores entre buckets, hover states, animación del cambio de selección, etc.).
- **Por qué se difirió**: estructura y funcionalidad están; el polish entra cuando 13a-d estén cerrados y tengamos uso real para saber qué duele.
- **Target**: §19.16f.

### Preview inline del diff en hover sobre la polaroid (zoom detalle)

- **Qué**: en la vista cordel (§rediseño /history v2 Fase 4), mostrar un preview del diff al hacer hover sostenido sobre una polaroid sin necesidad de seleccionarla y esperar a que la mesa de revelado la muestre abajo.
- **Por qué se difirió**: pulido visual evaluado como posible upgrade después de cerrar Fase 4; no se abordó porque click+mesa de revelado ya cubre el flujo principal sin estado adicional de hover.
- **Target**: §19.16f.

### Vista secundaria de constelaciones ("mapa de patrones de trabajo")

- **Qué**: vista alternativa tipo cielo estrellado que revele patrones de trabajo emergentes (ritmo, picos, gaps) en vez de commits individuales navegables. Se descartó como vista principal del rediseño de `/history` v2 porque encontrar un commit específico en un layout 2D estrellado es peor que en la cordillera/estratos/cordel, pero quedó anotada como posible vista secundaria.
- **Por qué se difirió**: opcional, muy posterior — sólo si el rediseño principal (cordillera/estratos/cordel) deja "hambre" de ese eje analítico distinto (patrones en vez de hechos puntuales).
- **Target**: sin asignar.

### Header del editor: "n commits desde {milestone}"

- **Qué**: 13a-bis grabó milestones como git tags anotados pero no expone "estás a n commits desde el milestone más cercano" en el header del editor de cada entidad. El roadmap lo describe como "contexto leve".
- **Por qué se difirió**: requiere walk del log desde HEAD hasta el primer commit con tag (por entidad o global), un computed que reacciona a cada autocommit, y un slot visual en el header del editor que hoy ya está cargado de chips (autosave, lock, tags). Sumado a que `/history` ya muestra los milestones inline, el valor incremental es marginal hasta tener varios milestones reales en uso.
- **Target**: §19.16f (pulido del historial).

### Índice de búsqueda persistido por familia (`idx-<family>-main`)

- **Qué**: §12 13b-ii describe un índice MiniSearch por familia cacheado en IndexedDB, así el switch sólo paga rebuild la primera vez.
- **Por qué se difirió**: confirmado 2026-08-04 al implementar comments/draft (ver abajo) que esto **no aporta nada real** con la arquitectura actual — `WorkspaceRefreshService.refreshAll()` ya recorre disco en cada switch de variante para repoblar el estado propio de cada feature (listas, walls, no sólo el índice), así que cachear aparte el índice `main` no ahorra ese walk, sólo agrega complejidad sin beneficio medible. Dejaría de aplicar si `refreshAll()` alguna vez deja de walkear disco en cada switch por otra razón.
- **Target**: sin asignar (no vale la pena reabrir sin un cambio de arquitectura en `refreshAll()` primero).

### Índice de búsqueda de commits (full-text sobre mensajes + entidades tocadas)

- **Qué**: un índice MiniSearch sobre el log de commits (mensaje + entidades tocadas) integrado al palette global, para poder buscar "¿cuándo toqué X?" sin abrir `/history` y escanear estratos a mano.
- **Por qué se difirió**: misma familia de problema que los índices de `main`/`comments`/`draft` diferidos arriba — requiere decidir priming al boot y si comparte infraestructura con esos índices. Se agrupa con ellos para diseñarse una sola vez.
- **Target**: §19.16d (pulido de búsqueda) — junto con los índices por familia ya diferidos.

### Compactación manual sobre rango específico

- **Qué**: además de la pasada background automática, una acción "Compactar este rango" desde `/history` que permita al usuario seleccionar un span de commits y forzar la fusión, respetando las barreras (tags, `before-restore`, `Merge-Group`).
- **Por qué se difirió**: la compactación background con buckets por edad cubre el caso 95%. Compactación manual es una herramienta avanzada que se justifica si el usuario quiere "limpiar" un período específico sin esperar al auto. Sin uso real no hay forma de saber si vale la UI.
- **Target**: sin asignar.

### `.git/` en OPFS para acelerar operaciones git

- **Qué**: mover `.git/` (loose objects + refs + index) al Origin Private File System del browser, dejando sólo el workdir visible en la carpeta del usuario via FS Access. isomorphic-git acepta nativamente `dir` (workdir) y `gitdir` separados. La ganancia esperada es 10-100×: cada syscall sobre OPFS cuesta ~5-10 ms vs ~100-200 ms sobre FS Access. Eso bajaría el commit base de ~3 s a ~200 ms.
- **Por qué se difirió**: las mediciones del validador en 13a (`DevPerfService`) confirmaron el piso de 3 s/commit, pero la decisión de producto fue aceptar pantallas de carga contextuales para las operaciones git disparadas por el usuario (switch de variante, merge, accept de diff-mark, crear/borrar variante) en vez de invertir 2-3 horas y duplicar el modelo de FS clients. Patrón estándar de clientes git; se entiende como aceptable hasta que el uso real demuestre lo contrario.
- **Implicaciones si se aborda**: el export ZIP (paso 14) tiene que leer también OPFS. Si el usuario limpia datos del sitio, pierde el historial git (pero conserva sus notas y puede recuperar el historial desde GitHub si tenía push configurado en 13e). Riesgo nuevo: races entre main thread (autosave) y posibles workers de git — habría que serializar accesos.
- **Target**: sin asignar (sólo si la UX con loading screens resulta intolerable en uso real, especialmente en 13b switches frecuentes o 13d accept-spam).

### CORS proxy propio para push/fetch a GitHub

- **Qué**: 13e-i usa `https://cors.isomorphic-git.org` (proxy público mantenido por la lib) para sortear CORS de GitHub HTTPS. Funciona pero es un single point of failure operado por terceros; el plan a largo plazo es un proxy propio (Cloudflare Worker o similar) que el usuario apunta desde `/settings`.
- **Por qué se difirió**: levantar y mantener un proxy propio requiere infra externa al repo. Para el smoke push inicial y uso single-user el proxy público sirve; el usuario está advertido en la UI.
- **Target**: §19.16f.

---
