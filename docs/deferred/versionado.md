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
- **Resuelto parcialmente 2026-08-08**: cordel ya estaba completo (transición + `.selected` con detach animado + dimming de hermanas + hover preview) y no necesitó cambios. Panorama sí tenía un gap real: el marcador de fósil (`<g class="panorama-fossil">`) heredaba `pointer-events: none` de su propia regla, así que un click de mouse nunca disparaba `onFossilClick()` — caía al hit-rect del día debajo; sólo Enter (foco+teclado) andaba. Corregido a `pointer-events: auto` + hover/focus-visible con scale-pop en la concha/núcleo del fósil, transición de fill en el hit-rect del día, animación `band-select-pop` al aparecer la banda de selección de día, y hover feedback en los chips `.notebook-fossil` (no tenían ninguno).
- **Rediseño mobile dedicado 2026-08-10** (cierra `responsive.md` "History — rediseño mobile"): panorama y strata reemplazaron su red de seguridad (`@media max-width:480px { .split { grid-template-columns: 1fr } }`) por un archivo `*.mobile.css` propio (`styleUrls` múltiple, split por responsabilidad desktop/mobile — ambos `.css` desktop ya superan el límite duro de 300 líneas, así que el mobile no se agregó ahí) donde la "libreta de campo"/"ficha de yacimiento" pasa a bottom-sheet fijo (mismo patrón que `reminders.container.css`), retirado del flujo vía `:has()` cuando no hay selección (Chromium-only, §2, seguro de usar). Cordel no necesitó cambios — su clothesline ya scrollea horizontal y su breakpoint de 720px en `.mesa-toolbar` ya cubre el caso. El rail de switcher de zoom (`.zoom-control` en `history.container.css`) ganó su propio breakpoint a 480px (esconde el label de texto, apila el toggle de constelación). Confirmado a nivel DOM/CSS computado con el workspace real del usuario a 375px (`position:fixed`, ancho completo, `max-height` correcto); confirmación visual a nivel píxel sigue bloqueada por el bridge de captura (ver `responsive.md`). Durante esta pasada no surgió ningún caso concreto de densidad/tipografía/jerarquía rota — el resto del grab-bag de pulido general sigue sin un pedido específico que lo motive (YAGNI).
- **Target**: sin asignar — el resto del pulido (densidad, jerarquía general) se abre sólo si aparece un caso concreto.

---
