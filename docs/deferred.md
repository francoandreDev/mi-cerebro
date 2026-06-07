# Diferidos

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

---

## Notas (origen: paso 5)

### Vista de papelera

- **Qué**: UI para listar, restaurar y vaciar lo borrado con soft-delete. Hoy las notas se mueven a `.mi-cerebro/trash/YYYY/MM/DD/` y no hay forma de recuperarlas sin tocar disco a mano.
- **Por qué**: el soft-delete era para no perder datos. La UI de papelera es una pieza transversal a todas las entidades, no de notas.
- **Target**: sin asignar — candidato a fase de pulido (§19.16) o a una mini-fase propia cuando exista la segunda entidad.

### Carpetas / jerarquía real dentro de notas

- **Qué**: poder anidar notas en carpetas creadas por el usuario, no sólo un grupo raíz "Notas".
- **Por qué**: el árbol del paso 6 ya soporta hijos arbitrarios; lo único que falta es UI para crear/renombrar/mover carpetas y persistencia de la jerarquía.
- **Target**: sin asignar — probable §19.9 (resto de entidades) si se decide que la jerarquía es transversal, o fase dedicada de "organización de notas".

---

## Árbol con filtro (origen: paso 6)

### Filtros por tipo de entidad y por tag

- **Qué**: combinaciones de filtros (notas+tasks, tag X, etc.) descritos en §10 y §15.
- **Por qué**: sólo existe la entidad Note hoy; los tags transversales no existen.
- **Target**: §19.7 (tags + búsqueda global).

### Búsqueda en contenido (full-text)

- **Qué**: indexar el body de cada nota (no sólo el título) con MiniSearch o Lunr, persistido en IndexedDB.
- **Por qué**: §10 lo describe como pieza independiente del árbol navegacional.
- **Target**: §19.7.

### Lista de coincidencias navegable visible

- **Qué**: hoy el filtro muestra sólo "N coincidencias" y permite saltar entre ellas con ↑/↓ desde el input. §10 menciona "Lista de coincidencias navegable con teclado".
- **Por qué**: con una sola entidad el contador alcanza. La lista cobra sentido cuando hay matches en varios tipos y se necesita preview por match.
- **Target**: §19.7 junto con la búsqueda global.

### Scroll automático al match activo

- **Qué**: cuando ↑/↓ desde el filtro mueve la selección a un nodo fuera de viewport, scrollear el árbol para mostrarlo.
- **Por qué**: con pocas notas no se nota. Vamos a verlo cuando el árbol crezca.
- **Target**: sin asignar — pulido (§19.16).

### Drag & drop / reordenamiento

- **Qué**: arrastrar nodos del árbol para reorganizar.
- **Por qué**: el árbol actual sólo lista; no hay concepto de orden custom todavía.
- **Target**: sin asignar — pulido (§19.16).

---

## Tags (origen: paso 7a)

### UI dedicada de gestión de tags

- **Qué**: pantalla para listar todos los tags, renombrar masivo, hacer merge entre dos, ver cuántas entidades usa cada uno, eliminar limpiando referencias.
- **Por qué**: hoy se crean en línea desde el picker y se quedan ahí. No hay vista global; renombrar requiere editar `tags.json` a mano.
- **Target**: sin asignar — probablemente §19.16 (pulido) o mini-fase cuando aparezca la segunda entidad que use tags.

### Color picker custom para tag

- **Qué**: dejar al usuario elegir el color de un tag desde la UI.
- **Por qué**: hoy el color se deriva determinísticamente del id (hash → paleta). Funciona, pero no es customizable.
- **Target**: §19.15 (temas custom + WCAG) o §19.16 (pulido).

### Limpieza de referencias rotas

- **Qué**: cuando se elimina un tag de `tags.json`, dejar de mostrarlo en notas que lo referencian (hoy `byId` devuelve undefined y el chip se filtra silenciosamente, pero el id queda guardado en el body de la nota).
- **Por qué**: queríamos paso 7a chico. La limpieza necesita iterar todas las entidades o hacerla lazy en el siguiente save de cada una.
- **Target**: §19.7b (búsqueda global indexada — ya tendremos que iterar todas las entidades para construir el índice, podemos limpiar en ese paso).

### Autocompletado por tag desde búsqueda global

- **Qué**: en la paleta global poder filtrar "tag:trabajo" y ver todas las entidades con ese tag.
- **Por qué**: necesita el índice de búsqueda global.
- **Target**: §19.7b.
