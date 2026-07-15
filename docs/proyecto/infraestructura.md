# Linter, errores, documentación, arranque y PWA (§5, §6, §7, §9, §18)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

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

- **`README.md` raíz:** cómo levantar el proyecto, comandos clave, link a `docs/proyecto/index.md`. Corto.
- **`docs/proyecto/`:** verdad sobre visión, decisiones, reglas. Single source of truth. Se actualiza cuando una decisión cambia.
- **`docs/decisions/`:** ADRs cortos para decisiones técnicas no obvias. Formato: Contexto / Opciones / Decisión / Consecuencias.
- **`docs/errors.md`:** catálogo completo de códigos de error (ver §6).
- **`docs/glossary.md`:** vocabulario del dominio. Un párrafo por término.
- **`docs/architecture.md`:** una página + diagrama (ASCII o mermaid) de cómo se conectan core/features/shared y el flujo de datos típico.
- **`docs/migrations.md`:** registro de migraciones de schema (`vN -> vN+1`), qué cambió y por qué.
- **`docs/deferred/`:** ítems pospuestos de una fase, repartidos en un archivo por tema (`docs/deferred/index.md` es el mapa, no contiene ítems). Ver §4 regla 25b.
- **`docs/evolution.md`:** índice de ideas de producto candidatas a futuro (dolores de usuario detectados, no comprometidos a roadmap). Distinto de `docs/deferred/`: acá van direcciones sin diseñar todavía; `docs/deferred/` es el recorte de algo ya en curso.
- **Comentarios `// why:`** solo donde el porqué no es obvio (workarounds, invariantes ocultos, restricciones externas).
- **JSDoc solo en APIs públicas de servicios de `core/`:** 1-2 líneas de propósito + ejemplo si la firma no es trivial.

### Qué NO documentamos

- Comentarios que repiten el nombre de la función.
- Tutoriales de cosas que están en docs oficiales — link, no copia.
- READMEs por carpeta que dicen "acá viven los componentes de notas".
- CHANGELOG manual.
- Diagramas en herramientas externas que se desactualizan — mermaid en repo o nada.

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

## 18. PWA

- Manifest + service worker desde el día uno.
- Instalable como app de escritorio (ventana propia, sin barra del navegador).
- Ícono: lo más simple posible, placeholder; se puede mejorar después.
- Funciona offline (los datos están en disco, el código en el SW cache).

---
