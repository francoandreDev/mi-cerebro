# Diferidos — Archivos, escritos y tareas

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Escritos (origen: rediseño /writings)

### Parser de fecha natural — parsing sin `@` en el título

- **Qué**: el parser (`features/reminders/utils/parse-due.ts` — nota: vive en **reminders**, no en escritos; esta entrada quedó mal ubicada desde el origen) ahora cubre hoy/mañana/pasado, días de la semana (+ sufijo "que viene"), "fin de semana", "próximo mes", fechas absolutas `dd/mm[/aaaa]`, "en Nh/Nm/Nd" y horas (24h y am/pm) — ver `docs/sistema/calendario-recordatorios-configuracion.md`. Queda afuera únicamente detectar la fecha dentro del título sin marcador `@` (ej. `Llamar mamá mañana 9`).
- **Por qué se difirió**: ambigüedad UX real, no falta de tiempo — `Llamar 15` puede leerse como hora 15 o día 15 sin marcador que lo distinga. Requiere una heurística explícita (o UI que confirme la interpretación) antes de implementarse, para no violar "la UI no debe mentir" adivinando mal.
- **Target**: sin asignar.
