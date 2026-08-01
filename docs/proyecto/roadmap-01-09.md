# Roadmap — items 1-9 (scaffolding a resto de entidades)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

## 19. Roadmap inicial (orden propuesto)

1.  **Scaffolding** Angular 21 + bun + PWA + estructura de carpetas src + linter + Prettier + Husky.
2.  **Core errors + i18n + theme** (base mínima para que el resto se monte ordenado).
3.  **FS Access + onboarding + permisos** (incluye `FsService`, persistencia del handle, banner de re-autorización).
4.  **Migrations base + AutosaveService + IndexedDB drafts** (toda la red de seguridad antes de la primera entidad).
5.  **Notes** como primer tipo end-to-end: crear, listar en árbol, editar (editor básico TipTap), guardar a disco con escritura atómica.
6.  **Árbol con filtro inteligente** (la búsqueda navegacional).
7.  **Tags transversales y búsqueda global** (dividido en dos sub-pasos):
    - **7a.** Tags transversales. _Cerrado — ver [`docs/sistema/busqueda-tags.md`](../sistema/busqueda-tags.md)._
    - **7b.** Búsqueda global indexada con MiniSearch persistido en IndexedDB; paleta `Ctrl+K`; filtro del árbol también busca tags; limpieza lazy de tag-refs muertos.
8.  **Concurrencia entre pestañas** (BroadcastChannel + locks). Dividido en sub-pasos:
    - **8a.** `LockService` genérico + canal `mc-locks`. _Cerrado — ver [`docs/sistema/fundamentos.md`](../sistema/fundamentos.md)._
    - **8b.** Integración del lock en `NotesContainer`. _Cerrado — ver [`docs/sistema/fundamentos.md`](../sistema/fundamentos.md)._
9.  **Resto de entidades**: tasks, goals, lists, writings, images, files. Incluye filtros por tipo en el árbol (combinaciones notas+tasks+goals descritas en §10), que sólo cobran sentido cuando existe la segunda entidad. Subdividido por entidad:
    - **9a.** Tasks como segunda entidad end-to-end + reestructuración a sidebar global. _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9b.** Goals como tercera entidad end-to-end. _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9d.** Writings — sólo artículos sueltos como quinta entidad end-to-end. _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9d-bis.** Books como sexta entidad end-to-end (forma "carpeta + capítulos"). _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9c.** Lists como cuarta entidad end-to-end. _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9e.** Images como séptima entidad end-to-end (primera entidad con binarios). _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9j.** Pulido de §9 — vista previa inline para items previewables en colecciones de archivos. _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9i.** Pulido de §9 — imagen-referencia dentro de cualquier editor TipTap (notas, escritos, capítulos de libros, metas). _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9h.** Pulido de §9 — pegar imagen desde clipboard en galerías. _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9g.** Pulido de §9 — drag-and-drop para reordenar items en las tres entidades con `order: string[]` (image-grid, file-grid, chapter-list). _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
    - **9f.** Files como octava entidad end-to-end (segunda entidad con binarios; cierra la familia de adjuntos). _Cerrado — ver [`docs/sistema/entidades.md`](../sistema/entidades.md)._
