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

### Filtros por tipo de entidad

- **Qué**: combinaciones de filtros por tipo (notas+tasks+goals, etc.) descritos en §10.
- **Por qué**: sólo existe la entidad Note hoy. El filtro por tag ya está cubierto en 7b.
- **Target**: §19.9 (resto de entidades) — cuando exista la segunda entidad, las pestañas/filtros por tipo cobran sentido.

### Lista de coincidencias visible dentro del árbol

- **Qué**: hoy el árbol muestra un contador "N coincidencias" y se navega con ↑/↓ desde el input. §10 menciona "Lista de coincidencias navegable con teclado" desplegada.
- **Por qué**: el paso 7b incorporó la paleta global que cumple el rol cuando hay muchos matches. El listado dentro del árbol es UX complementario y menos urgente.
- **Target**: sin asignar — pulido (§19.16) salvo que aparezca una necesidad concreta.

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

---

## Búsqueda (origen: paso 7b)

### Botón / atajo de "reindexar" manual

- **Qué**: §10 menciona "botón reindexar para rebuild manual si se corrompe". Hoy el rebuild ocurre solo en cada `refresh()` (apertura del workspace o paneo); no hay UI explícita.
- **Por qué**: con sólo notas el rebuild automático cubre el caso. La pieza UI tiene sentido cuando haya más entidades y el índice sea grande, o cuando exista una pantalla de "ajustes".
- **Target**: §19.16 (pulido), o anticipado si aparece un escenario de corrupción.

### Snippet centrado en la coincidencia (con highlight)

- **Qué**: en lugar de mostrar los primeros 160 caracteres del body, mostrar un fragmento alrededor del término encontrado y resaltarlo.
- **Por qué**: requiere índice posicional o un re-scan por hit. La paleta ya muestra preview, pero no contextualizado.
- **Target**: §19.16 (pulido).

### Historial de últimas búsquedas / accesos recientes

- **Qué**: al abrir la paleta sin escribir nada, mostrar las últimas entidades visitadas o búsquedas recientes.
- **Por qué**: requiere persistir un log; no es crítico para la primera versión.
- **Target**: §19.16 (pulido).

### Continuidad: última ruta + scroll al abrir

- **Qué**: §10 menciona "vuelve a la última ruta + última entidad abierta + scroll". Hoy se abre en `/notes` sin recordar nada.
- **Por qué**: requiere infra de `localStorage` y un listener de route changes. Fuera del scope estricto de búsqueda.
- **Target**: §19.16 (pulido — "continuidad de sesión").
