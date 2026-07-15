# Diferidos — Notas, árbol y búsqueda

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Notas (origen: paso 5)

### Vista de papelera

- **Qué**: UI para listar, restaurar y vaciar lo borrado con soft-delete. Hoy las notas se mueven a `.mi-cerebro/trash/YYYY/MM/DD/` y no hay forma de recuperarlas sin tocar disco a mano.
- **Por qué**: el soft-delete era para no perder datos. La UI de papelera es una pieza transversal a todas las entidades, no de notas.
- **Target**: §19.9bis (papelera + carpetas).

### ~~Carpetas / jerarquía real dentro de notas~~ (resuelto en §19.23a)

- **Qué**: poder anidar notas en carpetas creadas por el usuario, no sólo un grupo raíz "Notas".
- **Estado**: cerrado. Breadcrumb + drill-down (§19.23a, `shared/folder-breadcrumb/`) en `/notes` — mismo mecanismo que el resto de las 8 entidades.

---

## Árbol con filtro (origen: paso 6)

### Filtros por tipo de entidad

- **Qué**: combinaciones de filtros por tipo (notas+tasks+goals, etc.) descritos en §10.
- **Por qué**: sólo existe la entidad Note hoy. El filtro por tag ya está cubierto en 7b.
- **Target**: §19.9 (resto de entidades).

---

## Tags (origen: paso 7a)

### ~~UI dedicada de gestión de tags~~ (resuelto 2026-07-04)

- **Qué**: pantalla para listar todos los tags, renombrar masivo, hacer merge entre dos, ver cuántas entidades usa cada uno, eliminar limpiando referencias.
- **Estado**: cerrado. Ruta `/tags` (`TagsContainer`) lista todas las etiquetas con conteo de uso, filtro por label, rename inline, recolor (reusa la paleta de swatches), merge ("Combinar con...") y delete con confirmación (muestra cuántas entidades la usan). La orquestación cross-kind vive en `core/tags/tags-admin.service.ts` (`TagsAdminService`), siguiendo el mismo patrón que `TrashService`/`FoldersService`/`calendar-events.service`: un agregador en `core/` inyecta los 8 servicios de entidad taggeable (notes/tasks/goals/lists/writings/books/images/files) para que ninguna feature tenga que importar a otra. `usageCounts` es un `computed` que recorre los `summaries()` ya cargados de cada kind (sin índice inverso persistido). `merge(fromId, toId)` reescribe el array `tags` de cada entidad afectada y remueve `fromId` del registro; `deleteCascade(id)` remueve el tag del registro primero y re-guarda las entidades afectadas — cada `*Service.save()` ya filtra tags ausentes del registro (`dropStaleTags`), así que no hizo falta un método nuevo por kind para el borrado. Rail icon 🏷 cerca de 🗑/⚙. 9/9 tests nuevos (`tags-admin.service.spec.ts`).

### ~~Color picker custom para tag~~ (resuelto en §19.15, entrada obsoleta)

- **Qué**: dejar al usuario elegir el color de un tag desde la UI.
- **Estado**: esta entrada quedó desactualizada — el mini-picker inline en `mc-tag-picker` (click en el dot del chip abre la grilla de `TAG_SWATCHES`, "✕" vuelve al hash determinístico, persistido en `Tag.colorSwatchId` vía `TagsService.setSwatch`) ya se construyó al cerrar §19.15 (paso 15 del roadmap). La pantalla `/tags` (arriba) reutiliza el mismo patrón de swatches en cada fila. Se borra por regla §4.11.24 (doc desactualizada miente) en vez de dejarla como "pendiente".

---

## Búsqueda (origen: paso 7b)

### ~~Botón / atajo de "reindexar" manual~~ (resuelto 2026-07-04)

- **Qué**: §10 menciona "botón reindexar para rebuild manual si se corrompe". Hoy el rebuild ocurre solo en cada `refresh()` (apertura del workspace o paneo); no hay UI explícita.
- **Estado**: cerrado. Botón "Reindexar" en `/settings` → sección General, junto a zona horaria. Llama a `WorkspaceRefreshService.refreshAll()` (mismo método que usa el boot y el switch de variante), con estado busy/spinner y mensaje de confirmación.

### ~~Snippet centrado en la coincidencia (con highlight)~~ (resuelto 2026-07-04)

- **Qué**: en lugar de mostrar los primeros 160 caracteres del body, mostrar un fragmento alrededor del término encontrado y resaltarlo.
- **Estado**: cerrado. `SearchIndexService` guarda el body aplanado completo por doc (`DocMeta.body`) en vez de un snippet pre-truncado; en `query()`, `buildSnippet()` re-escanea el texto normalizado buscando el término matcheado más temprano (de `r.terms`, ya que MiniSearch no expone offsets) y mapea el índice de vuelta al texto original (largo 1:1 preservado por `norm()`) para recortar una ventana de ±70 caracteres. `SearchHit.snippet` pasa de `string` a `{ pre, match, post }`; la paleta renderiza `pre` + `<mark>{{ match }}</mark>` + `post` sin `innerHTML`/sanitizer. Sin match (browse por tag, o recientes) cae al fallback de los primeros 160 caracteres, igual que antes. `SEARCH_INDEX_VERSION` bump a 2 (el índice persistido en IndexedDB se reconstruye solo si cambia el schema; el usuario puede forzarlo con el botón "Reindexar" ya cerrado arriba).

### ~~Historial de últimas búsquedas / accesos recientes~~ (resuelto en §19.16a-ii + §19.16a-iii)

- **Qué**: al abrir la paleta sin escribir nada, mostrar las últimas entidades visitadas o búsquedas recientes.
- **Estado**: cerrado. Entidades recientes en §19.16a-ii (`@core/search/palette-recents.service`, sección "Recientes"). Queries literales en §19.16a-iii (`@core/search/palette-queries.service`, sección "Búsquedas anteriores" con ✕ para olvidar).

### ~~Continuidad: última ruta + scroll al abrir~~ (resuelto en §19.16a-i)

- **Qué**: §10 menciona "vuelve a la última ruta + última entidad abierta + scroll". Hoy se abre en `/notes` sin recordar nada.
- **Estado**: cerrado en §19.16a-i (`@core/continuity/continuity.service`, redirect funcional desde `/`, scroll restore en `NavigationEnd`).

---
