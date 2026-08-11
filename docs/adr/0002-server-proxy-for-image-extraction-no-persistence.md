# Proxy image-to-spelling-list extraction through the existing server, without persisting the image

CHE-17 needs the app to send a photographed worksheet to Claude for entity extraction and get back candidate spelling sessions. The ticket asks for this to happen "in the frontend, no backend server deployed," and separately requires secure token handling — two constraints that pull against each other, since the only way to call Claude directly from the browser is to ship an API key inside the client bundle.

We're resolving this with a server-side proxy instead of a client-embedded key. A key baked into the Vite bundle is readable by anyone who opens devtools or inspects network requests — the app's PIN only gates in-app screens after the JS has already loaded, it does not gate the bundle itself, and Anthropic has no scoped/spend-limited client tokens the way e.g. Stripe or Firebase do. So there's no way to hand the browser a "safe" key.

The app already has a deployed Express server (used for session CRUD) and already stores one secret as a Render environment variable (`DATABASE_URL`). Adding one route to that server, reading the Anthropic key from a second Render env var, means the key never reaches the browser while adding no new infrastructure or deployment — satisfying "no backend server deployed" as "no new backend," which is the only reading consistent with a backend already existing (see [0001](0001-pinyin-pro-for-client-side-pinyin.md) for the precedent of avoiding backend *compute cost*, not backend *existence*).

The route is stateless: it relays the image bytes to Anthropic in memory and streams the JSON result back. Nothing is written to Postgres or disk. This was a specific requirement (not wanting to store captured images) and falls out naturally from the route just forwarding a request/response rather than persisting anything — the same lifecycle `POST /api/sessions` already has.

The new endpoint has no auth in front of it, consistent with every other route in this API today. The only cost at stake is Claude spend on a single-user app served from an unlisted URL; PIN-gating this one endpoint would add friction to the most-used flow in the app for a risk that doesn't currently exist. Revisit if the URL is ever shared more widely.

## Considered Options

- **Direct browser-to-Anthropic call with a client-embedded key** — rejected: the key is extractable via devtools/network tab regardless of the app's PIN, and Anthropic has no way to scope or rate-limit a client-held key.
- **Server-side proxy that persists the image and/or extraction result** — rejected: no product need to retain images, and persisting them adds storage and privacy surface for no benefit.
- **Server-side proxy, stateless, key as a Render env var** (chosen) — keeps the key server-side, adds no new infra, stores nothing.
