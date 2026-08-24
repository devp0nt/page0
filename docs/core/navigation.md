---
index: 100
title: Navigation
description:
  Type-safe routing, links, and programmatic navigation by point name — plus
  redirects and prefetch policies.
---

Navigation is one factory call. `createNavigation` reads your generated `routes`
and hands back everything the client needs to move between pages: a `<Link>`, an
imperative `navigate()`, a `<Redirect>`, the `<Router>` that renders pages, and
the location/search hooks. The first page load is server-rendered (when SSR is
on); after that, navigation between pages is client-side (SPA-style) — no full
reload. Everything is typed against your real routes — you navigate by **point
name and params**, never by hand-built URL strings.

```tsx
// src/lib/navigation.ts
import { createNavigation } from '@point0/react-dom/router'
import {
  navigate as browserNavigate,
  useBrowserLocation as hook,
} from 'wouter/use-browser-location'
import { routes } from '@/generated/point0/routes'
import { AppError } from '@/lib/error' // your own error class, or just the built-in ErrorPoint0

export const {
  navigate,
  Link,
  NavLink,
  Redirect,
  redirect,
  Router,
  RouterRoutes,
  useNavLink,
  InferNavigation,
} = createNavigation({
  routes,
  navigate: browserNavigate,
  hook,
  ErrorClass: AppError, // optional — defaults to ErrorPoint0
})

// Embeddable link props with this app's routes baked in (see InferNavigation, below).
export type AppLinkProps = typeof InferNavigation.LinkProps
export type AppNavLinkProps = typeof InferNavigation.NavLinkProps
```

```tsx
// anywhere in a component:
;<Link route="ideaView" input={{ id: idea.id }}>
  {idea.title}
</Link>
await navigate('ideaView', { id: idea.id }) // same target, imperatively
```

You export these once and import them across the app.

## Setup: `createNavigation`

`routes` comes from codegen (`@/generated/point0/routes`); the `hook` is the
wouter location hook for your platform. Everything else is optional. If you omit
`routes` and never call `ClientPoints.mount(points)` first, setup throws:

```tsx
export const { navigate, Link /* … */ } = createNavigation({
  navigate: browserNavigate,
  hook,
})
// throws "You should provide routes, or call ClientPoints.mount(points) before createNavigation"
```

`ErrorClass` is the error class navigation uses — it types the `error` you get
back from `navigate()` and lets `<Redirect>` carry your errors. It defaults to
the built-in `ErrorPoint0`; pass your own class (any class of the same or wider
shape) to override it. See [error handling](error-handling). Pass `hook` and
Point0 derives the imperative adapter-navigate and the search hook from it;
passing `navigate: browserNavigate` as well (as the examples do) is harmless but
redundant when `hook` is `useBrowserLocation`.

Other options you reach for less often: `Page404` / `layout404` (rendered on no
match), `addHashToLocation`, `openExternal` (see [below](#leaving-the-spa)),
`scrollToHash`, `forceRerender`, and `prependRoutes` / `appendRoutes`. The full
list is in the [reference](#createnavigation-options).

## Links

`<Link>` renders an `<a>` that the router intercepts — clicking it navigates
client-side (SPA-style), no full page reload. The target is one of three
mutually exclusive forms:

```tsx
<Link route="ideaView" input={{ id: idea.id }}>Open</Link>     // by point name + typed params
<Link to={routes.ideaView({ id: 123 })}>Open</Link>           // same target, built via the routes map
<Link to="/ideas/123?tab=news">Open</Link>                    // raw internal path
<Link href="https://example.com">External</Link>              // leaves the app (plain <a>)
```

- `route` + `input` is the usual form: `input` is typed to the route's params,
  and **required exactly when the route has required params** — omit it on
  `route="about"` (no params), but `route="ideaView"` forces `input={{ id }}`.
- `to` is a raw internal path — useful when you already have a URL string, or
  when you build one from the [`routes`](#the-points-route-pointroute) map
  (`to={routes.ideaView({ id })}`).
- `href` leaves the app entirely. It renders a plain `<a href>` with no router
  interception and **no prefetch** — for cross-origin or non-app URLs.

A `<Link>` accepts all native `<a>` attributes (`className`, `target`, `rel`,
`onClick`, …):

```tsx
<Link route="ideaView" input={{ id }} className="text-blue-600 hover:underline">
  {idea.title}
</Link>
```

It also takes `asChild` — the wouter slot pattern. With `asChild`, `<Link>`
renders no `<a>` of its own: it clones its single child (which must be a valid
element) and injects the resolved `href` and `onClick` onto it, so your own
element becomes the link.

```tsx
<Link route="ideaView" input={{ id }} asChild>
  <MyButton>Open</MyButton>{' '}
  {/* MyButton receives href + onClick, no extra <a> */}
</Link>
```

`asChild` only applies to internal (`route` / `to`) links. An `href` link, or
any link opened in a new tab, always renders a plain `<a>` and ignores
`asChild`. For turning an arbitrary component into a link by _props_ rather than
by nesting, use `splitLinkProps` instead — see
[InferNavigation](#infernavigation-embeddable-link-props).

> **GOTCHA:** an unknown `route` name on a `<Link>` does **not** throw — it logs
> an error and renders `href="#"`. `navigate(...)` with an unknown name _does_
> throw.

### Search and hash in the target

`input` carries route params plus two special keys: `'?'` for the query string
and `'#'` for the hash. They work on both `<Link>` and `navigate`:

```tsx
navigate('ideaList', { '?': { filter, sort } }) // => /ideas?filter=…&sort=…
navigate('ideaView', { id, '#': 'comments' }) // => /ideas/123#comments
```

## Imperative navigation

`navigate(route, input?, options?)` mirrors `<Link>`. It returns a promise that
resolves once the navigation settles:

```tsx
const { location, error } = await navigate('ideaView', { id: idea.id })
// location = the new location; error = an instance of your ErrorClass, or undefined
```

The most common spot is after a mutation:

```tsx
await mutation.mutateAsync(
  { title, content },
  {
    onSuccess: async ({ idea }) => {
      await navigate('ideaView', { id: idea.id })
    },
  },
)
```

Variants:

```tsx
await navigate.to('/ideas/123?tab=news') // raw URL instead of a point name
navigate.back() // window.history.back()  (no-op on server)
navigate.forward() // window.history.forward()
```

`navigate(...)` doesn't throw on a failed navigation — the transition still
completes, and the error (logged under the `navigation` category) comes back in
the resolved `{ location, error }`.

### Adapter options: replace, state

`replace` and `state` pass through to the underlying router (wouter):

```tsx
await navigate('ideaView', { id: '123' }, { replace: true }) // replace history entry, no Back trap
```

## Per-link and per-navigate options

Both `<Link>` and `navigate` take an options object for prefetch overrides,
callbacks, and tab/scroll behavior. On `navigate` it's the third argument; on
`<Link>` they're props.

```tsx
navigate('ideaView', { id }, { prefetch: 'none' })          // skip prefetch for this nav
navigate('docs', undefined, { newTab: true })               // open in a new tab
<Link route="ideaView" input={{ id }} prefetchOnHover="serverAndClientQuery">…</Link>
<Link route="ideaView" input={{ id }} prefetch="none">…</Link> // disable both triggers
```

| Option               | On `navigate` | On `<Link>` | What it does                                                  |
| -------------------- | :-----------: | :---------: | ------------------------------------------------------------- |
| `prefetch`           |       ✓       |      ✓      | Override the page's prefetch policy (both triggers on a Link) |
| `prefetchOnHover`    |               |      ✓      | Override only the hover-prefetch policy                       |
| `prefetchOnNavigate` |               |      ✓      | Override only the click/navigate-prefetch policy              |
| `before`             |       ✓       |      ✓      | Callback run before prefetch (`(to, options) => …`)           |
| `after`              |       ✓       |      ✓      | Callback run after the navigation commits                     |
| `newTab`             |       ✓       |      ✓      | Open the target in a new tab (via `openExternal`)             |
| `scrollToHash`       |       ✓       |      ✓      | Override the global scroll-to-hash policy                     |
| `keepScroll`         |       ✓       |      ✓      | Keep the scroll where it is for this one navigation           |

On a `<Link>`, `prefetchOnHover ?? prefetch` controls hover and
`prefetchOnNavigate ?? prefetch` controls the click. `before` / `after` are
fire-and-forget — they aren't awaited. A hover prefetch that fails (offline, a
[stale deploy](#stale-deploys)) stays quiet — it logs at the `debug` level and
nothing surfaces; the real navigation loads the page itself and runs its own
recovery.

## Active links: `NavLink` and `useNavLink`

`<NavLink>` is `<Link>` that knows whether it points at the current location. It
sets a class based on the **match state** between the link's route and the URL:

```tsx
<NavLink
  route="ideaList"
  className="px-3 py-2"
  exactClassName="text-blue-600 font-semibold" // exact same page
  ancestorClassName="text-blue-600" // this route is a parent of the URL
/>
```

The state comes from matching the link's route against the current **pathname**
(via `route.getRelation`); `exact` vs `same` is then split by comparing the full
href. The five states:

| State        | Meaning                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exact`      | the route's pathname matches **and** the full href is identical (path + search + hash)                                                                              |
| `same`       | the route's pathname matches but the full href differs — a different `?search`/`#hash`, or a different param value (`/ideas/1` while the link points at `/ideas/2`) |
| `ancestor`   | this route is a parent of the current URL                                                                                                                           |
| `descendant` | this route is a child of the current URL                                                                                                                            |
| `unmatched`  | no relation                                                                                                                                                         |

`className` also accepts a function or an object map:

```tsx
<NavLink route="ideaList" className={(state) => (state.exact ? 'active' : 'idle')} />
<NavLink route="ideaList" className={{ default: 'px-3', exact: 'active', ancestor: 'active' }} />
```

For custom active UI without rendering an `<a>`, use `useNavLink` — it returns
the state plus the resolved href:

```tsx
const { exact, ancestor, tohref } = useNavLink({ route: 'ideaList' })
return <MyButton highlighted={exact || ancestor} href={tohref} />
```

## Redirects

`redirect(...)` builds a redirect — it does **nothing** by itself. You `return`
or `throw` the result, or pass it to `<Redirect>`. Same call shape as
`navigate`:

```tsx
redirect('signIn') // by point name
redirect('ideaView', { id }) // with params
redirect.to('/login') // raw path
redirect('signIn', undefined, { status: 308 }) // SSR HTTP status
```

There are three ways to fire one:

**From a page component** — return `<Redirect>`. It works under SSR (it sets the
HTTP status code) and on the client:

```tsx
export const accountPage = root.lets
  .page('/account')
  .page(({ props: { me } }) =>
    me ? <Account me={me} /> : <Redirect route="signIn" />,
  )
```

**From `.with`** (the auth-gate spot) — return a `redirect(...)`:

```tsx
export const redirectAuthorizedPlugin = Point0.lets
  .plugin()
  .use(mePlugin)
  .with(({ props: { me } }) => (me ? redirect('home') : { me }))
  .plugin()
```

**From a loader or `.ctx`** — `return` or `throw` it (both work):

```tsx
export const ideaPage = root.lets
  .page('/ideas/:id')
  .use(mePlugin)
  .loader(async ({ ctx }) => {
    if (!ctx.me) throw redirect('signIn')
    return { idea: await findIdea() }
  })
  .page(/* ... */)
```

The same `redirect(...)` value works in all three places, so an auth plugin can
gate both server loaders (in `.ctx`) and the render (in `.with`) with one helper
— see [Plugin](plugin). What happens to it depends on **where** the redirect is
produced:

- **During the initial SSR page load** — the server short-circuits the render
  and replies with a real HTTP redirect carrying the status code (`302` by
  default, or whatever you passed). The browser follows it before any of your JS
  runs.
- **From a mutation or query** (a point fetched by the point0 client) — there is
  no HTTP redirect. The redirect comes back to the client as a serialized
  instruction (tagged with an `x-point0-redirect` header), and the client
  performs the navigation itself — client-side, SPA-style, no full page reload.

`<Redirect>` also takes a `task` prop directly:

```tsx
<Redirect task={someRedirectTask} />
```

Valid `status` values are `301`, `302`, `303`, `307`, `308`; anything else (or
none) falls back to `302`. `redirect(...)` carries `replace`/`state` through to
the adapter, so `redirect.to('/x', { replace: true })` replaces the history
entry instead of pushing.

## Reading the location

`location` is available as a prop on every page/layout component and via hooks
from `@point0/core/navigation`:

```tsx
import { useLocation, getLocation } from '@point0/core/navigation'

const location = useLocation()
location.pathname // "/ideas/123"
location.search // parsed query object
location.searchString // raw "?tab=news"
location.hash // raw "#comments" — empty unless addHash is on (see below)
location.route // the matched template, e.g. "/ideas/:id"
location.params // parsed route params
location.href // absolute, when the location has an origin; location.hrefRel = path+search+hash
```

`useLocation()` re-renders on navigation; `getLocation()` reads it imperatively
(and throws `"Current location is not yet initialized"` if called before the
router mounts).

### Reading the location on the server

`useLocation()` is a hook, so it needs a React render: pages, layouts and
[component points](component) — including the ones that mount as
[RSC islands](rsc#interactive-islands-component-points). A
[server component](rsc#server-components) is not a render at all, it is one
plain function call, so no hook runs in it. Read `getLocation()` there:

```tsx
import { getLocation } from '@point0/core/navigation'

const Breadcrumbs = async () => {
  const location = getLocation() // no React render needed
  return <nav>{location.pathname}</nav>
}

export const ideaPage = root.lets
  .page('/ideas/:id')
  .rsc({ depth: 1 }) // usually inherited from the root — see the RSC page
  .loader(async () => ({ crumbs: <Breadcrumbs /> }))
  .page(({ data }) => <main>{data.crumbs}</main>)
```

On the server `getLocation()` — and `getSearch()`, which reads through it —
answers whenever the request **stands for a page**, and which points those are
is worth being precise about:

| Reading from…                                 | On the server                                                    |
| --------------------------------------------- | ---------------------------------------------------------------- |
| a **page** loader, or its server components   | always — SSR, the navigation data fetch, a refetch, `ssr(false)` |
| a **layout** loader, or its server components | only while a page renders or prefetches around it                |
| a **query** or **mutation** loader            | throws — nothing about the request names a page                  |

A page always answers because the request that carries its loader addresses the
page itself, so the location can be rebuilt from the route and the input. A
query or a mutation never had a page to name.

A layout is the case to be careful with. It answers while a page is rendered or
prefetched around it — but a layout has no route of its own, so the moment its
query is fetched **on its own**, there is nothing to rebuild a location from and
the call throws. That happens on an invalidation, on a `staleTime` refetch, and
on a client-side navigation whose layout data isn't already fresh in the cache —
so "the navigation data fetch" being safe for a page does **not** make it safe
for a layout.

> **Where it can throw, keep the location in the query input.** A value in the
> input keys the cache; an ambient read does not, so one entry would serve two
> different locations. Page and layout loaders already receive `params` and
> `search` — prefer those, and pass what a server component needs as a prop.

One caveat on the server: `origin` and `href` may come from the browser's
`Referer` header, so never build a security-sensitive absolute URL out of them —
a link in an email, an outbound redirect. `pathname`, `params` and `search` come
from the route and the validated input, and cannot be spoofed.

The hash is **off by default**: `location.hash` is an empty string unless you
opt in. The underlying router doesn't track hash changes, so the hash is read
straight from `window.location.hash` only when asked. Turn it on globally with
`addHashToLocation: true` on `createNavigation`, or per read with
`useLocation({ addHash: true })` (the per-call option overrides the global
default). It's client-only — on the server the hash is always empty (the URL
fragment never reaches the server).

### Search params: `useSearch` / `setSearch`

`useSearch` returns the raw query object and a setter; pages also get
`setSearch` as a component prop:

```tsx
const [search, setSearch] = useSearch()

setSearch({ tab: 'news' }) // REPLACES the whole query → ?tab=news
setSearch({}) // clears the query
setSearch((prev) => ({ ...prev, tab })) // updater form patches; undefined drops a key
```

`setSearch` is a soft URL update — it updates the address bar without running
the navigation pipeline (no prefetch, no loading flash) and replaces the history
entry by default. It's a no-op on the server. The query object here is **raw** —
it isn't coerced by a `.search` schema.

## Reacting to navigation: `useOnNavigate`

`useOnNavigate(fn)` fires when a navigation **starts**, and the cleanup it
returns runs when that navigation settles. This is the right tool for a progress
bar:

```tsx
import { useOnNavigate } from '@point0/core/navigation'
import nprogress from 'nprogress'

export const NProgress = () => {
  useOnNavigate(() => {
    const timeout = setTimeout(() => nprogress.start(), 30)
    return () => {
      clearTimeout(timeout)
      nprogress.done()
    }
  })
  return null
}
```

> **GOTCHA:** `useOnNavigate` skips the very first load and fires at navigation
> **start**, not when the new page is shown. For page-view analytics that must
> catch the first load, read `useLocation()` in an effect instead.

`useIsNavigating()` is the boolean built on top of it — dim the content while a
navigation is in flight:

```tsx
const isNavigating = useIsNavigating()
return <main className={isNavigating ? 'opacity-60' : ''}>{children}</main>
```

## Guarding navigation: `useNavigationGuard`

A guard is asked before a client navigation does anything — no prefetch, no
transition state, no history write until it answers. Guards may be async: the
navigation waits, so a guard can show a dialog and resolve with the user's
answer. That is the whole "unsaved changes" pattern:

```tsx
import { useNavigationGuard } from '@point0/core/navigation'

useNavigationGuard(async ({ from, to }) => {
  if (!isDirty) return true
  return await openConfirmDialog() // resolves true («leave») or false («stay»)
})
```

`false` blocks the navigation the way the other didn't-navigate outcomes work —
a `POINT0_NAVIGATION_BLOCKED`-coded error in the awaited result, never a thrown
one:

```tsx
const result = await navigate('ideaView', { id })
if (result.error?.code === 'POINT0_NAVIGATION_BLOCKED') {
  // a guard said no — the user stayed
}
```

The hook reads the latest render's closure (state and props work directly) and
unregisters with its component. Outside React, `registerNavigationGuard(guard)`
does the same and returns the unregister function. A guard that should hold
every navigation of the app for its whole lifetime can instead be the `guard`
option of `createNavigation` (or a `<Router guard>` prop); all layers run —
instance guard first, then registered ones, in order, and the first `false`
wins.

Each guard receives `{ from, to }` — both full locations — and decides itself
what counts as leaving; comparing `pathname`s is the usual move, so a
search-only change stays free.

> **GOTCHA:** guards cover the client navigation pipeline only. `setSearch` (a
> "soft" URL update), browser back/forward (on `popstate` the URL has already
> changed by the time anyone learns of it), and full unloads never pass through
> — cover leaving the document with a `beforeunload` listener.

## Scroll restoration

Scroll restoration is **split between the browser and Point0**, along the line
of what each can actually do.

**The browser restores a document load** — a reload, or a back/forward that
reloads the page. It does this _before the first paint_, knowing the real page
height, which no framework can match: any JavaScript restore runs after
hydration, hence after that first paint, so it would show you the top of the
page and then jump. So Point0 hands the mode back to the browser
(`scrollRestoration = 'auto'`) when the page is on its way out, and reloading a
scrolled page simply brings you back where you were, with nothing to see.

**Point0 restores everything else**, and holds `scrollRestoration = 'manual'`
while the page is alive so the browser doesn't interfere. Same-document
navigation is its job: a new navigation (push) scrolls to the top — or to the
target `#hash` per the `scrollToHash` policy — and Back/Forward (pop) restores
the remembered position, even when the URL carries a `#hash` (the browser's own
restoration would jump to the fragment instead — which is exactly why the mode
is not handed back for a URL that has one). A first load with a `#hash` is a
deep link: it jumps to the anchor.

Positions are remembered per URL and persisted to `sessionStorage`, which is
what lets the next document **repair** a restore the browser could not perform.
It can't when the content isn't there yet at load time: a page whose data
arrives after the first paint is still short when the browser makes its one
attempt, so it lands nothing. Point0 then re-applies the position for up to a
second while the document grows — and backs off the moment anything else moves
the scroll. Same for a page rendered entirely on the client (`ssr: false`),
whose first paint is empty, and for a **custom scroll container**
(`.scrollPosition`): no browser restores the scroll of an element rather than
the window, in any mode, so a container is always Point0's to restore — on a
reload as much as on a Back/Forward.

Two stage-methods on a mountable control where the page scrolls when you
navigate to it. They're set on the point chain (page/layout), not on
`createNavigation`:

```tsx
export const ideaPage = root.lets
  .page('/ideas/:id')
  // top of the page on every arrival (the default behavior, made explicit):
  .scrollPosition('top')
  // …or restore the previous scroll offset on Back/Forward:
  .scrollRestore('auto')
  .page(IdeaView)
```

- `.scrollPosition` decides the target scroll position when this point is shown
  — e.g. jump to the top, keep the current offset, or compute one from the
  location.
- `.scrollRestore` controls browser scroll restoration for this point — whether
  a remembered offset is restored on history navigation (Back/Forward) or the
  page starts fresh.

Both are **client-only** — cut from the server bundle, body and imports removed
(there's no scroll position to restore on the server).

### `keepScroll` — a navigation that doesn't move the scroll

`keepScroll: true` on `navigate` / `<Link>` / `redirect` freezes the scroll for
that one navigation — no scroll-to-top, no restore, no `#hash` jump. For URL
changes that don't mean "a new page": mid-page tabs that rewrite the pathname, a
filter in the URL. Positions are still remembered, so Back/Forward later
restores each page's own offset.

```tsx
<Link route="ideaListActive" keepScroll>Active</Link>
<Link route="ideaListArchived" keepScroll>Archived</Link>
```

## The point's route: `point.route`

Every routable point carries a callable [Route0](https://1gr14.dev/route0)
route. You usually navigate by name, but the route is there when you need a URL
string:

```tsx
ideaPage.route({ id: 123 }) // => "/ideas/123"   (relative)
ideaPage.route.abs({ id: 123 }) // => "https://app.example.com/ideas/123"
ideaPage.route.getRelation(href) // match the current URL against this route
ideaPage.route.extend('/edit') // a new route with a suffix appended
```

- `route(input)` (≡ `route.get(input)`) builds the relative path. `input` is
  required only if the route has required params.
- `route.abs(input)` builds the absolute URL using the route's configured
  origin; override with `{ origin: 'https://…' }` or `{ origin: false }` for
  relative.
- `route.getRelation(input)` parses a URL/location and returns the match
  relation (`exact` / `ancestor` / `descendant` / `unmatched`) — this is what
  `NavLink` uses under the hood.
- `route.extend(suffix)` returns a new callable route with the suffix appended.

The app-wide `routes` object (the one you feed `createNavigation`) is a map of
these callable routes, one per routable point.

## `InferNavigation`: embeddable link props

`InferNavigation` is a **type-only** export. It lets you bake your app's routes
into a component's props so any button can become a link, fully typed:

```tsx
export type AppLinkProps = typeof InferNavigation.LinkProps // route/to/href + behavior, no <a> attrs
export type AppNavLinkProps = typeof InferNavigation.NavLinkProps
```

At runtime, split the link props off with `splitLinkProps` — this is the
production button pattern:

```tsx
import { splitLinkProps } from '@point0/react-dom/router'

type ButtonProps = MyButtonProps & AppLinkProps
function Button(props: ButtonProps) {
  const [linkProps, restProps, isLink] = splitLinkProps(props)
  const Comp = isLink ? Link : 'button'
  return <Comp {...(isLink ? linkProps : {})} {...restProps} />
}
// <Button route="ideaView" input={{ id }}>Open</Button>  → renders a <Link>
// <Button onClick={save}>Save</Button>                   → renders a <button>
```

`isLink` is true only when a target (`route` / `to` / `href`) is present — link
_options_ alone don't make a component a link.

> **GOTCHA:** `InferNavigation` is `null` at runtime — only ever read it in type
> position (`typeof InferNavigation.LinkProps`), never as a value.

## Prefetch policies

Prefetch is how a page's data is loaded **before** you arrive, so navigation
feels instant. Policies are set on the point chain (root/base/page/layout) with
the [`.prefetchPage*` setters](stage-methods), and overridden per `<Link>` /
`navigate`. By default a page prefetches nothing — set a policy to opt in.

```tsx
export const root = Point0.lets
  .root()
  .prefetchPagePolicy('pageDehydratedStateAndClientQuery') // both triggers
  // or set triggers separately:
  // .prefetchPageOnNavigate('serverAndClientQuery')
  // .prefetchPageOnLinkHover('serverAndClientQuery', 200)  // 2nd arg = hover delay (ms, default 30)
  .root()
```

Strip note: `.prefetchPagePolicy` and the two trigger setters it wraps
(`.prefetchPageOnNavigate` / `.prefetchPageOnLinkHover`) are all **client-only**
— cut from the server bundle, their bodies and the imports they use removed
(prefetch is driven by the browser).

A policy decides **what** gets prefetched for the target page (its related
queries and `.onPrefetchPage` callbacks). The split that matters: the `*Query`
policies **self-fetch the page's related queries WITHOUT rendering the page** —
related queries are statically discoverable, so they're prefetched cheaply (just
run the loader, cache the result). The `pageDehydratedState*` policies instead
**render the page on the server** to collect its dehydrated state — far more
expensive, and SSR-only.

| Policy                              | What it prefetches                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `none` / `false`                    | Nothing.                                                                                                                                         |
| `serverQuery`                       | Only related queries that have a **server** loader (`mode: 'server'`) — self-fetched, no render.                                                 |
| `clientQuery`                       | Only related queries that have a **client** loader (`mode: 'client'`) — self-fetched, no render.                                                 |
| `serverAndClientQuery`              | Whichever loader each related query has (server or client), self-fetched without a server render. The **cheap** default.                         |
| `pageDehydratedState`               | Renders the page **on the server** to collect its server queries' dehydrated state, then stops — no client queries. **Requires SSR.** Expensive. |
| `pageDehydratedStateAndClientQuery` | The server render's dehydrated state **plus** client-loader queries. **Requires SSR.** The most thorough, and the most expensive.                |
| `onPrefetchOnly`                    | Only the `.onPrefetchPage` callbacks — no related queries at all.                                                                                |

**Cost.** Reserve the expensive `pageDehydratedState*` policies for pages where
the first paint must be instant. They **throw** if SSR is disabled:

```tsx
// with .prefetchPagePolicy('pageDehydratedState') and SSR off:
// throws "Query client dehydrated state can be prefetched only when ssr is enabled…"
```

### `.onPrefetchPage`: prefetch side-effects

`.onPrefetchPage` is a stage-method on a page or layout. It registers a callback
that runs when the point is prefetched — the place to warm anything that isn't a
related query (an image, a non-point fetch, an analytics ping). It runs under
every policy except `none` and `pageDehydratedState`-only:

```tsx
export const ideaPage = root.lets
  .page('/ideas/:id')
  .onPrefetchPage(({ input }) => {
    void fetch(`/og/${input.id}.png`) // warm the hero image before arrival
  })
  .page(IdeaView)
```

It runs on the client (during the prefetch policies above) **and** on the server
once before the first render — the compiler keeps it in both bundles
(**server-and-client**). This is the one prefetch method that is not
client-only. Two side-pinned variants share its shape: `.serverOnPrefetchPage`
(kept only in the server bundle) and `.clientOnPrefetchPage` (kept only in the
client bundle), for warm-up code whose imports belong to just one side.

### Per-call overrides

The point default is overridden per link or per navigation:

```tsx
<Link route="ideaView" input={{ id }} prefetchOnHover="serverAndClientQuery">…</Link>
<Link route="heavy" input={{ id }} prefetch="none">…</Link> // opt one link out
await navigate('ideaView', { id }, { prefetch: 'serverAndClientQuery' })
```

The same policies and their server-side angle appear on the [SSR](ssr) page.

## Stale deploys

A deploy changes the client chunk hashes. A tab loaded before the deploy still
holds the old URLs — its next client navigation would request a page chunk that
no longer exists. Point0 detects that and recovers by default: the navigation
leaves the SPA and lands on the SAME target as a full document load, on the new
build. The user gets where they clicked; only the SPA state of the old tab is
gone — exactly what a fresh deploy requires.

Detection is always on and free:

- **Every server response** carries an `x-point0-client-build` header with the
  build version it serves. The client compares it with its own version (injected
  into the HTML at build time); a mismatch marks the tab stale, and the next
  navigation goes as a document navigation without even trying the old chunks.
- **A page chunk that fails to load mid-navigation** triggers a confirmation
  fetch of `build-version.json` (never cached, served next to the chunks). A new
  version confirms the deploy → recover by document navigation. The same version
  means a genuine network error → the import is retried in place (below) before
  anything surfaces.

A transient network failure — a dropped keep-alive socket after the laptop woke
up, a Wi-Fi blip, a CDN edge hiccup — is not a stale deploy, and a reload would
not fix it. So every chunk import that fails WITHOUT a confirmed newer build is
retried up to two more times (300 ms, then 1 s between attempts), re-checking
the served version before each attempt: if a deploy is confirmed mid-retry, the
retries stop and the document-navigation recovery takes over immediately. Only
after the retries are exhausted does the failure surface through the normal
error path, coded `POINT0_PAGE_CHUNK_LOAD_FAILED` — your `.error()` can branch
on it (e.g. "check your connection"). In dev there is no build version, and a
failed import is a real error (a compile failure, a bad path) — it fails fast,
no retries.

Reload loops cannot happen: a document navigation is attempted once per new
build version (sessionStorage-guarded), and only after the version check
confirmed the build actually changed. Once that reload lands, the tab runs the
new build — so a chunk that still won't load is now a genuine error and surfaces
as `POINT0_PAGE_CHUNK_LOAD_FAILED`, not another reload.
`POINT0_STALE_CLIENT_BUILD` is what the page's `.error()` receives under
`stale: 'error'`, and when a `'navigate'` reload is guard-blocked because the
tab still can't reach the new build (a rolling deploy caught mid-rollout, or a
client that can't document-navigate).

The reaction is the `stale` option of `createNavigation`:

```tsx
export const { navigate, Link /* … */ } = createNavigation({
  routes,
  hook,
  // 'navigate' (default) — full document navigation to the same target
  // 'error' — no auto-navigation; .error() gets a POINT0_STALE_CLIENT_BUILD error
  // 'off' — behave as if the feature didn't exist
  stale: 'navigate',
})
```

Or take full control — e.g. show your own "new version available" UI. Return
`'navigate'` / `'error'` to hand back to the framework, or nothing to keep
ownership (the framework then neither navigates nor commits the failed client
navigation — the user stays on the current page):

```tsx
export const { navigate, Link /* … */ } = createNavigation({
  routes,
  hook,
  stale: async ({ to, error, clientBuildVersion, latestBuildVersion }) => {
    const reload = await askUserToReload(latestBuildVersion)
    return reload ? 'navigate' : undefined
  },
})
```

The default `'navigate'` recovery assumes the standard browser location hook —
the SPA hrefs it produces are real document URLs, so leaving the SPA is a plain
document navigation (a hash-only difference force-reloads, since a hash change
alone would not fetch a new document). On a non-path location scheme (a
hash-based or memory `hook`), SPA hrefs are not document URLs — handle staleness
yourself with a custom `stale` function there.

In dev all of this is inert — nothing is bundled, so there is no build to be
stale against. The build/server half of the mechanism (the version file, the
header, static hosting notes) is on [Deploy](deploy).

## Reference

### `createNavigation` options

All optional except the need for routes (via `routes` or a prior
`ClientPoints.mount`).

| Option                           | Default                    | What                                                                                 |
| -------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `routes`                         | `getClientPoints().routes` | The generated route map                                                              |
| `hook`                           | `useBrowserLocation`       | The router location hook (wouter)                                                    |
| `searchHook`                     | derived from `hook`        | The search hook                                                                      |
| `navigate`                       | derived from `hook`        | The imperative adapter-navigate fn                                                   |
| `ErrorClass`                     | `ErrorPoint0`              | Error class used for navigation errors (any [compatible class](error-handling))      |
| `Page404`                        | built-in "Page Not Found"  | Component/element rendered on no match                                               |
| `layout404`                      | —                          | Layout(s) to wrap the 404                                                            |
| `scrollToHash`                   | `true`                     | Global scroll-to-hash policy                                                         |
| `addHashToLocation`              | `false`                    | Read `window.location.hash` into `location.hash` (client-only; off → `hash` is `''`) |
| `openExternal`                   | `defaultOpenExternal`      | Hook for leaving the SPA (see below)                                                 |
| `stale`                          | `'navigate'`               | Stale-deploy reaction: `'navigate'` / `'error'` / `'off'` / a custom fn (see above)  |
| `guard`                          | —                          | The instance [navigation guard](#guarding-navigation-usenavigationguard)             |
| `forceRerender`                  | `false`                    | Re-render routes on every location change                                            |
| `prependRoutes` / `appendRoutes` | —                          | Extra routes injected at the tree root                                               |

### What `createNavigation` returns

`navigate`, `Link`, `NavLink`, `Redirect`, `redirect`, `Router`, `RouterRoutes`,
`useNavLink`, and `InferNavigation`. The location/search hooks (`useLocation`,
`getLocation`, `useSearch`, `setSearch`, `useOnNavigate`, `useIsNavigating`,
`useNavigationGuard`, `registerNavigationGuard`) import directly from
`@point0/core/navigation` — they aren't part of the returned object.

### Leaving the SPA

`openExternal` is called when the target is cross-origin or when `newTab` is
set. The default opens a new tab with
`window.open(to, '_blank', 'noopener,noreferrer')` or replaces the location for
same-tab. Override it on a native shell (capacitor / expo) to open the system
browser:

```tsx
export const { navigate, Link /* … */ } = createNavigation({
  routes,
  hook,
  openExternal: (to) => Browser.open({ url: to }),
})
```

### Edge cases

- **Same-URL re-navigation is a no-op** — navigating to the exact current path +
  search (no hash) does nothing: no prefetch, no callbacks, no history entry. A
  hash-only change still goes through, so in-page anchors work.
- **Relative `to`** — a string target resolves against the current page the way
  a browser resolves an `<a href>`: `navigate.to('edit')` from `/ideas/list`
  goes to `/ideas/edit`, `'../x'` climbs a segment, a bare `'#section'` stays on
  the current URL (keeping its search), a bare `'?page=2'` replaces the search.
  Root-relative (`'/x'`) and same-origin absolute targets become root-relative
  hrefs; cross-origin ones go to `openExternal`. An unparsable target is handed
  to the adapter as-is.
- **Concurrent navigations** — if a second navigation starts before the first
  finishes, the stale one resolves with
  `error: "Another navigate has been started"`.
- **`href` links don't prefetch** — they're plain `<a>` tags outside the router.
