# Carpetas y papelera

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Sistema transversal a todas las entidades (notas, tareas, objetivos y, más tarde, imágenes/archivos): borrado suave con retención y organización en subcarpetas reales en disco. Reglas generales de arquitectura en [`../proyecto/reglas.md`](../proyecto/reglas.md).

## Papelera

### Layout en disco

Las entidades borradas se mueven a `.mi-cerebro/trash/YYYY/MM/DD/` (carpeta del día del borrado). Cada archivo se nombra:

```
<kind>__<id>__<file>.json
```

`kind` es el tipo de entidad (`note`, `task`, `goal`, etc.), `id` es su identificador y `file` conserva el nombre original del archivo. El prefijo `kind` permite listar y filtrar sin abrir cada archivo.

### `TrashService`

- Lista todo el contenido de `.mi-cerebro/trash/` parseando los nombres de archivo (`parseEntry`).
- Cada entrada expone `kind`, `id`, `title` y `deletedAt` (derivado de la ruta `YYYY/MM/DD`).
- `TrashKind` y `KIND_DIRS` mapean cada kind soportado a su carpeta raíz de origen (ej. `note → notes`).
- `refreshKind` delega en el `refresh` del servicio de cada entidad para reconstruir su listado tras una operación de papelera.

### Ruta `/trash`

- **Restore:** mueve el archivo de vuelta al directorio raíz del kind correspondiente.
- **Purge individual:** borrado permanente de una entrada, con confirmación.
- **Vaciado total:** borra todo el contenido de la papelera, con confirmación.
- Link de acceso en el footer del sidebar.

### Entidades binarias (nota de alcance)

Entidades agregadas después de este paso (imágenes, archivos) extendieron el modelo de papelera para soportar contenido shape `'file' | 'directory'` además del flat-file JSON original, ya que esas entidades son binary-backed y algunas son directory-shaped. El detalle de esa extensión vive en la documentación de esas entidades (fuera del alcance de este documento) — acá solo se deja constancia de que la papelera no asume que todo lo borrado es un único `.json`.

## Carpetas

### Modelo

Las carpetas son subdirectorios reales en disco, uno por entidad: `notes/<path>/file.json`, y de forma idéntica en `tasks/` y `goals/`. No hay un archivo de metadata separado para el árbol — la estructura de carpetas _es_ la estructura de directorios.

Cada entity service escanea recursivamente con `walkEntities`. El summary de cada entidad gana un campo `folder: string`, donde `''` representa la raíz.

### `FoldersService`

Provee, por kind:

- `createFolder`
- `renameFolder`
- `moveFolder`
- `deleteFolder`

Al borrar una carpeta, todo su contenido (recursivo) se manda primero a la papelera vía el `deleteToTrash` de cada entity service correspondiente, y recién después se elimina el directorio físico — así el borrado de una carpeta completa queda cubierto por la misma retención/restore que el borrado individual.

Cada entity service expone además `moveToFolder(id, newFolder)` para reubicar una entidad puntual sin pasar por la carpeta contenedora.

### Árbol en el sidebar

El sidebar arma el árbol de navegación con `buildFolderTree`:

- Las carpetas vacías quedan visibles (no se ocultan por falta de contenido).
- Las entidades se anidan bajo su carpeta.
- Botón **"+ Carpeta en {kind}"** en el header de cada sección crea carpetas nuevas.
- Botón **"⋯"** inline en cada nodo (carpeta o entidad) abre prompts para renombrar/mover/eliminar la carpeta, o mover la entidad a otra carpeta.

## Fuera de alcance de este paso

- Papelera e imágenes/archivos binary-backed: extensión de shape documentada junto a esas entidades, no acá.
- Drag-and-drop de entidades/carpetas en el árbol (si existiera, se documenta en la feature de sidebar/tree correspondiente).
