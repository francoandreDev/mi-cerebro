# Diferidos — Responsive mobile

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Responsive mobile — pantallas pendientes (origen: §21, 2026-07-10)

### Verificación visual real (dispositivo/navegador) de todo §21

- **Qué**: confirmación visual **a nivel píxel** (legibilidad, jerarquía, que cada metáfora se vea bien) de las pantallas mobile — sigue sin poder hacerse.
- **Por qué se difirió**: el bridge de captura de pantalla de Chrome (`Page.captureScreenshot`, uso vía `claude-in-chrome`) es conocido por fallar de forma intermitente entre WSL y Windows — no es un bug de la app, es infraestructura del entorno de desarrollo.
- **Avance 2026-07-20**: chequeo estructural (ausencia de overflow horizontal) confirmado vía DOM real en `<iframe>` con ancho controlado en 12 rutas × 4 anchos.
- **Avance 2026-08-10**: reampliado el chequeo estructural a las **19 rutas** actuales de la app (agrega `/dashboard`, `/lists`, `/reminders`, `/music`, `/trash`, que no existían en la pasada original) × 375/700/900/1300px — **0 overflow horizontal en las 19**, workspace real del usuario (no fixtures). Además, para el bottom-sheet mobile nuevo de History (ver más abajo), se confirmó vía `getComputedStyle`/`getBoundingClientRect` sobre el DOM real dentro del iframe que la regla aplica correctamente con datos reales (`position: fixed`, ancho completo, `max-height` = 60vh). El bridge de screenshot se probó de nuevo en esta sesión — timeout consistente en `Page.captureScreenshot` (6+ intentos, con reconexiones intermedias del resto del bridge que sí funcionó: navegación, clicks, JS eval), confirmando que sigue siendo el mismo problema de siempre, no algo nuevo. **Decisión del usuario 2026-08-10: se deja sin confirmar visualmente por ahora** — no se fuerza más.
- **Target**: sin asignar — retomar cuando el bridge de captura ande, o el usuario haga su propia pasada visual.
