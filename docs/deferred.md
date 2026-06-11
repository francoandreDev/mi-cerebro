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

### Colapsar chips de kind en la timeline cuando hay más de N

- **Qué**: hoy cada commit de la timeline muestra todos los chips de kind tocado (`note`, `task`, `goal`, `image`, `book`, `file`, `list`, `track`, `tag`, `writing`). Cuando el commit toca 8-10 kinds los chips envuelven a dos líneas y desbalancean visualmente la fila.
- **Por qué se difirió**: estético, no bloquea funcionalidad. La heurística "N chips + (+M más)" es trivial pero entra junto con un pulido más profundo del item de timeline.
- **Target**: §19.16f (pulido del historial — sección a crear cuando arranque el pulido).

### Toggle "ver sólo cambios" en diffs largos

- **Qué**: el diff de cuerpo (TipTap → prosa + jsdiff) muestra todo el contenido, no sólo los chunks `add`/`remove`. En notas largas las líneas de contexto opacitadas dominan visualmente. Sería útil un toggle que oculte los `context` y deje sólo los chunks modificados con un separador `…`.
- **Por qué se difirió**: nice-to-have. Con contexto reducido (~3 líneas alrededor de cada cambio) la legibilidad puede mejorar sin esconder nada — esa es una alternativa más conservadora que también queda en este ítem.
- **Target**: §19.16f.

### Pulido visual general de `/history`

- **Qué**: cuando cerramos 13a el usuario confirmó que la información está completa y legible pero "mucha info, poco visual". Queda como ítem único agrupador para futuras iteraciones de tipografía, densidad, jerarquía y micro-interacciones del historial (anchos de columna, separadores entre buckets, hover states, animación del cambio de selección, etc.).
- **Por qué se difirió**: estructura y funcionalidad están; el polish entra cuando 13a-d estén cerrados y tengamos uso real para saber qué duele.
- **Target**: §19.16f.

### Header del editor: "n commits desde {milestone}"

- **Qué**: 13a-bis grabó milestones como git tags anotados pero no expone "estás a n commits desde el milestone más cercano" en el header del editor de cada entidad. El roadmap lo describe como "contexto leve".
- **Por qué se difirió**: requiere walk del log desde HEAD hasta el primer commit con tag (por entidad o global), un computed que reacciona a cada autocommit, y un slot visual en el header del editor que hoy ya está cargado de chips (autosave, lock, tags). Sumado a que `/history` ya muestra los milestones inline, el valor incremental es marginal hasta tener varios milestones reales en uso.
- **Target**: §19.16f (pulido del historial).

### `.git/` en OPFS para acelerar operaciones git

- **Qué**: mover `.git/` (loose objects + refs + index) al Origin Private File System del browser, dejando sólo el workdir visible en la carpeta del usuario via FS Access. isomorphic-git acepta nativamente `dir` (workdir) y `gitdir` separados. La ganancia esperada es 10-100×: cada syscall sobre OPFS cuesta ~5-10 ms vs ~100-200 ms sobre FS Access. Eso bajaría el commit base de ~3 s a ~200 ms.
- **Por qué se difirió**: las mediciones del validador en 13a (`DevPerfService`) confirmaron el piso de 3 s/commit, pero la decisión de producto fue aceptar pantallas de carga contextuales para las operaciones git disparadas por el usuario (switch de variante, merge, accept de diff-mark, crear/borrar variante) en vez de invertir 2-3 horas y duplicar el modelo de FS clients. Patrón estándar de clientes git; se entiende como aceptable hasta que el uso real demuestre lo contrario.
- **Implicaciones si se aborda**: el export ZIP (paso 14) tiene que leer también OPFS. Si el usuario limpia datos del sitio, pierde el historial git (pero conserva sus notas y puede recuperar el historial desde GitHub si tenía push configurado en 13e). Riesgo nuevo: races entre main thread (autosave) y posibles workers de git — habría que serializar accesos.
- **Target**: sin asignar (sólo si la UX con loading screens resulta intolerable en uso real, especialmente en 13b switches frecuentes o 13d accept-spam).
