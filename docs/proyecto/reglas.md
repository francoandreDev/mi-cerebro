# Reglas del proyecto (§4)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

## 4. Reglas del proyecto

Reglas que rigen todo el desarrollo. Cualquier excepción se justifica en el commit.

### 4.1 Código

1. **TypeScript strict + `noUncheckedIndexedAccess`.** Cero `any` salvo excepción comentada.
2. **Standalone components.** Sin `NgModules` salvo que algo externo lo exija.
3. **Signals como estado primario.** RxJS solo donde brilla (streams, debounce, websockets).
   3b. **Effects + signals: nunca leer+escribir la misma señal en código alcanzado por un `effect`.** Dentro de un `effect`, cada lectura de una señal registra una dependencia. Un `set()` posterior con valor referencialmente distinto (`{}`, `[]`, objeto/array nuevo) re-dispara el effect aunque el contenido sea equivalente, generando loops infinitos silenciosos — Angular permite escrituras dentro de effects, así que no lo marca como error. **Regla:** todo método invocado desde un `effect`, directa o transitivamente _antes del primer `await`_, que lea+escriba la misma señal debe (a) envolver la lectura en `untracked(() => this.x())` y (b) guardar la escritura con un check de "ya está en el estado vacío" cuando el valor por defecto cree referencia nueva (`if (Object.keys(prev).length === 0) return`). `signal.update(fn)` ya es internamente untracked y es seguro. Después del primer `await`, el resto del body corre fuera del contexto del effect: read+write ahí también es seguro. **Incidente fundacional:** 2026-06-29 — freeze sync determinístico al navegar a `/images` porque `revokePreviewUrls()` leía y reseteaba la señal `previewUrls` desde un effect (5832+ re-runs antes de poder cerrar la tab). Fix aplicado en `galleries-index.container.ts` y `gallery-url-cache.ts`.
4. **Imports absolutos con alias:** `@core/...`, `@features/...`, `@shared/...`, `@layout/...`, `@styles/...`. Nada de `../../../`.
5. **Inglés en código** (variables, funciones, archivos, carpetas, commits, comentarios). Español solo en strings de UI, centralizados (regla 8).
6. **Sin comentarios que expliquen el qué.** Solo el porqué cuando no es obvio. Prefijo recomendado: `// why: ...`.
7. **Cero librerías de UI pesadas.** Nada de Material/PrimeNG. Componentes propios sobre CSS variables.
8. **i18n centralizado desde el día uno.** Todos los strings visibles pasan por un servicio/diccionario, no hardcodeados en templates.

### 4.2 Arquitectura

9. **Separación estricta `core/` / `features/` / `shared/` / `layout/`.**
   - `core/` = servicios singleton (FS, índice, tema, continuidad, recordatorios, versionado, autosave, errores, migraciones).
   - `features/` = cada entidad/sección, autocontenida.
   - `shared/` = componentes/directivas/pipes/utils reutilizables, sin estado.
   - `layout/` = la cáscara visual de la app (sidebar + outlet + mini-player).
10. **Comunicación entre features vía core.** Una feature nunca importa de otra feature.
11. **Toda I/O de disco pasa por `FsService`.** Ningún componente toca File System Access API directo.
12. **El índice de búsqueda se actualiza siempre desde `FsService`**, no desde los componentes. Garantiza que disco e índice no se desincronicen.

### 4.3 Subcarpetas dentro de las principales

- **`features/<entity>/`** estructura espejada:
  ```
  components/   # dumb components
  containers/   # smart components
  services/     # lógica específica de la feature
  models/       # interfaces/types
  <name>.routes.ts
  <name>.config.ts   # solo si hace falta
  ```
- **`core/`** por dominio: `fs/`, `idb/`, `index/`, `theme/`, `continuity/`, `reminders/`, `versioning/`, `autosave/`, `errors/`, `migrations/`, `tags/`, `i18n/`, `dnd/` (auto-scroll de borde durante drag-and-drop nativo, transversal a toda la app — ver `DragAutoScrollService`).
- **`shared/`** por tipo: `components/`, `directives/`, `pipes/`, `utils/`, `editor/` (wrapper TipTap propio, ver §11), `tree/` (árbol con filtro inteligente, ver §10), `tags/` (chip + picker de etiquetas, ver §2).
- **Regla de oro:** subcarpeta con un solo archivo no existe; se inlinea un nivel arriba. Nace cuando hay 2+ archivos relacionados.

### 4.4 Tamaño y responsabilidad de archivos

- **Límite blando: 200 líneas. Límite duro: 300.** Pasar 200 exige justificación; pasar 300 fuerza split.
- **Una responsabilidad por archivo.** Nada de `utils.ts` gigantes — agrupar por dominio (`date.utils.ts`, `string.utils.ts`).
- **No god files:** servicios con 7-8+ métodos públicos → señal de split. Componentes con 5+ inputs/outputs → revisar mezcla de responsabilidades.
- **Template inline solo si cabe en 20 líneas.** Mismo criterio para CSS.

### 4.5 Smart vs Dumb components

- **Dumb / presentational** → `components/`, sufijo `.component.ts`. Solo `input()` / `output()`. No inyectan servicios (excepto `I18nService` si aplica). No saben de FS, rutas, ni estado global.
- **Smart / container** → `containers/`, sufijo `.container.ts`. Inyectan servicios, leen estado, navegan, llaman a `FsService`. Componen dumb components y les pasan datos.
- Si un dumb empieza a necesitar un servicio: o sube a su container, o pasa a `containers/`. No mezclamos.

### 4.6 Estilo / UX

13. **CSS variables para todo lo temable.** Tema custom del usuario = override de variables guardado en IndexedDB.
14. **Desktop-first, mobile-responsive real.** El diseño se piensa para pantalla grande primero, pero "no se rompe en ventana chica" se cumple en serio: cada layout necesita al menos un breakpoint que evite overflow horizontal y contenido cortado en viewports de celular (~360-430px). No hay convención de breakpoint centralizada (ni token `--mc-breakpoint-*`, ni mixin) — cada componente hardcodea su propio `@media (max-width: …)`, igual que ya hacían calendar/notes-wall/history/music/reminders/settings/sync/writings-shelf/book-reader antes de este cambio. Rediagnosticado 2026-07-10: hasta entonces el shell global (`workspace-sidebar.container.ts`, el rail de íconos de 56px) no tenía ningún `@media`, así que en cualquier viewport angosto — sea ventana de escritorio chica o el navegador de un celular — el rail se comía una porción fija del ancho y el contenido de cada feature desbordaba sin wrap. Ver roadmap §21.
    14b. **Sin section pane por defecto.** El layout global mantiene el rail de íconos de entidad pero el panel intermedio (árbol/lista contextual) se oculta por ruta vía `PANE_HIDDEN_PREFIXES` en `workspace-sidebar.container.ts`. Cada página diseña su propio layout para usar el ancho ganado — idea distinta por entidad, no un patrón único. Migración cerrada 2026-07-14 (todas las páginas ✅); el checklist de migración vivía en `docs/redesign.md`, eliminado tras el cierre.
15. **Atajos de teclado de primera clase.** Ctrl+P para buscar, Ctrl+N para nueva entidad, etc. Vista de ayuda accesible. **Convención obligatoria de implementación** (audit gate para todo paso que introduzca un combo): cualquier atajo con modificador (Ctrl/Cmd/Alt/Shift) o letra global se registra en `ShortcutsService` — listener único en `document.keydown` capture-phase que llama a `event.preventDefault()` _antes_ de invocar el handler para que el navegador no dispare su acción default. El parser de `combo` es case-insensitive y trata `Ctrl`, `Control`, `Cmd`, `Command`, `Meta` como sinónimos del mismo modificador (matchea `event.ctrlKey || event.metaKey`), de modo que el mismo binding cubre Windows/Linux y macOS sin duplicar el registro. Único uso permitido de listeners ad-hoc (`@HostListener` o `(keydown.escape)` en plantilla) es para dismiss/confirm de un único elemento focuseable (modal, popover, row de lista) — esos también deben llamar `preventDefault()` cuando consumen la tecla. Cuando se planifique un nuevo atajo en un sub-paso del roadmap, declarar explícitamente: combo, scope (`global` vs `editable-safe`), preventDefault (siempre sí en service) y si se cablea por `ShortcutsService` o por listener local.

15b. **Tutorial guiado, como fallback del diseño auto-explicativo — por página y cross-página.** El diseño auto-explicativo (hints, leyendas, tooltips) sigue siendo la primera línea — el tutorial no lo reemplaza, cubre lo que un hint estático no puede narrar: una secuencia de pasos. `core/tutorials/` (`TutorialService`, mismo molde `register()`/disposer que `ShortcutsService`) + `shared/tutorial-overlay/` (spotlight sobre el elemento real vía `anchorSelector`, montado una sola vez en el shell). Se dispara solo la primera vez por página (`localStorage`, `TutorialService.register(def, { autoStartIfUnseen: true })`, guardado además contra dispararse por encima de un flujo cross-página ya activo) y es re-invocable desde un control fijo en el shell (`layout/components/page-help-control.component.ts`, íconos "Guía de la página" + "Atajos de la página"). **Cobertura: las 17 secciones tienen tutorial**, cada una con copy propio y dedicado (claves `<feature>.tutorial.<slug>.title`/`.body`), nunca reciclado de `core/home-content/home-content.ts` — ese archivo sigue siendo el contenido de las cards de la home (visión general de la sección), un consumidor totalmente distinto del tutorial en la página. Un `TutorialStep` describe un único gesto concreto; cuando ese gesto es real y detectable en la página, suma `action` (ver más abajo) — evitar empaquetar varios gestos en un mismo step (ej. "PageUp/Down pasa página, Alt+←/→ salta de capítulo, Ctrl+. activa focus mode" son 3 steps, no 1), siempre verificado contra el componente real. **`TutorialStep.action?: TutorialStepAction`** (`{ event: 'click'|'submit'|'keydown'|'dragstart', selector?, key?, ctrlOrMeta?, shiftKey? }`, `tutorial.types.ts`) deja que un step se practique con la interacción real en vez de solo leerse — `shared/tutorial-overlay/` instala un listener en `document` (capture phase) mientras ese step está activo y auto-avanza al detectarlo, sin deshabilitar nunca el botón "Siguiente" (regla 29 — un usuario que no puede ejecutar el gesto físico, ej. drag-drop, no debe quedar bloqueado). **Flujos cross-página**: `TutorialStep.route?: string` + `TutorialService` inyecta `Router` y navega antes de medir el anchor cuando el step siguiente vive en otra ruta (`core/tutorials/home-flows.tutorial.ts`, copy de `home.flow.*`, registrado una sola vez en `AppShellContainer`, `autoStartIfUnseen: false` — un flujo nunca se dispara solo, lo arranca el botón "Recorrer este flujo" de la home). `ShortcutBinding` suma `pageScope?: string` para que "Atajos de la página" filtre el diálogo de `?` a los combos de la página activa además de los globales. Ver roadmap ítem 26.

### 4.7 Workflow

16. **Commits frecuentes y atómicos.** Mensaje en inglés, imperativo (`add tag filter`, no `added`).
17. **Branches por feature.** `main` siempre funcional.
18. **Tests donde duele, no donde es fácil.** `FsService`, `IndexService`, `AutosaveService`, `MigrationsService` y `VersioningService` se testean sí o sí. Componentes visuales solo si tienen lógica no trivial.

### 4.8 Filosofía

19. **YAGNI estricto.** Si una abstracción no resuelve un problema concreto hoy, no va.
20. **El usuario nunca ve archivos rotos.** Si un `.json` está corrupto: UI de error en ese archivo + opción de restaurar versión anterior. Nunca un stack trace.

### 4.9 El trabajo del usuario es sagrado

21. **Defensa en profundidad contra pérdida de trabajo.** Asumir que todo va a fallar:

- **Autosave continuo:** cada 2-3 segundos de inactividad, en cambio de foco, cambio de ruta y `beforeunload`.
- **Borrador local en IndexedDB en paralelo al disco.** Cada cambio se escribe a IndexedDB _antes_ de tocar el FS. Si el FS falla, sobrevive en IndexedDB.
- **Crash recovery:** al iniciar la app, si hay borradores en IndexedDB más nuevos que el archivo en disco → ofrecer recuperar.
- **Undo/redo profundo** en el editor (TipTap nativo).
- **Versionado fino con isomorphic-git:** snapshots automáticos cada X minutos si hubo cambios. Línea de tiempo siempre accesible.
- **Confirmación destructiva con papelera:** borrar entidad → soft-delete a `.mi-cerebro/trash/`, retención 30 días.
- **Escritura atómica:** se escribe a `.tmp` y solo se reemplaza el archivo si parseó OK.

### 4.10 No god files / no acoplamientos ocultos

22. **Topes duros de complejidad.** El linter los enforza (ver §5).

### 4.11 Documentación

23. **Documentar el porqué, no el qué.** Si para entender un fragmento de código necesitás abrir un `.md`, falló el código o la doc.
24. **Doc desactualizada miente.** Si vemos un `.md` desactualizado se actualiza o se borra, no se deja pudrir.
25. **El commit que cambia una decisión arquitectónica también actualiza el archivo correspondiente de `docs/proyecto/`** (o agrega un ADR). En el mismo commit, no después.
    25b. **Todo lo que se posterga queda registrado en el archivo de tema correspondiente dentro de `docs/deferred/`** (ver `docs/deferred/index.md` para el mapa de temas; si el tema es nuevo, se crea el archivo y se agrega una línea al índice) en el mismo commit que toma la decisión. Sin entrada en deferred, la decisión no es válida: el siguiente paso no puede saber qué heredó como "para después". Cada ítem incluye: qué se difirió, por qué, y a qué fase apunta (o "sin asignar"). Al cerrar la fase target, los ítems se eliminan del archivo de tema (y si el archivo queda vacío, se borra y se saca del índice).

### 4.12 Errores

26. **Todo error tiene código y entrada en `docs/errors.md`.** Lanzar un `AppError` sin código documentado falla el lint o el code review.
27. **Ninguna excepción llega al usuario como stack trace.** Se captura, se envuelve en `AppError`, se muestra con código y mensaje en su idioma.
28. **Toda acción del usuario que pueda fallar tiene tratamiento explícito.** No hay "silent fail". O loguea + UI + código, o se reintenta automáticamente con feedback visible.

### 4.13 Accesibilidad

29. **Accesibilidad base no es opcional.**

- Foco visible siempre. Sin `outline: none` sin alternativa.
- Navegación completa por teclado (tab/shift+tab/enter/escape en todo accionable).
- ARIA correcto en componentes interactivos (botones, modales, listas, tree).
- Contraste mínimo WCAG AA (4.5:1 texto normal, 3:1 texto grande). El editor de tema custom valida y advierte si la combinación es ilegible (advierte, no bloquea).

### 4.14 Privacidad y red

30. **Cero telemetría. Cero llamadas a red salvo las que el usuario inicia conscientemente** (push a GitHub para backup off-site). Sin analytics, sin Sentry, sin tracking. La app funciona 100% offline después del primer load.

### 4.15 Versionado de schema y migraciones

31. **Cada archivo persistido lleva `schemaVersion`.** Notas, tareas, objetivos, listas, escritos, playlists, `config.json`, `tags.json`, etc.

- Las migraciones viven en `core/migrations/` como funciones puras `vN -> vN+1` por tipo de entidad.
- Al leer, si la versión es vieja, se migra en memoria antes de pasar a la app.
- **Backup automático antes de cualquier migración:** snapshot completo del workspace a `.mi-cerebro/pre-migration/<fecha>/`.
- Política: nunca se rompe lectura de versiones anteriores. Migraciones one-way.

### 4.16 Concurrencia entre pestañas

32. **Una entidad solo puede ser editada en una pestaña a la vez.**

- `BroadcastChannel` API coordina locks entre pestañas.
- Al abrir una entidad: se anuncia "estoy editando X". Si otra pestaña ya la edita, la segunda abre en **modo lectura** con banner ofreciendo "abrir solo lectura" o "tomar control".
- "Tomar control" cierra la otra pestaña (que muestra `MCB-AUT-006: se tomó control desde otra ventana`).
- Error `MCB-AUT-005` cuando se intenta forzar escritura sobre lock ajeno.

### 4.17 Cuotas de almacenamiento

33. **La app pide persistencia del storage al iniciar** (`navigator.storage.persist()`) para que el navegador no eviccione IndexedDB sin avisar.

- `QuotaExceededError` y "disco lleno" se capturan y mapean a `MCB-SYS-002` con sugerencias accionables (vaciar papelera, exportar y limpiar, etc.).

---
