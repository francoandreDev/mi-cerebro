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

_Sin migraciones registradas todavía._ Esta sección crece con el tiempo, una entrada por bump.

### Plantilla

```markdown
### note v0 → v1 (YYYY-MM-DD)

- **Qué cambia:** descripción del campo o forma.
- **Por qué:** motivación.
- **Mapeo:** cómo se construye el nuevo formato a partir del viejo.
- **Compatibilidad:** qué pasa con archivos que ya tenían el campo, casos borde.
```
