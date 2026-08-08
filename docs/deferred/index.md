# Diferidos — índice

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra del archivo de tema correspondiente.

Formato por entrada (dentro de cada archivo de tema):

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (`docs/proyecto/`) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Este índice es sólo un mapa de temas — no lista ítems individuales. Para eso, abrí el archivo del tema. Se actualiza cuando aparece o se cierra un **tema entero** (un archivo nuevo, o uno que queda vacío y se borra), no en cada ítem individual.

---

- [`reminders-goals.md`](./reminders-goals.md) — recordatorios (incluido el "palomar") y metas/constelaciones.
- [`responsive.md`](./responsive.md) — pantallas mobile pendientes de verificación/rediseño.
- [`versionado.md`](./versionado.md) — versionado, variantes, historial, merges. **Sección más extensa/compleja — atacar al final.**

---

## Trabajo paralelo

Si se van a atacar varios ítems de este directorio en simultáneo (varios agentes/worktrees a la vez), ver [`trabajo-paralelo.md`](./trabajo-paralelo.md) — regla de agrupación por tema desacoplado, mecánica de worktrees y orden de merge.
