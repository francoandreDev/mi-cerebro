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

## 12. Versionado, variantes e historial

Sistema combinado de autocommits + **variantes** (ramas renombradas en UI) + panel de historial navegable, sobre **isomorphic-git** con adapter propio a File System Access API. El export ZIP (paso 14) coexiste como snapshot manual rápido fuera del flujo git.

### Autocommits

- Timer cada N minutos (default 5, configurable) que evalúa si hubo cambios desde `HEAD` y commitea sólo si los hay. Triggers adicionales: cierre de entidad, cambio de feature, `visibilitychange` → hidden, `beforeunload`. Throttle de 60s entre commits aunque se apilen triggers.
- Mensaje derivado del staging: `auto: 3 notes, 1 task (2026-06-10 14:32) [trigger-reason]`. El sufijo `[reason]` registra qué trigger lo disparó (`timer`, `feature-change`, `entity-close`, `visibility`, `beforeunload`, `manual`) para diagnóstico. Cada autocommit lleva prefijo de faceta para que la timeline entremezclada sea legible: `auto: …` (main), `auto [borrador]: …`, `auto [comentarios]: …`.
- `.gitignore` automático para binarios pesados (`music/tracks/`, `images/*/original/`) y para las redes de seguridad paralelas (`.mi-cerebro/recovery/`, `/pre-migration/`, `/trash/`, `.mi-cerebro/history/`). Toggle global "incluir binarios en historial" off por default; si se prende, advertencia de bloat.
- **Coordinación con autosave**: el autocommit hace `flushAll()` sobre `AutosaveService` antes de leer la `statusMatrix`, así el commit ve el workspace quiescente. Tanto el `onFlush` de autosave como `commitAll` corren detrás del mismo mutex (`FsLockService`), lo que previene el `InvalidStateError` que dispara Chromium cuando dos escritores cruzan el mismo `FileSystemDirectoryHandle` en paralelo.
- **Recuperación de estado tras recarga**: `lastCommitAt` (el timestamp visible en el footer) es in-memory; al arrancar el servicio lee `git.log({ depth: 1 })` y reconstruye el valor desde el commit más reciente del repo. Sin esto el footer mentía con "Sin commits aún" después de un F5.

### Variantes como familias de 3 ramas

Una variante visible al usuario es internamente una **familia de tres ramas git** que se gestiona en bloque:

| Variante visible | Rama main        | Rama borrador             | Rama comentarios             |
| ---------------- | ---------------- | ------------------------- | ---------------------------- |
| Principal        | `main`           | `variant/principal/draft` | `variant/principal/comments` |
| Variante X       | `variant/<slug>` | `variant/<slug>/draft`    | `variant/<slug>/comments`    |

`.mi-cerebro/variants.json` lleva el registro: id, nombre legible, color, `protected`, `lastActivityAt`, refs de las 3 ramas. Borrador y Comentarios son **facetas permanentes de cada familia**: se crean junto con la variante, se borran con ella, no existen sueltas. Principal nunca se borra.

- **Crear variante** = bifurcar las 3 ramas a la vez, cada una forkeada de su faceta hermana en la familia origen. No se arranca con borrador/comentarios vacíos: se heredan los actuales. Forkear el contexto entero, no sólo lo definitivo.
- **Borrar variante** = `git branch -D` sobre las 3 + remover entrada. Una sola acción del usuario; si tenía commits no mergeados, warning con opción de exportar a ZIP antes.

### Comentarios anclados (rama `comments`)

La rama comentarios **no guarda copias de entidades**. Guarda anotaciones referidas por anchor a contenido en `main` de la misma familia.

- Forma en disco: `comments/<entityId>.json` con array `{id, anchorType, anchor, body, createdAt, orphaned}`.
- `anchorType` soportados desde 13c: `entity` (toda la entidad) y `block` (un nodo TipTap por id estable). `range` (porción de texto dentro de un bloque) queda diferido a pulido posterior (ver `docs/deferred.md`).
- **IDs estables de bloques:** extensión TipTap que asigna UUID a cada nodo top-level (párrafos, headings, list items, etc.) al crearlo, persistido como atributo del nodo. Es la única forma de tener anchors que sobrevivan a ediciones; coste ~5% en tamaño del JSON, aceptable.
- Anchors que quedan invalidados por ediciones que borran el bloque referido se marcan `orphaned: true`. Aparecen en una sección de revisión del panel. **Nunca expiran solos:** el usuario decide re-anclar o eliminar.

### Borrador anclado (rama `draft`, track-changes)

La rama borrador tampoco guarda copias completas. Guarda **diff-marks pendientes** sobre `main` de la misma familia.

- Forma en disco: `drafts/<entityId>.json` con array `{id, anchor, before, after, status: 'pending'|'accepted'|'rejected', createdAt}`.
- **Modo borrador del editor:** toggle per-entidad (la siguiente entidad arranca en modo normal). Mientras está activo, las ediciones se capturan como diff-marks pendientes en la rama `draft` en vez de aplicarse a `main`.
- **Aceptar un diff-mark:** genera un commit nuevo en `main` de la familia (`accept-draft: <entidad> (N cambios)`). Nunca pisa historia. El draft pasa a `status: 'accepted'` y desaparece del panel.
- UI inicial: panel lateral con lista de pending marks + accept/reject por mark. Renderizado inline (ghost / strikethrough en el editor, tipo track-changes de Word) queda diferido a pulido.

### Position tracking

Cada vez que se edita `main`, se recorren los ProseMirror steps y se mapean las posiciones de todos los anchors (de la rama `comments` y de la rama `draft`) para esa entidad. Persistencia automática en las ramas correspondientes vía isomorphic-git plumbing (sin checkout de esas ramas).

### Switch de variante activa

- Una sola variante activa por workspace. Estado: `{family}` (no hay `facet`: borrador y comentarios se viven dentro del editor como paneles laterales, no como vistas separadas del workspace).
- Cambio de variante: commit forzado de dirty en la familia saliente + `git checkout` a `main` de la familia entrante + invalidación del índice + carga del índice por familia desde IndexedDB.
- BroadcastChannel sincroniza otras pestañas a la nueva variante; si rehúsan, entran en modo lectura con banner (reusa la maquinaria del paso 8).
- **Borrador y comentarios nunca aparecen como archivos en el FS del usuario.** Viven exclusivamente en `.git/`, leídos/escritos vía isomorphic-git plumbing sin checkout. El FS siempre refleja `main` de la variante activa.

### Lifecycle de variantes en reposo

- `lastActivityAt` de cada familia = el más reciente `lastActivityAt` de sus 3 ramas. Editar sólo el borrador mantiene viva a la familia.
- Default 30 días sin actividad → `state: 'dormant'`. Configurable en settings. **Nunca borra sola**, sólo cambia de sección visual.
- Principal está exenta. Las familias del usuario pueden entrar en reposo; en `/variants` aparecen agrupadas aparte con CTA "Mergear" y "Eliminar".

### Merge entre variantes

Pantalla dedicada (`/variants/merge?from=X&into=Y`).

- Unidad de elección por default: **bundle de las 3 facetas por entidad**. Click "← Quedarme con esto de X" aplica main + comentarios anclados + diff-marks pendientes de X a la familia destino simultáneamente.
- Granularidad por faceta dentro del bundle queda como opción avanzada, no preseleccionada (ver `docs/deferred.md`).
- Atajos masivos: `Todo de X →`, `← Todo de Y`. Saltar = no tocar la entidad en destino.
- Aplicación: 3 commits secuenciales (uno por faceta) compartiendo `Merge-Group: <uuid>` en el trailer. La timeline los agrupa como una sola operación. Si revienta a mitad, los commits ya hechos quedan y la UI muestra "merge parcial, reintentar". No silencioso.
- Mergear nunca borra la familia origen. Eliminar es una acción separada y explícita.

### Historial `/history`

Split de 2 columnas. Izquierda: commits agrupados por bucket temporal (_Hoy / Ayer / Esta semana / La semana pasada / Hace dos semanas / Hace un mes / Más viejo_) con sticky headers, chips por kind tocado, dot del color de la variante. Toggle "ver todas las variantes" (off por default; on entremezcla commits de todas las familias). Derecha: detalle del commit con lista de entidades cambiadas → diff visual de cada una.

**Diff visual:** texto rico convertido a texto plano normalizado + jsdiff línea a línea inline; metadata aparte como tabla "antes → después"; tags con chips +/–; binarios sólo tamaño antes/después.

**Milestones (paso 13a-bis).** El usuario nombra commits importantes ("antes de refactor X", "borrador 3 entregado") como git tags anotados — ref persistente separado del log, no una fila más de la timeline. Se renderizan como banda/separador entre commits, con panel "Sólo milestones" para colapsar el ruido de autocommits. Botón "Marcar este punto" en el detail-head; crear/renombrar/eliminar desde ahí.

### Restore

- **Por entidad:** "restaurar esta versión" → escribe el blob del commit a la ruta actual con escritura atómica + autosave marca dirty.
- **Por commit completo:** modal de confirmación fuerte + autocommit `before-restore: <hash>` previo. Siempre reversible.

### Índice de búsqueda por familia

Cada familia tiene 3 índices independientes en IndexedDB: `idx-<family>-main`, `idx-<family>-comments`, `idx-<family>-draft`. Cuesta más memoria pero da switch de variante instantáneo (no rebuild) y permite búsqueda dentro de comentarios y drafts sin tocar disco. Las facetas borrador/comentarios suelen ser más livianas que main en contenido, así que el costo real es bastante menor que 3×.

### Push a GitHub (opt-in)

Configurable en settings: URL de repo privado + PAT (guardado en IndexedDB, no en localStorage). Toggle "push tras cada autocommit" con throttle de 5 min, o sólo manual con botón. **Cero llamadas a red sin esto configurado** (regla §4.14).

### Costo de operaciones git sobre FS Access

Cada operación de isomorphic-git sobre el adapter FS Access tiene un piso de ~100-200 ms por syscall del browser. En la práctica eso se traduce en commits que toman ~2-3 s aún para una sola entidad, ~6 s para 100 entidades a la vez. Las operaciones de **autocommit** corren en background y el costo es invisible. Las operaciones **disparadas por el usuario** (switch de variante, merge entre variantes, accept de un diff-mark del borrador, crear/borrar variante) muestran una **pantalla de carga con mensaje contextual** mientras la operación termina. Patrón estándar de clientes git; aceptable para esta app. Mover `.git/` a OPFS para reducir el piso queda como optimización futura (ver `docs/deferred.md`); se evalúa si la UX con loading screens resulta intolerable en uso real.

### Fallback si isomorphic-git resulta inviable

Snapshots por entidad en `.mi-cerebro/history/<kind>/<id>/<timestamp>.json`. Misma UI de timeline, distinto backend. Las variantes no son soportables en este modo: la app degrada a una sola "Principal" implícita. Decisión sólo tras prototipo fallido del adapter de isomorphic-git en 13a. **Estado al cierre de 13a**: descartado. El adapter pasa los 10 casos de validación con números aceptables bajo el modelo de loading screens.

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

1.  **Scaffolding** Angular 21 + bun + PWA + estructura de carpetas src + linter + Prettier + Husky.
2.  **Core errors + i18n + theme** (base mínima para que el resto se monte ordenado).
3.  **FS Access + onboarding + permisos** (incluye `FsService`, persistencia del handle, banner de re-autorización).
4.  **Migrations base + AutosaveService + IndexedDB drafts** (toda la red de seguridad antes de la primera entidad).
5.  **Notes** como primer tipo end-to-end: crear, listar en árbol, editar (editor básico TipTap), guardar a disco con escritura atómica.
6.  **Árbol con filtro inteligente** (la búsqueda navegacional).
7.  **Tags transversales y búsqueda global** (dividido en dos sub-pasos):
    - **7a.** Tags transversales (`tags.json`, picker, badges en el árbol, color determinístico). _Cerrado._
    - **7b.** Búsqueda global indexada con MiniSearch persistido en IndexedDB; paleta `Ctrl+K`; filtro del árbol también busca tags; limpieza lazy de tag-refs muertos.
8.  **Concurrencia entre pestañas** (BroadcastChannel + locks). Dividido en sub-pasos:
    - **8a.** `LockService` genérico + canal `mc-locks`: claim/pong/release/takeover por `(kind, id)`, estado `idle | owned | foreign | evicted` como signal, takeover optimista, release best-effort en `beforeunload`. _Cerrado._
    - **8b.** Integración en `NotesContainer`: `NoteLockController` orquesta acquire al abrir / release al cerrar o cambiar de ruta. Editor, título y tag-picker pasan a solo-lectura cuando el estado es `foreign`/`evicted`. Banner inline con _Abrir solo lectura_ / _Tomar control_ para `foreign` y _Entendido_ para `evicted`. `guardWrite()` reporta AUT-005 si llega un write programático en solo-lectura; un effect dispara AUT-006 una sola vez por desalojo. _Cerrado._
9.  **Resto de entidades**: tasks, goals, lists, writings, images, files. Incluye filtros por tipo en el árbol (combinaciones notas+tasks+goals descritas en §10), que sólo cobran sentido cuando existe la segunda entidad. Subdividido por entidad:
    - **9a.** Tasks como segunda entidad end-to-end + reestructuración a sidebar global. Model `Task` con `done: boolean` y `dueDates: string[]` (ISO, ordenadas asc); `TasksService` reusa el patrón de notes (refresh/create/read/save/deleteToTrash + atomic write + autosave + índice de búsqueda + migrations); `TaskEditorPane` con checkbox done, picker de fechas (chips removibles, badge ámbar si está vencida), tag-picker y body TipTap. Refactor del lock controller a `EntityLockController` genérico (parametrizado por kind) usado por notes y tasks. Banner de lock se mueve a `shared/lock-banner` (entity-agnostic, recibe labels). **Cambio de arquitectura del shell:** la sidebar deja de vivir adentro de cada container y pasa a ser `WorkspaceSidebarContainer` global en el layout, con chips `Todo / Notas / Tareas`, árbol unificado con groups por entidad y filtro de texto/dirección compartido. Los containers de notes/tasks quedan reducidos al editor pane. Ruta `/tasks/:id` registrada. _Cerrado._
    - **9b.** Goals como tercera entidad end-to-end. Model `Goal` con `deadline: string | null` (un único plazo opcional — §13 enmarca metas como "tenés X tiempo para…") y `completed: boolean`; `GoalsService` reusa el patrón compartido (refresh/create/read/save/deleteToTrash + atomic write + autosave + índice de búsqueda + migrations); `GoalEditorPane` con checkbox completed, `DeadlinePickerComponent` de fecha única (chip removible, ámbar si vencida), tag-picker y body TipTap. Sidebar global gana chip `Metas` y grupo en el árbol con badge de plazo. Ruta `/goals/:id` registrada. Incluye `GoalReminderContainer` global en el shell: en cada `NavigationEnd` fuera de `/goals`, con probabilidad 1/4, banner discreto abajo-derecha con una meta no completada (prioriza vencidas, luego ≤7 días, luego cualquier pendiente) y acciones abrir/cerrar; evita repetir la misma meta hasta agotar el pool. _Cerrado._
    - **9d.** Writings — sólo artículos sueltos como quinta entidad end-to-end. Cubre `writings/<slug>.json` (archivo único) y deja libros (carpeta `<libro>/` con `_book.json` + `chapters/*.json`) para un sub-paso siguiente. Model `Writing` con `title`, `body` (TipTap; `emptyDoc` arranca con un párrafo vacío para enmarcar prosa larga, no bullets), `tags`, sin fecha ni estado. `WritingsService` reusa el patrón compartido (refresh/create/read/save/deleteToTrash/moveToFolder + atomic write + autosave + índice de búsqueda + migrations). `WritingEditorPaneComponent` con título, tag-picker y body TipTap. Sidebar global gana chip `Escritos`, botón `+ Nuevo escrito`, botón `+ Carpeta en Escritos` y grupo en el árbol. Ruta `/writings/:id` registrada. `TrashKind` y `KIND_DIRS` extendidos con `writing → writings`; `TrashService`, `FoldersService`, `folder-actions` y `tree-node` aprenden a manejar el nuevo kind. _Cerrado._
    - **9d-bis.** Books como sexta entidad end-to-end (forma "carpeta + capítulos"). Vive en `books/` (kind separado, no anidado bajo `writings/` para evitar colisión con el walk de single-file de Writings). Estructura en disco: `books/<carpeta-opcional>/<libro-slug>/_book.json` + `chapters/<capitulo>.json`. Model `Book` con `title`, `tags`, `order: string[]` (ids de capítulo definiendo orden visual, independiente del FS) y `Chapter` con `bookId`, `title`, `body` (TipTap). `BooksService` ofrece refresh (recorrido custom que distingue book-folder por presencia de `_book.json`), createBook, readBook, saveBook, deleteBookToTrash (bundle JSON `{book, chapters}` + remove dir), restoreFromBundle, moveBookToFolder, listChapters, addChapter, readChapter, saveChapter, removeChapter (hard-delete, no papelera, fuera del flow de §11), reorderChapters; búsqueda indexa libro + cada capítulo. `BooksContainer` orquesta `EntityLockController('book')` (un solo lock por libro, no por capítulo), book-meta-bar (título + tags + estado + borrar), chapter-list (↑/↓/+/✕) y chapter-editor-pane (título + body). Rutas `/books`, `/books/:id`, `/books/:id/:chapterId`. Sidebar suma chip `Libros`, botón `+ Nuevo libro`, botón `+ Carpeta en Libros` y grupo en el árbol. `TrashKind` y `KIND_DIRS` extendidos con `book → books`; `TrashService.restore` rama especial para `kind === 'book'` (lee bundle, llama `restoreFromBundle`, purga el archivo); `parseEntry` extrae título de `raw.book.title` para bundles; `FoldersService`, `folder-actions` y `tree-node` aprenden el nuevo kind. Fuera de alcance (siguiente sub-paso si surge): drag-and-drop para reordenar, papelera por capítulo individual. _Cerrado._
    - **9c.** Lists como cuarta entidad end-to-end. Model `List` con sólo `title`, `body` (TipTap; `emptyDoc` arranca con un bullet list para reforzar el formato), `tags`, sin fecha ni estado (§2 / §8: "listas sin fecha ni estado"). `ListsService` reusa el patrón compartido (refresh/create/read/save/deleteToTrash/moveToFolder + atomic write + autosave + índice de búsqueda + migrations). `ListEditorPaneComponent` con título, tag-picker y body TipTap. Sidebar global gana chip `Listas`, botón `+ Nueva lista`, botón `+ Carpeta en Listas` y grupo en el árbol. Ruta `/lists/:id` registrada. `TrashKind` y `KIND_DIRS` extendidos con `list → lists`; `TrashService`, `FoldersService`, `folder-actions` y `tree-node` aprenden a manejar el nuevo kind. _Cerrado._
    - **9e.** Images como séptima entidad end-to-end (primera entidad con binarios). Forma "carpeta = galería + originales + thumbs": vive en `images/<carpeta-opcional>/<galería-slug>/_gallery.json` + `original/<id>.<ext>` + `thumbs/<id>.webp`. Toda imagen vive dentro de una colección (no hay "imagen suelta en `images/`"). Model `Gallery` con `title`, `tags`, `order: string[]`, `images: GalleryImage[]` (cada una con `id`, `originalName`, `mime`, `ext`, `width`, `height`, `bytes`, `addedAt`). `GalleriesService` ofrece refresh (recorrido custom que distingue gallery-folder por presencia de `_gallery.json`), createGallery, readGallery, saveGallery, addImage (escribe original + genera thumb webp ≤320px lado largo via OffscreenCanvas, con fallback al original si falla createImageBitmap), readOriginalBlob, readThumbBlob, removeImage (hard-delete del par original+thumb), reorderImages, deleteGalleryToTrash, restoreFromDir, moveGalleryToFolder. `FsService` gana `writeFileAtomicBinary(Blob|ArrayBuffer)` y `readFile(): Promise<File>`. `GalleriesContainer` orquesta `EntityLockController('image')`, gallery-meta-bar (título + tags + estado + borrar), image-grid (thumbs en grid CSS, drop-zone para archivos, ↑/↓/✕ por imagen) y image-lightbox (overlay con original y close por click/Escape). Container administra blob URLs (createObjectURL/revokeObjectURL) por id de imagen, en `thumbUrls` (todos) y `originalUrls` (lazy al abrir lightbox); revoke en destroy. Rutas `/images`, `/images/:id`. Sidebar suma rail-icon 🖼 "Imágenes", botón `+ Nueva galería`, "+ Carpeta en Imágenes" y grupo en el árbol. **Papelera extendida para entradas-directorio:** `TrashEntry` gana `shape: 'file' | 'directory'`; `TrashService.refresh` lista subdirs `image__<id>__<slug>/` además de files `.json`; `parseDirEntry` lee título desde el `_gallery.json` interno; `restore` rama especial para `kind === 'image'` (mueve la carpeta entera de vuelta a `images/` con slug libre); `purge` usa `{recursive: true}` para directorios. `TrashKind` y `KIND_DIRS` extendidos con `image → images`; `FoldersService`, `folder-actions` y `tree-node` aprenden el nuevo kind. Fuera de alcance (siguientes sub-pasos): pegar desde clipboard, insertar imagen-referencia dentro de notas/escritos, drag-and-drop para reordenar, edición de imagen. _Cerrado._
    - **9j.** Pulido de §9 — vista previa inline para items previewables en colecciones de archivos. `FilesContainer` agrega `previewUrls = signal<Record<itemId, string>>({})` y `refreshPreviewsFor(collection)`: por cada item con mime `image/*` o `application/pdf`, lee el blob via `filesService.readBlob` y crea un `URL.createObjectURL`. Diff-friendly: reusa URLs cacheadas, revoca huérfanos. Se ejecuta en `loadCollection`, después de `onAddFiles` y `onRemoveItem`; `revokeAllPreviews()` en `destroyRef.onDestroy`. `FileGridComponent` recibe `previews: Record<itemId, string>` y, cuando hay URL, renderiza `<img>` para imágenes o `<embed type="application/pdf">` para PDFs en lugar del icono mime. Items sin preview (audio/video/zip/texto/binarios) siguen mostrando el icono. _Cerrado._
    - **9i.** Pulido de §9 — imagen-referencia dentro de cualquier editor TipTap (notas, escritos, capítulos de libros, metas). **Extracción a core:** `IMAGES_DIR`, `GALLERY_META_FILE`, `ORIGINAL_DIR`, `THUMBS_DIR`, `THUMB_EXT` se mudan a `@core/images/image-paths` (la convención de path queda en una sola fuente); `features/images/models/gallery.types.ts` los re-exporta. `core/trash/trash.service` ahora lee `GALLERY_META_FILE` desde el core, no desde el feature. Nuevo `@core/images/image-reader.service` con `register/unregister/clear/getGallery/summaries/readThumbBlob/readOriginalBlob`: mantiene un cache `Map<galleryId, {folder, slug, gallery: ImageRefGallery}>` que `GalleriesService` pobla en `refresh`/`createGallery`/`saveGallery`/`moveGalleryToFolder` y limpia en `deleteGalleryToTrash`. **Nodo TipTap:** `@core/tiptap/image-ref/image-ref.node.ts` define un nodo inline atom con attrs `{galleryId, imageId, alt}`, serializado a `<span data-image-ref data-gallery-id data-image-id data-alt>` (HTML plano para que copy/paste y búsqueda no rompan); el NodeView lee el thumb (o fallback al original) via `ImageReaderService`, crea un blob URL para el `<img>` y lo revoca en `destroy`. **Picker UI:** `@shared/editor/image-picker-dialog.component.ts` (modal con grilla de galerías a la izquierda + thumbs a la derecha) crea blob URLs sólo para la galería activa y los revoca al cambiar / cerrar. `EditorComponent` registra la extensión, inyecta el reader y muestra un toolbar con botón "🖼 Insertar imagen" sólo cuando `editable() && hasGalleries()`; al elegir, inserta el nodo con `chain().focus().insertContent(…)`. Como notas/escritos/capítulos/metas comparten `EditorComponent`, el wiring sirve a las cuatro entidades sin tocarlas. _Cerrado._
    - **9h.** Pulido de §9 — pegar imagen desde clipboard en galerías. `GalleriesContainer` registra en su `constructor` un listener `document.addEventListener('paste', …)` (removido en `destroyRef.onDestroy`) que: ignora el evento si no hay galería activa o si el lock no es editable; ignora si `event.target` está dentro de `input`/`textarea`/`[contenteditable]` (para no robarle el paste a la barra de título o al tag-picker); extrae archivos de `event.clipboardData.items` filtrando por `kind === 'file'` y `type.startsWith('image/')`; llama a `event.preventDefault()` y reusa `onAddFiles(files)`. _Cerrado._
    - **9g.** Pulido de §9 — drag-and-drop para reordenar items en las tres entidades con `order: string[]` (image-grid, file-grid, chapter-list). Helper compartido `reorderById(order, from, to)` en `@shared/utils/reorder` (mueve `from` para ocupar el slot de `to`, idempotente si `from === to`, tolera ids ausentes). Constante + guard compartidos en `@shared/utils/dnd`: `MC_INTERNAL_DND_TYPE = 'application/x-mc-id'` y `hasInternalDnd(event)` distinguen drags internos de drops de archivos del OS (que llevan `dataTransfer.files`) — el grid sigue aceptando ambos sin colisión. Cada componente afectado expone `reorder({from, to})` y los containers (`FilesContainer`, `GalleriesContainer`, `BooksContainer`) llaman a su respectivo `reorder*` del servicio con el array nuevo. Estado local de DnD con signals `draggingId` y `dropTargetId` para feedback visual (opacidad reducida en el item arrastrado, outline accent en el target). Ítem desplazado en `dragend`/`drop` para limpiar estado en caso de cancelación. Tests unitarios para `reorderById`. _Cerrado._
    - **9f.** Files como octava entidad end-to-end (segunda entidad con binarios; cierra la familia de adjuntos). Forma "carpeta = colección + items": vive en `files/<carpeta-opcional>/<colección-slug>/_collection.json` + `items/<id>.<ext>`. Todo archivo vive dentro de una colección — no hay "archivo suelto en `files/`" para mantener el patrón de papelera-directorio uniforme con 9e. Model `FileCollection` con `title`, `tags`, `order: string[]`, `items: FileItem[]` (cada uno con `id`, `originalName`, `mime`, `ext`, `bytes`, `addedAt`). `FilesService` ofrece refresh (recorrido custom que distingue collection-folder por presencia de `_collection.json`), createCollection, readCollection, saveCollection, addFile (escribe binario sin generar thumb), readBlob, removeFile (hard-delete), reorderFiles, deleteCollectionToTrash, restoreFromDir, moveCollectionToFolder. No hay generación de miniaturas — el grid usa iconos por mime/extensión (📄 PDF, 🎵 audio, 🎬 video, 📦 zip, 📝 texto, 📎 fallback). `FilesContainer` orquesta `EntityLockController('file')`, file-collection-meta-bar (título + tags + estado + borrar) y file-grid (cards con icono + nombre + tamaño, drop-zone, ↑/↓/✕ por item). Click en una card descarga el archivo original (blob URL + `<a download>` + revoke). Rutas `/files`, `/files/:id`. Sidebar suma rail-icon 📎 "Archivos", botón `+ Nueva colección`, "+ Carpeta en Archivos" y grupo en el árbol. **Papelera extendida (segunda kind con `shape: 'directory'`):** `parseDirEntry` ahora acepta `kind === 'image' | 'file'` y selecciona el meta file correcto (`_gallery.json` vs `_collection.json`) para leer el título; `restore` rama especial para `kind === 'file'` (mueve la carpeta entera de vuelta a `files/`). `TrashKind` y `KIND_DIRS` extendidos con `file → files`; `FoldersService`, `folder-actions` y `tree-node` aprenden el nuevo kind. Fuera de alcance (siguiente sub-paso si surge): vista previa inline (imágenes/PDF) en el grid, drag-and-drop para reordenar, edición de metadata por item. _Cerrado._
    - **9bis.** Papelera + carpetas. **Papelera:** `TrashService` lista todo lo que hay en `.mi-cerebro/trash/YYYY/MM/DD/` parseando archivos nombrados `<kind>__<id>__<file>.json`; cada entrada expone kind/id/title/deletedAt. Ruta `/trash` con restore (al directorio raíz del kind), purge individual y vaciado total con confirmaciones; link en footer del sidebar. **Carpetas:** son subdirectorios reales en disco por entidad (`notes/<path>/file.json`, idem `tasks/` y `goals/`). Cada entity service escanea recursivamente con `walkEntities`, summary gana `folder: string` (`''` = raíz). `FoldersService` provee createFolder/renameFolder/moveFolder/deleteFolder por kind; al borrar una carpeta, todo su contenido (recursivo) se manda a la papelera vía `deleteToTrash` de cada entity, y luego se elimina el dir. Cada entity service expone `moveToFolder(id, newFolder)`. Sidebar arma el árbol con `buildFolderTree` (carpetas vacías visibles, entities anidadas); botón "+ Carpeta en {kind}" en header crea carpetas, y un botón "⋯" inline en folder/entity nodes abre prompts para renombrar/mover/eliminar carpeta y mover entidad. _Cerrado._
10. **Calendar.** Feature consumidora-pura: lee de tasks (cada `dueDate`) y goals (deadline) — únicas entidades con fecha hoy; notas/recordatorios entrarán cuando el paso 11 sume reminders y cuando notas ganen fecha. **Cross-feature decoupling:** `@core/calendar/calendar-event.types` define `CalendarEvent { id, entityId, kind: 'task'|'goal', title, date, tags, done }`, `CalendarFilters { kinds, tagIds }` y `eventRoute(event)`; `@core/calendar/calendar-events.service` inyecta `TasksService` y `GoalsService` (mismo patrón que `TrashService`/`FoldersService` para servicios agregadores que viven en core), expone `events` (computed plano sorteado por fecha+título), `eventsByDay` (computed `Map<isoDay, events[]>`) y `filter(events, filters)`. `features/calendar` sólo importa el service de core, nunca features hermanos. **Vistas:** ruta `/calendar` con query params `?view=month|year&cursor=YYYY-MM-DD&day=YYYY-MM-DD`. `CalendarContainer` lee los params con `toSignal(route.queryParamMap)` y deriva `view`, `cursor` y eventos filtrados por mes/año. **Month grid:** componente `CalendarMonthGridComponent` arma siempre 6 semanas (42 celdas) con `buildMonthGrid(year, month)` para que el layout no salte; muestra dots por kind (azul tarea, naranja meta) cuando hay eventos en el día; resalta hoy y el día seleccionado. **Year grid:** `CalendarYearGridComponent` arma 12 mini-meses con tinte `--mc-bg-selected` en días con eventos; click en día abre vista mes + selecciona, click en nombre del mes abre vista mes en ese mes. **Day panel:** `CalendarDayPanelComponent` se monta debajo del grid cuando hay `day` en query params, agrupa eventos por kind ("Tareas" / "Metas") con tachado en done/completed; botones `+ Nueva tarea` y `+ Nueva meta` navegan a `/tasks` y `/goals` (prefijar fecha en la entidad creada queda como follow-up). **Filtros:** `CalendarFiltersComponent` con chips para los dos kinds y chips para tags globales (de `TagsService.tags()`); cuando hay tags seleccionados aparece `Limpiar tags`. Sidebar suma rail-icon 📅 "Calendario" antes del 🗑, con tratamiento de RailKey análogo a `trash` (no es entity-kind, no abre árbol). Rutas registradas en `app.routes.ts`. Fuera de alcance: prefijar fecha al crear una entidad desde el calendario, drag-and-drop entre días, vista semana, integrar `notas fechadas` (modelo de Note aún no tiene fecha) y reminders (paso 11). _Cerrado._
11. **Reminders.** Entidad plana, sin folders ni tags ni body — solo `title`, `dueAt` (ISO local sin timezone, `YYYY-MM-DDTHH:mm`), `done` y timestamps. `RemindersService` (en `features/reminders/services/`) reusa el patrón de single-file pero simplificado: refresh/create/read/save/deleteToTrash, sin walkEntities ni folders, archivos en `reminders/<uuid>.json`. Summary con `title/dueAt/done/updatedAt`, ordenado pending-earliest-first y luego done por updatedAt desc. **Scheduler in-app:** nuevo `@core/reminders/reminder-scheduler.service` (singleton root, instanciado al montar el toast) computa el próximo pending no-fired (`nextDue`), arma un `setTimeout` y al disparar mete el reminder en una signal `active`. Re-arma en cada cambio de summaries via `effect`. `dueAt` se parsea como wall-clock local (`new Date(y, mo-1, d, h, mi)`) — coincide con el calendario del usuario sin chasing de zonas. `firedIds` Set en memoria evita re-disparar el mismo recordatorio durante la sesión (al recargar arrancan limpios — consistente con "solo in-app con la app abierta" del §14). **Toast UI:** `ReminderToastContainer` montado en `AppShellContainer` debajo de `<mc-goal-reminder>`; banner abajo-derecha con borde acento, título y botones "Ver" (navega a `/reminders` y dismiss) y "✕". **Pantalla dedicada:** `RemindersContainer` (ruta `/reminders`) con lista pending arriba (editable inline: title input + datetime-local) + lista done abajo, checkbox para toggle, botón "+" para crear, ✕ para mover a papelera. Sidebar suma rail-icon ⏰ "Recordatorios" después del 📅, con tratamiento de RailKey análogo a calendar/trash. **Integración trash:** `TrashKind` y `KIND_DIRS` extendidos con `reminder → reminders`; `parseEntry` acepta el nuevo prefijo; `refreshKind` llama a `RemindersService.refresh`. **Divergencia FolderKind/TrashKind:** como reminders no tiene folders, `FolderKind` deja de ser un alias de `TrashKind` y se define explícito (todos los kinds menos reminder), para que el switch exhaustivo de `FoldersService` no caiga en una rama imposible. **Integración calendar:** `CalendarEventKind` suma `'reminder'`, `ALL_CALENDAR_KINDS` lo incluye, `eventRoute(reminder)` apunta a `/reminders` (sin id de detalle — no hay vista individual), `CalendarEventsService` inyecta `RemindersService` y proyecta cada summary con `tags: []`. Filtros + day-panel ganan chip y botón "+ Nuevo recordatorio". Fuera de alcance: notificaciones del SO con app cerrada (§2 fuera de alcance), folders + tags + body en reminders, snooze, repetición (recurring). _Cerrado._
    11bis. **Configuración del usuario.** Paso transversal que cierra una omisión recurrente del roadmap: varios pasos ya cerrados y pendientes hablan de "configurable en settings" (timer de autocommit en 13a, lifecycle de variantes en 13b, push opt-in en 13e, theme override en §17, umbral de objetivos dormidos en §13) sin que nadie haya construido la pantalla ni el servicio que esos knobs necesitan. Este paso lo crea y lo abre para el resto. **SettingsService (`@core/settings/settings.service`):** singleton root con estado en una `signal<Settings>`; incluye `schemaVersion` para futuras migraciones. API: `state` readonly + `set<Key>` por campo (validación inline antes de aceptar). **Persistencia dual:** fuente de verdad en archivo `.mi-cerebro/settings.json` del workspace (viaja con la carpeta del usuario → respeta §1 portabilidad real) + cache espejo en `localStorage` bajo `mc.settings.v1` para evitar flicker antes de que el workspace handle esté autorizado. Carga inicial: arranca con el cache de `localStorage` (o defaults si está vacío/inválido); cuando `WorkspaceService.isReady()` se vuelve `true`, un effect dispara `syncWithWorkspaceFile`: si el archivo existe y el schema coincide, sobreescribe el estado y refresca el cache; si no existe, lo sembra con el estado actual. Cada `set*` persiste a ambos lados (file write atomic via `FsService.writeFileAtomic`, fire-and-forget). Si el workspace no está listo aún, sólo persiste a `localStorage` y el sync se encarga después. **Inventario inicial de keys** (estructura por dominio, una sola por feature): - `timezone: string` (IANA, default `'America/Lima'` — UTC-5 sin DST chasing). Único knob _cableado activamente_ en este paso. Valida con `try { new Intl.DateTimeFormat('en', { timeZone }) }`; rechaza inválidos. - `versioning.autocommitMinutes: number` (default 5) — pendiente de wiring desde 13a. - `versioning.pushAfterAutocommit: boolean` + `versioning.pushThrottleMinutes: number` — placeholders para 13e. - `variants.dormantThresholdDays: number` (default 30) — placeholder para 13b. - `goals.dormantThresholdDays: number` (default 30) — placeholder para §13. - `theme.override: 'auto' | 'light' | 'dark'` (default `'auto'`) — placeholder para §17 / paso 15.

        Los campos placeholder existen con su default y se persisten, pero su feature dueña sigue siendo la única que los lee/escribe cuando llegue su turno — este paso no implementa la lógica de cada knob, sólo el contenedor. **Pantalla `/settings`:** `SettingsContainer` con secciones plegables por dominio (General / Versionado / Variantes / Objetivos / Tema). En este paso sólo "General" tiene controles funcionales: un único `<input list>` con `<datalist>` alimentado por `Intl.supportedValuesOf('timeZone')` (Chromium ≥99, dentro del support matrix §3 — fallback a lista curada si el runtime no lo expone). Combina autocompletado nativo (escribís "Lima" y el browser filtra) con escape hatch (cualquier IANA name aceptado libremente). Enter aplica, Escape revierte; validación pre-commit con `isValidTimezone()` muestra error si el string no es IANA. El resto de secciones muestra los valores guardados como readonly con badge "Próximamente" hasta que su paso correspondiente lo wire-up. Sidebar suma rail-icon ⚙ "Configuración" cerca del 🗑/⏰ (RailKey análogo, no entity-kind, no abre árbol). **Integración con `McDatePipe`:** el pipe deja de hardcodear `-5` y consume `settingsService.timezone()`; formatea con `Intl.DateTimeFormat` + `formatToParts` para garantizar el layout literal `dd/mm/yyyy hh:mm:ss` independiente del locale del SO. Como el pipe necesita re-renderizar cuando cambia la TZ, pasa a `pure: false` (costo aceptable: formateo de date strings cortos en cada CD cycle). **i18n:** strings nuevos bajo `settings.*` (título, secciones, label de timezone, hint de IANA). Fuera de alcance: import/export manual del archivo de settings (vive en `.mi-cerebro/settings.json` y el usuario puede copiarlo si quiere), sincronizar settings entre pestañas (BroadcastChannel), reset a defaults global, conflict resolution si dos pestañas escriben simultáneamente (last-write-wins, aceptado por el feature ser low-frequency), knobs nuevos no listados arriba (cada feature los suma cuando los necesita). _Pendiente._

12. **Music player.** Reproductor mini global + sección dedicada `/music`. **Almacenamiento en disco:** carpeta `music/` con `_library.json` (manifest `{tracks: Track[]}`), `tracks/<id>.mp3` (binarios) y `playlists/<slug>.json` (uno por playlist). `MusicLibraryService` (`features/music/services/`) maneja library: `refresh` lee el manifest (tolera ausencia), `addTracks(files)` filtra por `audio/mpeg` o extensión `.mp3`, escribe cada blob con `FsService.writeFileAtomicBinary` y actualiza el manifest atómicamente, `removeTrack` borra el archivo + actualiza manifest, `readBlob(id)` devuelve el `Blob` para reproducción/exposición. `PlaylistsService` reusa el patrón flat (sin folders): `refresh` enumera `playlists/*.json`, `create/read/save/delete`, más `removeTrackFromAll(trackId)` para limpiar refs cuando se borra un track de la biblioteca. **Playback core:** `@core/music/player.service` (singleton root) encapsula un único `HTMLAudioElement`. Estado en signals: `queue: {trackIds, index}`, `isPlaying`, `shuffle` (default `true` — §16 "reproducción aleatoria en bucle"), `currentTrackId`, `currentTrack`. API: `playTrack(id)`, `playPlaylist(trackIds, startIndex)` (si shuffle, baraja en orden con `shuffleFrom` poniendo el seleccionado al frente), `next/prev` (módulo length = bucle), `toggle/stop/toggleShuffle`. Crea/revoca blob URLs por track. `ended` event ⇒ `next()` automático. **Mini-player global:** `MiniPlayerContainer` en `layout/`, montado dentro del shell sólo cuando hay `currentTrack`. Barra fija abajo con título (link a `/music`), ⏮ ▶/⏸ ⏭ 🔀 (toggle aleatorio, resaltado cuando activo) y ✕ (stop). **Sección `/music`:** `MusicContainer` con grid 2-col: biblioteca (subir MP3 múltiple via `<input type=file>` oculto, lista con ▶/⏸ por track, "+" para agregar a playlist activa, ✕ para borrar de biblioteca con `removeTrackFromAll`) y playlists (lista clickable + editor de la activa con título editable, ▶ Reproducir, ↑/↓/✕ por track, borrar playlist). Sidebar suma rail-icon 🎵 "Música" después de ⏰, con RailKey análogo a calendar/trash/reminders (no es entity-kind). Refresh inicial de `MusicLibraryService` + `PlaylistsService` en el constructor del sidebar para que el mini-player vea tracks al primer arranque. Fuera de alcance: drag-and-drop para reordenar tracks de playlist, papelera para tracks/playlists (borrado directo), formatos distintos de MP3, edición de metadata (tags ID3), duración real del archivo (sólo se persiste `null` por ahora), control de volumen, scrubbing en la timeline. _Cerrado._
13. **Versionado y variantes.** Sistema combinado de autocommits + variantes + historial navegable sobre **isomorphic-git** con adapter propio a File System Access API. Dividido en sub-pasos:
    - **13a.** Autocommit + timeline + restore sobre una variante implícita. Sin UI de variantes, sin push remoto. Adapter de isomorphic-git sobre FS Access API; `git init` al detectar workspace sin `.git/`; `VersioningService` con timer (default 5 min, configurable) + triggers (cierre de entidad, cambio de feature, `visibilitychange` → hidden, `beforeunload`) + throttle 60s + skip si no hay diff. `.gitignore` automático para binarios (`music/tracks/`, `images/*/original/`) y redes de seguridad (`.mi-cerebro/recovery/`, `/pre-migration/`, `/trash/`, `.mi-cerebro/history/`). Ruta `/history` con timeline agrupada por bucket temporal + diff visual por entidad (TipTap a texto plano + jsdiff línea a línea; metadata como tabla antes→después; tags con chips +/–; binarios sólo tamaño). Restore por entidad y por commit (con autocommit `before-restore: <hash>` previo). Footer del sidebar con "Último commit · hace 3 min". Errores `MCB-VER-001..003`. **Si el adapter resulta inviable** (típicamente performance del walk inicial), fallback a snapshots por entidad en `.mi-cerebro/history/<kind>/<id>/<timestamp>.json` con la misma UI; variantes (13b en adelante) no soportables en ese modo y queda registrado.
      - **Cerrado 2026-06-11.** Adapter, `VersioningService`, autocommit con los 4 triggers + throttle + drain + `FsLockService`, `/history` con buckets + diff estructurado por entidad (título / cuerpo / tags chips / campos / metadata del sistema), footer del sidebar, indicador HEAD ("Actual") en la timeline, restore por entidad (botón en cada fila con confirm) y restore por commit completo (autocommit `before-restore: <hash>` como red de seguridad + confirmación tipeando el shortOid + commit final `restore: snapshot completo desde <short>` via walk de los dos trees), `MCB-VER-001..003` registrados. Validator dev (`DevPerfService`) viable bajo modelo loading-screen. Polish visual y pequeñas mejoras de UX diferidos en `docs/deferred.md` §19.16f.\_
    - **13a-bis.** Milestones nombrados (git tags). Resuelve el dolor de "no me encuentro en el océano de autocommits". El usuario nombra un commit como hito (ej. "antes de refactor X", "borrador 3 entregado") y queda como un git tag real (`refs/tags/<slug>`) — ref separado del log, persistente, no es un commit más en la línea. **UI:** botón "Marcar este punto" en el detail-head de `/history` (al lado de "Restaurar todo este commit"); abre prompt para nombre + descripción opcional. La timeline muestra los milestones como banda/separador visible entre commits (no como una fila más), y existe un panel/filtro "Sólo milestones" para colapsar todo lo demás. Renombrar y eliminar milestone desde el mismo punto. **Implementación:** `MilestoneService` con `create(oid, name, description?)` que llama `git.annotatedTag` (tag anotado para que guarde el mensaje del usuario, no sólo el ref), `list()`, `rename()` (delete + recreate sobre el mismo oid), `delete()`. `HistoryService` expone `milestonesByOid` para que la timeline pinte los chips. Slug del tag derivado del nombre con saneo (espacios → guiones, minúsculas, ASCII). **Nombres únicos por diseño:** si el usuario intenta crear (o renombrar) con un nombre que ya existe, el flujo se interrumpe y le ofrece tres opciones — (1) usar otro nombre, (2) mover el milestone existente a este commit (delete + recreate sobre el nuevo oid), (3) cancelar. Descartadas: auto-sufijo `(N)` estilo Windows (miente cuando hay renombres/borrados posteriores, el contador se degrada y deja de reflejar la realidad) y permitir duplicados con slug interno por oid (rompe la búsqueda por nombre, que es el valor principal del feature). Persistencia automática: viven en `.git/refs/tags/`, viajan con el push de 13e cuando se habilite. **Mensaje en el header del editor:** "n commits desde {milestone-más-cercano}" como contexto leve, diferido a 16f si saturamos. Errores `MCB-VER-017..018` (deja el rango 004..016 a 13b-e). _Cerrado 2026-06-11._ `MilestoneService` con create/list/rename/delete/moveTo sobre `git.annotatedTag` + slug ASCII; `HistoryService` expone `milestonesByOid` y `refreshMilestones`; `MilestoneController` (provider del container) encapsula los prompts y el flujo de colisión 3-opciones; UI con toggle "Sólo milestones" en el header de la timeline, banda visual con borde acento sobre cada commit marcado, y en el detail-head botón "Marcar este punto" que se reemplaza por chip con nombre + ✏ + ✕ cuando ya hay milestone. `MCB-VER-017/018` registrados. Mensaje "n commits desde {milestone}" en el header del editor queda diferido a 16f. **Pulido colateral del shell aceptado en el mismo commit**, anticipando trabajo que estaba previsto para §19.16f: timeline y detail de `/history` con toggle de colapso a rail (mutuamente excluyentes, estado efímero por ruta); `WorkspaceSidebarContainer` esconde su `.pane` (buscador + árbol) en `/history` manteniendo el rail de navegación cross-page (host se contrae a `width: auto`); scrollbars globales finitos (8px) y semi-transparentes via `color-mix(... transparent)` sobre `--mc-fg-muted`, que siguen al tema.
    - **13b.** Variantes (familias) + switch + lifecycle + merge sobre `main`. Modelo de familia de 3 ramas por variante (`main`/`draft`/`comments`); `.mi-cerebro/variants.json` con la metadata. Crear variante = bifurcar las 3 ramas heredando de las facetas hermanas de la familia origen. Borrar variante = `git branch -D` sobre las 3 + remover entrada. Switch de familia con commit forzado de dirty + `git checkout` + invalidación e intercambio de índice. Pill de variante activa en el header del editor (color por familia). Pantalla `/variants` con secciones Activas / Principal (permanente) / En reposo. Lifecycle de reposo a 30 días default (configurable en settings, consume el placeholder `variants.dormantThresholdDays` de 11bis). Merge entre variantes (`/variants/merge?from=X&into=Y`) con bundle por entidad limitado a `main` por ahora (las facetas `draft`/`comments` existen como ramas inicializadas pero sin UI de uso hasta 13c/13d). BroadcastChannel sincroniza otras pestañas a la variante activa; rehúso → modo lectura. Índice de búsqueda por familia en IndexedDB (`idx-<family>-main`). Errores reservados `MCB-VER-004..012` (asignación fina por sub-paso). **Partido en cuatro sub-pasos, cada uno cierra con un criterio de validación duro antes de avanzar — la prioridad es que el sistema de versionado sea confiable, no rápido de cerrar.**
      - **13b-i. Modelo + servicio de variantes (sin UI de switch).** Foundation: `.mi-cerebro/variants.json` con schema versionado (id, nombre, color, `protected`, `lastActivityAt`, refs de las 3 ramas, `state: 'active' | 'dormant'`). Migración base. `VariantsService` (core/versioning/) con `list`, `create(name, color, fromVariantId?)`, `delete(id)`, `read(id)`, `getActiveId`, `setActiveId` (sólo persiste la elección, no hace checkout en este paso). **Creación atómica de la tripla:** crea `variant/<slug>/main`, `variant/<slug>/draft`, `variant/<slug>/comments` forkeando de las facetas hermanas de la familia origen (Principal por default = `main`, `variant/principal/draft`, `variant/principal/comments`); si alguna de las 3 falla, rollback completo (`git branch -D` de las que sí se crearon + no se escribe `variants.json`). **Eliminación atómica:** marca la entrada en `variants.json` como `pending-delete` antes de tocar las ramas; si el `git branch -D` de las 3 falla, queda como `pending-delete` para reintento en el próximo arranque (no como huérfano). Footer del sidebar muestra nombre + color de la variante activa (read-only, sin menú de cambio aún). Errores `MCB-VER-004` (crear variante falló mid-way), `MCB-VER-005` (borrar falló), `MCB-VER-006` (`variants.json` ilegible/incompatible). **Validación de cierre (debe pasar antes de 13b-ii):** (1) crear 3 variantes desde dev panel, listar ramas internamente (`git.listBranches`) y verificar que existen las 9 ramas esperadas; (2) forzar fallo en la creación de la 3ra rama y verificar que las 2 primeras se rollbackeen y `variants.json` no se modifique; (3) eliminar una variante con commits propios y verificar que las 3 ramas desaparezcan; (4) corromper `variants.json` a mano y verificar que la app abre con `MCB-VER-006` y la opción de restaurar desde `.mi-cerebro/pre-migration/`. _Cerrado._ Implementación: `variants.types` + `variants.io` (sanitizer estricto del shape persistido + helpers de refs), `VariantsService` con `list/refresh/create/delete/read/getActiveId/setActiveId` — creación de las 3 ramas atómica con rollback en orden inverso si alguna `branch()` falla y `variants.json` sólo se escribe cuando las tres pasan; eliminación en dos fases (marca `pendingDelete` y persiste antes de tocar refs, así un crash mid-delete queda recuperable y `ensureLoaded()` reintenta al próximo boot); seed automático con sólo Principal cuando `variants.json` no existe; degrade a Principal-only ante archivo corrupto/incompatible con toast `MCB-VER-006`. Errores `MCB-VER-004/005/006` registrados en `error.codes.ts`, `docs/errors.md` e i18n. Pill readonly de variante activa en el footer del sidebar (color + nombre, sin menú aún — eso es 13b-ii). Dev panel 🌿 con tres secciones (estado vivo con conteo de refs por familia + flag de huérfanas, CRUD limpio, validación automatizada ① ② ③ con setup + assert + cleanup sobre variantes throwaway; ④ queda como check manual con sub-casos "edits válidos respetados" y "JSON inválido → VER-006"). Gates ① ② ③ ④ pasaron en su momento. Commit `4189bdf`.

      - **13b-ii. Switch de variante activa + sincronización entre pestañas.** Punto más delicado del paso 13: el switch toca el FS, el índice de búsqueda y el lock por entidad simultáneamente. Flujo: (a) `AutosaveService.flushAll()` para que no haya escrituras pendientes, (b) `VersioningService.commitAll('auto: pre-switch-variant <slug-from> → <slug-to>')` para no perder dirty, (c) `git.checkout({ ref: 'variant/<to>/main' })`, (d) invalidar el índice de búsqueda en memoria, (e) cargar/rebuild el índice `idx-<to>-main` desde IDB (rebuild si no existe), (f) `setActiveId(to)` persistido en `variants.json`. Todo el flujo corre bajo `FsLockService` (mismo mutex que el autocommit) para no cruzar escrituras con un autocommit en vuelo. **Loading screen contextual:** mientras corre el flujo, overlay con mensaje "Cambiando a variante {nombre}…" (operación visible, ~3-6 s según el repo). **Sincronización entre pestañas:** nuevo canal `mc-variants` con mensaje `{type: 'switched', variantId, requestedAt}`. Pestañas hermanas reciben el aviso y: si tienen entidades abiertas, las pasan a read-only con banner inline "Otra pestaña cambió a la variante {X}. Recargar para continuar." (reusa el componente del banner del paso 8 con un label nuevo). Si están en una vista sin entidad abierta, hacen reload silencioso. **Pill de variante en el sidebar global:** chip con el color de la familia + nombre + chevron; click abre un dropdown simple con la lista de variantes para hacer switch (sin pantalla `/variants` todavía — eso es 13b-iii). **Persistencia robusta:** `variants.json` es la fuente de verdad de `activeId`; al arrancar, si el `git.currentBranch()` no coincide con `activeId`, la app hace checkout silencioso para alinear (cubre el caso de cierre forzoso mid-switch). Errores `MCB-VER-007` (switch falló durante flush o commit pre-switch), `MCB-VER-008` (checkout falló — workspace queda en la variante origen), `MCB-VER-009` (índice no pudo cargarse — switch se completa pero la búsqueda queda deshabilitada hasta rebuild manual). **Validación de cierre:** (1) 50 switches ida-y-vuelta sin pérdida de cambios (escribir en entidad, switch, switch de vuelta, verificar que el contenido coincide); (2) abrir entidad en pestaña A, cambiar variante desde pestaña B, verificar que A entra en read-only con banner; (3) cerrar la app durante un switch (devtools → kill tab) y verificar que al reabrir, el branch actual coincide con `activeId`; (4) switch con dirty no commiteado verifica que se creó el commit `pre-switch-variant`. _Cerrado._ Implementación: flujo de switch en cinco pasos bajo `FsLockService.withLock` para no crozar con autocommit/autosave — (1) `AutosaveService.flushAll()`, (2) `VersioningService.commitAll('auto: pre-switch-variant <from> → <to>')` que aterriza el dirty snapshot en la variante que dejamos, (3) `git.checkout({ ref, force: true })`, (4) `VariantsService.setActiveId(to)` persistido antes del rebuild de índice para que un fallo del rebuild (VER-009, warning) no deshaga el switch, (5) `WorkspaceRefreshService.refreshAll()` re-camina cada feed de entidades desde disco (índice persistente por familia diferido — ver `deferred.md`). `alignWithGit()` corre al boot del app-shell: si `HEAD ≠ variants.json.activeId` (crash mid-switch), force-checkout silencioso reconcilia. Sincronización entre pestañas con `BroadcastChannel('mc-variants')`: pestañas hermanas que reciben `{type:'switched', variantId, requestedAt}` setean `SwitchVariantService.remoteSwitch`, lo que monta un banner amarillo no-cerrable con botón Recargar en el tope del shell. UI: pill del sidebar ahora es trigger de dropdown con la lista de variantes para switchear (deshabilitado con spinner durante el switch); `<mc-variant-switch-overlay>` en el app-shell (overlay modal durante propio switch + banner stale cuando otra pestaña broadcasteó). Nuevo `core/fs/WorkspaceRefreshService` centraliza el refresh chain del boot (sidebar bootea por ahí; el switch usa el mismo chain). Errores `MCB-VER-007/008/009` registrados en docs + i18n. Dev panel gana segunda sección con tests automatizados ⑤ ⑥ ⑦ ⑧ (round-trip, broadcast set-stale, alignWithGit recovery, pre-switch commit en main de la variante saliente). Gates ① ② ③ ④ pasaron en su momento. Commit `eaddeb9`.

      - **13b-iii. Pantalla `/variants` + lifecycle de reposo.** UI completa de gestión, sobre las primitivas que ya garantizan 13b-i/ii. `/variants` con tres secciones: **Activas** (ordenadas por `lastActivityAt` desc), **Principal** (permanente, no se borra), **En reposo** (CTAs "Mergear" — deshabilitado hasta 13b-iv — y "Eliminar"). Crear variante con form (nombre, color picker, "forkear desde {activa}" como default). Renombrar variante (modifica `variants.json` + renombra las 3 ramas via `git.renameBranch`). Eliminar con confirmación; si la variante tiene commits no mergeados respecto a Principal, warning con opción "exportar ZIP antes" (deferred a 14 si todavía no está). **Lifecycle:** `lastActivityAt` por familia = max de los `committer.timestamp` del HEAD de sus 3 ramas. `state` se computa al cargar `/variants` y al arrancar: si `now - lastActivityAt > dormantThresholdDays * 86400000`, pasa a `'dormant'`. `dormantThresholdDays` consumido desde `SettingsService.state().variants.dormantThresholdDays` (cablea el placeholder de 11bis; agrega el control real a la pantalla `/settings`). Principal está exenta del lifecycle. Sidebar rail-icon nuevo 🌿 "Variantes" cerca de 🕐. El dropdown del pill de 13b-ii pasa a tener al final "Gestionar variantes…" que abre `/variants`. **Migración del dropdown:** la lógica de switch sigue viviendo en `VariantsService.switchTo()`; la UI nueva sólo agrega entradas, no duplica el flow. **Validación de cierre:** (1) crear variante con form, verificar que aparece en "Activas" y que el switch funciona; (2) tocar `lastActivityAt` a mano (via dev panel) para una variante hace 31 días, recargar `/variants` y verificar que pasa a "En reposo"; (3) cambiar `dormantThresholdDays` de 30 a 7 desde `/settings` y verificar que `/variants` reacciona; (4) renombrar una variante con switch activo y verificar que el rail-pill se actualiza sin romper el lock de la entidad abierta. _Cerrado._ Implementación: `VariantsService.rename/setColor/refreshActivity/setLastActivityAt` + `variants-rename.ts` (atomic 3-branch rename con rollback + checkout HEAD si la activa fue renombrada) + `variants-activity.ts` (max committer.timestamp de `main`/`draft`/`comments`, depth 1) + nuevo feature `/variants` con tres secciones, form de creación, rename inline, color picker, confirmación de delete con conteo de unmerged contra Principal (`VariantsStatsService`), rail-icon 🌿 + "Gestionar variantes…" en el dropdown del pill. Control real en `/settings` para `dormantThresholdDays`. Refresh de actividad al boot del app-shell y al cargar `/variants`. No se introdujeron códigos de error nuevos — rename colisión/inválido cae en `MCB-VER-004`; rename con checkout fallido en `MCB-VER-008`.

      - **13b-iv. Merge entre variantes (limitado a `main`).** Cierra 13b. `/variants/merge?from=<X>&into=<Y>` con tabla de entidades que difieren entre `main` de X y `main` de Y (path, status `modified|added-in-X|added-in-Y|deleted-in-X|deleted-in-Y`, preview corto). Por entidad: botones "← Quedarme con esto de X" / "→ Quedarme con esto de Y" / "Saltar" (no toca destino). Atajos masivos `Todo de X →` / `← Todo de Y` con confirm. **Aplicación:** un commit en `main` de Y por cada entidad seleccionada (`merge: <path> from <X>`) — en este paso sólo `main`, las facetas `draft`/`comments` quedan intactas en Y aunque tomen lo de X (la granularidad por faceta es 13c/13d). Cada commit lleva trailer `Merge-Group: <uuid-de-esta-sesión>` para que `/history` los agrupe visualmente como una sola operación. **Manejo de fallo parcial:** si el commit N falla, los N-1 anteriores quedan; la UI muestra "merge parcial: aplicadas N-1 de M, falló en {entidad}, [reintentar] / [continuar saltando esta] / [cancelar resto]". No hay reversión automática — el usuario decide. Origen nunca se borra (eliminar es acción separada en `/variants`). **Bundle ZIP de seguridad:** antes de aplicar el primer commit, autocommit `pre-merge: <X> → <Y>` en Y como red de seguridad (mismo patrón que `pre-restore` de 13a). Errores `MCB-VER-010` (merge falló durante el commit), `MCB-VER-011` (entidad cambió externamente entre la preview y el commit — pide refrescar), `MCB-VER-012` (trailer `Merge-Group` inconsistente en el grupo aplicado). **Validación de cierre:** (1) merge de 20 entidades con bundle ✓ sin fallos; (2) merge interrumpido a mitad (forzar fallo en commit 5 de 10) reporta correctamente que aplicó 4 y falló en la 5ta; (3) `/history` agrupa los 10 commits del merge bajo el mismo `Merge-Group`; (4) `pre-merge` queda como punto de restauración usable desde `/history`. _Cerrado._ Implementación: `MergeService.diffMains` (tree-walk de los dos `main` con preview corto de cada blob no-binario) + `MergeService.apply` (autocommit `pre-merge` afuera del lock para evitar reentrada; `applyLocked` corre per-entidad bajo `FsLockService.withLock` usando `git.writeCommit`/`writeRef` con árbol reconstruido por `merge-apply.ts:buildMergeCommit` — nunca se mueve el HEAD del usuario ni se toca el working tree) + pantalla `/variants/merge` con selectores from/into editables (swap incluido), tabla con preview + segmento ← / → / saltar, barra de bulk, banner de outcome con partial-fail UX (Reintentar la fallida / Saltar y continuar / Cerrar) + agrupación visual en `/history` por trailer `Merge-Group` (consecutivos colapsan a una fila "Merge: N entradas desde X hacia Y" expandible). Errores nuevos: `MCB-VER-010` (apply falló), `MCB-VER-011` (entidad cambió externamente, reservado para racing con otra pestaña), `MCB-VER-012` (trailer inconsistente). Principal queda incluido en `refreshActivity` para que su `lastActivityAt` se actualice cuando recibe un merge (pero `state` siempre `'active'`). Gates ⑨ y ⑪ verificados (merge de 23 entidades — 20 seed + 3 metadata de `.mi-cerebro/` — y agrupado visual en `/history` por trailer `Merge-Group`). **Pendientes de verificación manual:** ⑩ partial-fail forzado (revocar permisos o renombrar ref destino a mitad del bucle) y ⑫ `pre-merge` como punto de restauración usable desde `/history`.

    - **13c.** Comentarios anclados. Extensión TipTap que asigna UUID estable a cada nodo top-level (persistido como atributo). `comments/<entityId>.json` en la rama `variant/<family>/comments` con anchors `entity` y `block` (sin `range` — diferido a pulido). Position tracking via mapping de ProseMirror steps al editar `main`; anchors invalidados → `orphaned: true` (nunca expiran solos). Panel lateral en el editor con lista de comentarios para la entidad activa + agregar + sección de huérfanos. Búsqueda por familia se extiende con índice de comentarios (`idx-<family>-comments`). El bundle del merge ahora incluye comentarios de la entidad. Mensajes de autocommit prefijados `auto [comentarios]: …`. Lectura/escritura de la rama vía isomorphic-git plumbing sin checkout. Errores `MCB-VER-019..021` (saltan 013-018 ya reservados/usados por 13b y 13a-bis). **Partido en cuatro sub-pasos**, mismo patrón que 13b — la prioridad es que el sistema sea confiable, no rápido de cerrar. **Cerrado en bloque 2026-06-12** con los cuatro sub-pasos (13c-i..iv) verdes; única pieza diferida: el índice de búsqueda global para comentarios (`idx-<family>-comments`), pateado a §19.16d porque sin un walk de priming de la rama comments al boot/family-switch dejaría una UX fantasma — registrado en `docs/deferred.md` junto con el índice por familia para `main` ya diferido en 13b-ii.
      - **13c-i. Extensión TipTap de block-ids + migración formal v1 → v2.** Foundation: nodos `paragraph`, `heading`, `blockquote`, `codeBlock`, `listItem`, `horizontalRule` ganan un atributo `blockId: string` con un UUID estable, persistido como `data-block-id`. Extensión `mcBlockId` mantiene la invariante en runtime (rellena al ingresar contenido nuevo, re-asigna duplicados al pegar). Migración formal por entidad rellena ids faltantes en docs pre-13c — un sólo step compartido `blockIdMigrationStep(1)` registrado bajo cada kind con body (`note`, `task`, `goal`, `list`, `writing`, `book` — este último cubre Chapter porque comparten cadena de migración). `injectBlockIds(body)` es puro, idempotente, y no-op cuando el payload no trae `body`. **Bug fix colateral**: `MigrationsService.isContiguous` exigía que la cadena empezara en `from === 0`, lo que contradecía su propio comentario ("A bump that introduces v2 will add the 1->2 step"); ahora acepta cualquier cadena estrictamente contigua que termine en `latest`. Cobertura: tests del walker (preserva, re-asigna duplicados, no-op fuera del target set) y de la extensión (round-trip a HTML, mantiene ids existentes, llena los faltantes en transacciones siguientes). Gate: tests verdes, docs con/sin ids round-tripean, ediciones nuevas no cambian ids. _Cerrado 2026-06-12._
      - **13c-ii. Comments branch I/O via plumbing + service + errores.** Plumbing reusable extraído: `tree-ops.ts` con `walkTreePath` / `rebuildTreeAt` / `blobOidAt` / `createTreePath` / `splitPath`, factor común que ahora consume `merge-apply.ts` (paso 13b-iv) y `branch-blob-ops.ts` (este sub-paso + 13d-i). `branch-blob-ops.ts` expone `readBranchBlob(fs, ref, filepath)` y `writeBranchBlob({ ... })` — operan sobre cualquier ref con plumbing puro: leen el oid del HEAD del ref, walk del tree, `writeBlob` + `rebuildTreeAt` + `writeCommit` + `writeRef` por dentro. `MissingBranchRefError` marca la falla estructural "el ref de la familia no existe" como subclase de `Error` (callers la mapean a su código de dominio). `CommentsService` (core/versioning/) inyecta `WorkspaceService` + `VariantsService` + `FsLockService`: `read(entityId)` devuelve `CommentsFile` (o `emptyCommentsFile` si no hay nada escrito), `save(entityId, entityTitle, comments[])` corre bajo el mismo mutex que el autocommit y commitea con prefijo `auto [comentarios]: <título> (N comentarios)`. `validateAnchor(comment, blockIdsInDoc)` es puro: lanza `MCB-VER-021` si `anchorType === 'block'` y el bloque ya no existe. `CommentsFile` lleva `schemaVersion: 1` para futuras migraciones; si el persistido trae versión mayor o JSON inválido, dispara `MCB-VER-020` (nunca se silencia). Errores nuevos: `MCB-VER-019` (read/write del plumbing falló o falta workspace/variante), `MCB-VER-020` (archivo ilegible o schema futuro), `MCB-VER-021` (anchor inválido). Tests: integración `branch-blob-ops.spec` (read null en archivo/ref ausente, write+read round-trip, idempotente, no toca el working tree, no mueve `main`) y `comments.service.spec` (round-trip, prefijo de commit, schema futuro dispara VER-020, validateAnchor con tres ramas). Gate: el commit de comments aterriza en su rama sin checkout, `main` queda intacto, los tres códigos están registrados en `error.codes.ts` + `docs/errors.md` + i18n. _Cerrado 2026-06-12._
      - **13c-iii. Comments side panel UI + i18n + a11y.** `EditorComponent` gana inputs `entityId` / `entityTitle` (opt-in: el panel aparece sólo cuando `entityId !== ''`); toolbar agrega botón 💬 "Comentarios" con `aria-pressed` para abrir/cerrar el panel. `CommentsPanelContainer` (smart, en `shared/editor/`) orquesta la UI: inyecta `CommentsService` + `ErrorService` + `I18nService`, lee comentarios en cada cambio de `entityId` (descarta resultados stale si el usuario navega mid-load), persiste alta/baja vía `CommentsService.save`. Sub-componentes dumb: `CommentItemComponent` (chip de anchor type + tiempo creado + botón eliminar + cuerpo), `CommentFormComponent` (radio entity/block, dropdown de bloques cuando aplica, textarea para cuerpo, error inline, botones cancelar/guardar). `extractBlockSummaries` (puro, `shared/editor/block-summaries.ts`) recorre el doc emitiendo `{blockId, type, preview}` en orden de documento, truncando a 60 chars con `…`; el form lo usa para poblar el dropdown. **Cuerpo plain text por ahora** — se serializa como `{type:'doc', content:[{type:'paragraph', content:[{type:'text', text}]}]}` (cumple el contrato del modelo `Comment`); rich text dentro del comentario queda diferido a pulido (16e). Sección de huérfanos visible cuando `orphaned.length > 0` (vacía hasta que 13c-iv cablee position tracking) con texto explicativo en i18n. **A11y:** `role` implícito por `<aside>` (host), `aria-labelledby` en lista al título, `aria-pressed` en toggle, `aria-live="polite"` en lista, `aria-label` en botones de icono, focus outlines visibles via `:focus-visible`. **Borrar** pide confirmación nativa con `confirm()` y mensaje i18n; si el browser no expone `confirm` (caso edge testing), no-op silencioso. **Wiring de consumers:** las seis panes que montan `<mc-editor>` (notes/tasks/goals/lists/writings/chapters) pasan `entityId` y `entityTitle` desde su modelo. i18n bajo `comments.*` (28 strings). Tests: `block-summaries.spec` (skip sin id, orden de doc, truncado, blocks vacíos). Gate: el panel abre/cierra, agrega comentario `entity` o `block`, persiste vía rama comments (verificado en 13c-ii), borra con confirm, muestra empty state, los huérfanos quedan listos para 13c-iv. _Cerrado 2026-06-12._
      - **13c-iv. Position tracking + merge bundle ext + history filter chips.** Cierra 13c. **Position tracking** vía helper puro `applyOrphanFlags(comments, blockIdsInDoc)` (en `core/versioning/comments-orphans.ts`): devuelve la misma referencia cuando nada cambia para que efectos signales que dependan no re-disparen. `CommentsPanelContainer` lo aplica en dos puntos: al cargar (sobre el `comments` recién leído de la rama, así huérfanos de versiones pasadas se ven al instante) y en un effect sobre `blocks()` (cuando el doc cambia, los flags se reconcilian sin tocar la rama — la persistencia del flag es opcional porque la verdad se rederiva en la siguiente lectura). Anchors `entity` nunca son huérfanos: si un flag `orphaned: true` sneaks in por ahí, se normaliza. **Merge bundle ext**: `MergeService.commitOneSelection` ahora invoca `mergeCommentsFaceta` después del commit en main. Best-effort additive: lee el id del blob recién mergeado de main, busca `comments/<id>.json` en `from.refs.comments`, si existe (y difiere de `into`) escribe un commit en `into.refs.comments` con `buildMergeCommit` y trailer compartido `Merge-Group: <uuid>` + `Merge-Facet: comments`. Si la entidad no es JSON o no tiene `id`, skip silencioso (cubre `.gitignore`, `variants.json`, `tags.json`, etc.). Nunca borra comentarios — el caso "from no tiene comments pero into sí" deja into intacto. **History filter chips**: helper puro `facetOf(message)` (en `features/history/services/facet.ts`) clasifica cada commit por convención de mensaje: `auto/merge [comentarios]:` → `comments`, `auto [borrador]:` o `accept-draft:` → `draft`, resto → `main`. `HistoryContainer` suma signal `enabledFacets: Set<Facet>` (default todas) con guard de no-vacío (no se puede deshabilitar la última chip), `buckets` computed los combina con el toggle "Sólo milestones" existente, UI con tres `<button class="facet-chip" aria-pressed="…">` al lado del checkbox de milestones. Strings nuevos bajo `versioning.history.facet.*`. Tests: `comments-orphans.spec` (idempotente, marca y desmarca, normaliza entity, ref-equality) y `facet.spec` (4 prefijos + multi-línea no se mis-clasifica). **Diferido a §19.16d**: índice de búsqueda global para comentarios (`idx-<family>-comments`) — requiere un walk de priming de la rama comments al boot/family-switch que conviene diseñar junto con el índice por familia para `main` ya listado en `deferred.md`. Sin priming, una integración parcial dejaría una UX fantasma peor que no tenerla. _Cerrado 2026-06-12._
    - **13d.** Borrador anclado (track-changes). `drafts/<entityId>.json` en la rama `variant/<family>/draft` con diff-marks `{anchor, before, after, status}`. Toggle "modo borrador" per-entidad: cuando está activo, las ediciones se capturan como pending diff-marks en vez de aplicarse a `main`. Panel lateral con accept/reject por mark + **renderizado inline ghost/strikethrough** (decoraciones ProseMirror, no contenido real). Aceptar = commit nuevo en `main` de la familia (`accept-draft: <entidad> (N cambios)`); nunca pisa historia. Position tracking compartido con comentarios. El bundle del merge ahora incluye drafts. Índice por familia (`idx-<family>-draft`) sujeto al mismo diferimiento que el índice de comentarios (ver `deferred.md`) — la búsqueda global de drafts pateada a §19.16d. Mensajes prefijados `auto [borrador]: …`. Errores `MCB-VER-022..024`. **Partido en cuatro sub-pasos**, mismo patrón que 13b/13c — la prioridad es que el sistema sea confiable, no rápido de cerrar. **Cerrado en bloque 2026-06-12** con los cuatro sub-pasos (13d-i..iv) verdes; única pieza diferida: ghost rendering inline para inserciones (panel ya las cubre) y el índice de búsqueda global para drafts (`idx-<family>-draft`), ambos en `docs/deferred.md`.
      - **13d-i. Drafts branch I/O + diff-mark model + errores.** Mirror estructural de 13c-ii. Modelo en `core/versioning/drafts.types.ts`: `DiffMark` (`id` UUID, `anchorType: 'block' | 'doc'`, `anchor` — `blockId` o el `entityId` para alcance doc, `before`/`after` como `JSONContent`, `status: 'pending'` por ahora — `accepted`/`rejected` no se persisten, son operaciones que mutan la lista en 13d-iii, `createdAt`/`updatedAt`); `DraftsFile` con `schemaVersion: 1`, `entityId`, `marks: readonly DiffMark[]`. `DraftsService` (core/versioning/) inyecta `WorkspaceService` + `VariantsService` + `FsLockService` siguiendo el patrón de `CommentsService`: `read(entityId)` devuelve `DraftsFile` (o `emptyDraftsFile` si no hay nada escrito), `save(entityId, entityTitle, marks)` corre bajo el mismo mutex que el autocommit y commitea con prefijo `auto [borrador]: <título> (N cambios)`. Reusa `branch-blob-ops` con `seedFrom: active.refs.main` (la lazy seed agregada al cerrar 13c — fix `162d70b`). `validateAnchor(mark, blockIdsInDoc)` es puro: lanza `MCB-VER-024` si `anchorType === 'block'` y el bloque ya no existe. `DraftsFile` lleva `schemaVersion: 1`; si el persistido trae versión mayor o JSON inválido, dispara `MCB-VER-023` (nunca se silencia). Errores nuevos: `MCB-VER-022` (read/write del plumbing falló o falta workspace/variante), `MCB-VER-023` (archivo ilegible o schema futuro), `MCB-VER-024` (anchor inválido). Tests: `drafts.service.spec` (round-trip, prefijo de commit, schema futuro dispara VER-023, validateAnchor con tres ramas). Gate: el commit de drafts aterriza en su rama sin checkout, `main` queda intacto, los tres códigos están registrados en `error.codes.ts` + `docs/errors.md` + i18n.
      - **13d-ii. Draft mode toggle + capture as marks (no apply a main).** Toggle per-entidad "modo borrador" en la toolbar del editor (`aria-pressed`, persiste en signal de `EditorComponent`, no en disco — el estado vive por sesión). Con el toggle activo, las ediciones del usuario se interceptan: el editor entra en modo read-only sobre el doc de `main` y abre un buffer separado donde captura el delta. Al confirmar (botón "guardar borrador" o blur con cambios), se genera una `DiffMark` con `anchorType: 'block'` para cada bloque cuyo contenido cambió (`anchor: blockId`, `before: <bloque original>`, `after: <bloque editado>`) y se persiste vía `DraftsService.save`. **El doc de `main` NO se muta**: el archivo de la entidad en el working tree queda exactamente igual. Sin toggle activo, comportamiento clásico (edita main). Errores reutilizan VER_022..024 — no se agregan códigos. Gate: (1) activar toggle, escribir, guardar — `main` del archivo intacto, `drafts/<entityId>.json` contiene la mark; (2) recargar entidad → marks vienen de la rama draft; (3) desactivar toggle, escribir → mutación normal a main. No hay UI de accept/reject todavía.
      - **13d-iii. Drafts side panel + decoraciones inline + accept/reject.** Mirror estructural de 13c-iii. `DraftsPanelContainer` (smart, en `shared/editor/`) lista las marks de la entidad activa, dropea stale results al navegar mid-load, persiste accept/reject vía `DraftsService.save`. **Accept**: aplica el `after` al doc usando `applyMarkToDoc` (replace/append/drop top-level por blockId) + emite el nuevo doc vía `valueChange` (host lo persiste como cambio normal) + agenda commit `accept-draft: <título> (N cambios)` con `AutocommitService.commitNow('accept-draft', customMessage)` — el flush de autosave previo al commit garantiza que la escritura del host aterriza en disco antes de capturar; luego remueve la mark del archivo de drafts. **Reject**: remueve la mark sin tocar main. Decoraciones ProseMirror inline (extensión `mcDraftDecorations` con `PluginKey` + meta channel `mc-draft-decorations.set` que el editor dispara cada vez que el panel emite `marksChange`): node decorations para mutación (tinte ámbar) y eliminación (strikethrough rojo). **Inserciones quedan render-only en el panel** — sin anchor visible en el doc, mostrar un widget fantasma con el contenido propuesto requería un mini-renderer JSON→DOM consistente con el theme; pateado a `docs/deferred.md` como "Ghost rendering inline para inserciones del borrador". Sub-componentes: `DraftMarkItemComponent` (chip categoría + tiempo + preview before/after + accept/reject), header del panel con "aceptar todos" / "rechazar todos" con confirm. Pure helpers en `core/versioning/draft-apply.ts`: `applyMarkToDoc` + `markCategory` (`insert | delete | mutate`). El authoring de draft mode (toggle + buffer + save de 13d-ii) extraído a `shared/editor/editor-draft-mode.controller.ts` para mantener `EditorComponent` bajo el cap de 300 líneas con todo el cableado nuevo. i18n bajo `drafts.*` (22 strings). A11y: `aria-pressed` en toggle, `aria-live="polite"` en lista, focus visible. Tests: `draft-apply.spec` (9 tests — categoría + apply para mutate/delete/insert + no-ops + doc-anchored ignored). Gate: aceptar mark → commit en main + decoración desaparece; rechazar → mark desaparece sin commit; panel abre/cierra con `aria-pressed`. _Cerrado 2026-06-12._ Commit `111e8f6`.
      - **13d-iv. Drafts merge bundle + history chip validation.** Cierra 13d. **Merge bundle ext**: `MergeService.commitOneSelection` invoca `mergeDraftsFaceta` después del commit en main + el de comentarios, mismo patrón aditivo que `mergeCommentsFaceta` (13c-iv): si la entidad mergeada tiene id y `drafts/<id>.json` existe en `from.refs.draft` (y difiere de `into`), escribe un commit en `into.refs.draft` con `buildMergeCommit` + trailer `Merge-Group: <uuid>` + `Merge-Facet: draft` + subject `merge [borrador]: <id> (from "X" into "Y")`. Skip silencioso si `from` no tiene drafts pero `into` sí (nunca borra). **History chip**: `facetOf` extendido para reconocer también `merge [borrador]:` (antes sólo `auto [borrador]:` y `accept-draft:` desde 13c-iv). La chip `draft` ahora filtra los tres prefijos. **Diferido a §19.16d**: índice de búsqueda global para drafts (`idx-<family>-draft`) — mismo razonamiento que el índice de comentarios (priming al boot/family-switch conviene hacerlo junto con los demás índices), registrado en `docs/deferred.md`. Tests: `merge-drafts.spec` (contrato entre el formato de mensaje y el clasificador de chips — drift en cualquier lado falla ambos tests al unísono) + `facet.spec` con caso nuevo para `merge [borrador]:`. Gate: (1) merge entre dos variantes con drafts en `from` → `into.refs.draft` tiene el commit con el trailer correcto (validación manual); (2) la chip `draft` filtra commits de borrador en `/history` con activity real (validación manual); (3) índice diferido registrado en `deferred.md`. _Cerrado 2026-06-12._
    - **13e.** Push a GitHub. Primera fase en abrir red — regla §4.14 sigue valiendo, sólo `git push/fetch` disparados por configuración explícita del usuario. **Auth:** PAT pegado por el usuario, persistido en plano dentro de `.mi-cerebro/secrets.json` (agregado al `.gitignore` por default). Crypto-at-rest con passphrase del usuario queda diferido a §19.16f (registrar en `deferred.md` al cerrar 13e-i). **Modelo del remoto:** todas las variantes × 3 ramas (`main` + `comments` + `draft`). Replica fielmente el estado local; backup remoto end-to-end (cross-device se levanta con todo: entidades + comentarios + borradores). **Conflictos pull:** rechaza non-fast-forward por ref. El divergente se descarga como `refs/remotes/origin/*` sin tocar local; banner global pide ir a `/variants/merge` (extendido para listar los remotos como source candidates) a resolver entidad por entidad. Cero merge automático — la confiabilidad es prioridad sobre velocidad. **Throttle:** auto-push opt-in tras autocommit con throttle de N minutos (default 5, configurable en `/settings`). Cablea los placeholders `versioning.pushAfterAutocommit` y `versioning.pushThrottleMinutes` de 11bis. Errores `MCB-NET-001..008`. **Partido en cuatro sub-pasos**, mismo patrón que 13b/13c/13d.
      - **13e-i. Remote config + PAT storage + smoke push.** Sección "Versionado remoto" en `/settings` con input para URL del repo (`https://github.com/<owner>/<repo>.git`) + textarea para PAT. `RemoteService` (core/versioning/): `configure({url, token})` valida formato y persiste en `.mi-cerebro/secrets.json` (escrito atómicamente, agrega path al `.gitignore` la primera vez); `push({refs})` con `isomorphic-git/http/web` usando `Authorization: token <pat>` header. CORS proxy: arrancamos con `https://cors.isomorphic-git.org` (público, ya usado por la lib) con warning explícito en la UI — proxy propio queda diferido a §19.16f. Botón "Push" en `/settings/remote` que pushea sólo `main` de la variante activa. Errores: `MCB-NET-001` (no hay config o PAT/URL inválidos), `MCB-NET-002` (auth falló — 401/403), `MCB-NET-003` (push falló por red u otro error genérico). Tests: `remote.service.spec` (validación de URL, lectura/escritura de secrets.json, `.gitignore` actualizado, mock de `http.request` para no salir a red). Gate: configurar repo + PAT, push manual de main, rama aparece en github.com con el commit head, secrets.json existe pero no está en el árbol de git. _Cerrado 2026-06-13._ `remote.types.ts` + `remote.config.io.ts` (validación URL, IO atómica vía `ConfigFs` interface, `ensureGitignoredSecrets` idempotente) + `remote.service.ts` (singleton con state signal, `configure/clear/pushActiveMain`, mapeo de `result.error`/`result.refs[ref].error` a NET_002/003 con detección up-to-date) + UI en `/settings.container` con formulario URL/PAT + botones Save/Push/Clear. 17/17 tests del IO. Smoke test contra repo real queda como validación manual del usuario.
      - **13e-ii. Push y pull de N×3 ramas (todas las variantes completas).** `RemoteService.pushAll()` itera `variants × {main, comments, draft}` y reporta por-ref outcome (`ok` | `up-to-date` | `error`). `RemoteService.fetchAll()` simétrico: trae cada ref remoto a `refs/remotes/origin/<branch>` con `git.fetch`. Ambas operaciones corren bajo `FsLockService` para no cruzarse con autocommit. Loading screen contextual durante la operación (puede tardar ~10-30s con varias variantes). Pantalla nueva `/sync` con tabla de refs (path local, status, last sync at) y botones "Push todo" / "Fetch todo". Errores: `MCB-NET-004` (push parcial — N de M refs fallaron, lista por-ref), `MCB-NET-005` (fetch parcial). Tests: `remote-bulk.spec` (orquestación + status reporting con http mockeado). Gate: crear 2 variantes con commits únicos en cada una × 3 facetas → push todo → borrar workspace local → fetch + verificar que todas las refs locales reflejan las remotas. _Cerrado 2026-06-13._ `remote-bulk.ts` (orquestación pura `runBulk` + `listRefTargets` + `gitPushOne`/`gitFetchOne`; clasificador `up-to-date`/`absent`/`error`) + `RemoteService.pushAll/fetchAll` con signals `lastPush/FetchOutcomes` + `lastBulkAt`. `/sync` (`features/sync/`) con tabla por-ref, botones Push/Fetch todo, link desde `/settings`. `MCB-NET-004/005` registrados y mapeados desde `finalizeBulk`. 13/13 nuevos tests (`remote-bulk.spec`: listRefTargets, runBulk serial, summarize). Smoke test contra GitHub real diferido al cierre de 13e completo.
      - **13e-iii. Detección de divergencia + handoff a `/variants/merge`.** En cada `fetch` por ref, comparar `localTip` vs `refs/remotes/origin/<branch>`: si `localTip` no es ancestro del remoto Y el remoto no es ancestro del local → divergencia. `RemoteService.divergentRefs` (signal) lista las refs en ese estado. Banner global no-cerrable en el shell: "Hay cambios remotos divergentes en N rama(s). Abrir merge para resolver." → click navega a `/variants/merge?incoming=remote`. La pantalla de merge extendida reconoce los remotos como source candidates (combo "Desde: [variante local] | remote/`<branch>`"). Resolver el merge produce commits en la variante destino que luego push normal. Mientras haya divergencia pendiente, el botón "Push todo" del `/sync` queda deshabilitado con tooltip explicativo. Errores: `MCB-NET-006` (divergencia detectada en fetch), `MCB-NET-007` (push post-merge rechazado por race con otro device). Tests: `divergence-detect.spec` (helper puro `classifyTip(local, remote)` con casos fast-forward / behind / divergent / unrelated). Gate: en 2 pestañas con remotos espejo, editar la misma entidad en ambas, push desde A, push desde B (B detecta divergencia post-fetch), abrir `/variants/merge` desde el banner, resolver, push final exitoso. _Cerrado 2026-06-13._ `remote-divergence.ts` con `classifyTip` puro + `detectDivergences` async (resolveRef + isDescendent en paralelo, ignora absent/error). `RemoteService` agrega `divergentRefs` + `hasDivergence` computed; `fetchAll` los actualiza y lanza `MCB-NET-006` post-éxito; `pushAll` rechaza con NET-006 si la signal está poblada. Banner global `RemoteDivergenceBannerComponent` (sticky, no cerrable) en el shell, navega con `?incoming=remote&ref=<first>&into=<variantId>`. `merge.container` lee la query y switch a `remoteRefName` mode; `MergeService.diffAgainstRemoteMain` + `applyFromRemoteMainSelections` delegan a `merge-remote.ts` (sin facetas, sólo main). El botón Push todo del `/sync` se deshabilita con tooltip mientras `hasDivergence`. `NET_007` queda registrado pero su mapeo concreto al outcome de un push se cubrirá si aparece naturalmente en el smoke test (post-merge → push → rechazo); por ahora cae a NET-003. 7/7 tests de `classifyTip` (`remote-divergence.spec`). Tests adicionales del extremo async (mock isomorphic-git) quedan al gate manual.
      - **13e-iv. Auto-push throttled + status panel + cierre 13e.** Cablea los placeholders `versioning.pushAfterAutocommit` (boolean, default `false`) y `versioning.pushThrottleMinutes` (number, default 5) de 11bis al `RemoteService`. `AutocommitService` (o un `AutoPushService` separado que escuche `autocommit.lastCommitAt`) dispara push si: (1) toggle ON, (2) `now - lastPushAt >= throttle`, (3) no hay divergencia pendiente, (4) no hay push en vuelo. Indicador en sidebar/footer: dot verde "sincronizado", amarillo "pending push", rojo "divergente". Pantalla `/sync` muestra el toggle + throttle slider + estado actual + última operación. Errores: `MCB-NET-008` (auto-push skipped — push ya en vuelo). Tests: `auto-push-scheduler.spec` (throttle no respeta dos triggers consecutivos dentro de la ventana, sí respeta uno tras la ventana; skip cuando divergent o in-flight). Gate: habilitar auto-push con throttle 1min para test, editar 3 veces en 2min → exactamente 1 push entre minuto 0-1 y otro entre minuto 1-2 (no 3 pushes); editar 1 vez con divergencia activa → 0 pushes hasta resolver.

14. **Export ZIP.**
15. **Temas custom + validación WCAG.** Incluye color picker custom para tags (hoy el color sale determinístico de un hash).
16. **Pulido** — partido en sub-fases temáticas para mantener scope acotado:
    - **16a.** Continuidad de sesión + atajos: última ruta + entidad abierta + scroll al reabrir, historial de búsquedas en la paleta, set completo de atajos de teclado.
    - **16b.** Pulido visual del árbol: scroll automático al match activo, lista de coincidencias desplegada navegable con teclado, drag & drop para reordenar nodos.
    - **16c.** Gestión avanzada de tags: pantalla dedicada para listar/renombrar/mergear/eliminar tags con conteo de uso por entidad.
    - **16d.** Pulido de búsqueda: botón "reindexar" manual, snippet centrado en la coincidencia con highlight (en lugar de los primeros 160 chars del body).
    - **16e.** Pulido del editor: highlighting personalizable, banners de objetivos en cambio de ruta.
17. **Modo pantalla completa de edición.** Atajo F11 (con fallback en menú) que entra a un modo focus: oculta sidebar, rail, header de la app y cualquier panel auxiliar (filtros, búsqueda, banners no críticos), dejando sólo el editor de la entidad activa.
18. **Empaquetado nativo (Tauri + Capacitor).** Envolver la SPA Angular en binarios de escritorio (Tauri) y mobile (Capacitor) sin cambiar el core de la app: el código sigue siendo el mismo Angular, con un shim para que `FsService` use APIs nativas cuando el host las exponga (Tauri `fs`, Capacitor `Filesystem`) y caiga al File System Access API cuando corre en navegador. Habilita rutas que el sandbox del navegador no permite — spawn de procesos, acceso a binarios embebidos, notificaciones del SO con la app cerrada (§14), integración con el reproductor de medios del sistema (MPRIS/SMTC/MediaSession nativa). Pre-requisito de cualquier feature que necesite ejecutar código fuera del sandbox.
19. **Descarga de MP3 desde YouTube.** Sección dedicada en `/music` (o expandir biblioteca con un input de URL) donde el usuario pega un link de video y el archivo entra directo a la biblioteca, auto-organizado (título del video → `originalName`, sin pasar por el picker de archivos). Depende del paso 18: necesita `yt-dlp` embebido como sidecar de Tauri y/o un plugin Capacitor equivalente, llamado vía bridge desde un nuevo `YoutubeDownloadService` que devuelve un `Blob` y lo pasa a `MusicLibraryService.addTracks`. Cuando corre en navegador sin host nativo, la UI queda deshabilitada con tooltip explicando el requisito.
