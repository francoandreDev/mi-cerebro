# Búsqueda, árbol y tags

Parte de la documentación de sistema de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo.

Cubre la navegación por árbol de carpetas, las etiquetas transversales y la búsqueda global indexada. Ver también [`features.md`](../proyecto/features.md) §10 para la especificación de producto de búsqueda y navegación.

## Árbol con filtro inteligente

El árbol jerárquico de carpetas es la navegación por defecto, con un filtro de texto que hace colapso/expansión inteligente: al escribir, las ramas sin coincidencias se colapsan y las que sí tienen resultados se expanden automáticamente, para no obligar a recorrer manualmente 10 niveles de carpetas. El filtro también busca por tag, no solo por título (ver más abajo).

## Tags transversales

Las etiquetas cruzan todas las entidades. Se persisten en un `tags.json` en la raíz del workspace, con `schemaVersion` como cualquier otro archivo del sistema (ver [`fundamentos.md`](./fundamentos.md#migraciones-de-schema)). Cada entidad guarda sus tags como referencias a este catálogo compartido.

- **Picker**: componente de selección/creación de tags, integrado en el editor-pane de cada entidad (ver [`entidades.md`](./entidades.md)).
- **Color determinístico**: el color de badge de cada tag se deriva de su nombre (no se elige a mano ni se guarda como campo aparte), así el mismo tag se ve igual en toda la app sin coordinación manual.
- **Badges en el árbol**: los nodos del árbol muestran los tags de la entidad como badges de color.
- **Limpieza lazy de tag-refs muertos**: si una entidad referencia un tag que ya no existe en `tags.json`, la referencia se limpia de forma perezosa (al tocar esa entidad) en lugar de con un barrido activo.

## Búsqueda global

Índice incremental en IndexedDB (MiniSearch), persistido entre sesiones y actualizado a medida que se crean/editan/borran entidades — no se reconstruye desde cero en cada carga. Cubre título, cuerpo y tags de todas las entidades (incluyendo, para libros y galerías/colecciones, sus sub-documentos: capítulos, imágenes, items).

La paleta `Ctrl+K` es la entrada principal a la búsqueda global: acepta texto libre y el token `tag:<etiqueta>` para filtrar por tag directamente en la query (acento-insensible). La paleta más tarde incorporó también el token `kind:<tipo>` (en `core/search/palette-query.ts`), que filtra por tipo de entidad con la misma sintaxis que `tag:`.

**Comentarios y borradores son buscables** (kinds `comment`/`draft` en el mismo índice, no índices separados). Como esas dos ramas git nunca se hacen checkout, `SearchFamilyPrimingService` las recorre por plumbing (sin tocar el working tree) al boot y en cada switch de variante, y `CommentsService`/`DraftsService` reindexan en vivo la entidad puntual en cada `save()`. No son objetivos de "Conexiones" — al elegir un resultado de este tipo en la paleta, navega a la entidad que el comentario/borrador anota, no a una ruta propia. Ver `docs/proyecto/features.md` "Índice de búsqueda de comentarios y borradores" para el detalle técnico.
