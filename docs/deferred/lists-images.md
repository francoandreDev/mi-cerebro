# Diferidos — Listas y imágenes

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Listas — Tiza sobre pizarra (origen: schema v4, 2026-06-25)

### Estilo "pizarra de verdad" en todo el pane

- **Qué**: el fondo del pane `/lists/:id` hoy mantiene la superficie base (tema activo). La metáfora "pizarra" se transmite por la paleta de tizas y el panel oscuro de la toolbar; ir más lejos implicaría restilizar el editor TipTap (texto claro sobre fondo verde-pizarra) y cargar fuente "Caveat" en el body.
- **Por qué se difirió**: restilizar el editor toca CSS variables transversales y rompe el modo lectura cuando otra pestaña tiene el lock. Mejor dejar el editor con su look estándar y que la pizarra sea la capa de tiza encima. Si el usuario lo pide, se cablea con un toggle "vista pizarra completa".
- **Target**: sin asignar.

## Imágenes — Museo (origen: rediseño /images, 2026-06-25)

### Sala 3D real (three.js + angular-three)

- **Qué**: convertir la sala del museo en un espacio 3D navegable en primera persona. Stack previsto: **three.js** como motor (escena con paredes `Mesh`, cuadros `PlaneGeometry` texturizados, `PerspectiveCamera` con WASD/drag o pointer-lock, spotlight cenital real, sombras proyectadas, raycasting para hover/click en cuadros) integrado vía **angular-three (NGT)** — wrapper idiomático que expone three con sintaxis declarativa Angular (signals + componentes), evitando manejar manualmente el render loop y la sincronización con el ciclo de vida. Esto entra en una **fase futura cross-página de migración 3D** (no sólo /images: también /books como libro físico real, /lists como pizarra con tiza volumétrica, etc.).
- **Por qué se difirió**: el v1 del museo es 2D con asimetría auto + luz cenital simulada por CSS gradient. Resuelve la metáfora con cero deps y mantiene la base sólida. El salto a 3D real es una fase de polish transversal que conviene hacer cuando todas las páginas tengan su v1 2D estable, para definir la lib + convenciones una sola vez.
- **Target**: fase futura de migración 3D (sin número aún en §19).
