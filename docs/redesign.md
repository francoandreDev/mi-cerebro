# Redesign por página

Migración progresiva: cada página de entidad/herramienta deja de depender del **section pane** secundario de la sidebar global y adopta un layout propio que aprovecha todo el ancho. El rail vertical (íconos de entidad) se mantiene; lo que se oculta es el panel intermedio (árbol/lista contextual).

## Mecanismo

El sidebar global lee `PANE_HIDDEN_PREFIXES` en `layout/containers/workspace-sidebar.container.ts`. Cualquier ruta listada ahí renderiza solo el rail y le da el ancho restante al `<router-outlet>`. Migrar una página = agregar su prefijo a esa lista + diseñar el layout interno de la página.

## Principio

Una idea distinta por página. No replicar el mismo patrón: cada entidad tiene una forma natural de mostrarse (estantería, galería, grid de cards, tabs, etc.). El section pane era un mínimo común denominador; el redesign apuesta a lo opuesto.

## Estado por página

| Ruta         | Idea del redesign                                                                                                                                                                                                                                                                                                                                                                                                                     | Estado |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `/books`     | Estantería + page-turn 3D flip con paper bend en lectura                                                                                                                                                                                                                                                                                                                                                                              | ✅     |
| `/images`    | Museo: planta + salas con cuartos auto-paginados + mini-mapa                                                                                                                                                                                                                                                                                                                                                                          | ✅     |
| `/trash`     | Grid visual de cards con filtro por kind, búsqueda y modal detalle                                                                                                                                                                                                                                                                                                                                                                    | ✅     |
| `/settings`  | Tabs verticales sticky + panel (sección activa única)                                                                                                                                                                                                                                                                                                                                                                                 | ✅     |
| `/history`   | (heredado, sin section pane)                                                                                                                                                                                                                                                                                                                                                                                                          | ✅     |
| `/variants`  | Delta de un río: Principal = cauce; cada brazo = variante con color propio, vado (fork oid) + rombo HEAD + bandera de milestone. Flujo ambiente animado (más rápido en activa, congelado con juncos en reposo). Confluencia al mergear. Drawer `position: fixed` al fondo del viewport con card de HEAD parseado (auto/manual + reason chip), píldoras funcionales (linaje → selecciona padre, adelante → merge), acciones agrupadas. | ✅     |
| `/notes`     | Muro de stickies (CSS columns) + card "nueva" inline + chips de filtro                                                                                                                                                                                                                                                                                                                                                                | ✅     |
| `/tasks`     | Jardín de tres canteros (floración/brote/semilla) + trasplantar (DnD) + cosecha + riego                                                                                                                                                                                                                                                                                                                                               | ✅     |
| `/goals`     | Wallboard tipográfico: posters grandes en grid auto-fit + filtros + hero create                                                                                                                                                                                                                                                                                                                                                       | ✅     |
| `/lists`     | Pizarra-directorio: chalkboard + rail A–Z/tag + flow multi-columna, search dim+highlight                                                                                                                                                                                                                                                                                                                                              | ✅     |
| `/lists/:id` | Editor + capa de tiza (toggle off por default): paleta de tizas, goma, capas con visibilidad/lock/reorden — persistencia en el JSON de la lista (`chalkLayers`, schema v4)                                                                                                                                                                                                                                                            | ✅     |
| `/writings`  | Biblioteca de borrador: shelf de cards tipográficas + editor full-bleed centrado                                                                                                                                                                                                                                                                                                                                                      | ✅     |
| `/files`     | Pared de lockers numerados (color = primer tag) + apertura inline (≤6 archivos) u overlay (más)                                                                                                                                                                                                                                                                                                                                       | ✅     |
| `/music`     | v1 3 zonas (✅). v2 (✅): membrana/superficie resonante central con FFT real + biblioteca de álbumes ID3 + cola lateral + playlists en tab alternable con álbumes.                                                                                                                                                                                                                                                                    | ✅     |
| `/calendar`  | v1 wallboard (✅). v2 planificado: vista temporal unificada — mesa de luz con acetatos (mes) + agenda de cuero (semana/día). Ver detalle abajo.                                                                                                                                                                                                                                                                                       | 🔄     |
| `/reminders` | Palomar de jaulas con palomas mensajeras: puertas se abren progresivamente, paloma vuela (ruta wandering, usa toda la pantalla) al rail icon y picotea al disparar; recurrentes se posan en la campana hasta que el usuario clickea la jaula vacía para llamarla de vuelta; puntuales caen tras picotear. Filtros por fecha/nombre. Ver detalle abajo.                                                                                | ✅     |
| `/sync`      | Central de tubos neumáticos: una cápsula por ref (variante × faceta) viajando por tubos transparentes al espejo remoto; dirección = push/fetch, sellos = último sync, atasco ámbar = divergencia. Ver detalle abajo.                                                                                                                                                                                                                  | ✅     |

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

## Checklist al migrar una página

1. Agregar el prefijo de ruta a `PANE_HIDDEN_PREFIXES`.
2. Diseñar layout propio que justifique el ancho ganado (no estirar el contenido viejo a 100%).
3. Si la página tiene muchas secciones internas, considerar navegación propia (tabs, TOC, cards colapsables).
4. Actualizar la tabla de arriba con la idea elegida + estado.
5. Verificar que el rail (íconos) sigue marcando la entidad activa correctamente.
