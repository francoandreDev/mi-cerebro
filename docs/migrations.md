# Migraciones de schema

Cada entidad persistida lleva un `schemaVersion`. Cuando aumentamos esa versión, registramos una migración pura `vN -> vN+1` en `src/app/core/migrations/`. La política completa vive en `PROYECTO.md` §4.15.

## Cómo agregar una migración

1. Bump del `schemaVersion` por defecto en el tipo de la entidad.
2. Crear una función pura `(data: vN) => vN+1`. Nada de I/O, nada de servicios.
3. Registrarla en el módulo de la entidad llamando a `MigrationsService.register({ kind, latest, steps })`. Los `steps` deben formar una cadena contigua: `0->1, 1->2, ...`.
4. Documentar acá la migración: qué cambió, por qué, cómo se traduce el campo viejo al nuevo.
5. Test unitario obligatorio: archivo de la versión anterior real → versión actual esperada.

## Política

- **Backup automático antes de migrar:** `MigrationsService` ejecuta el `BackupFn` registrado antes de aplicar ningún step. La implementación de FS hace snapshot completo a `.mi-cerebro/pre-migration/<ISO>/`.
- **Nunca rompemos lectura de versiones anteriores.** Migraciones one-way: vN+1 nunca tiene que volver a vN.
- **Schemaversión más nueva que `latest` es fatal:** mejor que la app abra archivo, lo migre mal y lo pisemos. Disparamos `MCB-MIG-002`.

## Registro

### note / task / goal / list / writing / book v1 → v2 (2026-06-12)

- **Qué cambia:** cada nodo "bloque anclable" del `body` TipTap (paragraph, heading, blockquote, codeBlock, listItem, horizontalRule) gana un atributo `blockId: string` con un UUID estable, persistido como `data-block-id`.
- **Por qué:** 13c (comentarios anclados) y 13d (borrador como track-changes) necesitan un anchor que sobreviva a ediciones. El walker es la **única** vía para que entidades pre-13c queden anclables sin requerir que el usuario reabra y reedite cada archivo.
- **Mapeo:** `injectBlockIds(body)` recorre el doc y rellena `attrs.blockId` con `crypto.randomUUID()` donde falta. Idempotente: ids válidos existentes se preservan; duplicados (típicamente por copy/paste) se reemplazan. Si la entidad no tiene `body` (caso Book bajo `BOOK_KIND`, que comparte la cadena con Chapter), sólo se bump-ea `schemaVersion`.
- **Compatibilidad:** la extensión `mcBlockId` de TipTap mantiene esta invariante en runtime, así que cualquier doc abierto en el editor (incluso ya migrado) sigue ganando ids para bloques nuevos. Backup automático antes de aplicar la migración por entidad (regla §4.15).

### goal v4 → v5 (2026-06-23)

- **Qué cambia:** se agrega `reminder: { enabled: boolean }` para que las metas alimenten recordatorios automáticos vía `GoalRemindersSyncService` (§14).
- **Por qué:** unifica el "banner de meta" pre-rediseño con el sistema de Recordatorios. La cadencia es derivada del deadline (no configurable), pero el toggle por meta vive acá.
- **Mapeo:** `enabled = (deadline !== null && !completed)` — son las metas que el banner aleatorio anterior habría empujado de todos modos. Si la meta ya tenía `reminder`, se respeta.
- **Compatibilidad:** `GoalsService.save` enforza la invariante "completed o sin deadline ⇒ enabled=false" para que el sync nunca tenga que adivinar.

### reminder v1 → v2 (2026-06-23)

- **Qué cambia:** se agregan opcionales `sourceKind?: 'goal' | null` y `sourceId?: string | null` para distinguir recordatorios creados por el usuario (sin source) de los autogenerados por una meta.
- **Por qué:** el toast y la lista de `/reminders` necesitan saber el origen para enrutar "Abrir" a `/goals/<id>` y para que "borrar" desactive el toggle de la meta (en vez de dejar el sync re-creando el archivo).
- **Mapeo:** no-op; los reminders viejos quedan como user-created (`sourceKind` ausente/`null`).
- **Compatibilidad:** todos los flujos existentes siguen funcionando idénticos para reminders sin source.

### reminder v2 → v3 (2026-06-24)

- **Qué cambia:** se agrega `nextPingAt: string` requerido. `dueAt` deja de ser el momento de disparo y pasa a representar el objetivo del usuario; `nextPingAt` es lo que el scheduler usa para disparar.
- **Por qué:** §14 unifica la cadencia de avisos para todo reminder (manual o derivado de meta). `RemindersCadenceService` mantiene `nextPingAt = nextSlotFor(dueAt, now, settings.reminders.leadMinutes)`. Antes solo los goal-sourced tenían serie densificante; ahora también los manuales.
- **Mapeo:** `nextPingAt = dueAt` (los reminders viejos disparan exactamente en su `dueAt`, igual que antes; la cadence service los re-agendará al siguiente tick según el lead-time vigente).
- **Compatibilidad:** ningún consumidor leía `nextPingAt`; el scheduler ahora lo lee en vez de `dueAt`. El campo de settings `goals.reminderLeadMinutes` quedó renombrado a `reminders.leadMinutes` con fallback de lectura para no resetear configuraciones existentes.

### Plantilla

```markdown
### note v0 → v1 (YYYY-MM-DD)

- **Qué cambia:** descripción del campo o forma.
- **Por qué:** motivación.
- **Mapeo:** cómo se construye el nuevo formato a partir del viejo.
- **Compatibilidad:** qué pasa con archivos que ya tenían el campo, casos borde.
```
