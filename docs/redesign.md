# Redesign por página

Migración progresiva: cada página de entidad/herramienta deja de depender del **section pane** secundario de la sidebar global y adopta un layout propio que aprovecha todo el ancho. El rail vertical (íconos de entidad) se mantiene; lo que se oculta es el panel intermedio (árbol/lista contextual).

## Mecanismo

El sidebar global lee `PANE_HIDDEN_PREFIXES` en `layout/containers/workspace-sidebar.container.ts`. Cualquier ruta listada ahí renderiza solo el rail y le da el ancho restante al `<router-outlet>`. Migrar una página = agregar su prefijo a esa lista + diseñar el layout interno de la página.

## Principio

Una idea distinta por página. No replicar el mismo patrón: cada entidad tiene una forma natural de mostrarse (estantería, galería, grid de cards, tabs, etc.). El section pane era un mínimo común denominador; el redesign apuesta a lo opuesto.

## Estado por página

| Ruta         | Idea del redesign                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Estado |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `/books`     | Estantería + page-turn 3D flip con paper bend en lectura                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✅     |
| `/images`    | Museo: planta + salas con cuartos auto-paginados + mini-mapa                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✅     |
| `/trash`     | Grid visual de cards con filtro por kind, búsqueda y modal detalle                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ✅     |
| `/settings`  | Tabs verticales sticky + panel (sección activa única)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ✅     |
| `/history`   | v1 heredado (✅). v2 (✅): corte estratigráfico con lupa — panorámica (cordillera) / medio (estratos con fósiles) / detalle (cordel de polaroids revelándose), con fetch por nivel de zoom. Fases 1, 1.5, 2, 3 (silueta continua Bezier + cielo/horizonte + banderines sobre picos), 4 (cordel curvo + polaroids con flip 3D dorso→frente + mesa de revelado abajo) y 5 (continuidad de sesión, fósil-jump cross-zoom con ±12h, mini-mapa al pie del yacimiento, deep-link `?zoom=`) cerradas honrando la metáfora visual. | ✅     |
| `/variants`  | Delta de un río: Principal = cauce; cada brazo = variante con color propio, vado (fork oid) + rombo HEAD + bandera de milestone. Flujo ambiente animado (más rápido en activa, congelado con juncos en reposo). Confluencia al mergear. Drawer `position: fixed` al fondo del viewport con card de HEAD parseado (auto/manual + reason chip), píldoras funcionales (linaje → selecciona padre, adelante → merge), acciones agrupadas.                                                                                      | ✅     |
| `/notes`     | Muro de stickies (CSS columns) + card "nueva" inline + chips de filtro                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ✅     |
| `/tasks`     | Jardín de tres canteros (floración/brote/semilla) + trasplantar (DnD) + cosecha + riego                                                                                                                                                                                                                                                                                                                                                                                                                                    | ✅     |
| `/goals`     | Wallboard tipográfico: posters grandes en grid auto-fit + filtros + hero create                                                                                                                                                                                                                                                                                                                                                                                                                                            | ✅     |
| `/lists`     | Pizarra-directorio: chalkboard + rail A–Z/tag + flow multi-columna, search dim+highlight                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✅     |
| `/lists/:id` | Editor + capa de tiza (toggle off por default): paleta de tizas, goma, capas con visibilidad/lock/reorden — persistencia en el JSON de la lista (`chalkLayers`, schema v4)                                                                                                                                                                                                                                                                                                                                                 | ✅     |
| `/writings`  | Biblioteca de borrador: shelf de cards tipográficas + editor full-bleed centrado                                                                                                                                                                                                                                                                                                                                                                                                                                           | ✅     |
| `/files`     | Pared de lockers numerados (color = primer tag) + apertura inline (≤6 archivos) u overlay (más)                                                                                                                                                                                                                                                                                                                                                                                                                            | ✅     |
| `/music`     | v1 3 zonas (✅). v2 (✅): membrana/superficie resonante central con FFT real + biblioteca de álbumes ID3 + cola lateral + playlists en tab alternable con álbumes.                                                                                                                                                                                                                                                                                                                                                         | ✅     |
| `/calendar`  | v1 wallboard (✅). v2 (✅ 2026-07-09): mesa de luz (mes) + agenda de cuero (semana/día) + transición mesa→libro (vía day-modal). Pendiente revisión visual manual del usuario (bridge Chrome↔WSL sigue sin poder capturar screenshots). Ver detalle en `docs/redesign-calendar.md`.                                                                                                                                                                                                                                        | ✅     |
| `/reminders` | Palomar de jaulas con palomas mensajeras: puertas se abren progresivamente, paloma vuela (ruta wandering, usa toda la pantalla) al rail icon y picotea al disparar; recurrentes se posan en la campana hasta que el usuario clickea la jaula vacía para llamarla de vuelta; puntuales caen tras picotear. Filtros por fecha/nombre. Ver detalle abajo.                                                                                                                                                                     | ✅     |
| `/sync`      | Central de tubos neumáticos: una cápsula por ref (variante × faceta) viajando por tubos transparentes al espejo remoto; dirección = push/fetch, sellos = último sync, atasco ámbar = divergencia. Ver detalle abajo.                                                                                                                                                                                                                                                                                                       | ✅     |

## Planes detallados

### `/calendar` v2 — Mesa de luz + agenda de cuero

**Concepto:** el calendario deja de ser solo "eventos" y se convierte en la **vista temporal unificada del cerebro** (eventos + recordatorios + tareas con fecha + notas con fecha). Ninguna otra sección hace ese cruce hoy, y es donde más valor agrega el módulo.

**Dos modos:**

- **Vista mes = mesa de luz con acetatos.** Grilla temporal de fondo + capas semitransparentes apilables, una por dominio. Toggles encienden/apagan cada capa. Modo "consulta/panorama".
- **Vista semana + día = agenda de cuero encuadernada.** Lomo central, semana a la izquierda, día expandido a la derecha. Post-its para recordatorios, entradas manuscritas para eventos. Modo "anotar/actuar".
- **Transición:** click en un día de la mesa → el día "se levanta" como acetato y se convierte en la página derecha del libro. Cerrar libro → vuelve a la mesa.

**Justificación del contraste material (vidrio/luz vs cuero/papel):** son dos modos del mismo escritorio de arquitecto — mesa de luz para revisar planos, libreta para apuntar.

**Orden de trabajo (multi-sesión):**

1. ✅ Servicio unificado: ya existía `CalendarEventsService` proyectando tasks/goals/reminders; se cerró el gap de notas (sin campo de fecha propio) agregando `Note.scheduledFor` opcional (schema v3→v4, nunca inferido de `createdAt`) + UI mínima en el editor para asignarlo. Detalle completo en `docs/redesign-calendar.md`.
2. ✅ Mesa de luz básica: grilla de mes con marco/vidrio + capas por kind. Fusionada con el paso 3 (ver justificación en `docs/redesign-calendar.md`) — las 4 capas (eventos/recordatorios/tareas/notas) quedaron funcionales de una vez porque el toggle/filtro genérico ya existía desde el paso 1.
3. ✅ (fusionado con el paso 2 — ver arriba).
4. ✅ Libro de cuero como zoom semana/día — post-its para recordatorios, entradas manuscritas para el resto. Detalle en `docs/redesign-calendar.md`.
5. ✅ Transición mesa↔libro — versión conservadora vía botón "Ver en la agenda" en el day-modal existente en vez de reemplazar su click-en-día; ver justificación en `docs/redesign-calendar.md`.

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
5. ✅ Animación de disparo del scheduler implementada (paloma sale de la jaula, vuela en ruta wandering por la pantalla — puede salirse un momento y volver — hasta el rail icon, picotea 3 veces; recurrente se posa en la campana hasta que el usuario haga click en la jaula vacía para llamarla de vuelta, también en ruta wandering; puntual cae rotando tras picotear — flapeo durante todo el vuelo). Snooze y "tomar papelito" manual diferidos a `docs/deferred.md`.
6. ⏳ Detalles opcionales (plumitas, ronroneo, plumaje). → `docs/deferred.md`.

### `/music` v2 — Membrana resonante con waveform real

**Concepto:** superficie física central que vibra con el audio real — parche de tambor con arena formando patrones de Chladni, o pileta con ondas concéntricas que nacen con cada pico de volumen. **Todo lo visible deriva de datos reales** (audio en vivo o metadata): nada se inventa. La UI no miente.

**Layout (3 columnas):**

- Izquierda: biblioteca de álbumes con búsqueda. Álbumes reales vía ID3 (no se renombran las playlists — eso mentiría). Tracks sin ID3 caen en sección "Sin álbum" honesta al final.
- Centro: la superficie resonante grande + waveform en vivo + metadata del track + barra de progreso real. Portada con placeholder genérico claramente vacío cuando no hay cover.
- Derecha: cola de reproducción.
- Playlists: dejan de ocupar columna; pasan a un modal accesible desde el rail/atajo. Siguen existiendo y siendo editables, pero no compiten con el modelo "álbum".

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

1. ✅ Auditar `music.service.ts` y modelos: schema actual de Track sin metadata musical, persistido en `music/_library.json` sin `schemaVersion`.
2. Migración de schema: Track gana `title?/artist?/album?/albumArtist?/year?/trackNumber?/discNumber?/coverPath?/id3ReadAt?`. `MusicLibrary` gana `schemaVersion: 2`. Migración lazy en `refresh()` con backfill batched (lectura ID3 de tracks existentes, una escritura JSON al final).
3. Extracción ID3 al importar: `jsmediatags` (~30KB). Portada se persiste como archivo separado en `music/covers/<sha1>.jpg` (dedup por hash, blob URL para mostrar). Tracks sin tags → bucket "Sin álbum".
4. Acceso al audio en vivo: WebAudio API + `AudioContext` + `MediaElementAudioSourceNode` + `AnalyserNode` enchufados al `<audio>` privado de `PlayerService`. Cuidar autoplay policy (contexto arranca en primer gesto del usuario, `restoreFromStorage` queda paused hasta el primer play).
5. Layout 3 columnas estático (biblioteca álbumes / superficie placeholder / cola). Playlists migran a modal.
6. Visualización central: arrancar con la **variante más simple (pileta con ondas)** — más legible y permite validar la pipeline de audio. Patrones de Chladni quedan como upgrade visual (la pipeline FFT/canvas se reusa).
7. Waveform inferior + metadata + progreso real + portada con placeholder genérico cuando falta.
8. Pulido: materiales (cobre/madera del recipiente, textura del agua o parche), transiciones al cambiar track, búsqueda/filtros en biblioteca.

**Decisiones de diseño detrás del descarte de otras opciones:** se descartaron pianola, caja musical de cilindro con púas, y orquesta automática porque mostrar teclas/púas/instrumentos específicos requeriría datos MIDI/transcripción/stems separados que no tenemos. La UI no debe fingir información que no posee — los detalles visuales que parecen contar algo deben ser verdaderos o no contarlo. Por el mismo principio, la biblioteca usa álbumes ID3 reales en vez de renombrar las playlists, y la portada faltante se muestra con un placeholder claramente vacío (no inventa carátulas).

### `/sync` — Central de tubos neumáticos

**Concepto:** el `/sync` actual funciona pero es una pantalla plana (dos botones + tabla de refs + toggle de auto-push) que no cuenta la única historia que importa: _qué cápsulas están viajando, cuáles ya llegaron, cuáles están atascadas_. La central de tubos neumáticos (bancos/hospitales de época) es literal: cada ref remoto es un **tubo transparente vertical** que conecta el workspace local con el espejo remoto; dentro viaja una **cápsula** con la etiqueta del ref. La UI no miente: todo lo visible deriva del outcome real de `pushAll`/`fetchAll` y del `lastPush/FetchOutcomes` del `RemoteService`.

**Layout:**

- **Header sobrio:** título + estado global ("Sincronizado" / "Push pendiente" / "Divergente" — mismo semáforo del `RemoteStatusDot`) + hora del último `lastBulkAt`.
- **Consola central:** grilla de tubos organizada como `filas = variantes`, `columnas = facetas (main/comments/draft)`. Cada celda es un tubo con su cápsula. Ancho ganado se usa para tubos más altos y respiro entre variantes — no para estirar la tabla vieja.
- **Cuadro de mandos lateral (o inferior en pantallas angostas):** dos palancas grandes (`Enviar todo` / `Traer todo`) con el mismo enable/disable actual (divergencia bloquea push), manivela del auto-push con reloj de arena que marca el throttle, y sello con `lastBulkAt`.
- **Estado no-configurado:** cartel enmarcado "Central sin línea al espejo — configurar remoto" con link a `/settings`, sin tubos dibujados. Coherente con la metáfora sin fingir un estado operativo.

**Mapeo de mecánicas:**

| Mecánica del `RemoteService`                 | Cómo se ve en el tubo                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| status `ok` tras push                        | Cápsula sube, entra en la boca superior, sello verde "enviado hh:mm"                                                   |
| status `ok` tras fetch                       | Cápsula baja, aterriza en la boca inferior, sello verde "recibido hh:mm"                                               |
| status `up-to-date`                          | Tubo quieto con cápsula asentada en su base + sello suave "al día"                                                     |
| status `absent` (ref no existe aún remoto)   | Tubo apagado / traslúcido gris + etiqueta "sin espejo"                                                                 |
| status `error`                               | Cápsula frenada en la mitad + halo ámbar + tooltip con el mensaje del error real                                       |
| divergencia (`divergentRefs` incluye la ref) | Dos cápsulas encontradas en el medio con contorno rojo + link a `/variants/merge?ref=<x>` (reusa handoff de 13e-iii)   |
| push/fetch en vuelo (`isPushing/isFetching`) | Cápsula animada subiendo/bajando con velocidad constante (sin barrita de progreso — no hay progreso real que reportar) |
| auto-push ON + throttle activo               | Manivela con reloj de arena que cuenta hacia el próximo push; ícono apagado si toggle OFF                              |
| `MCB-NET-008` (skip in-flight)               | Chispita fugaz sobre la manivela + tooltip "salteado — otro envío en curso"                                            |

**Qué afirma cada elemento y por qué no miente:**

| Visual                | Afirma                                | Sostén                                     |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| Fila del tubo         | Existe la ref local (variante+faceta) | `listRefTargets()`                         |
| Color/estado del tubo | Último outcome conocido               | `lastPush/FetchOutcomes[ref]`              |
| Sello con hora        | Momento del último sync exitoso       | `row.lastSyncAt`                           |
| Cápsula animada       | Hay una operación en curso            | `isPushing()` / `isFetching()`             |
| Colisión roja         | Divergencia real detectada            | `remote.divergentRefs.includes(ref)`       |
| Manivela girando      | Auto-push habilitado                  | `settings.pushAfterAutocommit`             |
| Reloj de arena        | Tiempo restante del throttle          | `pushThrottleMinutes - (now - lastPushAt)` |
| Central apagada       | No hay remoto configurado             | `!isConfigured()`                          |

Silencio operativo (nada en vuelo, sin divergencia, sin errores) → todos los tubos en reposo con sello "al día". Se lee correctamente como "no hay nada que hacer" sin inventar actividad.

**Detalles bonitos opcionales:** silbido suave al despachar (respeta el mute global), sombra de la cápsula sobre el tubo, latón/madera del cuadro de mandos consistente con `/music` v2, contador acumulado discreto ("N envíos hoy") sólo si viene barato del `lastBulkAt` histórico. Nada de esto entra al MVP.

**Riesgos a vigilar:**

- **Escala:** con muchas variantes × 3 facetas la grilla crece rápido. MVP soporta hasta ~12 variantes cómodo; más que eso, colapsar por variante (fila plegable) antes de perder legibilidad. No inventar paginación decorativa.
- **Animación honesta:** la cápsula "en vuelo" no debe simular progreso (no tenemos %). Usar loop constante hasta que llegue el outcome real — igual que el spinner actual.
- **Consistencia con el banner de divergencia global:** el detalle por-tubo debe abrir el mismo flujo de `/variants/merge?incoming=remote&ref=…` que el banner ya usa. No duplicar UX de resolución.
- **Estado no-configurado sin caer en decorativo:** no dibujar tubos "fantasma" — un cartel es más honesto y ahorra pintar UI que no representa nada.

**Alternativas consideradas (descartadas):**

- **Muelle con barcos** (una nave por ref, sale con carga y llega con carga): bonito pero cada nave necesita animación individual costosa y la horizontalidad no aprovecha el ancho ganado — la grilla del muelle se sentiría vacía.
- **Panel eléctrico de subestación** con breakers y voltímetros: sobrio y coherente con la "ingeniería" del repo, pero los voltímetros insinuarían métricas continuas (voltaje, corriente) que no tenemos — mentiría en la aguja. Tubos neumáticos son discretos por diseño (una cápsula = un evento).
- **Palomar de intercambio con otra ciudad:** colisiona con la metáfora de `/reminders`. Dos secciones con palomas diluyen ambas.

**Orden de trabajo (multi-sesión):**

1. ✅ Agregar `/sync` a `PANE_HIDDEN_PREFIXES` — la pantalla ya recibe el ancho completo.
2. ✅ Auditoría de `RemoteService` (`core/versioning/remote.service.ts`): todo lo que el layout necesita ya existe sin cambios de modelo. Señales: `isConfigured()`, `isPushing()`, `isFetching()`, `lastPushOutcomes()`, `lastFetchOutcomes()` (arrays de `RefSyncOutcome { variantId, facet, ref, remoteRef, status, error? }`), `lastBulkAt()`, `divergentRefs()`, `hasDivergence()`. Estados de `RefSyncStatus` = `'ok' | 'up-to-date' | 'error' | 'absent'` (`remote.types.ts:34`). Grilla se compone con `listRefTargets(variants.filter(v => !v.pendingDelete))` (`remote-bulk.ts:35`) — filas=variantes, columnas=facetas. El `sync.container.ts` actual ya cruza targets × outcomes indexado por `ref` y deriva `lastSyncAt` por-fila del `lastBulkAt` del último outcome (`sync.container.ts:58-72`); el redesign reusa esa proyección tal cual, sólo cambia el render.
3. ✅ Consola central v0: grilla estática `filas=variantes × columnas=facetas` en `sync.container.html`, cada celda un tubo con boca superior/inferior, vidrio con gradiente lateral y cápsula quieta en la base coloreada por status (`ok`/`up-to-date` verde, `error` rojo, `divergent` ámbar, `absent` gris translúcido, `idle` gris neutro). Sello debajo del tubo con chip de estado + `lastSyncAt`. Nueva `TubeStatus` en el container agrega `'divergent'` cruzando `remote.divergentRefs()` con el ref local. `stripHeadsPrefix` reemplaza `listRefTargets` para poder anidar por variante sin re-agrupar. La tabla plana anterior y su tipo `Row` desaparecieron. i18n suma `sync.status.divergent`, `sync.console.variantHeader`, `sync.console.divergent.action`, `sync.console.emptyCap`. Sin animación aún (paso 5); las palancas y el auto-push siguen tal cual el layout viejo (paso 4 los reformatea).
4. ✅ Cuadro de mandos: layout dos-columnas `grid-template-columns: minmax(0,1fr) minmax(260px,320px)` con la consola de tubos a la izquierda y `<aside class="control-panel">` sticky a la derecha. Tres bloques enmarcados:
   - **Palancas** (`.levers`): botones `Push todo` (accent) y `Fetch todo` (neutro) en grid 1×2 con los mismos enable/disable (`isPushing/isFetching/hasDivergence`), tooltip `sync.divergent.disabled`, y chip de estado que resume el último bulk (`allOk` verde / `partial` rojo / `never` mute) — absorbe la `.summary` vieja.
   - **Auto-envío** (`.crank`): switch estilizado (checkbox oculto + `.switch-track/.switch-thumb`) para `pushAfterAutocommit` y "dial" (input numérico enmarcado + unidad `min`) para `pushThrottleMinutes` — el dial se atenúa y deshabilita cuando el toggle está OFF (feedback visual honesto de que el valor no aplica). Handlers `onTogglePushAfter`/`onThrottleInput` intactos.
   - **Sello** (`.seal`): `.stamp-block` con caption `sync.panel.sealLabel` + `lastBulkAt | mcDate` destacado; borde punteado y `data-empty` cuando nunca corrió.
     Responsive: en <1100px el aside cae a `order: -1` sobre la consola y pierde el sticky. Removí `.actions`/`.summary`/`.auto-push` viejos y el `max-width: 1000px` del `.page`. i18n suma `sync.panel.leversTitle`, `sync.panel.sealTitle`, `sync.panel.sealLabel`, `sync.panel.sealNever`, `sync.autoPush.throttle.unit`. Paridad funcional completa con la pantalla anterior.
5. ✅ Animación honesta de cápsula en vuelo mientras `isPushing/isFetching` esté activo (loop constante, sin barrita de progreso — la cápsula sube en push, baja en fetch). Sello con hora al aterrizar el outcome (usa el proyector de `lastSyncAt` ya existente). Halo ámbar en `error`: la cápsula se detiene en la mitad del tubo con `box-shadow` doble (borde + glow ámbar), tooltip del error real ya viene del `[title]` sobre `.tube`. Nueva helper `tubeFlight()` en el container decide push/fetch/null; divergent y error nunca animan.
6. ✅ Divergencia: en `status='divergent'` el tubo dibuja dos cápsulas encontrándose en el centro (`.capsule--local` desde abajo, `.capsule--remote` desde arriba, ambas con borde rojo), y el `.tube-seal` suma un pill "Resolver merge" que abre `/variants/merge?incoming=remote&ref=<ref>&into=<variantId>` — mismo shape de query que `RemoteDivergenceBannerComponent`, no se duplica UX. Se agregó `variantId` al `Tube` para tener el `into` a mano.
7. ✅ Estado no-configurado: cartel enmarcado (borde dashed, layout vertical propio) con título `sync.notConfigured.title` "Central sin línea al espejo" + body + link a `/settings`. No se dibujan tubos ni cuadro de mandos. Coherente con la metáfora sin fingir estado operativo.
8. ✅ Pulido: caps del tubo con tinte latón (gradient `color-mix` sobre warning) — consistente con la materialidad "cobre/madera" de `/music` v2. Reloj de arena del throttle (`hourglass-medium`) sólo visible cuando `pushAfterAutocommit=true`, `lastPushAt` existe y quedan minutos: muestra `m:ss` restantes calculados sobre `lastPushAt + throttleMinutes` y un ticker de 15s. `MCB-NET-008`: `AutoPushService` expone `lastSkipAt` signal, el container escucha vía `effect` y muestra una chispita absoluta sobre el crank durante 1.6s (keyframe `skip-spark`). No hay detalles bonitos pendientes; la lista opcional del plan (silbido, sombra de cápsula, contador diario) no entra al MVP — sin nuevas entradas en `docs/deferred.md` por ahora.

### `/history` v2 — Corte estratigráfico con lupa

**Concepto:** el `/history` actual funciona pero paga todo el fetch antes de pintar (`git.log(200)` × 3 refs × N variantes para el origin-map) y muestra una lista lineal de buckets uniformes que no cuenta la única historia que importa: _cuándo hubo trabajo, cuánto, de qué faceta, y dónde están los puntos que el usuario nombró_. El corte estratigráfico es un yacimiento vertical: cada estrato es un período con **espesor real** (proporcional a `commits/día`), pintado en franjas por faceta (`main`/`comentarios`/`borrador`), con **fósiles** (milestones) embebidos y visibles siempre. La misma vista se navega a tres resoluciones:

- **Panorámica** (cordillera): columnas por día con altura = actividad real; se ve un año en una vista.
- **Media** (estratos): buckets con cabecera de espesor + fósiles + auto-load por viewport. Reemplaza el `/history` actual.
- **Detalle** (cordel): commits como polaroids revelándose horizontalmente a medida que llega el diff.

Los tres son **niveles de detalle del mismo objeto**, no metáforas distintas; el zoom del usuario dicta la política de fetch (semantic zoom).

**Layout:**

- **Header sobrio:** buscador (`facet:` `since:` `sha:`), chips faceta, toggle "sólo fósiles", control de zoom `⟨█▁▁⟩ / ⟨▁█▁⟩ / ⟨▁▁█⟩` siempre visible con label del nivel actual.
- **Vista panorámica:** SVG de columnas por día, altura log-escalada (piso 12px, techo 40% viewport) con banderines de fósiles por encima del pico. Doble-click en columna → baja a estratos con ese rango.
- **Vista media (default al entrar):** estratos verticales con cabecera `nombre · ▓▓▓░░▒ N commits`. Estrato "delgado" (poca actividad) se ve chico; "grueso" se ve grande — la cordillera sobrevive acá como densidad de cabecera, no como perfil separado. Lecho de roca al final con banner de compactación si hay backlog. Panel de detalle a la derecha con summary + entidades + restore + trailers (misma información que el `/history` actual, sólo re-encuadrada).
- **Vista detalle:** cordel horizontal con polaroids `┌───┐` (fósiles `╔═══╗`). Placeholder borroso hasta que `loadWindow(detail)` resuelve; entonces se afina. Contador "revelando 24/47" visible arriba. Mesa de revelado abajo con la foto seleccionada ampliada.
- **Mini-mapa** al pie de vista media: silueta panorámica comprimida con banderines + ventana visible resaltada, para saltar de era.
- **Estado sin remoto/sin commits:** cartel "yacimiento vacío — todavía no hay historia que excavar" sin dibujar estratos, coherente con la metáfora.

**Mapeo de mecánicas:**

| Mecánica de `VersioningService`/`HistoryService` | Cómo se ve en el corte                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `git.log(depth, refs)` por rango                 | `HistoryLoader.loadWindow({range, resolution})` — resolución sale del zoom (aggregate/summary/detail)                        |
| Bucket temporal (`today` … `older`)              | Estrato horizontal con espesor real en su cabecera                                                                           |
| Milestones (`git tag`)                           | Fósil `⚑` embebido en su estrato / banderín en la cumbre / polaroid enmarcada — visible incluso antes de hidratar el estrato |
| Faceta del commit (`main`/`comments`/`draft`)    | Banda de color en la cabecera del estrato y borde-izq del commit                                                             |
| Origen por variante (`originByOid`)              | Color de borde-izq del commit; resuelto **por-oid lazy con cache**, no BFS-full al load                                      |
| Auto-group (autocommits mismo fp, ≤1h)           | Fila colapsada `(N más) ⧉` en estratos; una polaroid con contador en detalle                                                 |
| Merge-group (trailer `Merge-Group`)              | Fila colapsada `merge-group #f8c1 · N entradas` con miembros expandibles                                                     |
| Compactación pendiente                           | Banner en lecho de roca con conteo real desde `CompactionSchedulerService`                                                   |
| Diff pre-fetch del vecino con `[`/`]`            | Polaroid siguiente arranca a revelarse antes de que el usuario llegue                                                        |
| Deep-link `?oid=<sha>`                           | Aterriza en detalle con esa polaroid enfocada; conserva parámetro `?zoom=`                                                   |
| Restore por entidad / por commit                 | Botones intactos en el detail pane; texto de confirm reusa strings actuales                                                  |

**Qué afirma cada elemento y por qué no miente:**

| Visual                             | Afirma                              | Sostén                                                     |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| Espesor de estrato/columna         | Cantidad de commits en el rango     | `count` del `aggregate` de `loadWindow`                    |
| Tinción de faceta en la cabecera   | Mezcla real de facetas del rango    | Ratios sobre `facetOf(message)` de los commits del rango   |
| Fósil visible                      | Existe un milestone en ese oid      | `git.listTags()` / `milestonesByOid`                       |
| Polaroid nítida                    | Diff cargado y disponible           | Resolución del `Promise` de `diff.loadForCommit`           |
| Polaroid borrosa / "revelando N/M" | Diff aún no llegó                   | Estado real del fetch en flight                            |
| Silueta borrosa en panorámica      | Rango no hidratado                  | Sin `summary` cargado; sólo `aggregate` está listo         |
| Banner de lecho de roca            | Hay commits compactables pendientes | `CompactionSchedulerService.shouldSuggestEnableCompaction` |
| Color de borde-izq                 | Variante que autoreó el commit      | `originByOid.get(oid)` con cache lazy                      |
| Mini-mapa comprimido               | Perfil histórico completo           | `aggregate` sobre todo el rango del log                    |

Silencio operativo (repo joven, sin milestones, sin compactación) → estratos delgados sin banderines y banner de lecho de roca ausente. Se lee correctamente como "todavía hay poca historia" sin dibujar densidad falsa.

**Riesgos a vigilar:**

- **Espesor variable puede mentir si no se acota.** Regla: escala log en el eje espesor, piso mínimo legible (~12px), techo 40% viewport. Un día con 200 commits no puede aplastar visualmente a la semana anterior.
- **Semantic zoom vs continuo.** Tres niveles con layouts propios, no morphing. El zoom continuo dentro de un nivel sólo cambia rango/densidad, no representación — evita el valle inquietante.
- **Descubribilidad del zoom.** Control siempre visible en el header con el nivel actual + shortcut. Onboarding sutil: al primer entrar en `/history` v2, un tooltip breve sobre el control.
- **Persistencia de estado.** Rango visible persiste en `sessionStorage` (coherente con §1 continuidad de PROYECTO). Nivel de zoom **no** persiste — se resetea a medio por default para que el usuario nunca aterrice en una vista rara.
- **Costo de SVG en panorámica.** Un año con 1000+ commits son 365 columnas × tinción por faceta. Renderizar como una sola cadena SVG con `path`s por faceta, no un `rect` por commit. Fallback a Canvas si el DOM SVG no rinde.
- **Fetch acoplado al viewport.** `IntersectionObserver` con `rootMargin` generoso para pre-cargar antes de que el estrato entre en foco. Evitar disparar `loadWindow(detail)` en scroll rápido — throttle 200ms.
- **Origin-map lazy tiene que ser rápido.** Cachear `variantId` por oid en memoria; nunca más de un walk por variante por sesión. Si el miss cache dispara BFS, aceptar 100–200ms de latencia al primer render del color.

**Alternativas consideradas (descartadas):**

- **Rollo/pergamino desenrollándose:** táctil pero unidimensional; no compone con la topografía real (`commits/día`) que el corte sí muestra, y la agrupación por bucket queda forzada en una cinta continua.
- **Anillos de árbol (dendrocronología):** compresión visual enorme, orgánico, pero radial desperdicia esquinas y navegar por radio es menos familiar que vertical; texto sobre curva es incómodo.
- **Biblioteca de tomos encuadernados:** discretización clara por mes/año, pero pierde novedad (la metáfora es común) y un proyecto nuevo con 2 tomos se ve pobre.
- **Constelaciones / cielo estrellado:** revela patrones de trabajo emergentes gratis, pero encontrar un commit específico en 2D estrellado es peor que en lista; mejor como vista secundaria futura, no principal.
- **Estratos solos** (sin cordillera ni cordel): fue la primera propuesta. Se descartó a favor del corte con lupa porque no aprovecha `commits/día` (que ya tenemos) para densidad real, y el `⛏ cavar` explícito era menos elegante que el zoom semántico.
- **Cordillera sola / cordel solo:** cada uno mejor en un eje pero peor en los otros; combinados como LOD del mismo objeto rinden más que cualquiera aislado. Ver mockups y análisis en la conversación de rediseño.

**Orden de trabajo (multi-sesión):**

1. ✅ **Loader incremental por ventana** (arquitectónica, sin cambio visual). `HistoryLoader` extraído de `HistoryService` (`services/history-loader.service.ts`) con API `loadWindow({resolution: 'aggregate'|'summary'|'detail', depth?, refs?, since?, until?})`. `HistoryService` delega el fetch al loader y sólo re-proyecta buckets/collapse. El origin-map BFS (`ensureOriginMap`) se disparó fuera del critical path (`void`, memoizado por depth, invalidable) — el timeline pinta al toque y el color por variante fade-in cuando el signal aterriza. `loadMilestones` en el loader; `refreshMilestones` intacto en el service. `aggregate` resolution ya devuelve `DayAggregate[]` por día con `count` + mix de facetas (contrato listo para Fase 3, sin consumidor aún). `detail` lanza (per-oid = `HistoryDiffService`, Fase 4). `HistoryLoader` registrado como provider del container junto al service. Spec del loader por resolución + memoización + lineage-order en `history-loader.service.spec.ts` (7 tests). Sin regresiones visuales.
   1.5. ✅ **Scan de ruido off critical path.** `HistoryDiffService.findNoiseCommits` (que recorre hasta 200 commits con `parentOidOf` + tree-diff por cada uno para detectar autocommits de sólo `lastActivityAt`/`state` en `variants.json`) era la segunda fuente de latencia al abrir `/history` — venía después del `load()` en `reloadAll`, sincrónico, y podía bloquear la selección inicial cientos de ms. Fase 1.5: la scan acepta `{ signal: AbortSignal, onBatch: (found) => void }`, cede el event loop cada 32 sondas (`NOISE_SCAN_YIELD_EVERY`), y reporta batches acumulados. El container la corre en background con generación monotónica y `AbortController` — cada `reloadAll` aborta la scan anterior y arranca una nueva. Si el commit auto-seleccionado inicial resulta ser ruido, se empuja al siguiente visible cuando ese oid aparece en un batch (sólo si `selectFirst && !matched`; deep-links no se tocan). **Gate:** primer paint ya no espera `O(depth)` operaciones de git; la UI se filtra progresivamente conforme cada batch resuelve; sin regresiones en los 380 tests existentes.
2. ✅ **Estratos (zoom medio) reemplaza la UI actual.** `HistoryContainer` rediseñado como corte estratigráfico: cada bucket es un `<section class="stratum">` con `stratum-head` sticky que muestra `bucket-label + count`, una barra `.stratum-thickness` (log-escalada 20–96px sobre `totalCount` real, con gradient de tres tramos por faceta usando `--facet-color-*` existentes) y una fila de `.stratum-fossil` (milestones anclados en el rango del estrato como pills clickables que hacen `select(oid)`). La densidad se deriva del `HistoryService.buckets()` **sin filtrar** para que search/chips no achiquen la geología, mientras que los items visibles siguen viniendo del `buckets()` filtrado del container — helper puro en `services/strata.utils.ts` (`computeDensity` + `EMPTY_DENSITY` + `StratumDensity`), testeado en `strata.utils.spec.ts` (4 tests, incluidos el gate 5-vs-200 y merge/auto-group counting). El compaction banner viejo desapareció del tope y renace como `.bedrock` al pie del último estrato, con borde dashed color tierra y tres franjas apiladas (`.bedrock-layer`) — metáfora coherente: lo compactado queda al fondo. **Progressive mount:** `hydratedBucketsSignal` arranca con `{'today'}`; un `IntersectionObserver` colgado del `.timeline` con `rootMargin: '240px 0px'` observa cada `[data-stratum-id]` y agrega su id al set cuando cruza (once-only, `unobserve` al hidratar). El observer se re-bindea vía effect cada vez que cambia `strata()` (queueMicrotask para dejar que Angular termine de renderizar). Mientras un estrato no está hidratado, el `<ul class="commits">` va con `[hidden]="true"` y se pinta un `.stratum-placeholder` de 3 filas apagadas para que el scroll no salte al hidratar. Todas las funciones del layout viejo intactas: search + chips + `sólo fósiles`, collapse timeline/detail, restore por entidad y commit, mark milestone, `[`/`]` entre milestones, deep-link `?oid=`, auto/merge groups, noise scan. **Gate:** ✅ 5 vs 200 commits se leen claramente distintos (test `strata.utils.spec.ts` exige `thick - thin ≥ 30px`); ✅ superficie inmediata (headers + fossils sin esperar hidratación); ✅ sin `⛏ cavar` — el observer maneja todo. Sin regresiones en typecheck.
3. ✅ **Panorámica (zoom cordillera) — silueta continua honrando la metáfora.** Reescrita: `computePanoramaGeometry` ahora emite tres `path` cerrados apilados (main→comments→draft) con **curvas Catmull-Rom → Bezier** en ambos bordes (top y floor) — la cordillera se lee como perfil montañoso continuo, no como bar chart. Fondo con `linear-gradient` vertical (cielo claro arriba → transparente en horizonte) sobre `.panorama-sky`. Línea de horizonte punteada al pie del SVG. Banderines clavados sobre el `peakY` de cada columna (asta hacia abajo hasta el pico + triangulito arriba), nunca dentro del relleno. Techo dinámico = `window.innerHeight * 0.4` (piso 160px), no 220px fijos. Escala log2 se mantiene con test actualizado (`strata.utils.spec.ts`, 9 tests: paths contienen `C`, cierran con `Z`, `peakY < horizonY`, fósil `y < col.peakY`). Doble-click en hit-rect baja a `strata` (sin cambios). **Gate:** paths con curva visible; banderines sobre picos; fondo con cielo/horizonte; techo se adapta al viewport.
   - Nota diferida: sería lindo hover en la ladera con tooltip por-día — no crítico, movido a `docs/deferred.md` al cerrar Fase 5.
4. ✅ **Detalle (zoom cordel) — polaroids colgadas de un hilo real.** Reescrito honrando la metáfora: SVG `<path>` con pandeo Bezier (`M0,6 Q500,32 1000,6`) atraviesa horizontalmente el stage como cordel real; sobre él, las polaroids cuelgan con broche (`.polaroid-pin`) y rotación alterna (`tilt-left` -1.2°, `tilt-right` 1.1°) — no una tira recta de cuadraditos.
   - **Reverso de cartón real, no `blur()`.** Estado inicial: cada polaroid muestra su **cara trasera** (gradient beige con etiqueta manuscrita "Revelando…" y trocito de cinta de embalar en la esquina). No fingimos foto borrosa — la polaroid está **dada vuelta**.
   - **Flip 3D al revelar.** `polaroid-card` con `transform-style: preserve-3d`. Reverso a `rotateY(0)`, frente a `rotateY(180deg)`. El contenedor arranca en `rotateY(180deg)` (muestra reverso); cuando `HistoryDiffService.loadForCommit(oid)` resuelve, `.revealed` rota a `rotateY(0)` con transición cubic-bezier 500ms. `backface-visibility: hidden` en ambas caras. Sin fallback explícito por ahora — Chrome/Firefox/Safari actuales soportan 3D transforms.
   - **Fósil enmarcado.** `.polaroid.fossil` añade doble borde en color hito + broche dorado, en ambas caras. Metáfora consistente: es una foto con marco especial, no una pill al pie.
   - **Selección.** `.polaroid.selected` = `rotate(0) scale(1.06)` + sombra reforzada + z-index encima de las vecinas.
   - **Mesa de revelado abajo, no al costado.** `.split.zoom-detail-stack` (bindeado cuando `zoom() === 'detail'`) cambia el grid de `360px 1fr` (dos columnas) a `1fr / minmax(260px, 42vh) 1fr` (dos filas). Timeline (con el cordel) arriba, detail pane abajo — las fotos cuelgan y se miran hacia arriba, así que la ampliación de la seleccionada queda debajo, coherente con la metáfora.
   - **Prefetch.** Sin cambios: primeras 6 polaroids al entrar al zoom, el resto on-hover / on-focus / on-click.
   - **Gate:** cordel visible como curva; polaroid inicial muestra dorso de cartón; al revelar hay flip 3D real (no des-blur); fósiles con marco distinto; mesa de revelado bajo el cordel.
     4.5. ✅ **Capas por faceta dentro del estrato + mesa de revelado con polaroid ampliada** (sesión 2026-07-02 b). `computeStratumLayers(bucket, milestonesByOid)` en `strata.utils.ts` sustituye la barra plana `.stratum-thickness` (gradient 90deg de tres tramos side-by-side) por franjas apiladas horizontalmente — main abajo, comentarios medio, borrador arriba — con altura proporcional al `facetMix` real. Cada faceta con cero commits se omite. Los fósiles se anclan dentro del SVG del estrato: X cronológica (viejo=izq, nuevo=der, edges pad 4%), Y centrada en la banda de su faceta, con halo dorado + polígono "fragmento" que se lee como fósil incrustado en la roca, no chip flotante. Altura del estrato mapea `thicknessPx` 20–96 a 40–140 para que las tres franjas se distingan. Cubierto por 5 tests nuevos (14 en `strata.utils.spec.ts`). En **cordel**, `.polaroid.selected` ahora se desprende del broche (`translateY(20px) rotate(-2deg) scale(1.08)` + drop-shadow) y las demás caen a 75% opacidad (`.polaroid-strip:has(.polaroid.selected) .polaroid:not(.selected)`). Cuando `zoom() === 'detail'` y hay commit seleccionado, el pane detail renderiza `<article class="mesa-revelado">`: polaroid 2-3x sobre madera oscura con animación `mesa-drop` (translateY + rotate + scale), broche de bronce, "foto" gradient por faceta con fecha/oid en las esquinas, chip de fósil si tiene, mensaje en tipografía `Caveat` y anotaciones al pie (chips +/✎/− y lista compacta de entidades) — el diff dejó de ser tabla verde/roja separada y quedó como leyenda de la polaroid, coherente con la metáfora fotográfica. Acciones milestone/restore migraron al pie de la polaroid ampliada. **Gate:** typecheck + build development limpios; tests 14/14; `bun start` compila en 36s sin warnings; validación visual en browser diferida (usuario debe abrir /history).
5. ✅ **Continuidad, fósil-jump cross-zoom y atajos.** Rango visible en `sessionStorage` (`query`, `enabledFacets`, `onlyMilestones`, `selectedOid`, `panoramaSelectedDay`), leído en el ctor del container y aplicado como valor inicial de cada signal; nivel de zoom **no** persiste — default `strata` (`unlockedLevel` arranca también en `strata` para permitir el `zoomBack` sin romper el flujo secuencial). Click en cualquier fósil (panorama SVG, notebook, legend del estrato, ficha, mini-mapa) → `jumpToFossil(oid, name)` aterriza en cordel con `fossilFocusOid/Name/CenterMs` seteados; el computed `polaroids` filtra a `[center − 12h, center + 12h]` y un chip `.cordel-focus` sobre el cordel muestra el nombre y ofrece limpiar. **Mini-mapa** (`stratum-minimap`) al pie del yacimiento: reusa `computePanoramaGeometry` con altura 56px + `panoramaFossils` sobre el mismo insumo `flatFossils`, sticky-bottom del `.timeline`. Un handler `onTimelineScroll` calcula la ventana visible `{x, width}` en coords SVG y la pinta como rectángulo iluminado; click en columna hace `jumpToFossil` si el día tiene fósil, si no scrollea al bucket. Se precarga `aggregate` también al aterrizar en `strata` (default) para que el mini-mapa esté disponible sin necesidad de subir a panorámica. Atajos `+`/`-`/`Esc` (`editable-safe`) vía `ShortcutsService` con `labelKey` — aparecen automáticamente en el dialog de ayuda porque agrupa por scope leyendo `bindings()`. Deep-link `?zoom=panoramica|media|detalle` mapea a los tipos internos via `ZOOM_URL_TO_INTERNAL` en `reloadAll` (con `unlockUpTo` antes de fijar el nivel); un `effect` sobre `zoomSignal()` navega con `queryParamsHandling: 'merge'` + `replaceUrl: true` para reflejar el zoom en la URL sin romper `?oid=`. **Gate:** typecheck limpio; `bunx ng build --configuration=development` compila en ~31s sin warnings. Nota diferida de Fase 3 (tooltip por-día en hover sobre la ladera) → `docs/deferred.md`.

**Diferido esperado post-cierre** (a `docs/deferred.md` cuando cada fase cierre):

- **Índice de búsqueda de commits** (full-text sobre mensajes + entidades tocadas) — familia §19.16d junto con los otros índices por familia ya diferidos.
- **Banner accionable de "compactar ahora"** en lecho de roca — futuro, cuando el flujo de compactación tenga UI dedicada.
- **Preview inline del diff en hover sobre la polaroid** — visual pulido, evaluar si suma después de Fase 4.
- **Vista secundaria de constelaciones** ("mapa de patrones de trabajo") si el rediseño principal deja hambre de ese eje — opcional, muy posterior.

## Checklist al migrar una página

1. Agregar el prefijo de ruta a `PANE_HIDDEN_PREFIXES`.
2. Diseñar layout propio que justifique el ancho ganado (no estirar el contenido viejo a 100%).
3. Si la página tiene muchas secciones internas, considerar navegación propia (tabs, TOC, cards colapsables).
4. Actualizar la tabla de arriba con la idea elegida + estado.
5. Verificar que el rail (íconos) sigue marcando la entidad activa correctamente.
