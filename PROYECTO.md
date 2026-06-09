# mi-cerebro

Documento base del proyecto. Rige todas las decisiones de diseño e implementación. Cualquier cambio se hace acá primero.

---

## 1. Visión

App web **front-only**, gratis, de uso personal, que funciona como "segundo cerebro" + espacio de escritura cómoda. Reemplaza la combinación de notas + tareas + objetivos + calendario + biblioteca de escritura larga + reproductor de música de fondo, con foco en **orden impecable** y **búsqueda instantánea**.

Ejes de diseño:

- **Orden por defecto, no por esfuerzo del usuario.** La app define la estructura; el usuario no tiene que decidir dónde va cada cosa.
- **Cero fricción de sintaxis.** UI bonita, simple y directa. Nada de Markdown crudo a la vista. El formato interno es problema de la app, no del usuario.
- **Continuidad.** Al volver, la app recuerda dónde quedaste (última ruta, última nota, scroll, etc).
- **Búsqueda primero.** Navegar 10 niveles de árbol es inaceptable. Todo es accesible en pocas teclas.
- **Portabilidad real.** Los datos viven en una carpeta del disco del usuario. Si mañana la app desaparece, los archivos siguen ahí, legibles.

Idioma: UI en **español**, código y commits en **inglés**.

---

## 2. Alcance

### Entidades principales

| Entidad                 | Característica                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| **Notas**               | Formato libre, sugerencia de formato corto. Pueden estar "por algún lado", no exigen visibilidad.  |
| **Tareas**              | Lista + fecha(s). Tienen estado (pendiente/hecha).                                                 |
| **Objetivos**           | Similar a notas pero **siempre visibles**. Recordatorio constante.                                 |
| **Listas**              | Genéricas, no atadas a tarea, sin fecha ni estado.                                                 |
| **Escritos largos**     | Libros, artículos, apuntes de idiomas, conocimiento de un tema, planes. Editor cómodo.             |
| **Imágenes**            | Galería propia como tipo de entidad. Lo que se "adjunta" es la referencia; se renderiza la imagen. |
| **Archivos**            | Cualquier archivo suelto que el usuario quiera tener organizado.                                   |
| **Playlists de música** | MP3s subidos por el usuario, reproducción aleatoria en bucle.                                      |

### Funcionalidades transversales

- Árbol de carpetas jerárquico con buscador inteligente (ver §10).
- **Etiquetas (tags)** transversales que cruzan todas las entidades. Filtro por etiqueta en búsqueda global.
- **Calendario** mensual/anual con expansión a día, mostrando todas las entidades con fecha, agrupadas por tipo, filtrables. Click en día → botón para crear entrada nueva.
- **Recordatorios** simples (in-app, con la app abierta). Sección dedicada.
- **Versionado** automático (ver §12).
- **Temas claro/oscuro + temas custom** del usuario.
- **Reproductor de música** siempre accesible (mini-controles globales).

### Fuera de alcance (por ahora)

- Sincronización multi-dispositivo automática (el usuario hace backup/restore manual o vía git remoto).
- Notificaciones del SO con app cerrada.
- OCR / búsqueda por contenido visual en imágenes.
- Colaboración multi-usuario.
- Soporte para Firefox/Safari (depende de File System Access API, que hoy solo va en Chromium).

---

## 3. Stack técnico

- **Framework:** Angular 21 (consistente con [[streak-quest-project]]).
- **Package manager:** bun (ver [[use-bun-not-npm]]).
- **Persistencia primaria:** carpeta del usuario en disco vía **File System Access API**.
- **Persistencia secundaria (navegador):**
  - `localStorage`: tema activo, última ruta, preferencias UI livianas.
  - `sessionStorage`: estado efímero de sesión (scroll, etc).
  - `IndexedDB`: temas custom creados por el usuario, índice de búsqueda cacheado, miniaturas, **borradores de autosave**, últimos errores para debug.
- **Versionado/backup:** **isomorphic-git** (commits automáticos, historial navegable, push opcional a GitHub privado) + botón **export ZIP** para snapshot manual rápido.
- **Editor:** **TipTap** sobre ProseMirror.
- **Búsqueda:** índice incremental en IndexedDB (MiniSearch o Lunr).
- **PWA** desde el inicio (instalable como app de escritorio, ícono mínimo).
- **Navegadores soportados:** Chrome, Edge, Vivaldi, Brave (Chromium con FS Access API).

---

## 4. Reglas del proyecto

Reglas que rigen todo el desarrollo. Cualquier excepción se justifica en el commit.

### 4.1 Código

1. **TypeScript strict + `noUncheckedIndexedAccess`.** Cero `any` salvo excepción comentada.
2. **Standalone components.** Sin `NgModules` salvo que algo externo lo exija.
3. **Signals como estado primario.** RxJS solo donde brilla (streams, debounce, websockets).
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
- **`core/`** por dominio: `fs/`, `idb/`, `index/`, `theme/`, `continuity/`, `reminders/`, `versioning/`, `autosave/`, `errors/`, `migrations/`, `tags/`, `i18n/`.
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
14. **Desktop-first.** Asumimos pantalla grande, pero el layout no se rompe en ventana chica.
15. **Atajos de teclado de primera clase.** Ctrl+P para buscar, Ctrl+N para nueva entidad, etc. Vista de ayuda accesible.

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
25. **El commit que cambia una decisión arquitectónica también actualiza `PROYECTO.md`** (o agrega un ADR). En el mismo commit, no después.
    25b. **Todo lo que se posterga queda registrado en `docs/deferred.md`** en el mismo commit que toma la decisión. Sin entrada en deferred, la decisión no es válida: el siguiente paso no puede saber qué heredó como "para después". Cada ítem incluye: qué se difirió, por qué, y a qué fase apunta (o "sin asignar"). Al cerrar la fase target, los ítems se eliminan del archivo.

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

## 5. Linter y formateo

### Stack

- **ESLint** + **`angular-eslint`** + **`@angular-eslint/template`** + **`eslint-plugin-rxjs`**.
- **Prettier** solo para formateo, sin reglas semánticas.
- **Husky + lint-staged:** pre-commit corre ESLint + Prettier sobre staged.
- **`tsc --noEmit`** en pre-push.

### Reglas anti-rendimiento

- `@angular-eslint/template/no-call-expression` — prohíbe funciones/getters en templates.
- `@angular-eslint/template/use-track-by-function` — `@for` siempre con `track`.
- `@angular-eslint/template/no-negated-async`.
- Custom: prohibir `*ngIf`/`*ngFor` clásicos — solo `@if` / `@for` / `@switch`.
- `@angular-eslint/prefer-on-push` — todos los componentes con `OnPush`.
- `@angular-eslint/prefer-signals` — empuja signals sobre `@Input()` / `BehaviorSubject` donde aplica.
- Custom: prohibir funciones inline en bindings (`(click)="() => doStuff()"`).
- Custom: prohibir `pipe(...)` largos en templates.

### Reglas que refuerzan las reglas del proyecto

- `max-lines`: warning 200, error 300.
- `max-lines-per-function`: warning 50.
- `complexity`: warning 10.
- `@typescript-eslint/no-explicit-any`: error.
- `@typescript-eslint/strict-boolean-expressions`: error.
- `@typescript-eslint/no-floating-promises`: error.
- `@typescript-eslint/consistent-type-imports`: error.
- `no-restricted-imports`: prohíbe imports cross-feature (refuerza regla 10).
- `import/no-cycle`: error.
- `unused-imports/no-unused-imports`: error.
- Custom: prohibir `throw new Error(...)` directo en código de app — solo `throw new AppError(CODE, ...)` (refuerza regla 26).
- Naming forzado: `kebab-case` archivos, `PascalCase` clases, `camelCase` variables. Sufijos: `.component.ts`, `.container.ts`, `.service.ts`, `.directive.ts`, `.pipe.ts`, `.utils.ts`, `.types.ts`, `.routes.ts`.

### Reglas de accesibilidad

- `@angular-eslint/template/click-events-have-key-events`.
- `@angular-eslint/template/interactive-supports-focus`.
- `@angular-eslint/template/elements-content` (roles ARIA correctos).
- `@angular-eslint/template/no-positive-tabindex`.

---

## 6. Errores

### Esquema de código

Formato: **`MCB-<área>-<número>`** (MCB = mi-cerebro). Número de 3 dígitos secuencial dentro del área.

| Área   | Dominio                                                    |
| ------ | ---------------------------------------------------------- |
| `FS_`  | File System Access (permisos, lectura, escritura, atómica) |
| `IDX`  | Índice de búsqueda                                         |
| `VER`  | Versionado / git                                           |
| `AUT`  | Autosave / recovery / borradores / concurrencia            |
| `TAG`  | Tags / referencias                                         |
| `ENT`  | Entidades (JSON inválido, ID duplicado, link roto)         |
| `MUS`  | Música (formato, codec, tamaño)                            |
| `IMG`  | Imágenes (formato, miniaturas)                             |
| `THM`  | Temas                                                      |
| `I18N` | Strings faltantes                                          |
| `PWA`  | Service worker / instalación                               |
| `MIG`  | Migraciones de schema                                      |
| `UI_`  | Validación / interacción / atajos                          |
| `SYS`  | Browser API ausente, cuota excedida, disco lleno           |

### Clase `AppError`

Vive en `core/errors/`:

```ts
class AppError {
  code: string; // 'MCB-FS-001'
  messageKey: string; // i18n key, ej 'errors.fs.permission_denied'
  severity: 'info' | 'warning' | 'error' | 'fatal';
  cause?: unknown; // error original encadenado
  context?: Record<string, unknown>; // ruta, id, etc.
  recoverable: boolean;
  actions?: ErrorAction[];
}
```

### Cómo llega al usuario

- **Toast** para `info` / `warning` (no bloqueante). Mensaje + código pequeño al lado.
- **Modal** para `error` / `fatal`. Mensaje + código + descripción + acciones sugeridas + botón "ver detalles" (expande `cause` y `context`).
- Siempre incluye el código. El usuario puede buscarlo en `docs/errors.md`.

### Servicio centralizado

`core/errors/`:

- `app-error.ts` — la clase.
- `error.codes.ts` — enum de códigos (autocompletado al lanzar).
- `error.service.ts` — recibe `AppError`, decide UI, loguea a consola con formato consistente, persiste últimos N errores en IndexedDB para debug.
- `error.types.ts` — `ErrorAction`, severidades, etc.

### Catálogo documentado

`docs/errors.md` con la tabla completa: código, descripción, causa típica, cómo resolver, severidad, recuperabilidad. Ejemplo de entrada:

```markdown
### MCB-FS-001 — Permission denied on write

**Severidad:** error
**Cuándo:** el navegador revocó el permiso al directorio raíz, o el archivo está bloqueado por otro programa.
**Causa típica:** después de un refresh sin permisos persistentes, o archivo bloqueado por antivirus.
**Cómo resolver:**

1. Volver a otorgar permiso desde el banner que aparece arriba.
2. Verificar que ningún programa externo tenga el archivo abierto.
3. Si persiste, hacer export ZIP por las dudas y reportar.
   **Recuperable:** sí — el borrador queda en IndexedDB hasta que se restablezca el permiso.
```

---

## 7. Documentación

Filosofía: **documentar lo que la sola lectura del código no responde**. Cero ceremonial.

### Qué SÍ documentamos

- **`README.md` raíz:** cómo levantar el proyecto, comandos clave, link a `PROYECTO.md`. Corto.
- **`PROYECTO.md`:** verdad sobre visión, decisiones, reglas. Single source of truth. Se actualiza cuando una decisión cambia.
- **`docs/decisions/`:** ADRs cortos para decisiones técnicas no obvias. Formato: Contexto / Opciones / Decisión / Consecuencias.
- **`docs/errors.md`:** catálogo completo de códigos de error (ver §6).
- **`docs/glossary.md`:** vocabulario del dominio. Un párrafo por término.
- **`docs/architecture.md`:** una página + diagrama (ASCII o mermaid) de cómo se conectan core/features/shared y el flujo de datos típico.
- **`docs/migrations.md`:** registro de migraciones de schema (`vN -> vN+1`), qué cambió y por qué.
- **Comentarios `// why:`** solo donde el porqué no es obvio (workarounds, invariantes ocultos, restricciones externas).
- **JSDoc solo en APIs públicas de servicios de `core/`:** 1-2 líneas de propósito + ejemplo si la firma no es trivial.

### Qué NO documentamos

- Comentarios que repiten el nombre de la función.
- Tutoriales de cosas que están en docs oficiales — link, no copia.
- READMEs por carpeta que dicen "acá viven los componentes de notas".
- CHANGELOG manual.
- Diagramas en herramientas externas que se desactualizan — mermaid en repo o nada.

---

## 8. Estructura del file system del usuario

Raíz elegida por el usuario al abrir la app la primera vez (sugerencia: `Documentos\mi-cerebro\`).

```
<raíz elegida>/                        ej: D:\Documentos\mi-cerebro\
│
├── .mi-cerebro/                       # metadata interna. NO TOCAR.
│   ├── config.json                    # config global del workspace (schemaVersion, retención papelera, etc.)
│   ├── tags.json                      # registro central de tags
│   ├── index/                         # índice de búsqueda persistido (espejo del de IndexedDB)
│   │   └── index.json
│   ├── trash/                         # soft-delete con retención (default 30 días)
│   │   └── 2026/06/07/
│   │       └── <id>__<nombre-original>.json
│   ├── history/                       # fallback si isomorphic-git no funciona
│   ├── pre-migration/                 # backup automático antes de migrar schema
│   │   └── <fecha>/
│   └── recovery/                      # borradores rescatados de IndexedDB al reabrir
│
├── .git/                              # isomorphic-git (oculta, manejada por la app)
│
├── notes/
│   ├── <carpetas libres del usuario>/
│   └── <slug>.json
│
├── tasks/
│   ├── <listas/carpetas libres>/
│   └── <slug>.json
│
├── goals/
│   └── <slug>.json
│
├── lists/                             # listas sin fecha ni estado pendiente/hecho
│   └── <slug>.json
│
├── writings/                          # libros, artículos, apuntes largos
│   ├── <libro>/                       # cada obra larga = una carpeta
│   │   ├── _book.json                 # metadata + orden de capítulos
│   │   └── chapters/
│   │       ├── 01-introduccion.json
│   │       └── 02-...json
│   └── <artículo-suelto>.json
│
├── images/
│   ├── <colección>/
│   │   ├── _gallery.json              # metadata de la colección (nombre, tags, orden)
│   │   ├── original/                  # binarios originales
│   │   │   └── <id>.<ext>
│   │   └── thumbs/                    # miniaturas generadas por la app
│   │       └── <id>.webp
│   └── ...
│
├── files/                             # archivos sueltos que el usuario quiera tener organizados
│   ├── <carpetas libres>/
│   └── <cualquier archivo>
│
└── music/
    ├── tracks/
    │   └── <id>__<nombre-original>.mp3
    └── playlists/
        └── <slug>.json                # IDs de tracks, no rutas
```

### Convenciones

- **IDs estables internos.** Filename = `<slug-humano>.json`, pero adentro del JSON hay un `id` UUID inmutable. Los links entre entidades y los tags usan IDs, no rutas. La app mantiene un mapa `id → ruta actual` en el índice.
- **Renombrar es libre.** El usuario puede mover y renombrar archivos/carpetas por fuera; la app reconcilia por ID al detectar el cambio.
- **Validación de integridad al abrir el workspace.** Detecta IDs duplicados, faltantes o links rotos y los repara o pide confirmación.
- **Profundidad de carpetas:** sin límite duro, warning a partir de 8 niveles.
- **Normalización de nombres:** la app trim/limpia caracteres no portables (`< > : " / \ | ? *`, control chars). El usuario ve su título limpio en la UI; el slug del archivo es derivado.
- **Distinción tareas vs listas:**
  - `tasks/` = tarea individual o grupo de tareas con fecha/estado.
  - `lists/` = listas sin fecha ni estado (libros pendientes, ideas, etc.).
- **Escritos largos:** libros como carpeta `<libro>/` con `_book.json` + `chapters/*.json`. Artículos/apuntes cortos como archivo único en `writings/`.
- **Imágenes:** colecciones (`<colección>/`) con `original/` + `thumbs/`. Las thumbs son derivadas regenerables.
- **Música:** filename con ID antepuesto (`<id>__<nombre-original>.mp3`) para evitar colisiones. Playlists referencian por ID.
- **`.git/` en la raíz** (no escondida bajo `.mi-cerebro/`) para que sea compatible con git nativo si el usuario quiere clonar manualmente.

### Formato interno de archivos

- **JSON estructurado** para notas, tareas, objetivos, listas, escritos, playlists, metadata de colecciones e índice. Contenido de texto rico serializado en estructura ProseMirror/TipTap.
- Todo archivo persistido lleva `schemaVersion` (regla 31).
- Export a Markdown por entidad disponible bajo demanda (pierde highlighting custom; conserva texto).
- Escritura atómica: `<archivo>.tmp` → fsync → rename. Si el parse falla, no se reemplaza el archivo bueno.

---

## 9. Primer arranque y permisos

### Onboarding

- Primera vez: pantalla de bienvenida que explica en 3 líneas qué necesita la app y pide elegir carpeta raíz.
- Detección al elegir carpeta:
  - **Vacía** → la app crea la estructura inicial (`.mi-cerebro/`, `notes/`, `tasks/`, ...).
  - **Workspace válido de mi-cerebro** → "te damos la bienvenida de nuevo" + cargar.
  - **Carpeta con archivos no reconocidos** → modal "esta carpeta tiene contenido que no reconozco. ¿Elegir otra carpeta, o inicializar acá (los archivos existentes no se tocan)?".

### Permisos

- File System Access pierde permisos en algunos contextos (reload, tiempo). Política:
  - Pedir `navigator.storage.persist()` al iniciar.
  - Persistir el handle de la carpeta en IndexedDB (`FileSystemDirectoryHandle` es serializable ahí).
  - Si al reabrir el handle existe pero los permisos están revocados → banner persistente pidiendo re-autorizar, **sin tocar IndexedDB hasta confirmar acceso**.
  - Mientras tanto, los borradores siguen viviendo en IndexedDB y son recuperables.

### Errores típicos del arranque

- `MCB-SYS-001`: navegador sin soporte para File System Access API (Firefox/Safari).
- `MCB-FS-002`: la carpeta elegida no es escribible, no se pueden crear las subcarpetas iniciales.
- `MCB-FS-003`: carpeta raíz movida o eliminada desde el último uso.
- `MCB-FS-004`: permisos revocados, requiere re-autorización.

---

## 10. Búsqueda y navegación

### Árbol con filtro (visual)

Vista de árbol expandible. Caja de filtro arriba que **resalta coincidencias y colapsa lo que no matchea**. El nivel que matchea se abre automáticamente. Si hay varias coincidencias:

- Por defecto, foco en la **más cercana al nodo actual**.
- El usuario puede elegir dirección: **arriba del árbol**, **abajo del árbol**, **general**.
- Lista de coincidencias navegable con teclado para saltar entre ellas.

### Búsqueda global

- Por texto en contenido, por nombre, por tag.
- Filtros por tipo de entidad y por tag combinables.
- Resultados con preview.
- **Índice incremental persistido en IndexedDB** (MiniSearch o Lunr). Se construye una vez al inicializar la carpeta raíz y se actualiza en cada save/borrado/renombrado. Búsqueda instantánea sin tocar el disco. Botón "reindexar" para rebuild manual si se corrompe.

### Continuidad

Al abrir la app: vuelve a la última ruta + última entidad abierta + scroll. Esto se guarda en `localStorage`.

---

## 11. Editor de escritura

Editor **híbrido tipo WYSIWYG**: el usuario ve siempre el resultado renderizado, no sintaxis.

Características:

- Formato básico: negrita, cursiva, subrayado, tachado, encabezados, listas, citas, código.
- **Highlighting personalizable**: el usuario define colores para fechas, números, texto plano, etc. Combina reconocimiento automático (tipo highlighting de lenguaje) con override manual desde la UI (tipo Word). Los esquemas de color custom se guardan en IndexedDB.
- Inserción de imágenes desde la galería (referencia, no embed).
- Inserción de links internos a otras entidades (por ID).
- Autosave continuo.

**TipTap** sobre ProseMirror. Integración Angular vía wrapper (`ngx-tiptap` o envoltorio propio). El highlighting personalizable se implementa como extensiones custom.

---

## 12. Versionado e historial

- Commit automático cada cierto intervalo o al cerrar una entidad.
- UI que maquilla los commits: línea de tiempo con vistas tipo "ayer", "hace una semana", diff visual de texto.
- Backup off-site: configurar un repo GitHub privado y `git push` desde la app.
- Botón **export ZIP** siempre disponible como snapshot manual rápido / backup local.
- Fallback si isomorphic-git resulta inviable: snapshots propios por entidad en `.mi-cerebro/history/`.

---

## 13. Objetivos siempre visibles

Los objetivos no compiten por atención con el resto: aparecen en momentos específicos para que mantengan presencia sin saturar.

- **Pantalla de carga / cambio de ruta:** al navegar a una ruta nueva, durante unos segundos aparece un **botón/banner flotante** con un objetivo (o a veces una tarea) elegido al azar, en formato "Recuerda... tenés X tiempo para…".
- Sección dedicada con vista completa de todos los objetivos.
- No banner permanente. No sidebar fijo. **Si todo es importante, nada lo es.**

---

## 14. Recordatorios y notificaciones

- Solo **in-app, con la app abierta** (toast/banner).
- Sección dedicada para gestionar los recordatorios.
- Granularidad: fecha + hora.

---

## 15. Calendario

- Vistas **mensual** y **anual**, ambas con **expansión a día**.
- Muestra todas las entidades con fecha (tareas, objetivos con deadline, notas fechadas, recordatorios).
- Agrupadas **por tipo** dentro del día, en orden.
- **Filtros por tipo y por tag.**
- Click en un día → botón "+ nueva entrada" que abre selector de tipo.

---

## 16. Reproductor de música

- **Mini-player global**, siempre accesible. Ocupa el mínimo espacio necesario: play/pausa, anterior, siguiente.
- Expandible a vista completa con la playlist actual.
- Sección dedicada para gestionar playlists: subir MP3 (se copia a `music/tracks/`), crear playlist (definición en `music/playlists/*.json`), editar orden.
- **Reproducción aleatoria en bucle** como modo principal.
- Solo MP3 por ahora.

---

## 17. Temas

### Política

- **Default al primer arranque:** sigue `prefers-color-scheme` del SO. El usuario puede fijar `light` o `dark` desde settings; la preferencia se guarda en `localStorage` y, si la quita, vuelve a `auto`.
- **Switch técnico:** atributo `data-theme="light"` o `data-theme="dark"` en `<html>`. En modo `auto` no se setea el atributo y manda el `@media (prefers-color-scheme: dark)` de las variables.
- **CSS variables, nada hardcoded.** Todos los colores, radios, spacing, tipografía y elevaciones viven en tokens. Los componentes consumen tokens, nunca literales.
- **Tema custom** del usuario: override de tokens guardado en IndexedDB. Validación WCAG AA con advertencia (no bloquea), no se rompe la app si la combinación es ilegible.

### Tipografía base

System stack — cero peso de fuente, look nativo en cada SO:

```
-apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI',
Inter, Roboto, 'Helvetica Neue', Arial, sans-serif
```

Mono (para código en editor y códigos de error): `ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace`. Serif (si en el futuro queremos un modo lectura para escritos largos) queda fuera del paso 2.

### Tokens base (paso 2)

Naming: `--mc-<grupo>-<rol>`. Grupos: `bg`, `fg`, `border`, `accent`, `state`, `focus`, `space`, `radius`, `font`, `shadow`.

#### Color — dark (default cuando SO está oscuro)

Tono: **neutro frío, grises azulados**. Acento: **naranja cálido**.

| Token                 | Valor                     | Uso                                 |
| --------------------- | ------------------------- | ----------------------------------- |
| `--mc-bg-base`        | `#0d1117`                 | Fondo de la app                     |
| `--mc-bg-surface`     | `#161b22`                 | Cards, paneles, sidebar             |
| `--mc-bg-elevated`    | `#1c232c`                 | Modales, popovers, menús            |
| `--mc-bg-hover`       | `#21262d`                 | Hover de filas/items                |
| `--mc-bg-selected`    | `#2a3340`                 | Item activo                         |
| `--mc-fg-primary`     | `#e6edf3`                 | Texto principal                     |
| `--mc-fg-muted`       | `#9aa4af`                 | Texto secundario                    |
| `--mc-fg-dim`         | `#7d8590`                 | Texto deshabilitado / hints         |
| `--mc-border-default` | `#30363d`                 | Bordes y separadores                |
| `--mc-border-strong`  | `#484f58`                 | Bordes de input enfocado            |
| `--mc-accent-primary` | `#ff7a45`                 | Botones primarios, links, selección |
| `--mc-accent-hover`   | `#ff8f60`                 | Hover                               |
| `--mc-accent-active`  | `#f06a35`                 | Active / pressed                    |
| `--mc-accent-fg`      | `#1a0f08`                 | Texto sobre superficie de acento    |
| `--mc-state-danger`   | `#f85149`                 | Error                               |
| `--mc-state-warning`  | `#d29922`                 | Advertencia                         |
| `--mc-state-success`  | `#3fb950`                 | OK                                  |
| `--mc-state-info`     | `#58a6ff`                 | Info neutral                        |
| `--mc-focus-ring`     | `#ff7a45` con `alpha 0.6` | Anillo de foco visible (regla 29)   |

#### Color — light

Tono: **neutro frío sobre blanco**. Acento naranja recalibrado para AA sobre fondo claro.

| Token                 | Valor                     | Uso                                             |
| --------------------- | ------------------------- | ----------------------------------------------- |
| `--mc-bg-base`        | `#ffffff`                 | Fondo de la app                                 |
| `--mc-bg-surface`     | `#f6f8fa`                 | Cards, paneles, sidebar                         |
| `--mc-bg-elevated`    | `#ffffff`                 | Modales, popovers                               |
| `--mc-bg-hover`       | `#eef1f4`                 | Hover                                           |
| `--mc-bg-selected`    | `#ffe8dc`                 | Item activo (tinte cálido del acento)           |
| `--mc-fg-primary`     | `#1f2328`                 | Texto principal                                 |
| `--mc-fg-muted`       | `#59636e`                 | Texto secundario                                |
| `--mc-fg-dim`         | `#818b97`                 | Texto deshabilitado                             |
| `--mc-border-default` | `#d0d7de`                 | Bordes                                          |
| `--mc-border-strong`  | `#8c959f`                 | Bordes de input enfocado                        |
| `--mc-accent-primary` | `#c44616`                 | Versión oscurecida del naranja, AA sobre blanco |
| `--mc-accent-hover`   | `#a83a0f`                 | Hover                                           |
| `--mc-accent-active`  | `#922f0a`                 | Active                                          |
| `--mc-accent-fg`      | `#ffffff`                 | Texto sobre superficie de acento                |
| `--mc-state-danger`   | `#cf222e`                 | Error                                           |
| `--mc-state-warning`  | `#9a6700`                 | Advertencia                                     |
| `--mc-state-success`  | `#1a7f37`                 | OK                                              |
| `--mc-state-info`     | `#0969da`                 | Info                                            |
| `--mc-focus-ring`     | `#c44616` con `alpha 0.4` | Anillo de foco                                  |

#### Spacing, radius, fuentes, sombras

| Token                | Valor                                                       |
| -------------------- | ----------------------------------------------------------- |
| `--mc-space-1`       | `4px`                                                       |
| `--mc-space-2`       | `8px`                                                       |
| `--mc-space-3`       | `12px`                                                      |
| `--mc-space-4`       | `16px`                                                      |
| `--mc-space-5`       | `24px`                                                      |
| `--mc-space-6`       | `32px`                                                      |
| `--mc-space-7`       | `48px`                                                      |
| `--mc-radius-sm`     | `4px`                                                       |
| `--mc-radius-md`     | `8px`                                                       |
| `--mc-radius-lg`     | `12px`                                                      |
| `--mc-radius-pill`   | `9999px`                                                    |
| `--mc-font-sans`     | system stack (ver arriba)                                   |
| `--mc-font-mono`     | mono stack (ver arriba)                                     |
| `--mc-font-size-xs`  | `12px`                                                      |
| `--mc-font-size-sm`  | `13px`                                                      |
| `--mc-font-size-md`  | `14px` (base UI)                                            |
| `--mc-font-size-lg`  | `16px`                                                      |
| `--mc-font-size-xl`  | `20px`                                                      |
| `--mc-font-size-2xl` | `28px`                                                      |
| `--mc-line-tight`    | `1.2`                                                       |
| `--mc-line-base`     | `1.5`                                                       |
| `--mc-line-loose`    | `1.75`                                                      |
| `--mc-shadow-sm`     | `0 1px 2px rgb(0 0 0 / 0.20)` (dark) / `... / 0.06` (light) |
| `--mc-shadow-md`     | `0 4px 12px rgb(0 0 0 / 0.30)` / `... / 0.10`               |
| `--mc-shadow-lg`     | `0 12px 32px rgb(0 0 0 / 0.40)` / `... / 0.14`              |

### Storage

- Preferencia del tema (`'light' | 'dark' | 'auto'`) en `localStorage` bajo `mc.theme`.
- Tema custom del usuario en IndexedDB (paso futuro). Si hay tema custom activo, override los tokens vía `<style id="mc-custom-theme">` inyectado al `<head>`.

---

## 18. PWA

- Manifest + service worker desde el día uno.
- Instalable como app de escritorio (ventana propia, sin barra del navegador).
- Ícono: lo más simple posible, placeholder; se puede mejorar después.
- Funciona offline (los datos están en disco, el código en el SW cache).

---

## 19. Roadmap inicial (orden propuesto)

1. **Scaffolding** Angular 21 + bun + PWA + estructura de carpetas src + linter + Prettier + Husky.
2. **Core errors + i18n + theme** (base mínima para que el resto se monte ordenado).
3. **FS Access + onboarding + permisos** (incluye `FsService`, persistencia del handle, banner de re-autorización).
4. **Migrations base + AutosaveService + IndexedDB drafts** (toda la red de seguridad antes de la primera entidad).
5. **Notes** como primer tipo end-to-end: crear, listar en árbol, editar (editor básico TipTap), guardar a disco con escritura atómica.
6. **Árbol con filtro inteligente** (la búsqueda navegacional).
7. **Tags transversales y búsqueda global** (dividido en dos sub-pasos):
   - **7a.** Tags transversales (`tags.json`, picker, badges en el árbol, color determinístico). _Cerrado._
   - **7b.** Búsqueda global indexada con MiniSearch persistido en IndexedDB; paleta `Ctrl+K`; filtro del árbol también busca tags; limpieza lazy de tag-refs muertos.
8. **Concurrencia entre pestañas** (BroadcastChannel + locks). Dividido en sub-pasos:
   - **8a.** `LockService` genérico + canal `mc-locks`: claim/pong/release/takeover por `(kind, id)`, estado `idle | owned | foreign | evicted` como signal, takeover optimista, release best-effort en `beforeunload`. _Cerrado._
   - **8b.** Integración en `NotesContainer`: `NoteLockController` orquesta acquire al abrir / release al cerrar o cambiar de ruta. Editor, título y tag-picker pasan a solo-lectura cuando el estado es `foreign`/`evicted`. Banner inline con _Abrir solo lectura_ / _Tomar control_ para `foreign` y _Entendido_ para `evicted`. `guardWrite()` reporta AUT-005 si llega un write programático en solo-lectura; un effect dispara AUT-006 una sola vez por desalojo. _Cerrado._
9. **Resto de entidades**: tasks, goals, lists, writings, images, files. Incluye filtros por tipo en el árbol (combinaciones notas+tasks+goals descritas en §10), que sólo cobran sentido cuando existe la segunda entidad. Subdividido por entidad:
   - **9a.** Tasks como segunda entidad end-to-end + reestructuración a sidebar global. Model `Task` con `done: boolean` y `dueDates: string[]` (ISO, ordenadas asc); `TasksService` reusa el patrón de notes (refresh/create/read/save/deleteToTrash + atomic write + autosave + índice de búsqueda + migrations); `TaskEditorPane` con checkbox done, picker de fechas (chips removibles, badge ámbar si está vencida), tag-picker y body TipTap. Refactor del lock controller a `EntityLockController` genérico (parametrizado por kind) usado por notes y tasks. Banner de lock se mueve a `shared/lock-banner` (entity-agnostic, recibe labels). **Cambio de arquitectura del shell:** la sidebar deja de vivir adentro de cada container y pasa a ser `WorkspaceSidebarContainer` global en el layout, con chips `Todo / Notas / Tareas`, árbol unificado con groups por entidad y filtro de texto/dirección compartido. Los containers de notes/tasks quedan reducidos al editor pane. Ruta `/tasks/:id` registrada. _Cerrado._
   - **9b.** Goals como tercera entidad end-to-end. Model `Goal` con `deadline: string | null` (un único plazo opcional — §13 enmarca metas como "tenés X tiempo para…") y `completed: boolean`; `GoalsService` reusa el patrón compartido (refresh/create/read/save/deleteToTrash + atomic write + autosave + índice de búsqueda + migrations); `GoalEditorPane` con checkbox completed, `DeadlinePickerComponent` de fecha única (chip removible, ámbar si vencida), tag-picker y body TipTap. Sidebar global gana chip `Metas` y grupo en el árbol con badge de plazo. Ruta `/goals/:id` registrada. Incluye `GoalReminderContainer` global en el shell: en cada `NavigationEnd` fuera de `/goals`, con probabilidad 1/4, banner discreto abajo-derecha con una meta no completada (prioriza vencidas, luego ≤7 días, luego cualquier pendiente) y acciones abrir/cerrar; evita repetir la misma meta hasta agotar el pool. _Cerrado._
   - **9d.** Writings — sólo artículos sueltos como quinta entidad end-to-end. Cubre `writings/<slug>.json` (archivo único) y deja libros (carpeta `<libro>/` con `_book.json` + `chapters/*.json`) para un sub-paso siguiente. Model `Writing` con `title`, `body` (TipTap; `emptyDoc` arranca con un párrafo vacío para enmarcar prosa larga, no bullets), `tags`, sin fecha ni estado. `WritingsService` reusa el patrón compartido (refresh/create/read/save/deleteToTrash/moveToFolder + atomic write + autosave + índice de búsqueda + migrations). `WritingEditorPaneComponent` con título, tag-picker y body TipTap. Sidebar global gana chip `Escritos`, botón `+ Nuevo escrito`, botón `+ Carpeta en Escritos` y grupo en el árbol. Ruta `/writings/:id` registrada. `TrashKind` y `KIND_DIRS` extendidos con `writing → writings`; `TrashService`, `FoldersService`, `folder-actions` y `tree-node` aprenden a manejar el nuevo kind. _Cerrado._
   - **9d-bis.** Books como sexta entidad end-to-end (forma "carpeta + capítulos"). Vive en `books/` (kind separado, no anidado bajo `writings/` para evitar colisión con el walk de single-file de Writings). Estructura en disco: `books/<carpeta-opcional>/<libro-slug>/_book.json` + `chapters/<capitulo>.json`. Model `Book` con `title`, `tags`, `order: string[]` (ids de capítulo definiendo orden visual, independiente del FS) y `Chapter` con `bookId`, `title`, `body` (TipTap). `BooksService` ofrece refresh (recorrido custom que distingue book-folder por presencia de `_book.json`), createBook, readBook, saveBook, deleteBookToTrash (bundle JSON `{book, chapters}` + remove dir), restoreFromBundle, moveBookToFolder, listChapters, addChapter, readChapter, saveChapter, removeChapter (hard-delete, no papelera, fuera del flow de §11), reorderChapters; búsqueda indexa libro + cada capítulo. `BooksContainer` orquesta `EntityLockController('book')` (un solo lock por libro, no por capítulo), book-meta-bar (título + tags + estado + borrar), chapter-list (↑/↓/+/✕) y chapter-editor-pane (título + body). Rutas `/books`, `/books/:id`, `/books/:id/:chapterId`. Sidebar suma chip `Libros`, botón `+ Nuevo libro`, botón `+ Carpeta en Libros` y grupo en el árbol. `TrashKind` y `KIND_DIRS` extendidos con `book → books`; `TrashService.restore` rama especial para `kind === 'book'` (lee bundle, llama `restoreFromBundle`, purga el archivo); `parseEntry` extrae título de `raw.book.title` para bundles; `FoldersService`, `folder-actions` y `tree-node` aprenden el nuevo kind. Fuera de alcance (siguiente sub-paso si surge): drag-and-drop para reordenar, papelera por capítulo individual. _Cerrado._
   - **9c.** Lists como cuarta entidad end-to-end. Model `List` con sólo `title`, `body` (TipTap; `emptyDoc` arranca con un bullet list para reforzar el formato), `tags`, sin fecha ni estado (§2 / §8: "listas sin fecha ni estado"). `ListsService` reusa el patrón compartido (refresh/create/read/save/deleteToTrash/moveToFolder + atomic write + autosave + índice de búsqueda + migrations). `ListEditorPaneComponent` con título, tag-picker y body TipTap. Sidebar global gana chip `Listas`, botón `+ Nueva lista`, botón `+ Carpeta en Listas` y grupo en el árbol. Ruta `/lists/:id` registrada. `TrashKind` y `KIND_DIRS` extendidos con `list → lists`; `TrashService`, `FoldersService`, `folder-actions` y `tree-node` aprenden a manejar el nuevo kind. _Cerrado._
   - **9e.** Images como séptima entidad end-to-end (primera entidad con binarios). Forma "carpeta = galería + originales + thumbs": vive en `images/<carpeta-opcional>/<galería-slug>/_gallery.json` + `original/<id>.<ext>` + `thumbs/<id>.webp`. Toda imagen vive dentro de una colección (no hay "imagen suelta en `images/`"). Model `Gallery` con `title`, `tags`, `order: string[]`, `images: GalleryImage[]` (cada una con `id`, `originalName`, `mime`, `ext`, `width`, `height`, `bytes`, `addedAt`). `GalleriesService` ofrece refresh (recorrido custom que distingue gallery-folder por presencia de `_gallery.json`), createGallery, readGallery, saveGallery, addImage (escribe original + genera thumb webp ≤320px lado largo via OffscreenCanvas, con fallback al original si falla createImageBitmap), readOriginalBlob, readThumbBlob, removeImage (hard-delete del par original+thumb), reorderImages, deleteGalleryToTrash, restoreFromDir, moveGalleryToFolder. `FsService` gana `writeFileAtomicBinary(Blob|ArrayBuffer)` y `readFile(): Promise<File>`. `GalleriesContainer` orquesta `EntityLockController('image')`, gallery-meta-bar (título + tags + estado + borrar), image-grid (thumbs en grid CSS, drop-zone para archivos, ↑/↓/✕ por imagen) y image-lightbox (overlay con original y close por click/Escape). Container administra blob URLs (createObjectURL/revokeObjectURL) por id de imagen, en `thumbUrls` (todos) y `originalUrls` (lazy al abrir lightbox); revoke en destroy. Rutas `/images`, `/images/:id`. Sidebar suma rail-icon 🖼 "Imágenes", botón `+ Nueva galería`, "+ Carpeta en Imágenes" y grupo en el árbol. **Papelera extendida para entradas-directorio:** `TrashEntry` gana `shape: 'file' | 'directory'`; `TrashService.refresh` lista subdirs `image__<id>__<slug>/` además de files `.json`; `parseDirEntry` lee título desde el `_gallery.json` interno; `restore` rama especial para `kind === 'image'` (mueve la carpeta entera de vuelta a `images/` con slug libre); `purge` usa `{recursive: true}` para directorios. `TrashKind` y `KIND_DIRS` extendidos con `image → images`; `FoldersService`, `folder-actions` y `tree-node` aprenden el nuevo kind. Fuera de alcance (siguientes sub-pasos): pegar desde clipboard, insertar imagen-referencia dentro de notas/escritos, drag-and-drop para reordenar, edición de imagen. _Cerrado._
   - **9i.** Pulido de §9 — imagen-referencia dentro de cualquier editor TipTap (notas, escritos, capítulos de libros, metas). **Extracción a core:** `IMAGES_DIR`, `GALLERY_META_FILE`, `ORIGINAL_DIR`, `THUMBS_DIR`, `THUMB_EXT` se mudan a `@core/images/image-paths` (la convención de path queda en una sola fuente); `features/images/models/gallery.types.ts` los re-exporta. `core/trash/trash.service` ahora lee `GALLERY_META_FILE` desde el core, no desde el feature. Nuevo `@core/images/image-reader.service` con `register/unregister/clear/getGallery/summaries/readThumbBlob/readOriginalBlob`: mantiene un cache `Map<galleryId, {folder, slug, gallery: ImageRefGallery}>` que `GalleriesService` pobla en `refresh`/`createGallery`/`saveGallery`/`moveGalleryToFolder` y limpia en `deleteGalleryToTrash`. **Nodo TipTap:** `@core/tiptap/image-ref/image-ref.node.ts` define un nodo inline atom con attrs `{galleryId, imageId, alt}`, serializado a `<span data-image-ref data-gallery-id data-image-id data-alt>` (HTML plano para que copy/paste y búsqueda no rompan); el NodeView lee el thumb (o fallback al original) via `ImageReaderService`, crea un blob URL para el `<img>` y lo revoca en `destroy`. **Picker UI:** `@shared/editor/image-picker-dialog.component.ts` (modal con grilla de galerías a la izquierda + thumbs a la derecha) crea blob URLs sólo para la galería activa y los revoca al cambiar / cerrar. `EditorComponent` registra la extensión, inyecta el reader y muestra un toolbar con botón "🖼 Insertar imagen" sólo cuando `editable() && hasGalleries()`; al elegir, inserta el nodo con `chain().focus().insertContent(…)`. Como notas/escritos/capítulos/metas comparten `EditorComponent`, el wiring sirve a las cuatro entidades sin tocarlas. _Cerrado._
   - **9h.** Pulido de §9 — pegar imagen desde clipboard en galerías. `GalleriesContainer` registra en su `constructor` un listener `document.addEventListener('paste', …)` (removido en `destroyRef.onDestroy`) que: ignora el evento si no hay galería activa o si el lock no es editable; ignora si `event.target` está dentro de `input`/`textarea`/`[contenteditable]` (para no robarle el paste a la barra de título o al tag-picker); extrae archivos de `event.clipboardData.items` filtrando por `kind === 'file'` y `type.startsWith('image/')`; llama a `event.preventDefault()` y reusa `onAddFiles(files)`. _Cerrado._
   - **9g.** Pulido de §9 — drag-and-drop para reordenar items en las tres entidades con `order: string[]` (image-grid, file-grid, chapter-list). Helper compartido `reorderById(order, from, to)` en `@shared/utils/reorder` (mueve `from` para ocupar el slot de `to`, idempotente si `from === to`, tolera ids ausentes). Constante + guard compartidos en `@shared/utils/dnd`: `MC_INTERNAL_DND_TYPE = 'application/x-mc-id'` y `hasInternalDnd(event)` distinguen drags internos de drops de archivos del OS (que llevan `dataTransfer.files`) — el grid sigue aceptando ambos sin colisión. Cada componente afectado expone `reorder({from, to})` y los containers (`FilesContainer`, `GalleriesContainer`, `BooksContainer`) llaman a su respectivo `reorder*` del servicio con el array nuevo. Estado local de DnD con signals `draggingId` y `dropTargetId` para feedback visual (opacidad reducida en el item arrastrado, outline accent en el target). Ítem desplazado en `dragend`/`drop` para limpiar estado en caso de cancelación. Tests unitarios para `reorderById`. _Cerrado._
   - **9f.** Files como octava entidad end-to-end (segunda entidad con binarios; cierra la familia de adjuntos). Forma "carpeta = colección + items": vive en `files/<carpeta-opcional>/<colección-slug>/_collection.json` + `items/<id>.<ext>`. Todo archivo vive dentro de una colección — no hay "archivo suelto en `files/`" para mantener el patrón de papelera-directorio uniforme con 9e. Model `FileCollection` con `title`, `tags`, `order: string[]`, `items: FileItem[]` (cada uno con `id`, `originalName`, `mime`, `ext`, `bytes`, `addedAt`). `FilesService` ofrece refresh (recorrido custom que distingue collection-folder por presencia de `_collection.json`), createCollection, readCollection, saveCollection, addFile (escribe binario sin generar thumb), readBlob, removeFile (hard-delete), reorderFiles, deleteCollectionToTrash, restoreFromDir, moveCollectionToFolder. No hay generación de miniaturas — el grid usa iconos por mime/extensión (📄 PDF, 🎵 audio, 🎬 video, 📦 zip, 📝 texto, 📎 fallback). `FilesContainer` orquesta `EntityLockController('file')`, file-collection-meta-bar (título + tags + estado + borrar) y file-grid (cards con icono + nombre + tamaño, drop-zone, ↑/↓/✕ por item). Click en una card descarga el archivo original (blob URL + `<a download>` + revoke). Rutas `/files`, `/files/:id`. Sidebar suma rail-icon 📎 "Archivos", botón `+ Nueva colección`, "+ Carpeta en Archivos" y grupo en el árbol. **Papelera extendida (segunda kind con `shape: 'directory'`):** `parseDirEntry` ahora acepta `kind === 'image' | 'file'` y selecciona el meta file correcto (`_gallery.json` vs `_collection.json`) para leer el título; `restore` rama especial para `kind === 'file'` (mueve la carpeta entera de vuelta a `files/`). `TrashKind` y `KIND_DIRS` extendidos con `file → files`; `FoldersService`, `folder-actions` y `tree-node` aprenden el nuevo kind. Fuera de alcance (siguiente sub-paso si surge): vista previa inline (imágenes/PDF) en el grid, drag-and-drop para reordenar, edición de metadata por item. _Cerrado._
   - **9bis.** Papelera + carpetas. **Papelera:** `TrashService` lista todo lo que hay en `.mi-cerebro/trash/YYYY/MM/DD/` parseando archivos nombrados `<kind>__<id>__<file>.json`; cada entrada expone kind/id/title/deletedAt. Ruta `/trash` con restore (al directorio raíz del kind), purge individual y vaciado total con confirmaciones; link en footer del sidebar. **Carpetas:** son subdirectorios reales en disco por entidad (`notes/<path>/file.json`, idem `tasks/` y `goals/`). Cada entity service escanea recursivamente con `walkEntities`, summary gana `folder: string` (`''` = raíz). `FoldersService` provee createFolder/renameFolder/moveFolder/deleteFolder por kind; al borrar una carpeta, todo su contenido (recursivo) se manda a la papelera vía `deleteToTrash` de cada entity, y luego se elimina el dir. Cada entity service expone `moveToFolder(id, newFolder)`. Sidebar arma el árbol con `buildFolderTree` (carpetas vacías visibles, entities anidadas); botón "+ Carpeta en {kind}" en header crea carpetas, y un botón "⋯" inline en folder/entity nodes abre prompts para renombrar/mover/eliminar carpeta y mover entidad. _Cerrado._
10. **Calendar.**
11. **Reminders.**
12. **Music player.**
13. **Versionado** (isomorphic-git).
14. **Export ZIP.**
15. **Temas custom + validación WCAG.** Incluye color picker custom para tags (hoy el color sale determinístico de un hash).
16. **Pulido** — partido en sub-fases temáticas para mantener scope acotado:
    - **16a.** Continuidad de sesión + atajos: última ruta + entidad abierta + scroll al reabrir, historial de búsquedas en la paleta, set completo de atajos de teclado.
    - **16b.** Pulido visual del árbol: scroll automático al match activo, lista de coincidencias desplegada navegable con teclado, drag & drop para reordenar nodos.
    - **16c.** Gestión avanzada de tags: pantalla dedicada para listar/renombrar/mergear/eliminar tags con conteo de uso por entidad.
    - **16d.** Pulido de búsqueda: botón "reindexar" manual, snippet centrado en la coincidencia con highlight (en lugar de los primeros 160 chars del body).
    - **16e.** Pulido del editor: highlighting personalizable, banners de objetivos en cambio de ruta.
