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
- **`shared/`** por tipo: `components/`, `directives/`, `pipes/`, `utils/`.
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
7. **Tags transversales** + búsqueda global indexada.
8. **Concurrencia entre pestañas** (BroadcastChannel + locks).
9. **Resto de entidades**: tasks, goals, lists, writings, images, files.
10. **Calendar.**
11. **Reminders.**
12. **Music player.**
13. **Versionado** (isomorphic-git).
14. **Export ZIP.**
15. **Temas custom + validación WCAG.**
16. **Pulido**: continuidad de sesión, highlighting personalizable del editor, banners de objetivos en cambio de ruta, atajos completos.
