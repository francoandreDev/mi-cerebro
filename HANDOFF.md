# Handoff — íconos + animaciones en todas las páginas

## Contexto

El usuario pidió: "pasa página por página poniendo más íconos, sobre todo en filtros y acciones debe haber ícono. Y me gustó mucho la animación que pusiste, sería bueno si pudieras poner más animaciones y más íconos de manera predeterminada".

Confirmó arranque con "arranca nomás". El alcance original (visto en `/reminders`) se está replicando feature por feature.

**Antes de seguir, leé `PROYECTO.md`** (regla CLAUDE.md). Single source of truth.

## Sistema compartido ya listo

- `src/styles/_animations.scss` — keyframes `mc-anim-*-kf` + utility classes `mc-anim-*` (`spark`, `pulse`, `pop`, `slide-up`, `fade-in`, `shake`, `bounce-soft`, `spin`, `float`, `glow`, `check`, `wiggle`) + hover helpers `mc-hover-grow`, `mc-hover-spin`, `mc-hover-wiggle`. Respeta `prefers-reduced-motion`.
- `src/styles.scss` ya importa `@use 'styles/animations';`.
- `scripts/generate-icons.mjs` — bloque "extra icons batch" agregado. Total: 105 íconos en `icons.data.ts`. Si hace falta más, agregar al script y correr `bun scripts/generate-icons.mjs`.
- **Nota LSP**: el language-server a veces queda stale tras regenerar íconos y marca falsos `TS2322 not assignable to IconName`. Si el build verde, ignorar y seguir.

## Patrones establecidos (replicar)

### Editor-pane (notes/tasks/lists/goals — listos)

- `mc-icon` título a la izquierda (`note`/`check-square`/`list-bullets`/`target`).
- Status badge animado: `statusIcon()` → `'spinner-gap'` (saving, con `mc-anim-spin`), `'warning'` (unsaved, `mc-anim-pulse`), `'check'` (saved).
- Botón danger con `<mc-icon name="trash" />` + clase `mc-hover-wiggle`.

### Container/empty state

- Ícono grande de la entidad + `class="empty-icon mc-anim-float"` + opacity 0.55 + color accent.

### Filtros y toolbars

- `funnel` para filtro general, `magnifying-glass` en search inputs (posicionado absolute), `tag` en tag chips, `broom` para limpiar, `caret-down` para dropdowns, `plus` para agregar, `x` para cerrar/quitar.
- Chips activos: `mc-anim-pop` al aparecer.

### Listas/items

- Bullet `dot-outline` (pendiente) vs `check` (hecho, color success).
- `mc-anim-slide-up` al entrar.

### Kind colors (por `[attr.data-kind]`)

- task → `--mc-accent-primary`
- goal → `--mc-warn`
- reminder → `--mc-danger`

## Estado por feature

| Feature    | Estado             | Notas                                                           |
| ---------- | ------------------ | --------------------------------------------------------------- |
| reminders  | ✅ (sesión previa) | Referencia visual                                               |
| tasks      | ✅                 | editor-pane + container + due-dates-picker                      |
| lists      | ✅                 | editor-pane + container                                         |
| goals      | ✅                 | editor-pane + container + deadline-picker                       |
| notes      | ✅                 | editor-pane + container                                         |
| calendar   | ✅                 | toolbar, container, kind-card, tag-filter, day-modal, day-panel |
| files      | ✅                 | meta-bar, grid, index-rail, container                           |
| images     | ✅                 | meta-bar, grid, galleries-index, galleries                      |
| search     | ✅                 | command-palette con iconForKind                                 |
| trash      | ✅                 | filter-bar (KIND_ICON), container, card                         |
| settings   | ✅                 | sections con icon, remote/export buttons                        |
| history    | ✅                 | toolbar, toggles, milestone-mark, commit-restore                |
| books      | ✅                 | bookshelf + book-meta-bar                                       |
| music      | ✅                 | playlists, library, bulk-bar, lib-search                        |
| writings   | ✅                 | editor-pane + container empty                                   |
| variants   | ✅                 | container, tree, detail (acciones con icon+anim)                |
| sync       | ✅                 | container (push/fetch animados, not-configured)                 |
| onboarding | ✅                 | welcome, permission-banner, foreign, loading, unsupported       |

## Estado

**Completo.** Todas las features pasaron con `bun run build` verde. Si surge un pedido nuevo del usuario sobre iconos/anims, replicar los patrones de "Patrones establecidos" arriba.

## Verificación al cerrar cada feature

```bash
bun run build
```

Debe quedar verde. Mid-way ya verifiqué: "Application bundle generation complete. [27.393 seconds]".

## Reglas duras del repo (CLAUDE.md / PROYECTO.md)

- UI español, código/commits inglés.
- TS strict, sin `any`, signals, OnPush, standalone.
- Aliases `@core/...`, `@features/...`, `@shared/...`, `@styles/...`.
- Files: soft 200 / hard 300 líneas.
- Sin cross-feature imports (regla 10).
- Shortcuts vía `ShortcutsService`.
- Errores como `MCB-<area>-<num>` en `docs/errors.md`.
- Decisiones diferidas en `docs/deferred.md`.
- Si una decisión arquitectónica cambia, el mismo commit actualiza `PROYECTO.md` (regla §4.11.25).

## Tip de continuidad

El TaskList previo estaba en #6 (files = in_progress). Reconstruirlo al arrancar la nueva sesión con TaskCreate, copiando el orden de la tabla de "Estado por feature".
