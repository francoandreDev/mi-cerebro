# Redesign `/tasks` — bitácora

Persistencia del rediseño de `/tasks`. Sirve para retomar el trabajo en otra sesión sin perder contexto. Convive con `docs/redesign.md` (índice general por página); este archivo guarda el detalle del trabajo en curso y se elimina cuando la tabla principal marque `/tasks` como ✅ con la nueva metáfora.

## Estado

El `/tasks` actual es kanban clásico de tres columnas (Hoy / Esta semana / Backlog) con DnD. Funciona pero comparte forma con el patrón genérico de board que no participa del lenguaje físico que se viene construyendo en el resto de las páginas (chalkboard en `/lists`, constellation en `/goals`, cork en `/files`, library en `/writings`, ticker/typewriter en `/notes`).

**Nueva metáfora elegida: jardín de tres canteros.** Cada horizonte temporal es un cantero con un estadio de crecimiento distinto:

- **HOY · floración** — plantas en flor (corola del color del tag principal).
- **ESTA SEMANA · brote** — tallos verdes con hojas.
- **BACKLOG · semilla** — semillas apenas asomando en tierra seca.

Mover una task entre horizontes = **trasplantar** la plantita (DnD con raíces colgando y terrones cayendo). Cerrar una task = **cosechar** (salta en arco a una cestita en el borde inferior del cantero HOY). Tasks que llevan >3 días en HOY sin cerrarse empiezan a **marchitarse** progresivamente (pétalos caídos, tallo curvado). Hay un toggle opcional 🚿 **riego** que permite "regar" tasks de backlog/semana para subirlas una posición.

## Mockup ASCII (final, validado)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ✓ Tareas                                       [+ sembrar]      [filtros]   ║
║  🌞 día  ◉─○ 🌙 noche       🚿 modo riego: off       ❀ 2 · 🌱 2 · ⋄ 14       ║
╚══════════════════════════════════════════════════════════════════════════════╝

  ╔══ HOY · floración ═══════╗  ╔══ SEMANA · brote ═══════╗  ╔══ BACKLOG · semilla ════╗
  ║                          ║  ║                          ║  ║                          ║
  ║          ❀               ║  ║                          ║  ║   ·   ·   ·   ·   ·     ║
  ║         ╱│╲              ║  ║         ╿                ║  ║                          ║
  ║        ─┴─┴─             ║  ║         ┴                ║  ║   ┌────────────────────┐ ║
  ║   ┌──────────────────┐   ║  ║    ┌──────────────────┐  ║  ║   │ ⋄ pwa shell        │ ║
  ║   │ LLAMAR AL BANCO  │   ║  ║    │ terminar /notes  │  ║  ║   └────────────────────┘ ║
  ║   │ #urgente · 11:00 │   ║  ║    │ #ui · jue        │  ║  ║   ┌────────────────────┐ ║
  ║   └────────╪─────────┘   ║  ║    └────────╪─────────┘  ║  ║   │ ⋄ actualizar docs  │ ║
  ║▒▒▒▒▒▒▒▒▒▒▒╪▒▒▒▒▒▒▒▒▒▒▒▒▒║  ║▒▒▒▒▒▒▒▒▒▒▒▒╪▒▒▒▒▒▒▒▒▒▒▒▒║  ║   └────────────────────┘ ║
  ║░░░░░░░░░░╱│╲░░░░░░░░░░░░║  ║░░░░░░░░░░░░│░░░░░░░░░░░░║  ║   ┌────────────────────┐ ║
  ║                          ║  ║                          ║  ║   │ ⋄ paper libsql     │ ║
  ║          ❀               ║  ║         ╿                ║  ║   └────────────────────┘ ║
  ║         ╱│╲              ║  ║         ┴                ║  ║   ┌────────────────────┐ ║
  ║        ─┴─┴─             ║  ║                          ║  ║   │ ⋄ refactor router  │ ║
  ║   ┌──────────────────┐   ║  ║    ┌──────────────────┐  ║  ║   └────────────────────┘ ║
  ║   │ REVISAR PR AUTH  │   ║  ║    │ mail a contadora │  ║  ║                          ║
  ║   │ #code            │   ║  ║    │                  │  ║  ║       · +10 sumergidas · ║
  ║   └────────╪─────────┘   ║  ║    └────────╪─────────┘  ║  ║         🚿 cargar más ▾  ║
  ║▒▒▒▒▒▒▒▒▒▒▒╪▒▒▒▒▒▒▒▒▒▒▒▒▒║  ║▒▒▒▒▒▒▒▒▒▒▒▒╪▒▒▒▒▒▒▒▒▒▒▒▒║  ║                          ║
  ║░░░░░░░░░░╱│╲░░░░░░░░░░░░║  ║░░░░░░░░░░░░│░░░░░░░░░░░░║  ║░░░░░░ semillero seco ░░░░║
  ║                          ║  ║                          ║  ║                          ║
  ║   ┌── cesta de cosecha ─┐║  ║                          ║  ║                          ║
  ║   │ ✓ ✓ ✓  3 cosechadas │║  ║                          ║  ║                          ║
  ║   └─────────────────────┘║  ║                          ║  ║                          ║
  ╚══════════════════════════╝  ╚══════════════════════════╝  ╚══════════════════════════╝
```

### Drag preview

```
─── arrastrando "paper libsql" desde semillero hacia cantero del medio ────────────

  ╔══ SEMANA · brote ═══════╗
  ║                          ║   ⋮  raíces colgando con
  ║    ✋ ┌────────────────┐ ║       terrones cayendo:
  ║    ╱┃ │ paper libsql   │ ║       . · ∙ .   (animación)
  ║    ┃┃ └────────────────┘ ║
  ║   ╱┃                     ║   → al soltar:
  ║  ─┘┴─                    ║       crecimiento ⋄ → ╿
  ║                          ║       (260ms ease-out)
  ╚══════════════════════════╝
```

### Marchitamiento

```
─── 4 días en HOY sin terminar ────────────

   ❀                              tareas en HOY más de 3 días sin
    ╲ ← pétalo caído               cerrar empiezan a marchitarse:
   ─┴─┴─                            - pétalos amarillos
   ┌──────────────────┐              - tallo curvado
   │ comprar regalo   │              - sin agresividad: solo aspecto
   │ #personal        │              - efecto reversible si se cierra
   └────────╪─────────┘
```

## Sistema visual

| Estadio   | Glyph        | Tarjeta                                           | Suelo              |
| --------- | ------------ | ------------------------------------------------- | ------------------ |
| Semilla   | `⋄` `·`      | Compacta, mono minúscula, gris 40%                | Beige seco `░`     |
| Brote     | `╿─┴─`       | Media, sans minúscula, gris 70%                   | Marrón húmedo `▒░` |
| Floración | `❀╱│╲ ─┴─┴─` | Grande, mayúsculas peso 600, color tag en pétalos | Marrón fértil `▓▒` |

La flor de HOY toma su color de la corola del tag principal de la task (los tags se vuelven "especies"). Si la task no tiene tag: flor blanca neutra.

> **Importante**: el ASCII de los glyphs es solo conceptual. En implementación cada estadio es un mini-SVG inline (`seed.svg`, `sprout.svg`, `bloom.svg`). El `bloom.svg` se parametriza con `currentColor` para teñir los pétalos según el tag.

## Interacciones

- **DnD trasplantar**: al arrastrar, la tarjeta sale del cantero con raíces visibles (3-4 hilitos colgantes) y va dejando un rastro de terrones (microspans que caen y se desvanecen). Al soltar, animación de crecimiento o regresión según el destino: el glyph muta `⋄ → ╿ → ❀` (o al revés) con 260 ms `ease-out` y un _plop_ visual al asentarse.
- **Cesta de cosecha** (en HOY): las tasks marcadas `done` saltan en arco a una cestita en el borde inferior del cantero, donde quedan apiladas (las 3 últimas visibles, resto archivado). Reemplaza al tendedero del cuarto oscuro descartado.
- **Marchitamiento**: tasks en HOY >3 días sin cerrar pierden pétalos progresivamente (día 4 = 1 pétalo caído, día 5+ = tallo curvado, hojas amarillas). Reversible al instante si se completa o se trasplanta. Sin texto explícito, solo lectura visual. La fecha de entrada a HOY se calcula a partir del timestamp de mutación de horizonte (hay que asegurarse de que el modelo guarde ese momento; si hoy no lo tiene, agregar `enteredHoyAt: ISOString` al schema con migration).
- **Riego (toggle opcional)** 🚿: al activarlo en el header, aparece un ícono regadera flotante con el cursor. Clic sobre una task en backlog/semana hace una micro-animación de chorro y mueve la task una posición arriba en su cantero (mecánica de "prioridad por riego"). Off por defecto. Estado persistido en `SettingsService` como pref de usuario.
- **Cargar más** en backlog: las semillas restantes "emergen" del semillero deslizándose hacia arriba.

## Modos de paleta

- 🌞 **Día** (default): cielo crema, canteros madera, tierra marrón, follaje verde, flores en color del tag.
- 🌙 **Noche**: cielo añil profundo, canteros madera oscura, tierra negra, plantas con halo bioluminiscente sutil (los pétalos brillan un poquito). Toggle en el header. Persistido como pref local del jardín, independiente del tema general de la app.

## Tokens nuevos

En `src/styles/tokens.css` (o donde estén los tokens de pages):

```
--mc-garden-soil-fertile
--mc-garden-soil-dirty
--mc-garden-soil-dry
--mc-garden-planter-wood-fg
--mc-garden-planter-wood-bg
--mc-garden-stem
--mc-garden-petal-default
--mc-garden-petal-wilted
--mc-garden-bioluminescent-halo
--mc-garden-night-bg
```

Las flores en HOY usan `color-mix(in srgb, var(--mc-tag-{id}) 80%, white)` para la corola, derivado del color del tag.

## Componentes

- `planter.component.ts` (dumb) — recibe `stage: 'seed' | 'sprout' | 'bloom'` y proyecta children. Maneja el suelo, el header del cantero y la cesta de cosecha (solo cuando `stage === 'bloom'`).
- `plant-card.component.ts` (dumb) — la tarjeta con el plantita-glyph + label. El glyph se elige por el `stage` heredado del contenedor (vía input).
- `harvest-basket.component.ts` (dumb) — la cestita de done en el cantero HOY.
- `tasks-garden.container.ts` (smart) — orquesta DnD, persistencia, riego, día/noche, cálculo de marchitamiento por timestamp.

Borrar: lo que quede del kanban anterior (containers viejos, componentes de columna) si no se reutiliza. Aplicar YAGNI como con `/notes`.

## i18n

Strings nuevos en `src/app/core/i18n/locales/es.ts` (regla 8 — UI en español, código en inglés):

```
'tasks.garden.headerTitle': '✓ Tareas',
'tasks.garden.newAction': '+ sembrar',
'tasks.garden.toggleDay': 'Día',
'tasks.garden.toggleNight': 'Noche',
'tasks.garden.toggleWatering': 'Modo riego',
'tasks.garden.planterToday': 'HOY · floración',
'tasks.garden.planterWeek': 'ESTA SEMANA · brote',
'tasks.garden.planterBacklog': 'BACKLOG · semilla',
'tasks.garden.harvestBasket': 'Cesta de cosecha',
'tasks.garden.loadMore': 'cargar más',
'tasks.garden.empty.today': 'sin floraciones por hoy',
'tasks.garden.empty.week': 'sin brotes esta semana',
'tasks.garden.empty.backlog': 'semillero vacío',
'tasks.garden.aria.transplanted': 'tarea {title} trasplantada a {stage}',
'tasks.garden.aria.harvested': 'tarea {title} cosechada',
'tasks.garden.aria.wilting': '{title}: {days} días sin completar',
```

Los keys exactos pueden ajustarse al estilo del archivo. Tipos derivados (no hace falta tocar `i18n.types.ts`).

## Accesibilidad

- **WCAG AA** en toda la pirámide de contraste. El "fantasma" del semillero solo afecta el chrome (bordes, halo), nunca el título.
- **`prefers-reduced-motion`**: corta el shimmer del suelo, la trayectoria de raíces y la animación de crecimiento. El glyph cambia de forma instantánea, sin morfismo.
- **DnD por teclado**: `Enter` sobre una task abre selector "trasplantar a → Hoy / Semana / Backlog / Cosechar".
- **ARIA-live** al trasplantar: _"tarea X trasplantada a floración"_.
- **Marchitamiento** describe el estado vía `aria-label` (_"task X: 4 días sin completar"_), no solo visual.

## Riesgos asumidos

- La metáfora orgánica corre riesgo de leerse infantil. Mitigación: tipografía sobria (mono para metadatos, sans para títulos, igual al resto del repo), ASCII-art moderado en SVG, sin emojis salvo el toggle 🌞/🌙 del header.
- Coordinación con tags: si el usuario tiene 10 tags con colores parecidos, el cantero de HOY se vuelve un campo monocromo. Aceptable — refleja la realidad de las prioridades del día.

## Pasos de implementación (orden sugerido)

Antes de tocar código, leer `PROYECTO.md` (regla del repo) y leer este archivo entero.

1. **Inventario actual**: leer todo `src/app/features/tasks/` (containers, components, services, models, types). Identificar qué se conserva (services, types, persistencia) y qué se reemplaza (containers, componentes de columna kanban).
2. **Schema check**: revisar `task.types.ts` y servicio. Si no hay timestamp de "entrada a HOY", agregar `enteredHoyAt` con migration (regla §4 sobre schema versionado en `PROYECTO.md`). Si el servicio actualiza el horizonte de la task, hay que actualizar ese campo en simultáneo.
3. **Tokens** (`src/styles/tokens.css` o equivalente): agregar los `--mc-garden-*` listados arriba. Variantes día/noche.
4. **SVG assets**: `src/assets/icons/garden/seed.svg`, `sprout.svg`, `bloom.svg`. `bloom.svg` usa `currentColor` para los pétalos.
5. **Componentes dumb** en `src/app/features/tasks/components/`:
   - `planter.component.ts` + `.css`
   - `plant-card.component.ts` + `.css`
   - `harvest-basket.component.ts` + `.css`
     Selector `mc-planter`, `mc-plant-card`, `mc-harvest-basket`. OnPush, signals, sin estado interno fuera de `input`/`output`/`computed`.
6. **Container smart**: `tasks-garden.container.{ts,html,css}` en `src/app/features/tasks/containers/`. Reemplaza al container kanban anterior. Orquesta:
   - filtros y búsqueda (mover de containers viejos si existen)
   - DnD entre canteros
   - cosecha al marcar done
   - cálculo de marchitamiento por `enteredHoyAt`
   - toggle día/noche persistido
   - toggle riego persistido
7. **Routing**: actualizar la entrada de `/tasks` para que apunte al nuevo container.
8. **Borrar lo viejo**: containers/componentes del kanban anterior si quedan sin uso (YAGNI, sin shims de retrocompat).
9. **i18n**: agregar strings nuevos en `es.ts`. Validar que no quede texto hardcodeado en HTML/CSS (regla 8).
10. **a11y**: probar tab order, `Enter` abre selector de transplante, anuncios ARIA-live, `prefers-reduced-motion` cortando animaciones.
11. **Type check**: `bunx tsc --noEmit` debe pasar limpio.
12. **Verificación visual**: arrancar `bun start` y verificar en navegador (mismo modus operandi de `/notes`).
13. **Update `docs/redesign.md`**: cambiar la fila de `/tasks` de "Tres columnas por horizonte" a "Jardín de tres canteros · floración/brote/semilla" y mantener ✅ cuando esté terminado. Borrar este archivo (`redesign-tasks.md`) cuando esté ✅.
14. **`PROYECTO.md` §4.11.25**: si la implementación cambia alguna decisión arquitectónica documentada, actualizar `PROYECTO.md` **en el mismo commit**.

## Convenciones del repo a respetar

- UI en español, código y commits en inglés.
- OnPush en todos los componentes. Signals (`input`/`output`/`computed`) sobre `@Input`/`@Output`.
- Standalone components.
- Sin `any`, `noUncheckedIndexedAccess`.
- Strict TypeScript.
- Tamaño de archivo: 200 líneas soft, 300 hard.
- Smart (`containers/`) vs dumb (`components/`).
- i18n centralizado en `es.ts`, **nunca** strings en HTML/CSS.
- File System Access API para persistencia (no localStorage para datos del usuario).
- No tocar `services/` salvo lo mínimo necesario para soportar el nuevo schema (`enteredHoyAt`) y/o las nuevas operaciones (cosechar, regar).
