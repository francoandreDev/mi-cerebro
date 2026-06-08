# Bugs conocidos

Registro de problemas confirmados que no se resuelven en el commit que los reportó. Cada entrada explica el síntoma, la sospecha, el workaround temporal y el target para arreglarlo.

Formato:

- **Síntoma**: lo que ve el usuario.
- **Sospecha**: hipótesis sobre la causa raíz.
- **Workaround**: cómo usar la app mientras tanto.
- **Target**: paso del roadmap donde se aborda, o "sin asignar".
- **Origen**: paso donde se detectó.

---

## BUG-001 — Ctrl+K no abre la paleta global (origen: paso 7b)

- **Síntoma**: presionar Ctrl+K cae en la omnibox de Chrome en lugar de abrir la paleta de búsqueda de mi-cerebro. Lo mismo después de cambiar entre `@HostListener('document:keydown')`, `@HostListener('window:keydown')` y `window.addEventListener('keydown', …, { capture: true })`.
- **Sospecha**: posibles causas a investigar — (a) el componente `mc-command-palette` no llega a montarse cuando se espera (verificar con un `console.log` en su constructor); (b) un service worker viejo está sirviendo un bundle previo al fix; (c) hay un listener anterior en la cadena que cancela la propagación o `preventDefault` no surte efecto por la versión específica de Chrome; (d) `inject(DestroyRef)` dentro de un método privado puede estar rompiendo el contexto de inyección y abortando el constructor sin error visible.
- **Workaround**: usar el botón flotante "🔍" arriba a la derecha (agregado en este mismo commit) para abrir la paleta. El resto de los atajos dentro de la paleta (↑↓, Enter, Esc) funcionan normalmente una vez abierta.
- **Target**: §19.7b — quedó abierto al cierre del paso. A retomar antes de paso 8 o como bug ticket independiente.
- **Origen**: paso 7b.
