# Roadmap — item 26 (tutorial guiado por página)

Parte de la especificación de `mi-cerebro`. Ver [`index.md`](./index.md) para el mapa completo y las reglas transversales (§4, en [`reglas.md`](./reglas.md)).

---

26. **Tutorial guiado por página, fallback del diseño auto-explicativo (§4.6.15b).** Disparado por dos auditorías de UX seguidas (descubribilidad y "usuario cero") que encontraron el mismo patrón: gestos reales (shift-click multi-selección en Metas, los 3 modos de Historial, la toolbar completa de "modo tiza" en Listas) sin ninguna vía de descubrimiento salvo tropezar con ellos o leer el manual estático en `/`. Decisión explícita: el tutorial es un **fallback**, no reemplaza el trabajo de hints/leyendas ya en curso — cubre lo que un hint estático no puede narrar (una secuencia, no solo el significado de un símbolo).

**Fase 1 — fundamento + piloto en Historial.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 2 — Metas y Listas.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 3 — cobertura completa (17/17) + flujos cross-página reales.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 4 — corrección de anchors mal colocados.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 7 — profundidad cross-página real.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 5 — pasos que se practican, no solo se leen.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 6 — copy dedicado, no reciclado de home-content.ts.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

**Fase 8 — cuatro huecos frente al estándar de onboarding.** _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._ Subdividida en los ítems 8.1-8.94 de abajo, todos cerrados.

### 8.1 — Engine: `tier`, `moreDetail`, `start(id, mode)` — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.2 — Bug: Goals steps 5-6 describen un gesto que no existe en `/goals` — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.3 — Bug: Music `mini-player` step sin `skipIfMissing` — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.4 — Empty state roto: Calendar wallboard sin bloque `@empty` — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.5 — Empty state que miente: Notes `/notes/:id` sin nota seleccionada — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.6 — Empty states: resto del pase (Goals, Lists, Writings, Tags, Music, Files) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.7 — Checklist de onboarding en Home — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.8 — Notes: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.9 — Tasks: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.10 — Settings: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.11 — Variants: cobertura completa, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.12 — Files: cobertura moderada, multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.13 — Tags: split del step `rowActions`, multi-flujo condicional (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.14 — Lists: multi-flujo, tiza + organización (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.15 — Dashboard: ajuste menor. Music: multi-flujo (re-scoped por 8.85) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.16 — Command Palette: tutorial nuevo + capacidad de engine "anclar dentro de overlay" — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.17 — Sync: tutorial nuevo + gating por `isConfigured()` — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.18 — Engine: selector de tutorial (múltiples flujos por página) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.85 — Investigación + diseño: afinar 8.18 para que el multi-flujo fluya en las 17 páginas — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.86 — Transversal: carpetas se repite en 5+ páginas — ¿un flujo por página o contenido compartido? — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.87 — Goals: cobertura completa, multi-flujo (nunca tuvo ítem propio) — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.88 — Calendar: multi-flujo, agenda semanal — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.89 — Reminders: multi-flujo, atajos + posponer — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.90 — Books: cobertura completa, la superficie más grande de la auditoría — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.91 — Images: ajustes menores, sin flujo nuevo — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.92 — Writings: flujo nuevo para el modal de biblioteca — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.93 — History: flujo nuevo para restaurar — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

### 8.94 — Trash: ajustes menores, sin flujo nuevo — _Cerrado — ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md)._

Ítem 26 cerrado por completo (8.1-8.94, 17/17 páginas + Command Palette + Sync). Ver [`docs/sistema/tutoriales-atajos.md`](../sistema/tutoriales-atajos.md) para el inventario vigente.
