# Estructura del file system del usuario (§8)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

## 8. Estructura del file system del usuario

Raíz elegida por el usuario al abrir la app la primera vez (sugerencia: `Documentos\mi-cerebro\`).

```
<raíz elegida>/                        ej: D:\Documentos\mi-cerebro\
│
├── .mi-cerebro/                       # metadata interna. NO TOCAR.
│   ├── config.json                    # config global del workspace (schemaVersion, retención papelera, etc.)
│   ├── tags.json                      # registro central de tags
│   ├── relations.json                 # registro central de conexiones entre entidades (§10bis)
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

- **IDs estables internos.** Filename = `<slug-humano>.json`, pero adentro del JSON hay un `id` UUID inmutable. Los links entre entidades y los tags usan IDs, no rutas. **Conexiones entre entidades (`relations.json`) no duplican esta resolución**: guardan sólo `{kind, id}` en cada extremo y resuelven título/ruta actuales contra el índice de búsqueda (`.mi-cerebro/index/index.json`, ya generado por cada `*Service`), igual que el picker de vincular reusa ese mismo índice para buscar — ver §10bis. **El mapa `id → ruta actual` vive en memoria por servicio** (`idToPath`/`idToLoc`, poblado por el `refresh()` de cada `*Service`), no persistido en el índice en disco — cada pestaña/reload lo reconstruye caminando el filesystem. Si el id buscado no está en el mapa (reload directo antes de que el `refresh()` de boot termine, o condición de carrera), cada servicio re-camina el filesystem una vez como fallback (`findPath`/`findLoc`) antes de asumir que la entidad no existe; sólo si tampoco aparece ahí se considera borrada (§20a). Un `ResolveFn` de Angular Router (`core/fs/entity-ready.guard.ts`) espera a que ese `refresh()` haya corrido al menos una vez antes de activar cualquier ruta de detalle, para no depender de que el sidebar se haya montado primero (§20b).
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
