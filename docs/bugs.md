# Bugs conocidos

Registro de problemas confirmados que no se resuelven en el commit que los reportó. Cada entrada explica el síntoma, la sospecha, el workaround temporal y el target para arreglarlo.

Formato:

- **Síntoma**: lo que ve el usuario.
- **Sospecha**: hipótesis sobre la causa raíz.
- **Workaround**: cómo usar la app mientras tanto.
- **Target**: paso del roadmap donde se aborda, o "sin asignar".
- **Origen**: paso donde se detectó.

---

## BUG-001 — Ctrl+K no abre la paleta global (origen: paso 7b) — RESUELTO

- **Síntoma**: presionar Ctrl+K caía en la omnibox de Chrome en lugar de abrir la paleta. Persistía con `@HostListener('document:keydown')`, `@HostListener('window:keydown')` y `window.addEventListener('keydown', …, { capture: true })`.
- **Causa real**: el listener tenía que ir en `document` y en fase de burbuja (no `window` ni capture). Con `window + capture`, Chrome interceptaba el atajo antes de que llegara al handler.
- **Fix**: `document.addEventListener('keydown', handler)` (bubble phase) en `command-palette.container.ts`. El botón flotante "🔍" se mantiene como entrada alternativa.
