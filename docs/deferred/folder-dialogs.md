# Diferidos — Diálogos de carpetas (rename/move/delete)

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## ~~Migrar `handleFolderAction` del `confirm()`/`prompt()` nativo al dialog custom~~ (resuelto 2026-07-20)

- **Qué**: `core/folders/folder-crud.ts` (`handleFolderAction`) mezclaba `prompt()` nativo (rename, move) con `confirm()` nativo (delete) en un único dispatcher compartido por todas las features que tienen árbol de carpetas.
- **Estado**: cerrado. Se creó `shared/folder-action-dialog/` (`FolderActionDialogComponent` + `FolderActionDialogController`, mismo patrón que `ConfirmController`/`ConfirmDialogComponent`) con un flujo de 3 pasos (elegir acción → input de texto para rename/move, o confirmación para delete). `handleFolderAction` se reemplazó por `openFolderActionDialog` (síncrona, no bloqueante, dispara el diálogo y delega el resultado a callbacks `onRename`/`onMove`/`onDelete` con su propio try/catch hacia `ErrorService`), cableada en los 8 containers de features con árbol de carpetas más `workspace-sidebar.container.ts`. `handleCreateFolder` (un solo `prompt()` para el nombre de la carpeta nueva) y `handleEntityAction` (mover una entidad a otra carpeta) quedaron fuera de este cierre — mismo problema, pero no eran el ítem diferido.
- **Target**: sesión 2026-07-20.
- **Origen**: sesión 2026-07-17 (migración de `window.confirm()` al `ConfirmDialogComponent` compartido, tras un audit de botones de eliminar).
