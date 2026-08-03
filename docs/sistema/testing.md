# Testing

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Dos capas, cada una cubre lo que la otra no puede.

## Unit (Vitest, vía `ng test`)

`@angular/build:unit-test` sobre Vitest en jsdom, con `TestBed`. Cubre lógica de componentes/servicios (specs `*.spec.ts` junto al archivo que testean). `FsStub`/`WorkspaceStub` (`core/fs/fs.stub.ts`) simulan `NativeFs`/`WorkspaceService` en memoria para las specs de servicios de entidad (notes, tasks, goals, folders, tags, trash, drafts, comments...). jsdom no calcula layout real, así que bugs puramente visuales (grids rotos, overflow) son invisibles para esta capa sin importar cuántos tests se agreguen — de ahí la capa e2e de abajo.

## E2E (Playwright, `bun run e2e`)

Decisión de alcance (`docs/proyecto/roadmap-22-25.md` ítem 24, 2026-08-03): **smoke funcional únicamente** — click-through de flujos críticos (crear/editar/borrar entidad, navegación básica). Sin regresión visual por screenshot-diff: las secciones de esta app se rediseñan visualmente con frecuencia, y el costo de re-aprobar baselines en cada rediseño intencional no se paga solo con la frecuencia real de bugs puramente visuales.

- `playwright.config.ts` — un solo proyecto (`chromium`), `webServer` levanta `bun run start` (`ng serve`) contra `http://localhost:4200`.
- `e2e/*.spec.ts` — specs actuales: `onboarding.spec.ts` (welcome card → app shell), `navigation.spec.ts` (rail navega Notes/Tasks/Goals/Calendar), y un spec CRUD (crear, renombrar, borrar con confirmación) por entidad — `notes-crud.spec.ts`, `tasks-crud.spec.ts`, `goals-crud.spec.ts`, `lists-crud.spec.ts`, `writings-crud.spec.ts`, `books-crud.spec.ts`, `images-crud.spec.ts`, `files-crud.spec.ts` — las 8 entidades con CRUD real (Trash no aplica: no crea, sólo recibe borrados de otras).
- `e2e/support/workspace.ts` — `enableE2eFs()` + `completeOnboarding()`, ver abajo.

### Patrones que se repiten entre specs CRUD

- **Tutoriales por pantalla**: cada entidad tiene su propio tutorial con `autoStartIfUnseen: true` (`docs/sistema/tutoriales-atajos.md`), que se dispara la primera vez que se visita esa ruta en la sesión — encima del tutorial de Command Palette que `completeOnboarding()` ya descarta. Cada spec presiona `Escape` en su `beforeEach` justo después de navegar a la sección, y de nuevo tras entrar al editor si esa entidad tiene un tutorial propio del editor (ej. goals: el wall tiene uno y el lienzo de constelación otro, distinto).
- **Creación e2e ≠ visible en single-run**: bajo carga (suite completa con 8 workers en paralelo) el tutorial puede tardar más en aparecer que en una corrida aislada de un solo spec — un spec que pasa solo pero falla en la suite completa casi siempre es este patrón, no un bug real.
- **Título click-to-rename vs. input siempre editable**: la mayoría de los editores (tasks/lists/writings/books) muestran un `<input>` de título editable en todo momento (`getByRole('textbox', { name: 'Título...' })`). Goals es la excepción: el título es un `<button>` que se convierte en `<input>` recién al clickearlo (`goal-constellation-editor.component.html`) — hay que clickear antes de buscar el textbox.
- **Navegación en el mismo click que muta estado**: cuando un botón dispara `router.navigate()` en su propio handler de click (patrón común: crear entidad → navegar directo a su editor), un tutorial que aparece mid-click puede hacer que el elemento clickeado se desmonte antes de que Playwright complete su verificación de actionability, generando un retry-loop contra el overlay del tutorial en la página nueva. Mitigación usada en `goals-crud.spec.ts`: acotar el intento de click con `{ timeout }` + `.catch(() => {})` y confirmar el resultado por la URL en vez de confiar en que `click()` resuelva limpio.

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
