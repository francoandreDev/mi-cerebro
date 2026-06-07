# Catálogo de errores

Cada error que la app puede mostrar lleva un código `MCB-<área>-<###>` (ver `PROYECTO.md` §6). Esta es la referencia completa: qué significa, por qué pasa, cómo salir. **Toda entrada nueva acá también va en `src/app/core/errors/error.codes.ts` y en `src/app/core/i18n/locales/es.ts`, en el mismo commit (regla 26).**

## Plantilla

```markdown
### MCB-<área>-<###> — Título corto

**Severidad:** info | warning | error | fatal
**Cuándo:** descripción de la condición que dispara el error.
**Causa típica:** la razón más común por la que pasa.
**Cómo resolver:**

1. Paso 1.
2. Paso 2.
   **Recuperable:** sí/no — si sí, qué quedó preservado.
```

---

## SYS — Navegador / sistema

### MCB-SYS-001 — Navegador sin soporte para File System Access API

**Severidad:** fatal
**Cuándo:** al arranque, si `window.showDirectoryPicker` no existe.
**Causa típica:** el usuario abrió la app en Firefox o Safari.
**Cómo resolver:**

1. Abrir mi-cerebro en Chrome, Edge, Vivaldi o Brave.
   **Recuperable:** no — la app no puede operar sin esta API.

### MCB-SYS-002 — Espacio en disco insuficiente

**Severidad:** error
**Cuándo:** una escritura a disco falla con `QuotaExceededError` o `NotEnoughSpace`.
**Causa típica:** disco lleno, o cuota del navegador para el origen agotada.
**Cómo resolver:**

1. Vaciar la papelera de mi-cerebro (`.mi-cerebro/trash/`).
2. Exportar y eliminar archivos viejos.
3. Liberar espacio del disco.
   **Recuperable:** sí — el borrador queda en IndexedDB hasta que haya espacio.

---

## FS — File System Access

### MCB-FS-001 — Permiso denegado al guardar

**Severidad:** error
**Cuándo:** una escritura devuelve `NotAllowedError`.
**Causa típica:** el navegador revocó el permiso después de un refresh, o el archivo está bloqueado por antivirus/otro programa.
**Cómo resolver:**

1. Volver a otorgar permiso desde el banner que aparece arriba.
2. Verificar que ningún programa externo tenga el archivo abierto.
3. Si persiste, hacer export ZIP por las dudas y reportar.
   **Recuperable:** sí — el borrador queda en IndexedDB hasta restablecer el permiso.

### MCB-FS-003 — Carpeta raíz movida o eliminada

**Severidad:** error
**Cuándo:** al reabrir, el handle persistido apunta a una carpeta que ya no existe.
**Causa típica:** el usuario movió o renombró la carpeta del workspace por fuera de la app.
**Cómo resolver:**

1. Elegir de nuevo la carpeta raíz en la pantalla que aparece.
2. Si la carpeta fue movida, navegarla a su nueva ubicación.
   **Recuperable:** sí — los borradores en IndexedDB se ofrecen al reabrir.

### MCB-FS-004 — Permisos revocados

**Severidad:** warning
**Cuándo:** la app sigue corriendo pero `queryPermission` devuelve `prompt` o `denied`.
**Causa típica:** sesión vieja del navegador, refresh sin persistencia, o el usuario los quitó manualmente.
**Cómo resolver:**

1. Aceptar el prompt del banner persistente para re-autorizar.
   **Recuperable:** sí — no se intenta tocar el disco hasta confirmar acceso.

---

## AUT — Autosave / concurrencia

### MCB-AUT-005 — Intento de escritura sobre lock ajeno

**Severidad:** error
**Cuándo:** otra pestaña tiene la entidad lockeada y esta intentó forzar escritura.
**Causa típica:** se abrió la misma nota en dos pestañas y la segunda intentó guardar.
**Cómo resolver:**

1. Elegir "abrir solo lectura" en el banner.
2. Elegir "tomar control" para reclamar la entidad (la otra pestaña cae a `MCB-AUT-006`).
   **Recuperable:** sí — los borradores siguen en IndexedDB.

### MCB-AUT-006 — Control tomado desde otra ventana

**Severidad:** warning
**Cuándo:** otra pestaña tomó control de la entidad que estabas editando.
**Causa típica:** abriste la misma entidad en otra ventana y elegiste "tomar control".
**Cómo resolver:**

1. La vista actual cae a modo lectura.
2. Cerrar esta pestaña o seguir leyendo.
   **Recuperable:** sí — el último estado guardado quedó en disco/IndexedDB.
