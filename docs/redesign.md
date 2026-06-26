# Redesign por página

Migración progresiva: cada página de entidad/herramienta deja de depender del **section pane** secundario de la sidebar global y adopta un layout propio que aprovecha todo el ancho. El rail vertical (íconos de entidad) se mantiene; lo que se oculta es el panel intermedio (árbol/lista contextual).

## Mecanismo

El sidebar global lee `PANE_HIDDEN_PREFIXES` en `layout/containers/workspace-sidebar.container.ts`. Cualquier ruta listada ahí renderiza solo el rail y le da el ancho restante al `<router-outlet>`. Migrar una página = agregar su prefijo a esa lista + diseñar el layout interno de la página.

## Principio

Una idea distinta por página. No replicar el mismo patrón: cada entidad tiene una forma natural de mostrarse (estantería, galería, grid de cards, tabs, etc.). El section pane era un mínimo común denominador; el redesign apuesta a lo opuesto.

## Estado por página

| Ruta         | Idea del redesign                                                                                                                                                                                                                                                                                                                                      | Estado |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `/books`     | Estantería + page-turn 3D flip con paper bend en lectura                                                                                                                                                                                                                                                                                               | ✅     |
| `/images`    | Museo: planta + salas con cuartos auto-paginados + mini-mapa                                                                                                                                                                                                                                                                                           | ✅     |
| `/trash`     | Grid visual de cards con filtro por kind, búsqueda y modal detalle                                                                                                                                                                                                                                                                                     | ✅     |
| `/settings`  | Tabs verticales sticky + panel (sección activa única)                                                                                                                                                                                                                                                                                                  | ✅     |
| `/history`   | (heredado, sin section pane)                                                                                                                                                                                                                                                                                                                           | ✅     |
| `/variants`  | (heredado, sin section pane)                                                                                                                                                                                                                                                                                                                           | ✅     |
| `/notes`     | Muro de stickies (CSS columns) + card "nueva" inline + chips de filtro                                                                                                                                                                                                                                                                                 | ✅     |
| `/tasks`     | Jardín de tres canteros (floración/brote/semilla) + trasplantar (DnD) + cosecha + riego                                                                                                                                                                                                                                                                | ✅     |
| `/goals`     | Wallboard tipográfico: posters grandes en grid auto-fit + filtros + hero create                                                                                                                                                                                                                                                                        | ✅     |
| `/lists`     | Pizarra-directorio: chalkboard + rail A–Z/tag + flow multi-columna, search dim+highlight                                                                                                                                                                                                                                                               | ✅     |
| `/lists/:id` | Editor + capa de tiza (toggle off por default): paleta de tizas, goma, capas con visibilidad/lock/reorden — persistencia en el JSON de la lista (`chalkLayers`, schema v4)                                                                                                                                                                             | ✅     |
| `/writings`  | Biblioteca de borrador: shelf de cards tipográficas + editor full-bleed centrado                                                                                                                                                                                                                                                                       | ✅     |
| `/files`     | Pared de lockers numerados (color = primer tag) + apertura inline (≤6 archivos) u overlay (más)                                                                                                                                                                                                                                                        | ✅     |
| `/music`     | v1 3 zonas (✅). v2 planificado: membrana/superficie resonante central que vibra con waveform real + biblioteca + cola. Ver detalle abajo.                                                                                                                                                                                                             | 🔄     |
| `/calendar`  | v1 wallboard (✅). v2 planificado: vista temporal unificada — mesa de luz con acetatos (mes) + agenda de cuero (semana/día). Ver detalle abajo.                                                                                                                                                                                                        | 🔄     |
| `/reminders` | Palomar de jaulas con palomas mensajeras: puertas se abren progresivamente, paloma vuela (ruta wandering, usa toda la pantalla) al rail icon y picotea al disparar; recurrentes se posan en la campana hasta que el usuario clickea la jaula vacía para llamarla de vuelta; puntuales caen tras picotear. Filtros por fecha/nombre. Ver detalle abajo. | 🔄     |
| `/sync`      | pendiente                                                                                                                                                                                                                                                                                                                                              | ⏳     |

## Planes detallados

### `/calendar` v2 — Mesa de luz + agenda de cuero

**Concepto:** el calendario deja de ser solo "eventos" y se convierte en la **vista temporal unificada del cerebro** (eventos + recordatorios + tareas con fecha + notas con fecha). Ninguna otra sección hace ese cruce hoy, y es donde más valor agrega el módulo.

**Dos modos:**

- **Vista mes = mesa de luz con acetatos.** Grilla temporal de fondo + capas semitransparentes apilables, una por dominio. Toggles encienden/apagan cada capa. Modo "consulta/panorama".
- **Vista semana + día = agenda de cuero encuadernada.** Lomo central, semana a la izquierda, día expandido a la derecha. Post-its para recordatorios, entradas manuscritas para eventos. Modo "anotar/actuar".
- **Transición:** click en un día de la mesa → el día "se levanta" como acetato y se convierte en la página derecha del libro. Cerrar libro → vuelve a la mesa.

**Justificación del contraste material (vidrio/luz vs cuero/papel):** son dos modos del mismo escritorio de arquitecto — mesa de luz para revisar planos, libreta para apuntar.

**Orden de trabajo (multi-sesión):**

1. Servicio unificado: interfaz consultable por rango que junte items con fecha de eventos + recordatorios + tareas + notas. **Auditar primero qué expone cada servicio hoy** (puede haber dominios sin `dueDate` que necesiten modelo antes que visual).
2. Mesa de luz básica: grilla de mes + una sola capa (eventos), toggles vacíos para el resto.
3. Agregar capas restantes una por una, ajustando colores/opacidades para que la superposición se lea.
4. Libro de cuero como zoom día (semana en dos páginas, click día = expansión).
5. Animación de transición mesa↔libro al final — es el "wow", no la utilidad.

**Riesgos a vigilar:**

- Performance con muchos ítems en las capas (evaluar SVG/canvas vs DOM).
- Que vidrio y cuero se sientan dos features distintos en vez de un módulo — la animación de transición es lo que los cose.
- Consistencia de "fecha asociada" entre dominios.

### `/reminders` — Palomar de palomas mensajeras

**Concepto:** palomar de madera con jaulas (arco oscuro + grilla de barrotes como puerta con bisagra superior); cada paloma carga un papelito enrollado con el recordatorio. Conforme se acerca la hora la puerta de la jaula se abre cada vez más; al disparar, la paloma sale volando, picotea el ícono `/reminders` en el rail (donde aparece el toast) y luego vuelve a la jaula (recurrente) o cae rotando (puntual). Original, claro de un vistazo, coherente con el lenguaje físico del repo.

**Mapeo de mecánicas:**

| Mecánica             | Cómo se ve                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear                | Escribir el papelito, enrollarlo; paloma nueva entra a una jaula                                                                            |
| Puntual              | Paloma con anillo transparente, cae rotando tras picotear el ícono                                                                          |
| Recurrente           | Paloma con anillo de colores, vuelve a la jaula con papelito fresco tras picotear                                                           |
| Disparo/notificación | Puerta totalmente abierta, paloma sale, vuela enérgicamente por la pantalla (puede salirse un momento y volver) hasta picotear el rail icon |
| Recall               | Paloma posada en la campana del rail tras picotear; click en jaula vacía → vuela de regreso con el mismo espíritu wandering                 |
| Snooze               | Paloma en la repisa de aterrizaje, reintenta en X min                                                                                       |
| Marcar como hecho    | Tomar el papelito; puntual se va volando, recurrente vuelve a la jaula                                                                      |
| Pausado/silenciado   | Cortinita corrida + puerta forzada cerrada, paloma duerme adentro                                                                           |
| Vencidos sin atender | Palomas cansadas acumuladas en la repisa                                                                                                    |
| Próximos a sonar     | Puerta entreabierta + paloma peeking + glow suave                                                                                           |

**Lectura visual de un vistazo:**

- Activos = palomas en nichos
- Pendientes/debidos = palomas en la repisa
- Urgencia = cuán asomada está la paloma del nicho
- Recurrente vs puntual = color del anillo
- Categoría (opcional) = color/dibujo del nicho o de la paloma

**Detalles bonitos opcionales:** aleteo sutil al salir, plumitas que caen al pasar, plumaje más detallado en palomas recurrentes con muchos ciclos cumplidos, ronroneo en hover sostenido (preview del mensaje).

**Escala:** se resuelve con **filtros por fecha y por nombre de recordatorio** sobre el palomar. Con eso no hay riesgo de saturación visual aunque haya muchos recordatorios. Los filtros son parte del MVP. (Opcional a futuro: palomares temáticos por categoría como salas del museo.)

**Orden de trabajo (multi-sesión):**

1. ✅ Revisar `reminders.service.ts` y modelos asociados para mapear qué mecánicas ya están implementadas.
2. ✅ Componente palomar con jaulas + palomas. Jaula = arco oscuro + grilla de barrotes como puerta, con bisagra superior; abre progresivamente según el bucket (cerrada `later/undated`, leve `thisWeek`, media `tomorrow`, abierta `today`). v1 con schema v4 (recurrence + paused) en su lugar.
3. ✅ Filtros por fecha y nombre.
4. ✅ Estados: recurrente vs puntual (anillo de colores), pausado (cortinita + puerta cerrada forzada), vencido (repisa), próximo a sonar (puerta más abierta + glow).
5. 🔄 Animación de disparo del scheduler implementada (paloma sale de la jaula, vuela en ruta wandering por la pantalla — puede salirse un momento y volver — hasta el rail icon, picotea 3 veces; recurrente se posa en la campana hasta que el usuario haga click en la jaula vacía para llamarla de vuelta, también en ruta wandering; puntual cae rotando tras picotear — flapeo durante todo el vuelo). Snooze y "tomar papelito" manual diferidos a `docs/deferred.md`.
6. ⏳ Detalles opcionales (plumitas, ronroneo, plumaje). → `docs/deferred.md`.

### `/music` v2 — Membrana resonante con waveform real

**Concepto:** superficie física central que vibra con el audio real — parche de tambor con arena formando patrones de Chladni, o pileta con ondas concéntricas que nacen con cada pico de volumen. **Todo lo visible deriva de datos reales** (audio en vivo o metadata): nada se inventa. La UI no miente.

**Layout (3 columnas):**

- Izquierda: biblioteca de álbumes con búsqueda.
- Centro: la superficie resonante grande + waveform en vivo + metadata del track + barra de progreso real.
- Derecha: cola de reproducción.

**Qué afirma cada elemento visual y por qué no miente:**

| Visual                     | Afirma                          | Sostén                          |
| -------------------------- | ------------------------------- | ------------------------------- |
| Patrón de arena / ondas    | Composición espectral del audio | FFT real (AnalyserNode) en vivo |
| Waveform inferior          | Forma de onda actual            | Audio sample literal            |
| Barra de progreso          | Posición en el track            | `currentTime / duration` real   |
| Portada / título / artista | Identidad del track             | Metadata del archivo            |
| Biblioteca                 | Álbumes disponibles             | Lectura del FS                  |
| Cola                       | Siguientes tracks               | Estado real de la queue         |

Silencio → arena dispersa / agua quieta. Se lee correctamente como "no hay sonido" sin mentir.

**Orden de trabajo (multi-sesión):**

1. Auditar `music.service.ts` y modelos: track actual, queue, biblioteca, metadata.
2. Asegurar acceso al audio en vivo: WebAudio API + AnalyserNode para FFT y waveform; verificar que el reproductor actual lo permita o adaptarlo.
3. Layout 3 columnas estático (biblioteca / superficie placeholder / cola).
4. Visualización central: arrancar con la **variante más simple (pileta con ondas)** — más legible y permite validar la pipeline de audio. Patrones de Chladni quedan como upgrade visual.
5. Waveform inferior + metadata + progreso real.
6. Pulido: materiales (cobre/madera del recipiente, textura del agua o parche), transiciones al cambiar track, búsqueda/filtros en biblioteca.

**Decisiones de diseño detrás del descarte de otras opciones:** se descartaron pianola, caja musical de cilindro con púas, y orquesta automática porque mostrar teclas/púas/instrumentos específicos requeriría datos MIDI/transcripción/stems separados que no tenemos. La UI no debe fingir información que no posee — los detalles visuales que parecen contar algo deben ser verdaderos o no contarlo.

## Checklist al migrar una página

1. Agregar el prefijo de ruta a `PANE_HIDDEN_PREFIXES`.
2. Diseñar layout propio que justifique el ancho ganado (no estirar el contenido viejo a 100%).
3. Si la página tiene muchas secciones internas, considerar navegación propia (tabs, TOC, cards colapsables).
4. Actualizar la tabla de arriba con la idea elegida + estado.
5. Verificar que el rail (íconos) sigue marcando la entidad activa correctamente.
