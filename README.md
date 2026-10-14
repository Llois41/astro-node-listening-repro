# astro-node-listening-repro

On Node 26.12.0, the `@astrojs/node` standalone server never logs `Server listening on …` when `HOST` is an IP literal. It still serves requests. On Node 26.11.1 the same build logs normally.

## Versions

- `astro` 7.3.5, `@astrojs/node` 11.1.6 (`mode: 'standalone'`, `output: 'server'`)
- Node 26.12.0 (broken) and 26.11.1 (works); pnpm 12.10.1
- Reproduced in `node:26.12.0-slim` on linux/arm64 and linux/amd64

## Reproduce

With Node 26.12.0 installed:

```sh
pnpm install
pnpm build
pnpm repro
```

Or compare both Node versions in their official images (needs `docker`):

```sh
pnpm repro:docker
```

`repro.mjs` starts `dist/server/entry.mjs` on a free port, once with `HOST=127.0.0.1` and once with `HOST=localhost`. It waits three seconds, then requests `/` and reports whether the log line appeared:

```
===== node:26.11.1-slim
--- HOST=127.0.0.1
logged "Server listening": yes
GET /: HTTP 200
--- HOST=localhost
logged "Server listening": yes
GET /: HTTP 200

===== node:26.12.0-slim
--- HOST=127.0.0.1
logged "Server listening": NO
GET /: HTTP 200
--- HOST=localhost
logged "Server listening": yes
GET /: HTTP 200
```

Expected: the line is logged in every case. Anything that reads the port from it, such as a test harness starting the server with `PORT=0`, otherwise waits forever.

## Cause

`standalone.js` calls `listen()` and registers the `listening` listener only after an async step:

```js
server.server.listen(port, host);
app.getLogger().then(() => logListeningOn(app.adapterLogger, server.server, host));
// log-listening-on.js: await new Promise((resolve) => server.once("listening", resolve));
```

With an IP literal there is no DNS lookup, so `listening` fires within a tick of `listen()`. A probe placed just before `server.once("listening", …)` in the built `entry.mjs` reads `server.listening === false` on 26.11.1, but `true` on 26.12.0. On 26.12.0 the event has already fired, so the `await` never settles. With `localhost`, the DNS lookup delays the event long enough.

The trigger appears to be nodejs/node#62530 ("module: synchronously load most ES modules"), new in 26.12.0. Passing any `--import`, even an empty module, restores the old behaviour.

## Fix

In `log-listening-on.js`, skip the wait when the server is already listening:

```js
if (!server.listening) {
  await new Promise((resolve) => server.once("listening", resolve));
}
```

Patched into the built `entry.mjs`, this logs on both 26.11.1 and 26.12.0.

Related: withastro/astro#18282, the silent exit on `EADDRINUSE` (a different problem).
