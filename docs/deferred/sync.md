# Diferidos — Sync

Registro de cosas que se sacaron del scope de una fase y deben tratarse después. Cuando la fase target cierra incorporando un ítem, ese ítem se borra de acá.

Formato por entrada:

- **Qué**: una línea describiendo el ítem.
- **Por qué se difirió**: la razón concreta (no hay infra todavía, fuera del alcance del paso, decisión de UX, etc.).
- **Target**: paso del roadmap (§19) o "sin asignar" si todavía no hay decisión.
- **Origen**: paso donde se decidió postergar.

Índice completo: [`docs/deferred/index.md`](./index.md).

---

## Sync — UI (origen: rediseño /sync — tubos neumáticos, 2026-07-11)

### Detalles bonitos opcionales (silbido, sombra de cápsula, contador diario)

- **Qué**: silbido suave al despachar una cápsula (respetando el mute global), sombra de la cápsula proyectada sobre el tubo, contador acumulado discreto ("N envíos hoy") sólo si sale barato de derivar del histórico de `lastBulkAt`.
- **Por qué se difirió**: pulido visual/sonoro de baja prioridad explícitamente fuera del MVP del rediseño de `/sync`. El latón/madera del cuadro de mandos y la animación honesta de la cápsula en vuelo (sin barra de progreso falsa) ya se cerraron.
- **Target**: sin asignar.

## Sync — Push a remoto no funciona (origen: uso manual, 2026-07-01)

### ~~Investigar por qué falla `pushAll` contra el remoto real~~ (resuelto 2026-07-08)

- **Qué**: en uso real desde `/sync`, disparar "Push todo" no llegaba a subir los refs al remoto — todos los refs volvían `error`, la mayoría con mensaje `"unknown"`.
- **Estado**: cerrado. Eran cuatro bugs independientes en `remote-bulk.ts`/`remote.service.ts`, ninguno de red/auth/CORS (el proxy público y el PAT funcionaban bien):
  1. `classifyPushResult`'s `realFailure` trataba `undefined`/`''` como fallo real — `isomorphic-git` nunca pone `result.error = null` en un push exitoso, lo deja `undefined`/`''`, así que **todo** push exitoso se clasificaba como error.
  2. `refErrorOf` buscaba `result.refs[ref]` con el nombre corto del ref (`variant/x/main`), pero `isomorphic-git` indexa esa tabla con el nombre completo que devuelve el servidor (`refs/heads/variant/x/main`) — el lookup nunca encontraba nada.
  3. Una branch de facet (`draft`/`comments`) que nunca se creó porque la variante nunca entró en ese modo (creación perezosa) se reportaba como `error` permanente en cada `pushAll`/`fetchAll` en vez de `absent` — mismo tratamiento que ya existía para refs ausentes del lado del fetch, ahora aplicado también al lookup por nombre de `isomorphic-git`'s `NotFoundError`.
  4. `fetchAll` nunca funcionó: la app nunca llamaba `git.addRemote()`, así que `.git/config` no tenía `[remote "origin"]` y `git.fetch()` tiraba `NoRefspecError` en los 12 refs. Fix: `ensureRemoteConfigured()` (llamada idempotente a `git.addRemote(..., force: true)`, sin red) al inicio de cada `fetchAll()` — se auto-repara sin pedirle al usuario que reconfigure nada.
     Además, el `main` local y el `main` remoto habían divergido de raíz: el repo GitHub apuntado (`francoandreDev/docs`) tenía 2 commits viejos sin relación al proyecto. Confirmado con el usuario que no hacía falta conservarlos — se resolvió con un force-push puntual de `main` (no repetible, fue una operación manual de esta sesión, no un fix de código).
     4 tests de regresión nuevos en `remote-bulk.spec.ts` (12/12 pasan) usando la forma real de respuesta de GitHub capturada en vivo. `/sync` ahora muestra "Todo en orden (12 refs)".
- **Nota aparte**: `docs/deferred.priority-order.md` (§sección `Cómo empezar`) decía revisar el CORS proxy en `versioning/http.ts` — ese archivo no existe; la wiring real está en `remote-bulk.ts`. Corregido en este cierre.
