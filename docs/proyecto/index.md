# mi-cerebro — proyecto (índice)

Documento base del proyecto. Rige todas las decisiones de diseño e implementación. Cualquier cambio se hace acá primero.

**Este archivo es el punto de entrada.** El contenido pesado vive repartido en los demás `.md` de esta carpeta — la tabla de abajo mapea cada sección (§) al archivo que la tiene. `regla 25` (`reglas.md`) sigue aplicando igual: el commit que cambia una decisión arquitectónica actualiza el archivo correspondiente en el mismo commit.

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

| Entidad                 | Característica                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notas**               | Formato libre, sugerencia de formato corto. Pueden estar "por algún lado", no exigen visibilidad.                                                                                                                                                                                                                                                                                               |
| **Tareas**              | Lista + fecha(s). Tienen estado (pendiente/hecha).                                                                                                                                                                                                                                                                                                                                              |
| **Objetivos**           | Similar a notas pero **siempre visibles**. Recordatorio constante.                                                                                                                                                                                                                                                                                                                              |
| **Listas**              | Genéricas, no atadas a tarea, sin fecha ni estado. La detalle (`/lists/:id`) lleva además una capa de **tiza** sobre el body: trazos vectoriales con paleta de tizas, goma, y capas nombradas que el usuario crea/oculta/bloquea/reordena. Toggle "modo tiza" off por default — los clicks van al editor; on captura el puntero sobre el body. Persiste en el JSON de la lista (`chalkLayers`). |
| **Escritos largos**     | Libros, artículos, apuntes de idiomas, conocimiento de un tema, planes. Editor cómodo.                                                                                                                                                                                                                                                                                                          |
| **Imágenes**            | Galería propia como tipo de entidad. Lo que se "adjunta" es la referencia; se renderiza la imagen.                                                                                                                                                                                                                                                                                              |
| **Archivos**            | Cualquier archivo suelto que el usuario quiera tener organizado.                                                                                                                                                                                                                                                                                                                                |
| **Playlists de música** | MP3s subidos por el usuario, reproducción aleatoria en bucle.                                                                                                                                                                                                                                                                                                                                   |

### Funcionalidades transversales

- Árbol de carpetas jerárquico con buscador inteligente (ver §10).
- **Etiquetas (tags)** transversales que cruzan todas las entidades. Filtro por etiqueta en búsqueda global.
- **Calendario** mensual/anual con expansión a día, mostrando todas las entidades con fecha, agrupadas por tipo, filtrables. Click en día → botón para crear entrada nueva.
- **Recordatorios** simples (in-app, con la app abierta). Sección dedicada.
- **Versionado** automático (ver §12).
- **Temas claro/oscuro + temas custom** del usuario.
- **Reproductor de música** siempre accesible (mini-controles globales).
- **Dashboard combinado (`/dashboard`)**: pantalla de lectura que agrega tareas de hoy, objetivos activos, recordatorios próximos, notas/escritos recientes y una selección aleatoria de contenido viejo para redescubrir ("Redescubrí esto") en un solo lugar, sin reemplazar la navegación por entidad (ver §19.22 y §19.22bis).

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

---

## Mapa de archivos

Cada sección numerada (§) vive en uno de estos archivos. Las referencias cruzadas en el resto del proyecto (código, `docs/deferred/`, `docs/evolution.md`) siguen usando el número de sección (`§13`, `§19.22`) — usá esta tabla para saber dónde abrir.

| Sección                                                                                                                                                                           | Archivo                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Visión, §2 Alcance, §3 Stack técnico                                                                                                                                           | `index.md` (este archivo)                                                                                                                                            |
| §4 Reglas del proyecto                                                                                                                                                            | [`reglas.md`](./reglas.md)                                                                                                                                           |
| §5 Linter y formateo, §6 Errores, §7 Documentación, §9 Primer arranque y permisos, §18 PWA                                                                                        | [`infraestructura.md`](./infraestructura.md)                                                                                                                         |
| §8 Estructura del file system del usuario                                                                                                                                         | [`filesystem.md`](./filesystem.md)                                                                                                                                   |
| §10 Búsqueda y navegación, §10bis Conexiones y backlinks, §11 Editor de escritura, §12 Versionado (spec), §13 Objetivos, §14 Recordatorios, §15 Calendario, §16 Música, §17 Temas | [`features.md`](./features.md)                                                                                                                                       |
| §19 Roadmap, items 1-9 (scaffolding → resto de entidades)                                                                                                                         | [`roadmap-01-09.md`](./roadmap-01-09.md)                                                                                                                             |
| §19 Roadmap, items 10-12 (calendar, reminders, music)                                                                                                                             | [`roadmap-10-12.md`](./roadmap-10-12.md)                                                                                                                             |
| §19 Roadmap, item 13 (versionado y variantes)                                                                                                                                     | [`roadmap-13-versionado.md`](./roadmap-13-versionado.md)                                                                                                             |
| §19 Roadmap, items 14-18 (export zip, temas custom, pulido, fullscreen, empaquetado nativo)                                                                                       | [`roadmap-14-18.md`](./roadmap-14-18.md)                                                                                                                             |
| §19 Roadmap, items 19-21 (rutas legibles, descarga mp3, responsive mobile)                                                                                                        | [`roadmap-19-21.md`](./roadmap-19-21.md)                                                                                                                             |
| §19 Roadmap, items 22-25 (dashboard, navegación por carpetas, testing, dormancia de metas)                                                                                        | [`roadmap-22-25.md`](./roadmap-22-25.md)                                                                                                                             |
| §19 Roadmap, item 26 (tutorial guiado por página)                                                                                                                                 | [`roadmap-26-tutoriales.md`](./roadmap-26-tutoriales.md) — cerrado, recortado a índice de punteros (ver `docs/sistema/tutoriales-atajos.md` para el estado vigente). |
| §19 Roadmap, item 27+ (conexiones entre entidades, y lo que se agregue después)                                                                                                   | [`roadmap-27-conexiones.md`](./roadmap-27-conexiones.md) — **bucket abierto**: los próximos ítems se agregan acá hasta que vuelva a pesar demasiado.                 |

**Documentación de lo que existe** (no del roadmap — estado actual del sistema, por componente, sin bitácora de sesión): [`docs/sistema/index.md`](../sistema/index.md). Cada ítem de roadmap que cierra migra su contenido ahí y queda en este archivo como puntero de una línea (regla §4.11.24/25).

Relacionados fuera de esta carpeta: [`docs/deferred/index.md`](../deferred/index.md) (ítems pospedidos), [`docs/evolution.md`](../evolution.md) (ideas de producto candidatas).
