# Diferidos — Diálogos de carpetas (rename/move/delete)

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Migrar `handleFolderAction` del `confirm()`/`prompt()` nativo al dialog custom

- **Qué**: `core/folders/folder-crud.ts` (`handleFolderAction`) mezcla `prompt()` nativo (rename, move) con `confirm()` nativo (delete) en un único dispatcher compartido por todas las features que tienen árbol de carpetas. La migración de 2026-07-17 pasó todos los `confirm()` de delete de la app al `ConfirmDialogComponent`/`ConfirmController` propio (temeable, no bloquea el hilo), pero dejó afuera este archivo porque su flujo de rename/move depende de `prompt()` con input de texto libre, que el dialog custom no soporta (solo confirmar/cancelar).
- **Por qué se difirió**: para cubrir rename/move con el dialog custom hace falta un componente nuevo de input modal (o extender `ConfirmRequest` con un campo de texto opcional), más restructurar `handleFolderAction` — hoy es una función síncrona con `prompt()` bloqueante que devuelve `void`, migrarla a un flujo async cancelable con estado en el componente que llama es un cambio de forma, no solo de UI. El `confirm()` de delete dentro de esta misma función quedó nativo por consistencia con el resto del flujo (mezclar un dialog custom para delete y prompts nativos para rename/move en la misma función sería más raro que dejar los tres nativos).
- **Target**: sin asignar.
- **Origen**: sesión 2026-07-17 (migración de `window.confirm()` al `ConfirmDialogComponent` compartido, tras un audit de botones de eliminar).
