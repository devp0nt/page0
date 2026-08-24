# Changelog

All notable changes to point0. Add notes under **Unreleased** as you work; `bun run
release` promotes that section to the new version.

## Unreleased

## 0.4.0 — 2026-08-24

- **Navigation guards: ask before a client navigation runs.** A guard is asked
  before anything happens — no prefetch, no transition state, no history write
  until it answers — and may be async, so it can show a dialog and resolve with
  the user's answer: the whole «unsaved changes» pattern in one hook. Register
  app-wide via `createNavigation({ guard })` (overridable per `<Router guard>`),
  or tie one to a component with `useNavigationGuard` /
  `registerNavigationGuard` from `@point0/core/navigation`; the instance guard
  runs first, then the registered ones, and the first `false` blocks the
  navigation — answered like the other didn't-navigate outcomes, with a new
  `POINT0_NAVIGATION_BLOCKED`-coded error in the awaited result, never a thrown
  one. Guards receive `{ from, to }` and decide themselves what counts as
  leaving (comparing `pathname`s is the usual move, so a search-only change
  stays free). Out of scope by design: `setSearch`, browser back/forward
  (`popstate` fires after the URL already changed) and full unloads — cover
  leaving the document with `beforeunload`.

## 0.3.14 — 2026-08-21

- **Docs: the benchmarks page is re-measured on Point0 0.3.13 and Bun 1.4.** The
  whole suite was re-run on one machine in one sitting against Next.js 16.3.2,
  TanStack Start 1.168.27 and React Router 8.3.0, all on React 19.2.8, with a
  cooldown and an idle gate before each suite. Point0 leads the edit loop — HMR
  at 20 ms and the only sub-second warm dev start (972 ms); the costs are named
  plainly in the same tables — the cold whole-project type-check (6.85 s at 500
  pages on TS7), the heaviest first-load JS (150 kB) and ~230 MB of idle RSS
  above its own bare-Bun floor. The page also now says where nothing separates
  the four at all: per-edit type re-checks, felt navigation latency, and the
  entire SSR picture once a real database query enters the loader. Numbers come
  from the re-run public repo (github.com/1gr14/point0-benchmarks).

## 0.3.13 — 2026-08-21

- **`@types/bun` moved to `^1.4.0`** — it was held at 1.3.14 in the Bun 1.4
  release only because the 1.4 types were not published yet.

- **`FakeClient.destroy` waits for scheduled work before dropping its globals.**
  React finishes an unmount on a later macrotask, and that task still resolves
  `window` through the fake client — so dropping the client's values first left
  the getter answering `undefined` and the task throwing on `window.event`,
  outside any test's stack. Under Bun 1.4 the timing made this common enough to
  redden whole test files whose assertions all passed. Teardown now drains after
  both stages: the caller's `onDestroyInside` and the `onRunEndInside` that
  `run()` fires after it.

## 0.3.12 — 2026-08-20

- **Bun 1.4 is the floor.** CI runs on 1.4.0 and every `engines.bun` — the
  packages, the examples and the scaffolder's template — now reads `>=1.4.0`.
  Point0 keeps working on 1.3.14 (that is where `--no-orphans` landed), but
  1.4 is what we build and test against. `@types/bun` stays on 1.3.14 until
  the 1.4 types are published.
- **Brand assets: `point0-avatar-black` / `point0-avatar-white`** (SVG + a
  1024×1024 PNG) — the sign centred on a filled square with 15% padding, sized
  for an avatar upload.
- **CI skips the test matrix for brand-asset PRs too.** The rule that let a
  Markdown-only PR skip the cross-OS matrix now also covers files in the
  top-level `assets/` directory; anything else, images under `examples/` and
  `packages/` included, still runs the full gate.

## 0.3.11 — 2026-08-14

- **Docs: the benchmarks page is re-measured on the August 2026 stack.** Point0
  0.3.10 vs Next.js 16.3.0, TanStack Start 1.168.27 and — new on the page —
  React Router 8.3.0, all on React 19.2.7, with a streaming section and
  green/red deltas against Point0 in every table. Wins and losses both moved:
  HMR and navigation payloads still lead, while first-load JS and the cold
  type-check are named plainly as the current costs. Every number comes from
  the re-run public repo (github.com/1gr14/point0-benchmarks).
- **Docs: the socket reference links the realtime tour.** The blog walkthrough
  ("Realtime in Point0: channels, spaces and handlers") is now cross-linked at
  the top of the socket page, section by section.

## 0.3.10 — 2026-08-10

- **Sockets: `enroll` is a guarantee.** A room granted by an enroller or by
  `space.enroll()` cannot be dropped from the client: `leave()` on an enrolled
  membership warns and does nothing, and a hand-crafted `leave` frame strips
  only client-joined rooms. The server now stores each room's provenance —
  joined, enrolled, or both — a resumed connection gets it back exactly, and
  the `enrolled` frame carries only the enrolled set. The invariant you can
  build on: if a space enrolls a user's room, an open channel means that room
  is subscribed.
- **Sockets: `kick` revokes rooms, `kill` closes connections.** `kick` lives on
  space points only. Closing a connection from the server is `kill` — on a
  channel by identity, or room-addressed on a space (`space.kill({ room })`),
  so closing every connection in a user's room needs no identity iteration.
  `refresh` and `amendIdentity` take room targets on spaces too.
- **Sockets: `onEnter`/`onLeave` are room events.** They fire for every way a
  connection enters or leaves rooms — join, enroll, resume, leave, kick, kill,
  a refresh that revokes, transport loss — with a `reason` on the props and
  `rooms` always an array. Point-level callbacks hear the whole space; a
  membership's callbacks hear its own rooms, including a kick of them.
  `onDisconnect` fires on transport loss too (with
  `reason: 'socket' | 'kill' | 'close'`), and exactly once.
  `memberships.client.rooms()` reports each room with its provenance:
  `{ room, joined, enrolled }`.
- **A chunk that fails to load on a flaky network retries in place.** A dropped
  keep-alive socket or a Wi-Fi blip failed the import once and surfaced an
  error page, even though nothing was stale. The import now retries up to two
  more times (300 ms, then 1 s), re-checking the served build version before
  each attempt — a confirmed newer build skips the retries and goes straight to
  the deploy recovery, and dev still fails fast (an import failure there is a
  real error).
- **The engine's server defaults `idleTimeout` to 255 seconds.** Bun's
  10-second default silently cut long-parked requests; the dev proxy already
  sat at 255, now the production server matches it. Override via
  `bunServeConfig`.
- **Duplicate channel/space/handler names fail `generate`.** They were only
  caught at runtime; the generator now refuses them the way it refuses other
  duplicate points.
- **Point declaration locations resolve again.** The location capture walked
  the stack at a fixed depth and landed on the lets proxy's internal frame, so
  every point reported no source location; it now walks past the machinery and
  reports the first caller frame.

## 0.3.9 — 2026-08-08

- **Fixed a native memory leak on Linux — roughly a kilobyte per request.** Every
  request seeded ~20 `new Error()` phase sentinels into its server storage
  state, and on Linux each such request claimed allocator memory that was never
  returned (invisible to the JS heap, so it only showed as container RSS climbing
  until restart). Sentinels are now shared markers; the `Error` is built only
  when a wrong-phase read actually throws — and its stack now points at the
  offending read instead of the seeding site.
- **`@point0/compress`: stream failures propagate instead of hanging.** A
  response body that errors mid-stream now errors the compressed response (it
  used to hang the client forever), and a client cancelling the response tears
  down the source stream instead of leaving it open. Bun's `fromWeb`/`toWeb`
  adapters drop both signals, so the middleware pumps the streams itself.

## 0.3.8 — 2026-08-07

- **`dev --hot` no longer rejects TypeScript that `dev` and `build` accept.** Hot
  reload flattens your modules into a content-addressed store before running
  them, and it named every copy `.tsx` — where a leading `<` opens a JSX tag. So
  a plain generic arrow (`const identity = <T>(x: T): T => x`) or an
  angle-bracket assertion (`<string>x`) in a `.ts` file failed the dev server on
  boot, while the same file compiled fine in `dev` and `build`. A moved module
  now keeps the loader its own extension would give it, so all three modes accept
  and reject exactly the same source.
- **`.mts` and `.cts` files compile.** They were documented as supported and
  matched by the compiler's filter, but the bundler was handed the plain-JS
  loader for them, so their type annotations were a syntax error.
- **A syntax error reads as a syntax error.** A file whose parse failed was
  replaced with an EMPTY module, so a typo surfaced as "does not provide an
  export" from somewhere else entirely. The file is now served untransformed and
  Bun/Vite report the real error against the real file and line.
- **The compiler says what it could not do.** Every pass — point collection, the
  guarded-expression optimizer, your babel plugins — recorded what it survived
  into a list nothing ever read, so a failed plugin or an unresolved point
  produced a quietly wrong bundle and no message. Those now reach the log, named
  by file.

## 0.3.7 — 2026-08-06

- **A save made right after `point0 dev` came up is no longer lost.** Dev
  spawned its server children first and subscribed the watchers after — an
  import-graph walk per entry plus a native recursive subscribe later — so
  between `Server started` and the first live watcher there was a window with
  nothing watching, and an edit inside it produced no event and no error. The
  watchers are now subscribed before any child is spawned: when dev says it is
  up, it is watching. Dev reports itself up a beat later in exchange.

## 0.3.6 — 2026-08-05

- **The socket layer is marked experimental in the docs.** Its design is settled
  — the API went through many passes — but the implementation under it still
  needs a refactor, so sockets are the one place in point0 where a bug or an
  awkward edge is expected. The [socket page](docs/core/socket.md) and the
  [socket example](docs/examples/example-socket.md) now say that plainly,
  including what it does _not_ say about the rest of the framework.

## 0.3.5 — 2026-08-03

- **A bare `useOnMessageFromServer` on a space handler could stay deaf for the
  life of the component.** The hook attaches its listener in an effect, and when
  no connection or membership is passed it resolves one itself — but that
  resolution was invisible to the effect's dependencies, so the first attempt was
  the only one. For a space grown from an `.enroller` that is fatal rather than
  unlucky: the membership is born from the server's `claimed` frame, which always
  lands after the first render, so the attach threw "No membership for space …",
  the throw was swallowed, and the pushes kept arriving on the wire with nobody
  listening. The listener now attaches the moment its facade appears, and a
  refused attach is logged (debug) instead of vanishing — the other reasons it
  throws, an ambiguous space or an unknown connection, are permanent and used to
  leave no trace at all. Found from an app, where a sign-out in one tab never
  reached the others.

## 0.3.4 — 2026-08-03

Sockets were audited end to end — the wire, the connect/resume path, the
backplane, and the client. Everything below that is marked **breaking** changes
a default that used to be unsafe.

- **Breaking: the socket upgrade is gated by `Origin`.** A browser does not
  apply CORS to a WebSocket handshake, so any page could open a socket carrying
  the victim's cookies, and on the cold-start channel upgrade could get a live
  connection under their identity. `upgradable` never protected this — it is a
  client-group option the compiler strips from the server bundle, so the server
  cannot read it. Both upgrade shapes now pass the gate _before_ the
  `.connector` runs; the default is `socket.allowedOrigins: 'same-origin'`, and
  a request without an `Origin` header (not a browser) passes. A Capacitor app
  or a separate front-end domain lists its origins explicitly.
- **Breaking: `cors()` no longer sends `credentials` by default**, and
  `cors({ credentials: true })` without an explicit `origin` throws at creation.
  Bare `cors()` reflected any origin together with credentials, which is what
  let a foreign page read the connect ticket.
- **Breaking: `except` by room is enforced by the server** instead of riding the
  topic path, so a client cannot be reached by a frame that excluded it. `except`
  by connection id stays what it always was — echo suppression on the client —
  and is documented as such, not as a confidentiality boundary. Personal frames
  no longer carry `except*` fields at all.
- **Every client frame is validated on arrival.** The wire was parsed as
  `JSON.parse(...) as SocketClientFrame` and trusted to match the type: field
  types, non-empty ids, and caps on `resume.entries` and `leave.rooms` are now
  checked, and `null` no longer crashes the socket callback. Unknown frame kinds
  and extra fields are still ignored, so older and newer clients interoperate.
- **A frame budget per socket, in two halves.** Before `claim` it is tight —
  there is no identity and no application hook there yet; after `claim` it is
  generous, a backstop rather than a policy. Both are options and `0` disables
  them. Domain limits belong in `onBeforeServerReply` and `.joiner`, which are
  the only places that know what a particular message costs.
- **A ceiling on parked connections** (`maxParkedConnections`, oldest evicted
  first): connect-and-drop in a loop held parkings in bulk, each with its
  indexes, streams and subscriptions. An evicted parking does not lose the
  connection — the right to resume lives on the record's TTL, and the client
  returns by passport.
- **Cross-process replies to a collect are authorized**: a process forwards only
  the `(mid, cid)` pair it actually sent a frame to. This also removes the
  client-uplink → bus amplification that came with it.
- **Bus envelopes are validated like client frames** — `kick`, `amend`, `enroll`
  and the gathers are read only after the shape checks out.
- A space handler frame that names **no room** is refused with
  `POINT0_SOCKET_NOT_IN_ROOM`. The membership check sat under
  `frame.room !== undefined`, so a push with `{ room: undefined }` widened to
  the whole space.
- A payload that does not deserialize now **opens and immediately settles its
  event family** with `input: undefined` — it was the one frame the events never
  saw, which is exactly what a hostile client sends.
- Client: a `joinErr` no longer leaves rooms in the dispatch index, space frames
  never reach a membership that is not `joined`, and a socket query whose
  membership was denied drops its cache entry instead of showing the previous
  room's data forever.
- Smaller: `claim` re-checks the connection record's scope, `discard` does not
  delete an unreadable record from another scope, `pendingUpgrades` is capped and
  its seed released when the upgrade fails, `maxRooms` is checked before the bus
  subscription, the client's error string stays out of the log body, and a
  collect window no longer wedges on a broken payload.
- **All the new thresholds are engine options, not constants** — thirteen keys
  under `server.socket`, listed in
  [engine config](https://1gr14.dev/point0/latest/engine-config): frame field
  caps, both budgets, the parking ceiling, and the TTL and size of the forward
  authorization map.

Everything else in this release:

- **Breaking: `<channel.Connection>` and `<space.Membership>` take their options
  flat on props** — `reconnect`, `enabled`, the callbacks — and the `options`
  prop is gone.
- `from.ips` is ordered client-first with the peer **last**, and `from.clientIp`
  gives the one address a rate limit or a geo lookup should key on.
  `isPublicIp` and `normalizeIp` are exported from `@point0/core/request0`.
- `point0 dev` starts only the `main` entry by default. Add `devEntries` to the
  config or `--entry '*'` for the rest; an entry that exits cleanly is reported
  as finished, not as an error.
- A page without a server loader answers a `data` request with 400 instead of
  500 — `POINT_NO_SERVER_LOADER`.
- `keepScroll` on `navigate`, `<Link>` and a redirect keeps the current scroll
  position across a navigation. `mount()` takes `pageChunkHydrationTimeoutMs`,
  and hydration waits behind one barrier, which is what made a code-split page
  flash its loading state after the server had already rendered it.
- New events: `pointHandlerSendClient*`, `pointHandlerSendServer*`,
  `pointHandlerServerLateError`, and the `POINT0_SERIALIZE_FAILED` error.
- `postgresBackplane` takes a `schema` option, so its tables live outside
  `public` and `prisma migrate` stops reading them as drift.
- Expo/Metro works at all now: `@point0/compiler/plugin/babel` declared only an
  `import` condition, and Babel resolves its plugins through CJS `require`, so
  the documented `babel.config.js` died at "Failed to construct transformer"
  before bundling a single module. The subpath is requireable, and the example
  bundles for iOS on SDK 57.
- A page chunk that fails to load before hydration is logged with its reason
  instead of being swallowed. On Bun's dev runtime it was the only report there
  would ever be: a module that throws while evaluating is cached, so the next
  import of it resolves to `null` and a denied server-only import surfaced as
  "Cannot read properties of null".
- Dependencies: redis/ioredis v5 or v6, Playwright 1.62.1, `@types/node` 26,
  `@scalar/types` 0.17 (the openapi peer is `^0.17.0`), Expo SDK 57, Prettier
  3.9.

## 0.3.3 — 2026-07-31

- **0.3.2 never reached npm either** — three more Windows/format landmines: a
  prettier-plugin-jsdoc wrap that isn't idempotent (the release script now runs
  the same fresh repo-wide `format:check` CI runs, before tagging), Bun on
  Windows never dropping a slow pub/sub subscriber at `closeOnBackpressureLimit`
  (test skipped there — `dev/backlog/socket-backpressure-windows.md`), and a
  Windows temp-dir `rm` racing the OS's asynchronous handle release (the test
  harness now retries longer and leaks the dir with a warning instead of
  failing). 0.3.3 is the first published build of everything under 0.3.0.

## 0.3.2 — 2026-07-31

- **0.3.1 never reached npm either.** Its tag was pushed and the lockfile fix
  held, but the run tripped over four test-infra failures: a stale prettier
  cache had let three unformatted files through the pre-commit, the redis-race
  mocks lacked the `socketOptions` the engine now reads, the backpressure
  fan-out flood sat entirely in Windows' auto-tuned kernel buffers, and the
  socket-browser vite variant wedges on GitHub's ubuntu runners (now sat out
  there — `dev/backlog/socket-linux-ci.md`). All fixed; CI job caps are
  also tightened so a wedged job dies in minutes, not 48. 0.3.2 is the first
  published build of everything listed under 0.3.0.

## 0.3.1 — 2026-07-31

- **0.3.0 never reached npm.** Its tag was pushed, but the release run failed
  before publishing: the release script bumped every workspace version without
  refreshing `bun.lock`, and CI's `bun install --frozen-lockfile` (Bun ≥ 1.3)
  rejects a lock whose workspace versions lag the bump. `bun run release` now
  refreshes the lockfile as part of the bump. 0.3.1 is the first published
  build of everything listed under 0.3.0.

## 0.3.0 — 2026-07-31

- Sockets: four new point types — live messaging over one WebSocket per
  client. A `channel` is the authenticated connection (its `.connector` returns
  the connection identity), a `space` is a family of rooms the server's
  `.joiner` / `.enroller` admits into, and the handlers are the typed messages:
  a `serverHandler` (the client sends, `.serverReply` answers) and a
  `clientHandler` (the server pushes to connections or rooms, with optionally
  collected replies). Reconnect and resumable connections, kicks, presence,
  connection/membership enumeration, per-process metrics, lifecycle events for
  every family, the compiler's side-split stripping of the sided options — and
  a backplane for multi-process delivery: in-memory by default, a `redis://`
  URL, or the ready-made
  `@point0/engine/backplane/{bun-redis,ioredis,node-redis,postgres}` adapters.
  Docs: [socket](https://1gr14.dev/point0/latest/socket); a complete app:
  [the socket example](https://1gr14.dev/point0/latest/example-socket).
- Subscriptions: a new point type — a server stream of values over plain HTTP,
  the pull twin of a socket push. The `.loader` is an async generator (each
  `yield` streams one value); consume with `useSubscription` or the imperative
  `fetchSubscription`; a broken stream reconnects with backoff and can resume
  from a tracked cursor; foreign clients get the same stream as SSE. Docs:
  [subscription](https://1gr14.dev/point0/latest/subscription).

## 0.2.8 — 2026-07-20

- route0 bumped to `^0.3.0`, where a path param carries one descriptor —
  `{ required, type }`, plus `values` when it is restricted to a set.
- Fix: the OpenAPI path template is built from the route's tokens instead of a
  regex over the definition string, so a value constraint or a trailing `?` no
  longer leaks into it. `/api/posts/:kind(new|top)/:id` documented itself as
  `/api/posts/{kind}(new|top)/{id}`, and `/api/x/:id?` as `/api/x/{id}?`.
- A param restricted to a set now reaches the OpenAPI spec as a real JSON Schema
  `enum`, without declaring `.params(...)` by hand.

## 0.2.7 — 2026-07-20

- Page routes are matched by route0 instead of wouter's own `regexparam`
  parser. The two only agreed on plain routes: given `/:locale(ru|en)?/author`,
  `regexparam` minted a param literally named `locale(ru|en)` and matched
  `/fr/author` — a page rendered for a URL the framework considered a 404.
  Layouts always used route0's real `RegExp`; pages now do too.
- Upgraded to `@1gr14/route0` 0.2: params constrained to a value set —
  `:locale(ru|en)`, `:locale(ru|en)?` — enforced in matching, building, schema
  validation, the emitted JSON Schema and route ordering, and narrowed to the
  literal union at the type level. Also fixes the ordering that let an optional
  leading param swallow every single-segment top-level route, and rejects a
  route naming the same param twice.
- The dev proxy no longer cuts long-polls at Bun's idle timeout.
- `bunServeConfig` is typed as a partial override.
- The compiler resolves imports without the TypeScript compiler API.
- The toolchain guard only guards the `tsc` of packages that actually run it.

## 0.2.6 — 2026-07-14

- `.scrollPosition()` now actually restores a custom scroll container — it
  never did. The code-split page's chunk wasn't loaded for the server-rendered
  page, so the lookup silently fell back to the window, capturing and restoring
  the window's offset instead of the container's. Restoration now loads the
  chunk first (answering "not yet" while it's in flight), honours a code-split
  page's `.scrollRestore()` policy, and waits for the container to render
  instead of giving up.
- Reloading a scrolled page no longer flashes at the top before jumping back.
  The browser now restores document loads (reload, cross-document
  back/forward) — it does that before first paint, which no post-hydration
  JavaScript can match — while Point0 keeps restoring everything the browser
  can't: same-document navigation, late-growing content, custom containers,
  `#hash` entries, and `ssr: false` pages.
- Restores pin `behavior: 'instant'`, so `scroll-behavior: smooth` no longer
  animates them (the retry used to read that animation as the user scrolling
  and back off for good).
- A scroll getter for a container not in the DOM reports `undefined` instead of
  `{ x: 0, y: 0 }`, so a capture while unmounted can't overwrite the real
  remembered position with the top.

## 0.2.5 — 2026-07-13

- SSR now renders your app as its own React root (the `#root` element) instead
  of nesting it inside a whole-document React tree. React's `useId` is relative
  to the render root, so the old shape offset every id — and React 19.2 turned
  that into a hard hydration mismatch (visibly diverging Radix ids). The
  document shell is now rendered separately and streamed around the app. One
  consequence: React 19's native `<title>`/`<meta>` hoisting can't reach the
  document `<head>` from inside your components — route head tags through
  `.head()` / unhead, the documented path.

## 0.2.4 — 2026-07-10

- Every string two independently compiled sides must agree on — the `x-point0-*`
  headers, the `/_point0/` path family, the globals the SSR html injects — now
  lives in one `protocol.ts` module per package (`@point0/core` for the wire
  contract, engine/compiler for their internal ids), imported by both sides and
  pinned by tests. No wire behavior changes; the only visible difference is that
  the generated OpenAPI document now spells its header parameters lowercase
  (`x-point0-transform`, `x-point0-output-type`) — header names are
  case-insensitive per spec, so existing clients keep working.
- The generated points meta (what `point0-project-mcp` serves) now carries the
  endpoint URLs the server actually mounts. The compiler used to bake raw
  camelCase segments (`/_point0/root/mutation/ideaCreate`) while the server
  mounts kebab (`/_point0/root/mutation/idea-create`), so anything trusting the
  meta called a 404. Both sides now kebab-case identically.
- Two type-guard copy-paste fixes: the validate-fn overload of `.cookies()`
  checked the new schema against the HEADERS schema instead of the cookies one,
  and `.use()` checked a plugin's search/body/headers/cookies schemas against
  the point's PARAMS schema. The guards now compare like with like — plugin code
  whose schema mismatch previously slipped through (or was falsely rejected) may
  see its type errors change accordingly. Types only, no runtime change.
- Removed the dead `_endpointPrefix` option on `Point0`. It reached one of the
  nine places that build `/_point0/` paths, so setting it silently broke the
  other eight; nothing ever set it. The prefix is a constant
  (`POINT0_INTERNAL_PATH_PREFIX`), not an option.
- `getLocation()` and `getSearch()` now answer on the server wherever the
  request stands for a page: a page's loader — and every RSC server component
  its data returns, `defer`red subtrees included — on the SSR render, the
  client-navigation data fetch, plain refetches, and `ssr(false)`. A layout's
  loader answers only while a page renders or prefetches around it (a layout
  has no route of its own); a query or mutation point still throws — keep the
  value in the query input, which also keys the cache. On the server
  `origin`/`href` may come from the `Referer`, so don't build
  security-sensitive absolute urls from them. `useLocation()` is unchanged: a
  hook, for pages, layouts and islands — never a server component.
- A page fetched through its endpoint no longer loses its origin. The page url was
  built from the `Referer` alone, so a request without one
  (`Referrer-Policy: no-referrer`, a privacy extension) produced an origin-less
  page location. On the client-navigation prefetch that location matched no page:
  the response carried an empty dehydrated state and the browser refetched
  everything after hydration. The origin now falls back to the root's
  `.clientUrl()` / `.serverUrl()`, and then to the request's own.
- An origin-less location no longer corrupts its own pathname. The router read it
  back by string-concatenating the origin, so a missing one became the literal
  segment `"/undefined/…"` — e.g. `/undefined/ideas/42`. It now yields a relative
  href, which is what an origin-less location means.

## 0.2.3 — 2026-07-09

- **0.2.2 never reached npm either.** Its tag was pushed and the whole test
  matrix passed, but the publish job failed: npm `12.0.0` (just promoted to
  `latest`) ships a broken provenance path (`Cannot find module 'sigstore'`) and
  the release CI upgraded npm to `latest` before publishing. The publish job now
  pins npm to 11.x, so a brand-new npm major can't break provenance again. 0.2.3
  is the first published build of everything listed under 0.2.0 through 0.2.3.

## 0.2.2 — 2026-07-09

- **0.2.1 never reached npm either.** Its release tag was pushed, but the run
  failed on the vite client-bundle leak fixed below, so npm `latest` stayed at
  0.1.12.
- Vite production builds no longer intermittently leak server-only method
  arguments into the client bundle. Rolldown transforms modules in
  nondeterministic order: when a page compiled before the file defining its
  parent point, that point got registered from a disk parse of the parent file,
  and the parent's own client compile then shook the stale AST instead of the
  one being emitted — `.middleware(cors())` (and any other server-only args)
  survived, pulling `@point0/cors` into the client chunk on ~50% of builds. The
  compiler now reuses a registered point only when it is bound to the exact AST
  being compiled.

## 0.2.1 — 2026-07-09

- **0.2.0 never reached npm.** Its release tag was pushed, but the release run
  failed on a CI flake before the publish step, so npm `latest` stayed at
  0.1.12.
- The RSC hole-deadline timer no longer calls `.unref()`. On bun-on-Windows a
  fired deadline timer could busy-spin the event loop and keep a short-lived
  process from exiting; dropping `.unref()` works around it. Trade-off: an exit
  with a genuinely un-settled hole now waits at most `holeTimeoutMs` for the
  deadline to fire.

## 0.2.0 — 2026-07-09

- Streamed SSR, rebuilt end to end. React renders the whole document (no
  wrapper div, no string splicing), the shell flushes immediately, and slow
  parts stream into the same response. Per-query `ssr` and `suspend` options
  control what the server awaits, streams, or leaves to the client. BREAKING
  rename: `ssr.allowedRerendersCount` / `ssr.forbiddenRerendersCount` →
  `allowedDiscoveryRenders` / `forbiddenDiscoveryRenders`, now counting
  discovery renders (old `N` ≡ new `N + 1`; `0` skips discovery entirely — the
  earliest possible shell).
- RSC — React elements as data. A server loader can return React elements,
  whole or nested in the output (gated by `.rsc({ depth })`): plain function
  components run on the server and ship as markup (their code never reaches the
  browser), component points hydrate as interactive islands resolved from the
  points collection, and everything rides the normal data pipe — SSR, client
  fetches, caching, both bundlers, no Flight, no directives.
- `defer(element, fallback?, errorFallback?)` streams a slow server subtree as
  a hole in the same response — over the SSR document and over client fetches
  (NDJSON, gated on the `x-point0-stream` header; foreign clients get the
  subtree inlined). Waiting streams heartbeat every 5s so idle reapers (Bun's
  10s default, proxies) never kill a legitimately slow subtree, and every hole
  carries a deadline — `.rsc({ holeTimeoutMs })`, default 60s — so a hung one
  fails loud with `POINT0_RSC_HOLE_TIMEOUT` instead of holding the connection.
- Promises as island props. Hand a still-resolving value straight to an island
  prop — `<Stats slowStats={getSlowStats()} />` — and the island mounts LIVE at
  once (first SSR paint included) while the value streams into the prop; the
  island reads it with React 19 `use()`. Non-streaming consumers get the value
  awaited inline.
- Per-point `.ssr(false | options)` split from `.clientOnly()`: whether the
  server executes a point during SSR and whether its render runs only in the
  browser are now independent switches.
- Query-family reads go over GET (`?input=` JSON, automatic POST fallback for
  oversized or binary inputs), so CDNs can cache them; new packages
  `@point0/cache-control` (correct `Cache-Control` per response variant,
  content-hashed assets immutable) and `@point0/compress` (streaming
  brotli/gzip/zstd with per-chunk flush).
- `createQueryClient` now takes a config factory and merges it over Point0's
  defaults (element-carrying query data opts out of structural sharing);
  passing a `QueryClient` instance throws. BREAKING for
  `createQueryClient(() => new QueryClient())` apps.
- The server loads the client points eagerly: every page/layout module is
  imported up front, so SSR never suspends on a `React.lazy` chunk — slightly
  heavier dev boot, fully-warm prod boot. The browser bundle keeps the lazy
  collection (code splitting unchanged).
- On the very first client-side mount of an SPA (`ssr: false`, no server HTML)
  the root/layout `.loading()` renders while the first page chunk loads —
  previously the root stayed blank. Client navigations are unaffected.
- What SSR renders for a FAILED loader explicitly follows TanStack's
  `retryOnMount`, exactly like a client mount; recommended:
  `.queryOptions({ retryOnMount: false })` on the root (every example now does)
  to render the real `.error()` + its `.head()` into the SSR HTML. See "Failed
  loaders and retryOnMount" in the SSR docs.

## 0.1.12 — 2026-07-03

- Internal: cleared dead imports and an unused store-dir helper from the engine
  `dev-hot-reload` / `dev-source-maps` tests, so `bun run lint` is green across
  the whole repo. No runtime or API change.

## 0.1.11 — 2026-07-03

- `point0 dev` now forwards origin `Content-Encoding` transparently. A server
  compression middleware (gzip/brotli) used to serve a 200 + blank page in dev
  (`ERR_CONTENT_DECODING_FAILED`): the client dev-server proxy's `fetch()`
  decoded the body but left the `Content-Encoding` header on it, so the browser
  tried to decode already-decoded bytes. The proxy now forwards the compressed
  bytes as-is (`decompress: false`) on every hop, so origin compression behaves
  in dev exactly as in a production build.
- Scroll restoration is now the router's job, not the browser's. Point0 sets
  `history.scrollRestoration = 'manual'` and becomes the single source of truth:
  a push scrolls to the top (or the target `#hash`), while back/forward restores
  the remembered position — even when the URL carries a `#hash`, where the
  browser would otherwise jump to the fragment instead of the saved offset.
  Positions are remembered per URL and persisted to `sessionStorage`, so a
  reload lands back at the same offset; a first load with a `#hash` is treated
  as a deep link and jumps to the anchor. While the entering page is still
  growing (async data, images), the restore re-applies for up to ~1s and backs
  off the instant anything else moves the scroll, so it never fights the user.
- `navigate.to(...)` now resolves a string target relatively, the way a browser
  resolves an `<a href>`: `'edit'` from `/ideas/list` goes to `/ideas/edit`,
  `'../x'` climbs a segment, a bare `'#section'` stays on the current URL
  (keeping its search), and a bare `'?page=2'` replaces just the search.
  Root-relative (`'/x'`) and same-origin absolute targets become root-relative
  hrefs; cross-origin ones go to `openExternal`; an unparsable target is handed
  to the adapter as-is.
- Docs: the intro overview and README gain a "The rest of the framework" section
  that sizes up everything beyond the five examples, and lead with a tighter
  pitch ("the scope of Next.js and TanStack Start, the simplicity of tRPC"). The
  README's `## Root` heading becomes `## Root point`, matching the overview.

## 0.1.10 — 2026-07-03

- Docs fix: the overview's `## Root` heading is renamed to `## Root point`. Its
  slugified anchor id was `root`, which collided with the docs site's `#root`
  mount element and broke that page's layout. (Matches full-overview, which
  already uses "Root point".)

## 0.1.9 — 2026-07-03

- Docs only: the intro is reshaped — `overview.md` is now the short pitch, the
  long announcement-article walkthrough moves to `full-overview.md`, and a new
  `benchmarks.md` sizes Point0 up against Next.js and TanStack Start. The
  reference pages (points, methods, core, engine, extra, examples) get a
  prose-tightening pass: same facts, denser (~600 fewer lines across 61 pages).
  No package code changed — this cut just moves the stable tag so the docs site
  serves the reworked content.
- Repaired the `@point0/docs` outline test that had pinned the `overview` page
  as an example of nested subsections; the reshape made `overview` a flat short
  pitch, so the test now reads `full-overview` (the deep-structured page). This
  is why v0.1.8 was tagged but never published — its release run went red on the
  stale assertion; 0.1.9 supersedes it.

## 0.1.7 — 2026-07-01

- `create-point0-app`: after scaffolding, it now prints a "Next steps" note —
  `cd <app>` (unless created in place) then `bun dev`, and `bun install` +
  `bun run setup` first when `--no-install` was used — instead of ending on a
  bare "created successfully" line.

## 0.1.6 — 2026-07-01

- `create-point0-app`: the template now ships a real `public/robots.txt`
  (crawl-open by default) instead of the `some.txt` placeholder, so a scaffolded
  app has a sensible robots file from the first run; the e2e test now asserts the
  client dev server serves it.
- Docs: the scaffold commands now recommend `bun create point0-app@latest` /
  `bun create start0@latest`, so `bun create` always fetches the newest
  scaffolder instead of a cached one.

## 0.1.5 — 2026-07-01

- `create-point0-app`: a scaffolded app now gets its `.gitignore` (the template
  ships it as `gitignore`, since npm strips real dotfiles, and the scaffolder
  materializes it) and a `.env` copied from `env.example`; the published package
  no longer ships `template/dev.db` or `template/src/generated`.
- Template and examples `lib/error.ts` now use the published `@1gr14/error0`
  redirect / stack plugins instead of the pre-publication local shim.

## 0.1.4 — 2026-06-30

- Dev hot-store now rewrites import specifiers via AST instead of a text regex,
  so a specifier that appears quoted inside a string or template literal (e.g. an
  `import …` shown as a code sample on a page) is no longer corrupted in the
  dev-served / SSR'd output — only real import / export-from / dynamic-import /
  require source positions are rewritten.

## 0.1.3 — 2026-06-29

- `.with` now keeps the query of a callable (component) point passed to it: the
  type discriminator tests the point brand before the function check, so the
  component's `input` is accepted and its query is no longer silently dropped
  (types-only — the runtime was already correct). See
  [docs/methods/with.md](docs/methods/with.md).
- Vite dev no longer hits "Port already in use" when re-serving after a page
  edit: the server-HMR dispose/accept block now lives on the server entry
  (`index.server.ts`), so a bubbling SSR-program reload disposes the old Bun
  server before the new one binds.

## 0.1.2 — 2026-06-29

## 0.1.1 — 2026-06-29

- Initial release.
- Per-page module preloading: production builds emit a preload manifest and the
  server injects `<link rel="modulepreload">` per request for the entry's shared
  closure plus the requested page's own chunks (bun + vite). Production-build-only
  — never injected in dev (a stale `dist` manifest can't leak into dev-served
  HTML) — and disablable entirely via `POINT0_MODULE_PRELOAD=false`. See
  [dev/docs/preload-manifest.md](dev/docs/preload-manifest.md).
