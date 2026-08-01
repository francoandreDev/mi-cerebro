# Fundamentos

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Cubre la plumbing sobre la que se monta cada entidad: el scaffolding del proyecto, los servicios core (errores, i18n, tema), el acceso al file system del usuario, la red de seguridad de escritura (migraciones + autosave + drafts) y la concurrencia entre pestañas. Las reglas transversales que rigen estos sistemas están en [`reglas.md`](../proyecto/reglas.md) §4 — acá se describe cómo cada pieza concreta las implementa.

## Scaffolding y stack

Angular 21 sobre bun, con PWA habilitada desde el arranque. Estructura de `src/app` separada en `core/` (servicios sin estado de UI, uno por subsistema), `features/` (containers y componentes por área de producto), `shared/` (componentes/utilidades reusables sin lógica de negocio) y `layout/` (shell de la app). Linter, Prettier y Husky corren en pre-commit.

## Errores

`core/errors/error.service.ts` centraliza el manejo de errores de la app: envuelve excepciones en `AppError` (`core/errors/app-error.ts`), con código y mensaje localizado, y evita que un stack trace crudo llegue al usuario. Los códigos están tipados en `core/errors/error.codes.ts` y documentados uno a uno en [`docs/errors.md`](../errors.md) (formato `MCB-<área>-<###>`, p. ej. `MCB-FS-001`, `MCB-AUT-005`). `core/errors/with-reauth.ts` envuelve operaciones que pueden fallar por pérdida de permiso del File System Access API y dispara el flujo de re-autorización.

## Internacionalización y tema

`core/i18n/i18n.service.ts` resuelve las cadenas de la UI (español, ver `core/i18n/locales/`). `core/theme/theme.service.ts` gestiona el tema activo (claro/oscuro/custom), persistido en `localStorage`; `theme-palette.ts`, `highlight-palette.ts` y `wcag.ts` calculan paletas derivadas y validan contraste mínimo AA para temas custom.

## Acceso al file system y onboarding

`core/fs/workspace.service.ts` es el punto de entrada al workspace del usuario: pide la carpeta raíz vía File System Access API, persiste el handle (`core/fs/handle-store.ts`) y expone el estado del permiso. `core/fs/fs.service.ts` concentra las operaciones de lectura/escritura (incluida escritura atómica); `core/fs/native-fs.ts` y `core/fs/native-fs.providers.ts` son el punto de extensión para adapters no-web (Tauri/Capacitor, ver códigos `MCB-FS-005`..`MCB-FS-007`). `core/fs/walk.ts` recorre el árbol de carpetas del workspace; `core/fs/workspace-refresh.service.ts` reconstruye el estado en memoria tras cambios externos.

El primer arranque pide la carpeta, y si el permiso se revoca en una sesión posterior (`MCB-FS-004`) o la carpeta raíz fue movida/borrada (`MCB-FS-003`), un banner de re-autorización guía al usuario a volver a concederlo sin perder el estado de la sesión.

## Migraciones de schema

Cada archivo persistido lleva un campo `schemaVersion` (regla §4.15). `core/migrations/migrations.service.ts` aplica funciones puras `vN -> vN+1` por tipo de entidad (`core/migrations/migration.types.ts` define el contrato) al leer un archivo con versión vieja, antes de exponerlo al resto de la app. Antes de correr cualquier migración se genera un snapshot completo del workspace en `.mi-cerebro/pre-migration/<fecha>/`. La política es de compatibilidad hacia atrás estricta: nunca se rompe la lectura de versiones anteriores, y las migraciones son de un solo sentido. Ver también [`docs/migrations.md`](../migrations.md) para el detalle de convención de las funciones de migración.

## Autosave y drafts en IndexedDB

`core/autosave/autosave.service.ts` guarda borradores incrementales del contenido en edición en IndexedDB (no en disco) mientras el usuario escribe, para no depender de la latencia de escritura en el file system real ni perder trabajo ante un cierre inesperado de pestaña o crash del navegador. Al reabrir una entidad con un draft más nuevo que el último guardado en disco, la app ofrece recuperarlo. Fallas de escritura o lectura del draft se mapean a `MCB-AUT-001`/`MCB-AUT-002`.

## Concurrencia entre pestañas

Una entidad solo puede editarse en una pestaña a la vez (regla §4.16). El mecanismo es genérico y vive en `core/locks/`:

- `core/locks/lock.service.ts` es el servicio de bajo nivel: coordina claim/pong/release/takeover por `(kind, id)` sobre un `BroadcastChannel` llamado `mc-locks` (`core/locks/lock-channel.ts`), y expone el estado como signal con los valores `idle | owned | foreign | evicted`. El takeover es optimista y el release es best-effort en `beforeunload`.
- `core/locks/entity-lock.controller.ts` (`EntityLockController`) es la capa de integración por entidad: parametrizado por `kind`, orquesta el acquire al abrir una entidad y el release al cerrarla o navegar a otra ruta. Lo usan todos los containers de entidad (notas, tareas, metas, escritos, libros, galerías, colecciones de archivos).

Cuando el estado del lock es `foreign` o `evicted`, el editor, el título y el tag-picker de la entidad pasan a solo-lectura. `shared/lock-banner` (entity-agnostic, recibe labels por entidad) muestra el banner correspondiente: para `foreign`, las acciones son "Abrir solo lectura" / "Tomar control"; para `evicted`, "Entendido". "Tomar control" fuerza el takeover y la pestaña desalojada muestra `MCB-AUT-006`. Si un write programático llega mientras la entidad está en solo-lectura, `guardWrite()` lo bloquea y reporta `MCB-AUT-005`.
