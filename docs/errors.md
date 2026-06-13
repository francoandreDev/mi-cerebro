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

---

## ENT — Entidades

### MCB-ENT-001 — Archivo dañado o ilegible

- **Severidad:** error
- **Cuándo:** el JSON de una entidad no parsea, o le faltan campos requeridos.
- **Causa típica:** un editor externo cortó el archivo a mitad, encoding inconsistente, o corrupción en disco.
- **Cómo resolver:** revisar `.mi-cerebro/pre-migration/` o el repo git si está versionado; restaurar desde la última copia buena.
- **Recuperable:** sí — la app omite el archivo y deja el resto del workspace usable.

### MCB-ENT-002 — IDs duplicados

- **Severidad:** error
- **Cuándo:** dos archivos distintos comparten el mismo `id` UUID interno.
- **Causa típica:** duplicación manual de un archivo `.json` sin regenerar el ID.
- **Cómo resolver:** renombrar/eliminar uno de los dos. Si querés conservar ambos, abrí el JSON y reemplazá uno de los IDs por un UUID nuevo.
- **Recuperable:** sí — los links que apuntaban al ID original quedan intactos.

---

## VER — Versionado e historial

### MCB-VER-001 — No se pudo guardar la versión

- **Severidad:** error
- **Cuándo:** una operación del `VersioningService` (init, commit, log, readBlob) falla. Engloba: workspace no listo cuando se invoca el servicio, error de isomorphic-git sobre el adapter FS Access, o I/O subyacente del FS rechazado a mitad.
- **Causa típica:** el adapter perdió permisos en medio de un walk largo, un archivo del workspace cambió mientras se calculaba la statusMatrix, o el `.git/` quedó parcialmente escrito tras un crash.
- **Cómo resolver:** el autocommit siguiente reintenta. Si se repite, abrir `/history` para verificar el estado; los datos del usuario están en disco (no se pierden con un fallo de versionado).
- **Recuperable:** sí — los cambios de la entidad siguen guardados en disco; sólo se pospone su entrada al historial.

### MCB-VER-002 — Falló el autocommit

- **Severidad:** warning
- **Cuándo:** `AutocommitService` disparado por timer, navegación, `visibilitychange` o `beforeunload` falla al ejecutar el commit. Captura cualquier error de `VersioningService.commitAll` que no se haya convertido ya a `MCB-VER-001`.
- **Causa típica:** permisos revocados a mitad del commit, lock contendido demasiado tiempo, o un autosave que terminó de escribir un archivo y dejó el FS en un estado que isomorphic-git no esperaba.
- **Cómo resolver:** el próximo trigger reintenta automáticamente (timer cada 5 min, navegación, cierre de pestaña). Si los autocommits siguen fallando varias veces seguidas, abrir `/history` para verificar que el último commit conocido sigue válido y forzar un commit manual desde el footer del sidebar.
- **Recuperable:** sí — los archivos del usuario están en disco; sólo el historial queda sin ese punto.

### MCB-VER-003 — No se pudo restaurar

- **Severidad:** error
- **Cuándo:** el usuario disparó "Restaurar esta versión" (o restore por commit completo) y la operación falló entre leer el blob del commit, escribir/borrar el archivo en disco o crear el commit que captura el cambio.
- **Causa típica:** permisos a la carpeta revocados mid-operación, el archivo destino fue tocado externamente entre el `flushAll` y la escritura, o isomorphic-git no pudo leer el blob (oid corrupto o `.git/` parcialmente roto).
- **Cómo resolver:** la restauración es transaccional desde el lado del usuario: o terminó completa, o el disco quedó como estaba antes. Reintentar la acción. Si se repite, abrir el commit en `/history`, verificar que el blob existe (debería listarse en el diff) y, si persiste, restaurar manualmente la entidad copiando el contenido de la versión deseada.
- **Recuperable:** sí — sin efectos parciales; los datos previos siguen en disco y en el historial.

### MCB-VER-004 — No se pudo crear la variante

- **Severidad:** error
- **Cuándo:** `VariantsService.create` falla mid-flight al bifurcar las tres ramas (`main`, `draft`, `comments`) de la nueva familia. La creación es atómica: si la 2ª o 3ª rama falla, las que ya se habían creado se eliminan en reverso y `variants.json` no se modifica.
- **Causa típica:** un ref con el mismo nombre ya existe (colisión de slug con una variante borrada cuya entrada de `pendingDelete` aún no se reintentó), permisos del adapter perdidos a mitad, o un disco que rechazó la escritura del segundo branch.
- **Cómo resolver:** revisar `/variants` (cuando exista, 13b-iii) para ver si hay entradas `pendingDelete` que no se completaron; en dev panel reintentar. Si el problema persiste, exportar ZIP y reportar.
- **Recuperable:** sí — el rollback dejó el repo como estaba antes del intento. No hay branches huérfanos ni entradas inconsistentes.

### MCB-VER-005 — No se pudo eliminar la variante

- **Severidad:** error
- **Cuándo:** `VariantsService.delete` falla al borrar una de las 3 ramas. La entrada quedó marcada `pendingDelete: true` en `variants.json` antes de tocar refs, así que el siguiente arranque (o `list()`) reintenta el borrado.
- **Causa típica:** la rama está checked-out (no se puede borrar la activa), o permisos a `.git/refs/heads/` revocados mid-operación.
- **Cómo resolver:** cambiar a otra variante antes de borrar; reintentar. La entrada `pendingDelete` se purgará automáticamente cuando todas las ramas estén ausentes.
- **Recuperable:** sí — los datos del usuario y los commits siguen ahí; sólo el ref puede quedar parcialmente borrado, y `list()` reconcilia.

### MCB-VER-006 — Archivo de variantes ilegible

- **Severidad:** error
- **Cuándo:** al cargar `.mi-cerebro/variants.json`, el archivo está ausente y no se pudo sembrar, JSON inválido, o `schemaVersion` no coincide con el actual.
- **Causa típica:** edición manual del archivo, archivo truncado por un crash mid-write, o downgrade de la app a una versión que no entiende el schema actual.
- **Cómo resolver:** la app sigue en la variante Principal implícita (no se pierden datos). Restaurar el archivo desde un backup en `.mi-cerebro/pre-migration/` (regla 31), o eliminar `variants.json` para que la app lo siembre con sólo Principal y reasocie variantes manualmente desde `/variants`.
- **Recuperable:** sí — la app degrada a Principal-only y los commits/branches del usuario siguen intactos en `.git/`.

### MCB-VER-007 — No se pudo preparar el cambio de variante

- **Severidad:** error
- **Cuándo:** durante el switch (paso 13b-ii), falló alguna de las dos operaciones previas al `checkout`: `AutosaveService.flushAll()` (vaciar borradores pendientes) o `VersioningService.commitAll('auto: pre-switch-variant <from> → <to>')` (capturar dirty). El servicio aborta antes de tocar `HEAD`, así que el workspace sigue en la variante origen.
- **Causa típica:** permisos del adapter revocados mid-flujo, `FsLockService` contendido por demasiado tiempo, o un autosave que devolvió un error fatal antes de drenar.
- **Cómo resolver:** reintentar el switch desde la pill del sidebar. Si persiste, abrir `/history` y verificar que el último commit conocido sigue válido; eventualmente forzar un commit manual desde el footer y volver a intentar.
- **Recuperable:** sí — la `activeId` no se modificó, el `HEAD` sigue en la rama anterior, los archivos del usuario están intactos.

### MCB-VER-008 — No se pudo cambiar de variante

- **Severidad:** error
- **Cuándo:** el `git.checkout({ ref: <main-de-destino> })` falló. Después del flush + commit, este es el punto donde el workspace efectivamente migra de rama; cualquier fallo acá aborta el switch y deja `HEAD` en la variante origen.
- **Causa típica:** un binario protegido por antivirus impide reescribir su archivo durante el checkout, hay un lock externo en algún `.json` (otro programa abierto), o el ref destino no existe (eliminado externamente desde el último `refresh`).
- **Cómo resolver:** cerrar cualquier programa que tenga archivos del workspace abiertos; reintentar. Si el ref destino fue eliminado externamente, ejecutar "Releer disco" desde el dev panel o recargar la app para que `VariantsService` reconcilie su vista.
- **Recuperable:** sí — `activeId` no se actualizó, los archivos visibles siguen siendo los de la variante anterior.

### MCB-VER-009 — Búsqueda deshabilitada tras el cambio

- **Severidad:** warning
- **Cuándo:** el checkout completó y `activeId` se actualizó, pero el rebuild del índice de búsqueda desde el nuevo estado del disco falló. La variante destino quedó montada y editable; sólo la búsqueda global queda fuera de servicio hasta el próximo refresh manual o reload.
- **Causa típica:** un IDB en estado transitorio, una entidad con JSON corrupto que rompió el walk, o un quota exceeded al persistir el índice nuevo.
- **Cómo resolver:** recargar la app (los workspaces re-indexan en el boot); o disparar "Reindexar" desde la pantalla de variantes (en 13b-iii). Mientras tanto el resto de la app funciona normal.
- **Recuperable:** sí — los archivos están bien, sólo la búsqueda global queda momentáneamente vacía.

### MCB-VER-010 — No se pudo aplicar el merge

- **Severidad:** error
- **Cuándo:** `MergeService.apply` falló durante la fase locked: `requireAdapter` no encontró workspace listo (`workspace-not-ready`), `findVariant` no encontró origen o destino (`variant-not-found`), o `buildMergeCommit`/`writeRef` falló a mitad del bucle por entidad.
- **Causa típica:** permisos del adapter revocados a mitad del merge, el ref del destino fue tocado externamente entre `resolveRef` y `writeRef`, o un blob del origen quedó ilegible por corrupción del `.git/objects`.
- **Cómo resolver:** la operación es per-commit y atómica por entidad: los commits previos quedan aplicados sobre el destino, el snapshot `pre-merge` queda como red de seguridad y la UI muestra "Reintentar la fallida" / "Saltar y continuar". Si lo querés revertir entero, abrir `/history`, ubicar el commit `auto: pre-merge` y "Restaurar todo este commit".
- **Recuperable:** sí — los commits aplicados son individualmente revertibles desde `/history`, agrupados visualmente por el trailer `Merge-Group`. Las entidades del origen no se tocan.

### MCB-VER-011 — Entidad cambió externamente

- **Severidad:** warning
- **Cuándo:** entre la generación de la preview en `/variants/merge` y la aplicación de un commit, una entidad del destino cambió de oid (otra pestaña commiteó, un autocommit corrió, o un editor externo tocó el archivo y el siguiente autocommit lo capturó). El plan calculado ya no representa el estado actual.
- **Causa típica:** otra pestaña abierta sobre el mismo workspace acaba de commitear; o el lock se liberó a mitad por un fallo y otro proceso ganó la carrera.
- **Cómo resolver:** refrescar la página de merge (`/variants/merge?from=...&into=...`) para recalcular el diff y reaplicar selecciones. Los commits ya aplicados quedan; sólo reintentás los pendientes sobre el nuevo estado.
- **Recuperable:** sí — el lock impide commits parciales sobre datos viejos; sólo se aborta la entidad afectada.

### MCB-VER-012 — Merge-Group inconsistente

- **Severidad:** error
- **Cuándo:** `/history` detectó dos commits con el mismo `Merge-Group: <uuid>` pero `Merge-From` / `Merge-Into` distintos. Es un invariante: una sesión de merge usa un único groupId y un único par (origen, destino).
- **Causa típica:** edición manual del repo, dos sesiones de merge concurrentes con un colisión astronómicamente improbable de UUID, o un bug en el formateo del trailer.
- **Cómo resolver:** no es esperable; reportar el caso con el oid de los commits afectados. La agrupación visual en `/history` cae a tratar cada commit como individual.
- **Recuperable:** sí — los commits están bien, sólo la agrupación visual queda degradada hasta resolver.

### MCB-VER-017 — No se pudo marcar este punto

- **Severidad:** warning | error
- **Cuándo:** el usuario disparó "Marcar este punto" y la operación falló al crear el git tag anotado. También cubre nombres inválidos (vacíos tras normalizar a slug ASCII).
- **Causa típica:** workspace sin abrir, permisos del adapter perdidos a mitad de la escritura del tag, o un nombre que tras `toSlug()` quedó vacío (sólo caracteres no ASCII no alfanuméricos).
- **Cómo resolver:** elegir un nombre que produzca al menos un caracter `[a-z0-9]` tras normalizar; reintentar; si persiste, verificar permisos del workspace.
- **Recuperable:** sí — el historial sigue intacto, el commit destino sigue ahí; sólo no se grabó la marca.

### MCB-VER-018 — No se pudo actualizar el milestone

- **Severidad:** error
- **Cuándo:** un renombre, "mover a este commit" o eliminación de milestone falló. Internamente son `git.deleteTag` + (en renombre/move) `git.annotatedTag`; cualquiera de los dos pasos puede fallar.
- **Causa típica:** permisos a `.git/refs/tags/` revocados mid-operación, el tag fue borrado externamente entre el read y el delete, o el oid destino del move no existe ya en el repo.
- **Cómo resolver:** reintentar. Si la operación quedó parcial (el delete pasó pero el create no), la lista de milestones lo reflejará — recrear manualmente con "Marcar este punto" sobre el commit deseado.
- **Recuperable:** sí — los datos del usuario y los commits no se tocan; sólo el ref del tag puede quedar en estado intermedio.

### MCB-VER-019 — No se pudo leer o guardar comentarios

- **Severidad:** error
- **Cuándo:** lectura o escritura de `comments/<entityId>.json` en la rama `variant/<family>/comments` falla en el plumbing de isomorphic-git (`readBlob` / `writeBlob` / `writeTree` / `writeCommit` / `writeRef`).
- **Causa típica:** permisos al directorio raíz revocados, `.git/` corrupto o el ref `variant/<family>/comments` apunta a un oid inexistente (cierre forzoso mid-fork de variante).
- **Cómo resolver:** reintentar; si persiste, verificar que la variante activa existe en `/variants` y que los permisos a la carpeta raíz no fueron revocados. La entidad subyacente (`main`) no se toca.
- **Recuperable:** sí — los comentarios viejos siguen en el último commit de la rama; sólo el escrito que falló se pierde y queda re-intentable.

### MCB-VER-020 — Archivo de comentarios ilegible

- **Severidad:** error
- **Cuándo:** se leyó `comments/<entityId>.json` pero el JSON no parsea, le falta `schemaVersion`, o la versión es mayor que la `latest` registrada para `commentsFile`.
- **Causa típica:** archivo corrupto por escritura interrumpida (mitigado por escritura atómica vía plumbing, pero posible si el repo se manipuló externamente) o downgrade de la app después de un upgrade que bumpeó el schema.
- **Cómo resolver:** restaurar la rama comments al commit anterior desde `/history` (toggle "ver todas las variantes" → buscar el último `auto [comentarios]: …` válido y restaurar). La entidad principal no se toca.
- **Recuperable:** sí — los comentarios previos al archivo corrupto siguen disponibles en el historial.

### MCB-VER-021 — El anchor del comentario ya no existe

- **Severidad:** warning
- **Cuándo:** al crear un comentario con `anchorType: 'block'` referenciando un `blockId` que no existe en el doc actual de la entidad, o al re-anclar un huérfano apuntando a un bloque que ya no está.
- **Causa típica:** el usuario eliminó el bloque al que apuntaba el comentario entre el momento en que abrió la entidad y el momento en que envió el comentario, o el anchor proviene de una versión vieja.
- **Cómo resolver:** apuntar a otro bloque o usar `anchorType: 'entity'` para anclar al documento completo.
- **Recuperable:** sí — el comentario nunca se persistió.

### MCB-VER-022 — No se pudo leer o guardar el borrador

- **Severidad:** error
- **Cuándo:** lectura o escritura de `drafts/<entityId>.json` en la rama `variant/<family>/draft` falla en el plumbing de isomorphic-git (`readBlob` / `writeBlob` / `writeTree` / `writeCommit` / `writeRef`).
- **Causa típica:** permisos al directorio raíz revocados, `.git/` corrupto o el ref `variant/<family>/draft` apunta a un oid inexistente (cierre forzoso mid-fork de variante).
- **Cómo resolver:** reintentar; si persiste, verificar que la variante activa existe en `/variants` y que los permisos a la carpeta raíz no fueron revocados. La entidad subyacente (`main`) no se toca.
- **Recuperable:** sí — las marcas viejas siguen en el último commit de la rama; sólo la escrita que falló se pierde y queda re-intentable.

### MCB-VER-023 — Archivo de borrador ilegible

- **Severidad:** error
- **Cuándo:** se leyó `drafts/<entityId>.json` pero el JSON no parsea, le falta `schemaVersion`, o la versión es mayor que la `latest` registrada para `draftsFile`.
- **Causa típica:** archivo corrupto por escritura interrumpida (mitigado por escritura atómica vía plumbing, pero posible si el repo se manipuló externamente) o downgrade de la app después de un upgrade que bumpeó el schema.
- **Cómo resolver:** restaurar la rama draft al commit anterior desde `/history` (toggle "ver todas las variantes" → buscar el último `auto [borrador]: …` válido y restaurar). La entidad principal no se toca.
- **Recuperable:** sí — las marcas previas al archivo corrupto siguen disponibles en el historial.

### MCB-VER-024 — El anchor del cambio ya no existe

- **Severidad:** warning
- **Cuándo:** al persistir una marca de borrador con `anchorType: 'block'` referenciando un `blockId` que no existe en el doc actual de la entidad.
- **Causa típica:** el bloque al que apuntaba la marca fue eliminado entre el momento de capturarla y el de guardarla, o el anchor proviene de una versión vieja.
- **Cómo resolver:** apuntar a otro bloque, descartar la marca, o usar `anchorType: 'doc'` si el cambio aplica a toda la entidad.
- **Recuperable:** sí — la marca nunca se persistió.

### MCB-NET-001 — Remoto no configurado o configuración inválida

- **Severidad:** error
- **Cuándo:** se intenta `pushActiveMain()` sin haber guardado config; la URL no matchea `https://github.com/<owner>/<repo>[.git]`; el PAT está vacío; o el workspace no está listo todavía.
- **Causa típica:** primer uso sin pasar por `/settings`, o copy-paste de URL con typo (http vs https, gitlab vs github).
- **Cómo resolver:** ir a `/settings` → "Versionado remoto" → pegar URL HTTPS de GitHub + PAT con scope `repo`.
- **Recuperable:** sí — operación local nunca tocó el árbol git.

### MCB-NET-002 — Autenticación rechazada por GitHub

- **Severidad:** error
- **Cuándo:** GitHub respondió 401/403 al push, o el cuerpo de error contiene "unauthorized"/"forbidden"/"authentication".
- **Causa típica:** PAT expirado, revocado, sin scope `repo`, o pegado con espacios/recortes; usuario sin permiso de write en el repo destino.
- **Cómo resolver:** generar un PAT nuevo en github.com/settings/tokens con scope `repo`, reemplazarlo en `/settings` → "Versionado remoto", reintentar Push.
- **Recuperable:** sí — el push fue rechazado en el servidor; el repo local no fue alterado.

### MCB-NET-003 — Push falló por error de red u otro

- **Severidad:** error
- **Cuándo:** la promesa de `git.push` rechazó con un error que no clasificó como auth; o `result.error` no nulo (y no es "up-to-date"); o `result.refs[ref].error` reporta un fallo per-ref distinto de up-to-date.
- **Causa típica:** corte de red, CORS proxy caído, repo destino no existe, push no-fast-forward (cuando se implemente N×3 esto va a `MCB-NET-006`).
- **Cómo resolver:** verificar conexión, refrescar la página y reintentar; si persiste, revisar que el repo destino exista y que la cuenta del PAT tenga acceso.
- **Recuperable:** sí — el árbol local no se alteró.

### MCB-NET-004 — Push parcial (algunas refs fallaron)

- **Severidad:** error
- **Cuándo:** al ejecutar `RemoteService.pushAll()`, una o más refs entre las variantes × `{main, comments, draft}` quedaron con `status: 'error'`. Las que sí subieron se contaron como éxito.
- **Causa típica:** push no-fast-forward en una sola variante (otra pestaña pusheó antes), un branch local con un commit corrupto, o intermitencia de red que cortó la mitad del lote.
- **Cómo resolver:** abrir `/sync`, ver la tabla por-ref con el detalle del error, y reintentar Push todo. Si el error es no-fast-forward, esperar a 13e-iii para que el flujo te lleve a `/variants/merge`.
- **Recuperable:** sí — el árbol local no se alteró; las refs que sí subieron quedaron arriba.

### MCB-NET-005 — Fetch parcial (algunas refs fallaron)

- **Severidad:** error
- **Cuándo:** al ejecutar `RemoteService.fetchAll()`, una o más refs no se pudieron traer. Las que sí, quedaron como `refs/remotes/origin/<branch>` locales.
- **Causa típica:** intermitencia de red, repo remoto sin alguna de las ramas todavía (se reporta como `absent`, no como error), o credenciales revocadas a mitad del fetch.
- **Cómo resolver:** mirar `/sync` para ver el detalle por-ref y reintentar Fetch todo.
- **Recuperable:** sí — las refs locales (`refs/heads/...`) no se tocan; sólo se intenta actualizar `refs/remotes/origin/*`.
