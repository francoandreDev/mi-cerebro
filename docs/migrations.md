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

### Plantilla

```markdown
### note v0 → v1 (YYYY-MM-DD)

- **Qué cambia:** descripción del campo o forma.
- **Por qué:** motivación.
- **Mapeo:** cómo se construye el nuevo formato a partir del viejo.
- **Compatibilidad:** qué pasa con archivos que ya tenían el campo, casos borde.
```
