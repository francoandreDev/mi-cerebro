# mi-cerebro — sistema (índice)

Documentación de **lo que existe hoy**, organizada por parte del sistema — no por cuándo se construyó ni qué falta. Complementa a `docs/proyecto/`:

- `docs/proyecto/` responde "¿qué se decidió y por qué?" — visión, reglas de arquitectura, spec de alto nivel (`features.md`), y el roadmap (qué falta, en qué orden).
- `docs/sistema/` (esta carpeta) responde "¿cómo funciona esto ahora?" — modelos de datos, nombres de servicios y componentes reales, layout en disco, rutas. Presente, sin fechas ni bitácora de sesión.

Cuando un ítem del roadmap cierra, su contenido migra acá y el roadmap queda con un puntero de una línea (regla `docs/proyecto/reglas.md` §4.11.24 — doc desactualizada miente, se actualiza o se borra).

---

| Archivo                                                                                    | Cubre                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`fundamentos.md`](./fundamentos.md)                                                       | Scaffolding, errores, i18n, tema, acceso al file system, migraciones de schema, autosave/drafts, concurrencia entre pestañas (locks).                              |
| [`entidades.md`](./entidades.md)                                                           | El patrón compartido de servicio/editor/lock, y las 8 entidades: notas, tareas, metas, listas, escritos, libros, imágenes, archivos.                               |
| [`carpetas-papelera.md`](./carpetas-papelera.md)                                           | Sistema de carpetas por entidad y papelera (`.mi-cerebro/trash/`).                                                                                                 |
| [`busqueda-tags.md`](./busqueda-tags.md)                                                   | Árbol con filtro, tags transversales, búsqueda global (`Ctrl+K`, tokens `tag:`/`kind:`).                                                                           |
| [`calendario-recordatorios-configuracion.md`](./calendario-recordatorios-configuracion.md) | `/calendar`, `/reminders` (palomar), `SettingsService` + `/settings`.                                                                                              |
| [`musica.md`](./musica.md)                                                                 | Biblioteca, playlists, reproductor, mini-player global.                                                                                                            |
| [`versionado.md`](./versionado.md)                                                         | Autocommits, historial, milestones, variantes (familias de 3 ramas), merge, comentarios y borradores anclados, vista combinada del editor, sync remoto con GitHub. |
| [`temas-export-empaquetado.md`](./temas-export-empaquetado.md)                             | Export ZIP, temas custom, atajos globales, orden manual del árbol, gestión de tags, pulido del editor, focus mode, empaquetado nativo (Tauri/Capacitor).           |
| [`navegacion-descargas-responsive.md`](./navegacion-descargas-responsive.md)               | Slugs legibles en URLs, descarga de MP3 desde YouTube, soporte responsive/mobile.                                                                                  |
| [`dashboard-carpetas-metas-dormidas.md`](./dashboard-carpetas-metas-dormidas.md)           | `/dashboard` y su resurfacing aleatorio, navegación por breadcrumb, dormancia de metas.                                                                            |
| [`tutoriales-atajos.md`](./tutoriales-atajos.md)                                           | Inventario de tutoriales guiados por página y el diálogo de atajos de teclado (arquitectura completa en `reglas.md` §4.6.15b).                                     |
| [`conexiones.md`](./conexiones.md)                                                         | Backlinks/relaciones entre entidades, mapa de 1 salto, hilos manuales en `/files`, modo lista + atajos de fila en tasks/goals.                                     |
| [`testing.md`](./testing.md)                                                               | Unit (Vitest/`ng test`) y e2e (Playwright smoke, `bun run e2e`) — incluye el adapter `E2eNativeFs` que evita el picker nativo de File System Access.               |

Relacionados: [`docs/proyecto/index.md`](../proyecto/index.md) (mapa de `docs/proyecto/`), [`docs/deferred/index.md`](../deferred/index.md) (lo pospuesto, genuinamente pendiente), [`docs/evolution.md`](../evolution.md) (ideas de producto candidatas, sin decidir).
