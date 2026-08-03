# Diferido — testing

Ver [`index.md`](./index.md) para el formato de entrada y el resto de temas.

---

- **Qué**: cobertura e2e (Playwright) de crear/editar/borrar para las 7 entidades restantes (Tasks, Goals, Lists, Writings, Books, Images, Files) — hoy sólo Notes tiene un spec CRUD completo (`e2e/notes-crud.spec.ts`), más `onboarding.spec.ts` y `navigation.spec.ts` (básicos, cross-entidad).
- **Por qué se difirió**: el ítem 24 pedía explícitamente un "primer set de specs" para validar el enfoque (config + adapter `E2eNativeFs` + un flujo real) antes de replicarlo 7 veces; ver [`docs/sistema/testing.md`](../sistema/testing.md).
- **Target**: sin asignar.
- **Origen**: ítem 24 (`docs/proyecto/roadmap-22-25.md`).
