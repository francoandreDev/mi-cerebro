# Testing

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Dos capas, cada una cubre lo que la otra no puede.

## Unit (Vitest, vía `ng test`)

`@angular/build:unit-test` sobre Vitest en jsdom, con `TestBed`. Cubre lógica de componentes/servicios (specs `*.spec.ts` junto al archivo que testean). `FsStub`/`WorkspaceStub` (`core/fs/fs.stub.ts`) simulan `NativeFs`/`WorkspaceService` en memoria para las specs de servicios de entidad (notes, tasks, goals, folders, tags, trash, drafts, comments...). jsdom no calcula layout real, así que bugs puramente visuales (grids rotos, overflow) son invisibles para esta capa sin importar cuántos tests se agreguen — de ahí la capa e2e de abajo.

## E2E (Playwright, `bun run e2e`)

Decisión de alcance (`docs/proyecto/roadmap-22-25.md` ítem 24, 2026-08-03): **smoke funcional únicamente** — click-through de flujos críticos (crear/editar/borrar entidad, navegación básica). Sin regresión visual por screenshot-diff: las secciones de esta app se rediseñan visualmente con frecuencia, y el costo de re-aprobar baselines en cada rediseño intencional no se paga solo con la frecuencia real de bugs puramente visuales.

- `playwright.config.ts` — un solo proyecto (`chromium`), `webServer` levanta `bun run start` (`ng serve`) contra `http://localhost:4200`.
- `e2e/*.spec.ts` — specs actuales: `onboarding.spec.ts` (welcome card → app shell), `navigation.spec.ts` (rail navega Notes/Tasks/Goals/Calendar), `notes-crud.spec.ts` (crear vía el compose inline, abrir, renombrar, borrar con confirmación).
- `e2e/support/workspace.ts` — `enableE2eFs()` + `completeOnboarding()`, ver abajo.

### El problema del picker nativo, y cómo se resolvió

La app es front-only sobre File System Access API: el primer arranque exige `window.showDirectoryPicker()` (`features/onboarding/`, ver `fundamentos.md`), un diálogo nativo del SO que Playwright no puede automatizar. La solución no toca `WorkspaceService` ni el flujo de onboarding — reusa el seam que ya existía para Tauri/Capacitor:

- `core/fs/native-fs.ts` define `NativeFs` (interfaz) + el token `NATIVE_FS`, con un adapter por plataforma (`BrowserNativeFs`, `TauriNativeFs`, `CapacitorNativeFs`) elegido en `native-fs.providers.ts` según `PlatformService.current`.
- `core/fs/adapters/e2e-native-fs.ts` (`E2eNativeFs`) suma un cuarto adapter: un filesystem en memoria (`Map<path, FsNode>` a nivel de módulo) que implementa `NativeFs` completo, con el mismo patrón `PathDirRef` que ya usan Tauri/Capacitor (estructuralmente clonable, así que `HandleStore` lo persiste en IndexedDB sin cambios). `pickDirectory()` no muestra ningún diálogo — crea/devuelve la raíz fija al toque, igual que el bootstrap fijo de Capacitor.
- `native-fs.providers.ts` resuelve `E2eNativeFs` cuando `window.__E2E_FS__ === true`, chequeado _antes_ del switch por `PlatformService.current` (que sigue siendo `'browser'` bajo Playwright/Chromium — el flag gana igual). `e2e/support/workspace.ts#enableE2eFs()` setea ese flag vía `page.addInitScript()`, así que está presente antes de que arranque cualquier script de la app. El flag nunca se setea en una sesión real.
- Todo lo que existe encima de `NativeFs` (versionado/isomorphic-git incluido — `GitFsAdapter` ya es agnóstico de adapter, ver `versionado.md`) funciona igual contra el fake sin cambios adicionales.

Un test real (`notes-crud.spec.ts`) encontró un bug de fidelidad en el propio fake durante su desarrollo: `readJson`/`readFile` no distinguían "archivo no existe" de "archivo corrupto" (ambos tiraban el mismo `AppError` genérico), así que un workspace recién creado disparaba el error `MCB-VER-006` ("variants.json ilegible") en vez de caer en el default silencioso que el resto de los adapters sí produce — `variants.io.ts#isNotFound()` narrowea sobre `DOMException('...', 'NotFoundError')` como `cause`. Fix: `E2eNativeFs` ahora lanza esas rutas vía `classifyFsError(notFound(name), ...)`, igual que los otros tres adapters.

### Convención para specs nuevas

- Todo test que necesite un workspace listo llama `enableE2eFs(page)` antes de cualquier `page.goto()`, y `completeOnboarding(page)` después del primer `goto('/')` (hace click en "Elegir carpeta" si el welcome card está visible, espera el rail del sidebar, y descarta con Escape el tutorial de Command Palette que auto-arranca en toda sesión nueva).
- Selectores: `getByRole`/`getByText` sobre el texto/aria-label real (la UI es español-only, sin locale alternativo que rompa el matching) — no hay convención de `data-testid` para e2e todavía; se reusa lo que exponga cada componente (`data-tutorial` donde ya exista, aria-labels si no).
- El árbol en memoria de `E2eNativeFs` es a nivel de módulo, no de instancia — persiste dentro de una misma carga de página (varias navegaciones de un mismo test comparten workspace) pero se resetea en cada `page.goto()` de un test nuevo, que es exactamente lo que un fresh start de Playwright espera.
