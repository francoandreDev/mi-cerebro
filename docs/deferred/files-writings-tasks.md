# Diferidos — Archivos, escritos y tareas

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Archivos (origen: rediseño /files — tablero de evidencia)

### Hilos entre items relacionados

- **Qué**: el rediseño "cork board" sugiere visualmente la idea de items vinculados con hilos. Hoy no hay modelo de relaciones entre `FileItem`s, así que la pieza queda como puro decorado pendiente.
- **Por qué se difirió**: introducir relaciones requiere extender `FileCollection`/`FileItem` con un grafo (id origen, id destino, opcional label), persistirlo en `_collection.json`, manejar deletes (limpiar hilos huérfanos), y diseñar UX para crear/borrar el hilo. Es un feature autónoma de tamaño propio, no parte del cambio visual.
- **Target**: sin asignar — abrir si aparece demanda real de "agrupar archivos relacionados dentro de una colección".

### Posición libre real (drag x/y) en el tablero

- **Qué**: en lugar de grilla con jitter determinista, dejar que el usuario arrastre cada artefacto a una coordenada arbitraria del corcho y persistirla.
- **Por qué se difirió**: implica nuevo `x,y` por item en el schema (migración + bump de `FILE_COLLECTION_SCHEMA_VERSION`), resolver overflow/colisiones al resize de ventana, hit-test de drop sobre el board, y modo "auto-acomodar" para colecciones nuevas. El jitter determinista ya transmite el feeling sin tocar disco ni schema.
- **Target**: sin asignar.

## Escritos (origen: rediseño /writings)

### Parser de fecha natural — alcance ampliado

- **Qué**: el `@hint` actual soporta hoy/mañana/pasado, días de la semana, "en Nh/Nm/Nd" y horas (24h y am/pm). Faltan: "viernes que viene", "fin de semana", "próximo mes", fechas absolutas "15/07", parsing dentro del título sin `@`.
- **Por qué se difirió**: cobertura actual cubre los casos cotidianos; lo demás suma complejidad de parser y ambigüedad UX (cuándo `Llamar 15` significa hora 15 vs día 15). Mejor evaluar uso real antes de extender.
- **Target**: sin asignar.
