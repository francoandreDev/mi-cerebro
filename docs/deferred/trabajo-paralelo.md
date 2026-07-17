# Diferidos — trabajo paralelo

Regla para cuando se decide atacar varios ítems de `docs/deferred/` en simultáneo (varios agentes / varias sesiones) en lugar de uno por vez. Complementa la regla §4.11.25b de `docs/proyecto/reglas.md` — no la reemplaza: cada ítem resuelto sigue debiendo salir de su archivo de tema en el mismo commit que lo cierra.

---

## Cuándo aplica

Solo cuando hay **más de un ítem de deferred** que se quiere resolver en la misma ventana de tiempo. Para un ítem suelto, no hace falta nada de esto: se trabaja directo en `main` como siempre.

## Regla de agrupación

**Un lote paralelo agrupa temas, no ítems sueltos dentro de un mismo tema.** Cada agente/worktree toma un archivo de `docs/deferred/*.md` completo (o un subconjunto de ítems de ese archivo), nunca ítems de dos temas distintos a la vez.

Antes de armar el lote, chequear que los temas elegidos sean **desacoplados** entre sí:

- **No comparten archivos de código fuente** (mismo componente, mismo servicio, mismo store) más allá de shells genéricos (layout, routing raíz).
- **No comparten una sección de `docs/proyecto/`.** Si dos temas apuntan a la misma sección (§) o al mismo archivo (`features.md`, `roadmap-*.md`, etc.), van en lotes separados — la regla §4.11.25 exige que el commit que cierra el ítem actualice ese archivo, y dos agentes escribiendo la misma sección en paralelo es la forma garantizada de pisarse.
- **No hay dependencia funcional entre ellos** (uno necesita que el otro exista primero).

Temas grandes y con alta superficie de acoplamiento (`versionado.md`, `reminders-goals.md`, `files-writings-tasks.md`) no entran en un lote junto con otro tema — si se atacan, van solos o subdivididos en su propio lote.

Tamaño de lote recomendado: **2-3 temas**. Más que eso, el costo de revisión y merge supera la ganancia de velocidad.

## Mecánica

- Un **worktree de git por tema** (`git worktree add`), rama propia por worktree.
- Cada worktree corre de forma aislada: no tocan el mismo `node_modules` instalado si eso genera conflicto de proceso, no comparten dev server.
- `docs/deferred/index.md` y `docs/proyecto/index.md` son **puntos de contención compartidos** aunque los temas estén desacoplados: si un worktree cierra un tema entero (archivo vacío → se borra y se saca del índice), ese cambio al índice se aísla en su propio commit final para minimizar el conflicto de merge con los otros.

## Orden de merge

1. Mergear los worktrees a `main` **de a uno**, no todos juntos.
2. Después de cada merge, rebasear los worktrees restantes contra `main` antes de seguir, sobre todo si tocaron `docs/proyecto/` o `docs/deferred/index.md`.
3. Si dos worktrees terminan generando un conflicto real pese a la agrupación por desacople, tratarlo como señal de que el chequeo de agrupación falló — no forzar el merge, resolver y anotar por qué para el próximo lote.

## Registro

Cada ítem resuelto sigue la regla §4.11.25b sin excepción: se borra del archivo de tema en el mismo commit que lo cierra, y si el archivo queda vacío se borra y se saca de `docs/deferred/index.md`. El trabajo paralelo no cambia esa mecánica, solo el hecho de que ocurre en varios worktrees a la vez.
