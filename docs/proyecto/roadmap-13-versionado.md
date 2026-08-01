# Roadmap — item 13 (versionado y variantes)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

12. **Music player.** _Cerrado — ver [`docs/sistema/musica.md`](../sistema/musica.md)._
13. **Versionado y variantes.** Sistema combinado de autocommits + variantes + historial navegable sobre isomorphic-git con adapter propio a File System Access API. Dividido en sub-pasos:
    - **13a.** Autocommit + timeline + restore sobre una variante implícita. _Cerrado — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
      - **Cerrado 2026-06-11.** _Ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
    - **13a-bis.** Milestones nombrados (git tags). _Cerrado 2026-06-11 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
    - **13b.** Variantes (familias) + switch + lifecycle + merge sobre `main`. Modelo de familia de 3 ramas por variante (`main`/`draft`/`comments`). Errores reservados `MCB-VER-004..012` (asignación fina por sub-paso). **Partido en cuatro sub-pasos, cada uno cierra con un criterio de validación duro antes de avanzar — la prioridad es que el sistema de versionado sea confiable, no rápido de cerrar.**
      - **13b-i. Modelo + servicio de variantes (sin UI de switch).** _Cerrado — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._

      - **13b-ii. Switch de variante activa + sincronización entre pestañas.** _Cerrado — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._

      - **13b-iii. Pantalla `/variants` + lifecycle de reposo.** _Cerrado — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._

      - **13b-iv. Merge entre variantes (limitado a `main`).** Cierra 13b. _Cerrado — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._

    - **13c.** Comentarios anclados. Errores `MCB-VER-019..021` (saltan 013-018 ya reservados/usados por 13b y 13a-bis). **Partido en cuatro sub-pasos**, mismo patrón que 13b — la prioridad es que el sistema sea confiable, no rápido de cerrar. **Cerrado en bloque 2026-06-12 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md).** Única pieza diferida: el índice de búsqueda global para comentarios (`idx-<family>-comments`), pateado a §19.16d — registrado en `docs/deferred/index.md`.
      - **13c-i. Extensión TipTap de block-ids + migración formal v1 → v2.** _Cerrado 2026-06-12 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
      - **13c-ii. Comments branch I/O via plumbing + service + errores.** _Cerrado 2026-06-12 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
      - **13c-iii. Comments side panel UI + i18n + a11y.** _Cerrado 2026-06-12 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._ (Nota: el side panel descrito en este sub-paso fue reemplazado por la vista combinada de 13f/13g; el documento de sistema describe la UI actual.)
      - **13c-iv. Position tracking + merge bundle ext + history filter chips.** Cierra 13c. _Cerrado 2026-06-12 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
    - **13d.** Borrador anclado (track-changes). Errores `MCB-VER-022..024`. **Partido en cuatro sub-pasos**, mismo patrón que 13b/13c — la prioridad es que el sistema sea confiable, no rápido de cerrar. **Cerrado en bloque 2026-06-12 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md).** Única pieza diferida: ghost rendering inline para inserciones (el popover ya las cubre) y el índice de búsqueda global para drafts (`idx-<family>-draft`), ambos en `docs/deferred/index.md`.
      - **13d-i. Drafts branch I/O + diff-mark model + errores.** _Cerrado — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
      - **13d-ii. Draft mode toggle + capture as marks (no apply a main).** _Cerrado — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._ (Nota: el toggle global descrito en este sub-paso fue eliminado por el rediseño de 13f/13g; ver documento de sistema para la UI actual.)
      - **13d-iii. Drafts side panel + decoraciones inline + accept/reject.** _Cerrado 2026-06-12 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._ Commit `111e8f6`. (Nota: el side panel fue reemplazado por la vista combinada de 13f/13g.)
      - **13d-iv. Drafts merge bundle + history chip validation.** Cierra 13d. _Cerrado 2026-06-12 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
    - **13e.** Push a GitHub. Primera fase en abrir red — regla §4.14 sigue valiendo, sólo `git push/fetch` disparados por configuración explícita del usuario. Errores `MCB-NET-001..008`. **Partido en cuatro sub-pasos**, mismo patrón que 13b/13c/13d. _Ver [`docs/sistema/versionado.md`](../sistema/versionado.md) para el sistema completo._
      - **13e-i. Remote config + PAT storage + smoke push.** _Cerrado 2026-06-13 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
      - **13e-ii. Push y pull de N×3 ramas (todas las variantes completas).** _Cerrado 2026-06-13 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
      - **13e-iii. Detección de divergencia + handoff a `/variants/merge`.** _Cerrado 2026-06-13 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._
      - **13e-iv. Auto-push throttled + status panel + cierre 13e.** _Cerrado 2026-06-13 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._ **Smoke test manual contra GitHub real (toda la fase 13e) queda pendiente como gate del usuario.**

    - **13g.** Refinamientos post-13f, partido en dos sub-pasos independientes que cerraron en la misma sesión (2026-06-14). _Cerrado — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._ (Panel de borradores side-by-side y comentarios anclados al rango, ambos incorporados como forma actual del sistema.)

    - **13f.** Rediseño de comentarios y borradores → vista combinada. _Cerrado 2026-06-14 — ver [`docs/sistema/versionado.md`](../sistema/versionado.md)._ (Este sub-paso reemplaza los paneles laterales de 13c-iii/13d-iii por la vista combinada `clean`/`combined` con bubble menu, descrita como forma actual del sistema en el documento de sistema.)
