// CORS proxy for isomorphic-git push/fetch to GitHub — Cloudflare Worker.
//
// The browser can't talk to GitHub's smart-HTTP git endpoints directly
// (no CORS headers on GitHub's side), so isomorphic-git routes push/fetch
// through a proxy that adds them. mi-cerebro defaults to the public proxy
// (cors.isomorphic-git.org); this Worker is a self-hosted drop-in
// replacement, deployed under the user's own Cloudflare account instead of
// depending on a third party.
//
// Ported from the reference implementation (isomorphic-git/cors-proxy,
// index.js, Node/Express-shaped) to the Workers fetch-handler shape. Same
// request-shape allowlist (`isAllowed`) and CORS header lists — only the
// runtime surface changed (Request/Response instead of http.IncomingMessage
// / http.ServerResponse).
//
// why: locked to github.com specifically (the reference proxy is a generic
//      open proxy for any git host) — mi-cerebro's remote config
//      (isValidRemoteUrl) never points anywhere else, and a narrower
//      allowlist means this Worker can't be abused as an open relay if the
//      URL leaks.
const ALLOWED_HOST = 'github.com';

const ALLOW_HEADERS = [
  'accept-encoding',
  'accept-language',
  'accept',
  'authorization',
  'cache-control',
  'content-length',
  'content-type',
  'dnt',
  'git-protocol',
  'pragma',
  'range',
  'referer',
  'user-agent',
  'x-authorization',
  'x-http-method-override',
  'x-requested-with',
];

const EXPOSE_HEADERS = [
  'accept-ranges',
  'age',
  'cache-control',
  'content-length',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'location',
  'pragma',
  'server',
  'transfer-encoding',
  'vary',
  'x-github-request-id',
  'x-redirected-url',
];

const ALLOW_METHODS = ['POST', 'GET', 'OPTIONS'];
const MAX_AGE = String(60 * 60 * 24); // 24h — matches the reference proxy

function isAllowedRequest(request, url) {
  const isInfoRefs =
    url.pathname.endsWith('/info/refs') &&
    (url.searchParams.get('service') === 'git-upload-pack' ||
      url.searchParams.get('service') === 'git-receive-pack');

  switch (request.method) {
    case 'OPTIONS': {
      if (isInfoRefs) return true;
      const requested = request.headers.get('access-control-request-headers') ?? '';
      if (!requested.toLowerCase().includes('content-type')) return false;
      return url.pathname.endsWith('git-upload-pack') || url.pathname.endsWith('git-receive-pack');
    }
    case 'POST': {
      const contentType = request.headers.get('content-type') ?? '';
      return (
        (contentType === 'application/x-git-upload-pack-request' &&
          url.pathname.endsWith('git-upload-pack')) ||
        (contentType === 'application/x-git-receive-pack-request' &&
          url.pathname.endsWith('git-receive-pack'))
      );
    }
    case 'GET':
      return isInfoRefs;
    default:
      return false;
  }
}

function corsHeaders(allowOrigin, preflight) {
  const headers = new Headers();
  headers.set('access-control-allow-origin', allowOrigin);
  headers.set('access-control-expose-headers', EXPOSE_HEADERS.join(','));
  if (preflight) {
    headers.set('access-control-allow-methods', ALLOW_METHODS.join(','));
    headers.set('access-control-allow-headers', ALLOW_HEADERS.join(','));
    headers.set('access-control-max-age', MAX_AGE);
  }
  return headers;
}

export default {
  /**
   * @param {Request} request
   * @param {{ ALLOW_ORIGIN?: string }} env
   */
  async fetch(request, env) {
    const allowOrigin = env.ALLOW_ORIGIN || '*';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders(allowOrigin, true) });
    }

    // Path shape isomorphic-git sends: /<host>/<rest-of-github-path>. It
    // builds this itself from `corsProxy` + the target URL — we only ever
    // see github.com here because remote-bulk.ts always passes a
    // github.com remote URL.
    const match = url.pathname.match(/^\/([^/]*)\/(.*)$/);
    if (!match)
      return new Response(null, { status: 400, headers: corsHeaders(allowOrigin, false) });
    const [, pathHost, remainingPath] = match;

    if (pathHost !== ALLOWED_HOST || !isAllowedRequest(request, url)) {
      return new Response(null, { status: 403, headers: corsHeaders(allowOrigin, false) });
    }

    const upstreamHeaders = new Headers();
    for (const h of ALLOW_HEADERS) {
      const v = request.headers.get(h);
      if (v) upstreamHeaders.set(h, v);
    }
    // why: GitHub sniffs user-agent for git/* and changes behavior —
    //      match the reference proxy's default when the client didn't
    //      already send a git/* UA.
    if (!upstreamHeaders.get('user-agent')?.startsWith('git/')) {
      upstreamHeaders.set('user-agent', 'git/@mi-cerebro/cors-proxy');
    }

    const upstreamUrl = `https://${ALLOWED_HOST}/${remainingPath}${url.search}`;
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      redirect: 'manual',
      headers: upstreamHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    });

    const responseHeaders = corsHeaders(allowOrigin, false);
    for (const h of EXPOSE_HEADERS) {
      if (h === 'content-length') continue;
      const v = upstream.headers.get(h);
      if (v) responseHeaders.set(h, v);
    }
    if (upstream.headers.has('location')) {
      // why: rewrite so the client keeps talking to the proxy, matching
      //      the reference proxy's redirect handling.
      const rewritten = upstream.headers.get('location').replace(/^https?:\//, '');
      responseHeaders.set('location', rewritten);
    }

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  },
};
