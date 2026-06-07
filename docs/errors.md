# Catálogo de errores

Cada error que la app puede mostrar lleva un código `MCB-<área>-<###>` (ver `PROYECTO.md` §6). Esta es la referencia completa: qué significa, por qué pasa, cómo salir. **Toda entrada nueva acá también va en `src/app/core/errors/error.codes.ts` y en `src/app/core/i18n/locales/es.ts`, en el mismo commit (regla 26).**

## Plantilla

```markdown
### MCB-<área>-<###> — Título corto

- **Severidad:** info | warning | error | fatal
- **Cuándo:** descripción de la condición que dispara el error.
- **Causa típica:** la razón más común por la que pasa.
- **Cómo resolver:** pasos.
- **Recuperable:** sí/no — si sí, qué quedó preservado.
```

---

## SYS — Navegador / sistema

### MCB-SYS-001 — Navegador sin soporte para File System Access API

- **Severidad:** fatal
- **Cuándo:** al arranque, si `window.showDirectoryPicker` no existe.
- **Causa típica:** el usuario abrió la app en Firefox o Safari.
- **Cómo resolver:** abrir mi-cerebro en Chrome, Edge, Vivaldi o Brave.
- **Recuperable:** no — la app no puede operar sin esta API.

### MCB-SYS-002 — Espacio en disco insuficiente

- **Severidad:** error
- **Cuándo:** una escritura a disco falla con `QuotaExceededError` o `NotEnoughSpace`.
- **Causa típica:** disco lleno, o cuota del navegador para el origen agotada.
- **Cómo resolver:** vaciar la papelera (`.mi-cerebro/trash/`), exportar y eliminar archivos viejos, liberar espacio del disco.
- **Recuperable:** sí — el borrador queda en IndexedDB hasta que haya espacio.

---

## FS — File System Access

### MCB-FS-001 — Permiso denegado al guardar

- **Severidad:** error
- **Cuándo:** una escritura devuelve `NotAllowedError`.
- **Causa típica:** el navegador revocó el permiso después de un refresh, o el archivo está bloqueado por antivirus/otro programa.
- **Cómo resolver:** otorgar permiso desde el banner que aparece, verificar que ningún programa externo tenga el archivo abierto. Si persiste, hacer export ZIP por las dudas y reportar.
- **Recuperable:** sí — el borrador queda en IndexedDB hasta restablecer el permiso.

### MCB-FS-002 — No se pudo inicializar la carpeta

- **Severidad:** error
- **Cuándo:** al elegir una carpeta raíz, la creación de las subcarpetas iniciales (`.mi-cerebro/`, `notes/`, etc.) falla.
- **Causa típica:** la carpeta es de sólo lectura, vive en un volumen montado sin permisos de escritura, o el SO rechazó la operación.
- **Cómo resolver:** elegir otra carpeta en una ubicación con permisos de escritura (típicamente dentro de `Documentos`).
- **Recuperable:** sí — no se persiste ningún handle hasta que la inicialización termine bien.

### MCB-FS-003 — Carpeta raíz movida o eliminada

- **Severidad:** error
- **Cuándo:** al reabrir, el handle persistido apunta a una carpeta que ya no existe.
- **Causa típica:** el usuario movió o renombró la carpeta del workspace por fuera de la app.
- **Cómo resolver:** elegir de nuevo la carpeta raíz en la pantalla que aparece; si fue movida, navegar a su nueva ubicación.
- **Recuperable:** sí — los borradores en IndexedDB se ofrecen al reabrir.

### MCB-FS-004 — Permisos revocados

- **Severidad:** warning
- **Cuándo:** la app sigue corriendo pero `queryPermission` devuelve `prompt` o `denied`.
- **Causa típica:** sesión vieja del navegador, refresh sin persistencia, o el usuario los quitó manualmente.
- **Cómo resolver:** aceptar el prompt del banner persistente para re-autorizar.
- **Recuperable:** sí — no se intenta tocar el disco hasta confirmar acceso.

---

## AUT — Autosave / concurrencia

### MCB-AUT-001 — Falla al escribir borrador

- **Severidad:** warning
- **Cuándo:** `AutosaveService.flush` no pudo persistir un borrador en IndexedDB.
- **Causa típica:** cuota de IDB agotada, modo incógnito con bloqueo estricto, transacción cancelada.
- **Cómo resolver:** liberar espacio, evitar incógnito, o reintentar el guardado manual. El payload sigue en memoria mientras la pestaña esté abierta.
- **Recuperable:** sí — el cambio no se perdió en memoria, sólo no quedó persistido.

### MCB-AUT-002 — Falla al recuperar borrador

- **Severidad:** warning
- **Cuándo:** `AutosaveService.recover` falla leyendo un borrador previo.
- **Causa típica:** IDB corrupto o transacción abortada.
- **Cómo resolver:** descartar el borrador (sobrescribir editando) o limpiar la entrada manualmente desde DevTools.
- **Recuperable:** sí — el archivo en FS sigue siendo la fuente de verdad.

### MCB-AUT-005 — Intento de escritura sobre lock ajeno

- **Severidad:** error
- **Cuándo:** otra pestaña tiene la entidad lockeada y esta intentó forzar escritura.
- **Causa típica:** se abrió la misma nota en dos pestañas y la segunda intentó guardar.
- **Cómo resolver:** elegir "abrir solo lectura" en el banner, o "tomar control" para reclamar la entidad (la otra pestaña cae a `MCB-AUT-006`).
- **Recuperable:** sí — los borradores siguen en IndexedDB.

### MCB-AUT-006 — Control tomado desde otra ventana

- **Severidad:** warning
- **Cuándo:** otra pestaña tomó control de la entidad que estabas editando.
- **Causa típica:** abriste la misma entidad en otra ventana y elegiste "tomar control".
- **Cómo resolver:** la vista actual cae a modo lectura; cerrar esta pestaña o seguir leyendo.
- **Recuperable:** sí — el último estado guardado quedó en disco/IndexedDB.

---

## IDB — IndexedDB

### MCB-IDB-001 — No se pudo abrir el almacén local

- **Severidad:** error
- **Cuándo:** la apertura de la base IndexedDB `mc-app` falla o queda bloqueada.
- **Causa típica:** modo incógnito con bloqueo estricto, otra pestaña con una versión de schema más vieja abierta, cuota agotada.
- **Cómo resolver:** cerrar otras pestañas de mi-cerebro, evitar incógnito, liberar espacio. Si persiste, exportar (cuando esté implementado) y borrar el sitio.
- **Recuperable:** no de inmediato — la app no puede persistir borradores hasta resolver.

### MCB-IDB-002 — Falla en operación de IndexedDB

- **Severidad:** error
- **Cuándo:** un `get`/`set`/`delete`/`clear` falla en mitad de la transacción.
- **Causa típica:** transacción abortada por timeout, cuota excedida durante la escritura, race condition.
- **Cómo resolver:** reintentar la acción. Si se repite, reportar con el `context` que viene en el error (`store`, `mode`).
- **Recuperable:** sí — el dato origen no se pierde; sólo no quedó persistido.

---

## MIG — Migraciones

### MCB-MIG-001 — Falla durante una migración

- **Severidad:** fatal
- **Cuándo:** una función de migración registrada lanzó, o la registración misma es incoherente (steps no contiguos), o el backup pre-migración falló.
- **Causa típica:** bug en la migración, archivo corrupto, fallo de FS al hacer el snapshot previo.
- **Cómo resolver:** la app dejó un backup completo en `.mi-cerebro/pre-migration/<fecha>/` antes de tocar nada. Restaurar desde ahí y reportar el bug con el `context` del error.
- **Recuperable:** sí — el backup garantiza no perder data.

### MCB-MIG-002 — Versión de schema desconocida

- **Severidad:** fatal
- **Cuándo:** un archivo viene con `schemaVersion` mayor al `latest` que esta app conoce.
- **Causa típica:** la carpeta se usó desde una versión más nueva de mi-cerebro.
- **Cómo resolver:** actualizar mi-cerebro a la última versión, o abrir el archivo desde la versión que lo creó.
- **Recuperable:** sí — el archivo no se modifica; sólo no se lo abre.
