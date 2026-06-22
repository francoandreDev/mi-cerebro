# Redesign por página

Migración progresiva: cada página de entidad/herramienta deja de depender del **section pane** secundario de la sidebar global y adopta un layout propio que aprovecha todo el ancho. El rail vertical (íconos de entidad) se mantiene; lo que se oculta es el panel intermedio (árbol/lista contextual).

## Mecanismo

El sidebar global lee `PANE_HIDDEN_PREFIXES` en `layout/containers/workspace-sidebar.container.ts`. Cualquier ruta listada ahí renderiza solo el rail y le da el ancho restante al `<router-outlet>`. Migrar una página = agregar su prefijo a esa lista + diseñar el layout interno de la página.

## Principio

Una idea distinta por página. No replicar el mismo patrón: cada entidad tiene una forma natural de mostrarse (estantería, galería, grid de cards, tabs, etc.). El section pane era un mínimo común denominador; el redesign apuesta a lo opuesto.

## Estado por página

| Ruta         | Idea del redesign                                                           | Estado |
| ------------ | --------------------------------------------------------------------------- | ------ |
| `/books`     | Estantería + page-turn 3D flip con paper bend en lectura                    | ✅     |
| `/images`    | Gallery wall index + justified inner grid                                   | ✅     |
| `/trash`     | Grid visual de cards con filtro por kind, búsqueda y modal detalle          | ✅     |
| `/settings`  | Tabs verticales sticky + panel (sección activa única)                       | ✅     |
| `/history`   | (heredado, sin section pane)                                                | ✅     |
| `/variants`  | (heredado, sin section pane)                                                | ✅     |
| `/notes`     | Muro de stickies (CSS columns) + card "nueva" inline + chips de filtro      | ✅     |
| `/tasks`     | Tres columnas por horizonte (Hoy / Esta semana / Backlog) + búsqueda local  | ✅     |
| `/goals`     | pendiente                                                                   | ⏳     |
| `/lists`     | pendiente                                                                   | ⏳     |
| `/writings`  | pendiente                                                                   | ⏳     |
| `/files`     | Rail interno fijo (260px) con árbol jerárquico + DnD + workbench full-width | ✅     |
| `/music`     | 3 zonas: playlists rail / biblioteca densa / now playing + cola             | ✅     |
| `/calendar`  | Wallboard: grid mes/año + columna cards colapsables por kind + modal de día | ✅     |
| `/reminders` | pendiente                                                                   | ⏳     |
| `/sync`      | pendiente                                                                   | ⏳     |

## Checklist al migrar una página

1. Agregar el prefijo de ruta a `PANE_HIDDEN_PREFIXES`.
2. Diseñar layout propio que justifique el ancho ganado (no estirar el contenido viejo a 100%).
3. Si la página tiene muchas secciones internas, considerar navegación propia (tabs, TOC, cards colapsables).
4. Actualizar la tabla de arriba con la idea elegida + estado.
5. Verificar que el rail (íconos) sigue marcando la entidad activa correctamente.
