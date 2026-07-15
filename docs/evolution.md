# Índice de evolución

Ideas de producto candidatas a futuro, no comprometidas. Distinto de `deferred/index.md`: `deferred/index.md` registra piezas concretas que se sacaron de un cambio ya en curso; este archivo registra direcciones de producto todavía sin diseñar ni agendar, para no perderlas y para revisitarlas con criterio cuando haya espacio.

No es obligatorio tomar ninguna. Es obligatorio no perderlas de vista: cada una se revisa al menos como candidata cuando se replantee roadmap.

Origen: investigación de dolores no cubiertos por apps de "segundo cerebro" existentes (notas/tareas/metas/escritura), pedida por el usuario a ChatGPT con browsing en tiempo real, 2026-07-15. Contrastada contra el estado real de `mi-cerebro` (código + `docs/proyecto/`) el mismo día — los 4 gaps están confirmados, no son especulación de marketing.

---

## 1. Cementerio de notas — falta resurfacing pasivo

**Dolor:** el usuario escribe y guarda, pero nunca vuelve a ver lo guardado salvo que lo busque activamente. La app es un archivador (metáfora: "acá está tu archivo, buscalo"), no una memoria que trae contenido de vuelta cuando es relevante ("necesito esto ahora porque encaja con lo que estoy pensando").

**Gap confirmado en mi-cerebro:** hoy solo hay recuperación **activa** (búsqueda por texto/tag/árbol, §10 de `docs/proyecto/features.md`) y links **manuales** (insertar referencia a otra entidad por ID, §11). El único mecanismo de aparición espontánea que existe es el banner aleatorio de objetivos (§13, `GoalReminderContainer`) — y es exclusivo de goals, no aplica a notas/escritos/listas. Choca directamente con la visión propia del proyecto (§1: "orden impecable y búsqueda instantánea" describe un filing cabinet, no un pensamiento externo).

**Estado:** ✅ primer corte cerrado 2026-07-15 (§19.22bis de `docs/proyecto/roadmap-22-25.md`) — sección "Redescubrí esto" en `/dashboard`, aleatorio ponderado por antigüedad sobre notas/escritos/listas. Capítulos de libros, selección por similitud (MiniSearch) como modo adicional, persistencia entre sesiones y dismiss/snooze quedaron en `docs/deferred/index.md` (grupo "Resurfacing pasivo en dashboard").

---

## 2. Fricción captura vs organización — "quiero pensar, no administrar mi sistema"

**Dolor:** dos extremos fallan. Apps simples (Apple Notes, Keep) son rápidas para capturar pero luego no se encuentra nada. Apps potentes (Notion, Obsidian) permiten cualquier sistema pero exigen que el usuario sea arquitecto y mantenedor de su propio esquema de organización.

**Gap en mi-cerebro:** el proyecto ya está diseñado explícitamente contra este dolor — es uno de sus ejes fundacionales. §1: "Orden por defecto, no por esfuerzo del usuario. La app define la estructura; el usuario no tiene que decidir dónde va cada cosa." Carpetas jerárquicas + tags transversales + búsqueda instantánea (§2, §10) ya cubren la intención. No hay gap real hoy; es un riesgo a vigilar si en el futuro se agregan features que exijan configuración manual (ej. reglas custom, plantillas complejas).

**Estado:** ✅ cubierto por diseño actual. Sin acción — se revisita solo si una feature futura empieza a pedirle esquema al usuario.

---

## 3. Metas estáticas — falta acompañamiento adaptativo

**Dolor:** las apps de objetivos guardan la meta pero no entienden el estado mental/comportamental del usuario respecto a ella. No hay señal de "este objetivo se está muriendo" antes de que el usuario lo abandone silenciosamente.

**Gap parcial en mi-cerebro:** hay una semilla del concepto ya nombrada pero no cableada: `goals.dormantThresholdDays` existe como placeholder en `SettingsService` (§19 paso 11bis) apuntando al "lifecycle de variantes en reposo" (§12) — pero es para variantes de escritos, no para goals. Objetivos hoy solo tienen `deadline`/`completed`/`progress`/`priority` (§13) — ninguna señal derivada de "sin actividad reciente". El acompañamiento real (detectar inactividad, avisar antes del abandono en vez de solo recordar que existe) no está implementado.

**Estado:** ✅ primer corte cerrado 2026-07-15 (§19.25 de `docs/proyecto/roadmap-22-25.md`) — `Goal.lastProgressAt` (schema v8) mide sólo cambios de progreso/steps/completed, no cualquier edición; `isGoalDormant` computa dormancia contra `settings.goals.dormantThresholdDays` (30 días default, ya existía sin cablear). Superficie en dashboard (badge 🌙) y en el wall de constelaciones `/goals` (estrella desaturada). El editor de meta individual (`/goals/:id`) no muestra la señal — queda en `docs/deferred/index.md`.

---

## 4. Editor sin comprensión de intención/conexiones

**Dolor:** escribir no es el problema del escritor; el problema es "¿esta idea vale la pena?, ¿qué conexiones tiene?, ¿qué olvidé?, ¿qué patrón se repite?". El editor de hoy en cualquier app (incluida esta) es un documento nuevo en blanco, no algo que ayude a ver relaciones con lo ya escrito.

**Gap confirmado en mi-cerebro:** el editor TipTap (§11) resuelve formato y highlighting, pero cero asistencia de contenido. Existe un embrión de la idea de "relaciones entre items" ya identificado y diferido explícitamente en `deferred/index.md` ("Hilos entre items relacionados", origen rediseño `/files`) — pero acotado a `FileItem`/tablero de evidencia, no al editor de escritura ni a notas/escritos en general. Requeriría un modelo de grafo de relaciones (origen/destino/label) que hoy no existe para ninguna entidad de texto.

**Estado:** 🔲 sin explorar, el más caro de los 4 (toca modelo de datos de todas las entidades de texto). Depende de que primero exista algo de idea 1 (resurfacing) para tener superficie donde mostrar las conexiones detectadas.

---

## Cómo se usa este índice

- Se relee cada vez que se replantea el roadmap (§19, `docs/proyecto/index.md` tiene el mapa completo) o cuando el usuario trae señal externa nueva sobre dolores de usuarios.
- Una idea sale de acá cuando: (a) se promueve a un paso de roadmap concreto en `docs/proyecto/`, o (b) se descarta explícitamente con motivo (como la idea 2).
- Diseños parciales que arrancan desde acá dejan su recorte en `deferred/index.md`, no acá — este archivo es el índice de "qué direcciones existen", no el detalle de "qué se decidió posponer dentro de una ya iniciada".
