# Diferidos — Sync

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Sync — UI (origen: rediseño /sync — tubos neumáticos, 2026-07-11)

### Detalles bonitos opcionales (silbido, sombra de cápsula, contador diario)

- **Qué**: silbido suave al despachar una cápsula (respetando el mute global), sombra de la cápsula proyectada sobre el tubo, contador acumulado discreto ("N envíos hoy") sólo si sale barato de derivar del histórico de `lastBulkAt`.
- **Por qué se difirió**: pulido visual/sonoro de baja prioridad explícitamente fuera del MVP del rediseño de `/sync`. El latón/madera del cuadro de mandos y la animación honesta de la cápsula en vuelo (sin barra de progreso falsa) ya se cerraron.
- **Target**: sin asignar.
