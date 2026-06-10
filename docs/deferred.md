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
- **Target**: §19.9bis (papelera + carpetas).

### Carpetas / jerarquía real dentro de notas

- **Qué**: poder anidar notas en carpetas creadas por el usuario, no sólo un grupo raíz "Notas".
- **Por qué**: el árbol del paso 6 ya soporta hijos arbitrarios; lo único que falta es UI para crear/renombrar/mover carpetas y persistencia de la jerarquía.
- **Target**: §19.9bis (papelera + carpetas).

---

## Árbol con filtro (origen: paso 6)

### Filtros por tipo de entidad

- **Qué**: combinaciones de filtros por tipo (notas+tasks+goals, etc.) descritos en §10.
- **Por qué**: sólo existe la entidad Note hoy. El filtro por tag ya está cubierto en 7b.
- **Target**: §19.9 (resto de entidades).

### Lista de coincidencias visible dentro del árbol

- **Qué**: hoy el árbol muestra un contador "N coincidencias" y se navega con ↑/↓ desde el input. §10 menciona "Lista de coincidencias navegable con teclado" desplegada.
- **Por qué**: el paso 7b incorporó la paleta global que cumple el rol cuando hay muchos matches. El listado dentro del árbol es UX complementario y menos urgente.
- **Target**: §19.16b (pulido visual del árbol).

### Scroll automático al match activo

- **Qué**: cuando ↑/↓ desde el filtro mueve la selección a un nodo fuera de viewport, scrollear el árbol para mostrarlo.
- **Por qué**: con pocas notas no se nota. Vamos a verlo cuando el árbol crezca.
- **Target**: §19.16b (pulido visual del árbol).

### Drag & drop / reordenamiento

- **Qué**: arrastrar nodos del árbol para reorganizar.
- **Por qué**: el árbol actual sólo lista; no hay concepto de orden custom todavía.
- **Target**: §19.16b (pulido visual del árbol).

---

## Tags (origen: paso 7a)

### UI dedicada de gestión de tags

- **Qué**: pantalla para listar todos los tags, renombrar masivo, hacer merge entre dos, ver cuántas entidades usa cada uno, eliminar limpiando referencias.
- **Por qué**: hoy se crean en línea desde el picker y se quedan ahí. No hay vista global; renombrar requiere editar `tags.json` a mano.
- **Target**: §19.16c (gestión avanzada de tags).

### Color picker custom para tag

- **Qué**: dejar al usuario elegir el color de un tag desde la UI.
- **Por qué**: hoy el color se deriva determinísticamente del id (hash → paleta). Funciona, pero no es customizable.
- **Target**: §19.15 (temas custom + WCAG).

---

## Búsqueda (origen: paso 7b)

### Botón / atajo de "reindexar" manual

- **Qué**: §10 menciona "botón reindexar para rebuild manual si se corrompe". Hoy el rebuild ocurre solo en cada `refresh()` (apertura del workspace o paneo); no hay UI explícita.
- **Por qué**: con sólo notas el rebuild automático cubre el caso. La pieza UI tiene sentido cuando haya más entidades y el índice sea grande, o cuando exista una pantalla de "ajustes".
- **Target**: §19.16d (pulido de búsqueda).

### Snippet centrado en la coincidencia (con highlight)

- **Qué**: en lugar de mostrar los primeros 160 caracteres del body, mostrar un fragmento alrededor del término encontrado y resaltarlo.
- **Por qué**: requiere índice posicional o un re-scan por hit. La paleta ya muestra preview, pero no contextualizado.
- **Target**: §19.16d (pulido de búsqueda).

### Historial de últimas búsquedas / accesos recientes

- **Qué**: al abrir la paleta sin escribir nada, mostrar las últimas entidades visitadas o búsquedas recientes.
- **Por qué**: requiere persistir un log; no es crítico para la primera versión.
- **Target**: §19.16a (continuidad de sesión + atajos).

### Continuidad: última ruta + scroll al abrir

- **Qué**: §10 menciona "vuelve a la última ruta + última entidad abierta + scroll". Hoy se abre en `/notes` sin recordar nada.
- **Por qué**: requiere infra de `localStorage` y un listener de route changes. Fuera del scope estricto de búsqueda.
- **Target**: §19.16a (continuidad de sesión + atajos).

---

## Versionado y variantes (origen: paso 13)

### Anchor `range` para comentarios

- **Qué**: §12 menciona tres niveles de anchor para comentarios (`entity`, `block`, `range`). 13c implementa sólo `entity` y `block`.
- **Por qué**: `range` requiere UI de selección de texto + persistencia de offsets dentro del bloque + casos de borde de mapping cuando el texto del bloque cambia parcialmente. Cubre un caso minoritario ("comentario sobre estas 3 palabras") cuando `block` ("comentario sobre este párrafo") cubre el 80%.
- **Target**: §19.16e (pulido del editor).

### Renderizado inline (ghost / overlay) de diff-marks del borrador

- **Qué**: en 13d el borrador se vive desde un panel lateral con lista de cambios pendientes + accept/reject. La versión "rica" — diff-marks renderizadas inline en el editor como ghost text/strikethrough, tipo track-changes de Word — queda fuera del alcance del paso.
- **Por qué**: el panel lateral entrega funcionalidad completa. El renderizado inline es lindo de UX pero implica una capa nueva de decoraciones ProseMirror y resolución visual de conflictos contra el contenido vivo. Vale como pulido cuando el resto del sistema esté estable y haya uso real para guiar decisiones de diseño.
- **Target**: §19.16e (pulido del editor) o sin asignar.

### Renderizado overlay unificado (variante "B" original)

- **Qué**: borrador y comentarios renderizados como overlay sobre `main` en una vista única e integrada, en lugar de paneles laterales separados. Era la opción "B" del diseño original; cerramos en "A con datos anclados".
- **Por qué**: 13c/13d entregan el modelo de datos correcto (anchored refs + diff-marks). El overlay unificado es una capa de renderizado adicional que no aporta funcionalidad nueva, sólo presentación. Se evalúa una vez que el flujo lateral esté en uso real.
- **Target**: sin asignar (se considera tras vivir con 13c/13d).

### Granularidad por faceta dentro del bundle de merge

- **Qué**: en 13b–d el merge ofrece elegir por entidad el bundle entero (main + draft + comments de la variante origen). Una versión avanzada permitiría tomar `main` de la variante origen pero quedarse con el `draft` o los `comments` de la variante destino.
- **Por qué**: cubre un caso raro y agrega 3× botones por delta en la UI de merge. Decisión explícita de "simple gana".
- **Target**: sin asignar (se agrega si aparece demanda real).

### Variantes sobre el fallback sin isomorphic-git

- **Qué**: si el adapter de isomorphic-git resulta inviable en 13a y se cae al fallback de snapshots en `.mi-cerebro/history/`, las variantes (13b en adelante) no son soportables. La app degrada a una sola "Principal" implícita.
- **Por qué**: implementar variantes sin git significaría reinventar branching + merge desde cero. No vale la pena hasta confirmar que isomorphic-git no funciona.
- **Target**: sin asignar (sólo se aborda si el fallback se activa en 13a).
