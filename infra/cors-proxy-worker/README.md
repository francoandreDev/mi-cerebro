# Proxy CORS propio (Cloudflare Worker)

Reemplazo self-hosted del proxy público de isomorphic-git
(`cors.isomorphic-git.org`), que mi-cerebro usa por defecto para push/fetch
a GitHub (el navegador no puede hablarle directo a GitHub por CORS). No es
obligatorio — el proxy público sigue andando y no está señalado como
inseguro, esto es sólo para quien prefiera no depender de un tercero.

**Costo esperado: $0.** El plan gratis de Cloudflare Workers da 100.000
requests/día — push/fetch manuales de un solo usuario ni se acercan a eso.
No hace falta tarjeta para activarlo.

## 1. Crear la cuenta de Cloudflare (si no tenés una)

1. Andá a [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. Registrate con tu email — no pide tarjeta para el plan gratis de
   Workers.
3. Confirmá el email (te llega un link).
4. Ya con la cuenta creada, no hace falta configurar nada más ahí manualmente
   — el siguiente paso (`wrangler login`) se encarga del resto.

## 2. Instalar Wrangler (CLI de Cloudflare) y loguearte

Desde esta carpeta (`infra/cors-proxy-worker/`):

```bash
bunx wrangler login
```

Esto abre el navegador para autorizar la CLI contra tu cuenta. Si preferís
no instalar nada global, `bunx` lo baja al vuelo cada vez — no ensucia el
`package.json` del proyecto principal (este Worker es standalone, no forma
parte del build de Angular).

## 3. Deployar

```bash
bunx wrangler deploy
```

Al terminar, la CLI imprime la URL del Worker, algo como:

```
https://mi-cerebro-cors-proxy.<tu-subdominio>.workers.dev
```

Esa es la URL que vas a pegar en mi-cerebro.

## 4. Conectarlo en mi-cerebro

1. Abrí `/settings` → sección "Versionado remoto".
2. En el campo **"Proxy CORS propio (opcional)"**, pegá la URL del paso 3
   (sin trailing slash, ej. `https://mi-cerebro-cors-proxy.tu-nombre.workers.dev`).
3. Guardar. Los próximos push/fetch usan tu proxy en vez del público — el
   campo queda vacío para volver al público en cualquier momento (borrarlo
   y guardar).

## Notas de seguridad

- El Worker sólo reenvía requests a `github.com`, y sólo las formas de
  request que el protocolo git smart-HTTP realmente usa (`info/refs`,
  `git-upload-pack`, `git-receive-pack`) — no es un proxy abierto a
  cualquier host, a diferencia del proxy público de referencia que sí lo es
  (ver `worker.js`, comentario en `ALLOWED_HOST`).
- El PAT de GitHub nunca pasa por Cloudflare en texto plano fuera de HTTPS
  — viaja en el header `Authorization`, igual que contra el proxy público;
  este Worker no lo loguea ni lo persiste en ningún lado.
- `ALLOW_ORIGIN` en `wrangler.toml` queda en `"*"` por defecto (mismo
  default que el proxy público). Si servís mi-cerebro desde un origin fijo
  (no `localhost` cambiante), podés restringirlo — ver el comentario en
  `wrangler.toml`.

## Redeployar tras cambios

Si tocás `worker.js`, `bunx wrangler deploy` de nuevo alcanza — Cloudflare
actualiza el mismo Worker en la misma URL, no hace falta reconfigurar nada
en mi-cerebro.
