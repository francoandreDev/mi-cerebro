# Diferidos — Recordatorios y metas

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Metas — pasos como estrellas (origen: schema v6, 2026-06-24; canvas editor v7, 2026-06-24)

### Drag-to-reposition de estrellas existentes en el editor

- **Qué**: hoy en el editor `/goals/:id` se "siembran" pasos clickeando el lienzo (persiste `x/y` en el step), pero no hay forma de reposicionar uno ya creado salvo borrarlo y recrearlo. Agregar drag desde la estrella misma con preview de líneas MST recalculadas en vivo.
- **Por qué se difirió**: el flujo de creación con click cubre el caso principal; reposicionar requiere distinguir "click corto" (toggle done) de "drag" (mover) con threshold de píxeles, manejar touch, y mantener responsive al resize. Implementación tarea aparte.
- **Target**: sin asignar.

### Layout libre de la constelación en la wall (drag de la meta entera)

- **Qué**: en `/goals` el centroide de cada meta deriva del hash de su id. Una versión avanzada permite arrastrar la constelación entera en la wall y persistir esa posición (en el `Goal` o side-car de layout).
- **Por qué se difirió**: el layout hash-based cubre el caso sin nuevo estado. Persistir requiere otro bump de schema y resolver colisiones/overflow al resize.
- **Target**: sin asignar.

### Lasso selection para multi-select de pasos

- **Qué**: shift+click para selección múltiple de pasos (toggle/eliminar en lote) ya está resuelto (`createMultiSelect`, `GoalSelectionToolbarComponent`). Queda afuera la variante "lasso" (arrastrar un rectángulo sobre el lienzo para seleccionar todo lo que cae adentro).
- **Por qué se difirió**: el `<svg>` del lienzo ya sobrecarga `(click)` para crear pasos y drag de estrella (`onStarDown/Move/Up` con `stopPropagation` + flag `suppressCanvasClick` para no disparar el click sintetizado). Meter un lasso de fondo ahí requeriría rehacer esa coreografía de pointer events sin romper pan/drag/creación — shift+click ya cubre el caso principal.
- **Target**: sin asignar.

---

## Recordatorios — Palomar (origen: rediseño palomar 2026-06-25)

### Animaciones de snooze / "tomar papelito" manual

- **Qué**: gestos manuales del paso 5 todavía sin cablear. El disparo del scheduler ya está implementado (puerta de la jaula se abre progresivamente, paloma vuela hasta el rail icon de `/reminders`, picotea, vuelve a la jaula si es recurrente o cae si es puntual). Falta: snooze posa la paloma en la repisa con animación; marcar hecho manual hace volar la paloma fuera de pantalla.
- **Por qué se difirió**: las animaciones disparadas por el scheduler son las críticas para que el palomar "funcione" como metáfora; los gestos manuales pueden quedar para una pasada de pulido sin perder lectura del estado.
- **Target**: sesión siguiente del redesign de `/reminders`.

### Detalles bonitos: plumitas que caen, plumaje rico, ronroneo

- **Qué**: paso 6 del plan. El aleteo ya quedó (la paloma voladora flapea el ala durante el vuelo). Faltan: plumitas que caen al pasar la paloma, plumaje más detallado en palomas recurrentes con muchos ciclos cumplidos, ronroneo/preview de mensaje en hover sostenido.
- **Por qué se difirió**: pulido visual de baja prioridad. Requiere modelo extra (`recurrence.cyclesCompleted`) para el plumaje y SVG más rico — no entra en el MVP del palomar.
- **Target**: sesión siguiente, después de las animaciones manuales.

### Palomares temáticos por categoría (como salas del museo)

- **Qué**: opcional mencionado en el plan original: separar el palomar en sub-palomares por tag/categoría, navegables como las salas del museo. Hoy se resuelve con filtros (fecha + nombre) sobre un único palomar.
- **Por qué se difirió**: los filtros del MVP ya resuelven el riesgo de saturación visual. Multi-palomar agrega complejidad de navegación que sólo vale si el usuario lo pide.
- **Target**: sin asignar.
