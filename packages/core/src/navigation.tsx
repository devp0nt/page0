import * as flat from '@1gr14/flat'
import type {
  AnyLocation,
  AnyRouteOrDefinition,
  ExactLocation,
  ExtractRoute,
  ExtractRoutesKeys,
  GetPathInputByRoute,
  IsParamsOptional,
  RoutesPretty,
  UnknownLocation,
  UnknownSearchInput,
  UnknownSearchParsed,
} from '@1gr14/route0'
import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ErrorPoint0, POINT0_ERROR_CODES_MAP } from './error.js'
import type { ClassLikeError0 } from './error.js'
import { getClientPoints, useEffectAsap, useEffectSsr } from './helpers.js'
import { _ss } from './internals.js'
import { log } from './logger.js'
import { findRedirectTaskInQueryClientCache, removeRedirectsFromQueryClientCache } from './query-client.js'
import type { RedirectTask } from './redirect.js'
import {
  resolveScrollToHashBehavior,
  saveScrollPositionForLocation,
  scrollRestorationSignal,
  scrollToHashElementWithRetry,
  scrollToHashSignal,
} from './scroll.js'
import type { ScrollToHashPolicy } from './scroll.js'
import {
  documentNavigate,
  fetchLatestClientBuildVersion,
  getClientBuildVersion,
  getStaleClientBuildState,
  markClientBuildStale,
  resolveStaleReaction,
  shouldAttemptStaleReload,
} from './stale.js'
import type { StalePolicy } from './stale.js'
import type { IfAnyThenElse, PointsScope, PrefetchPagePolicy } from './types.js'
import { generateId, singletonize } from './utils.js'
import { _point0_env } from './env.js'

export type NavigationCallback<TAdapterNavigateOptions extends AdapterNavigateOptions = AdapterNavigateOptions> = (
  to: string,
  options?: TAdapterNavigateOptions & SpecialNavigateOptions<TAdapterNavigateOptions>,
) => void | Promise<void>
export type SpecialNavigateOptions<TAdapterNavigateOptions extends AdapterNavigateOptions> = {
  prefetch?: PrefetchPagePolicy
  before?: NavigationCallback<TAdapterNavigateOptions>
  after?: NavigationCallback<TAdapterNavigateOptions>
  /** Open the target in a new tab (uses the `openExternal` hook). */
  newTab?: boolean
  /**
   * Scroll-to-hash policy for this navigation, overriding the global `createNavigation({ scrollToHash })`. See
   * {@link ScrollToHashPolicy}.
   */
  scrollToHash?: ScrollToHashPolicy
  /**
   * Keep the scroll where it is for this one navigation: no scroll-to-top, no restore, no `#hash` jump — for URL
   * changes that don't mean "a new page" (mid-page tabs, a filter in the pathname).
   */
  keepScroll?: boolean
}
export type SpecialLinkOptions<TAdapterNavigateOptions extends AdapterNavigateOptions> = {
  prefetch?: PrefetchPagePolicy
  prefetchOnHover?: PrefetchPagePolicy
  prefetchOnNavigate?: PrefetchPagePolicy
  before?: NavigationCallback<TAdapterNavigateOptions>
  after?: NavigationCallback<TAdapterNavigateOptions>
  /** Open the target in a new tab (uses the `openExternal` hook). */
  newTab?: boolean
  /**
   * Scroll-to-hash policy for this navigation, overriding the global `createNavigation({ scrollToHash })`. See
   * {@link ScrollToHashPolicy}.
   */
  scrollToHash?: ScrollToHashPolicy
  /**
   * Keep the scroll where it is for this one navigation: no scroll-to-top, no restore, no `#hash` jump — for URL
   * changes that don't mean "a new page" (mid-page tabs, a filter in the pathname).
   */
  keepScroll?: boolean
}
export type SpecialRedirectOptions = {
  status?: number
}

/**
 * Opens a link that leaves the SPA: a cross-origin URL, or any URL requested with `newTab`. Override via
 * `createNavigation({ openExternal })` — e.g. on capacitor/expo, open in the system browser instead of replacing the
 * webview.
 */
export type OpenExternalFn = (to: string, options: { newTab?: boolean }) => void
export const defaultOpenExternal: OpenExternalFn = (to, { newTab }) => {
  if (typeof window === 'undefined') {
    return
  }
  if (newTab) {
    window.open(to, '_blank', 'noopener,noreferrer')
  } else {
    window.location.assign(to)
  }
}
// export type SpecialLinkOptionsInDataAttributes<
//   TAdapterNavigateOptions extends AdapterNavigateOptions = AdapterNavigateOptions,
// > = {
//   ['data-prefetch-on-hover']?: PrefetchPagePolicy
//   ['data-prefetch']?: PrefetchPagePolicy
//   ['data-prefetch-on-navigate']?: PrefetchPagePolicy
//   ['data-before']?: NavigationCallback<TAdapterNavigateOptions>
//   ['data-after']?: NavigationCallback<TAdapterNavigateOptions>
// }
// export type SpecialRedirectOptionsInDataAttributes = {
//   ['data-status']?: number
// }

export type AdapterNavigateOptions = Record<string, unknown>
export type AdapterNavigateFn<TAdapterNavigateOptions extends AdapterNavigateOptions = AdapterNavigateOptions> = (
  to: string,
  options?: TAdapterNavigateOptions,
) => any

export type NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn extends AdapterNavigateFn> = NonNullable<
  Parameters<TAdapterNavigateFn>[1]
>
export type RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn extends AdapterNavigateFn> =
  NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> & SpecialRedirectOptions

export type NavigateHelper<
  TRoutes extends RoutesPretty,
  TAdapterNavigateFn extends AdapterNavigateFn,
  TErrorClass extends ClassLikeError0<ErrorPoint0>,
> = {
  <TRouteName extends ExtractRoutesKeys<TRoutes>>(
    ...args: IsParamsOptional<ExtractRoute<TRoutes, TRouteName>> extends true
      ? [
          route: TRouteName,
          input?: GetPathInputByRoute<ExtractRoute<TRoutes, TRouteName>>,
          options?: NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
            SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
        ]
      : [
          route: TRouteName,
          input: GetPathInputByRoute<ExtractRoute<TRoutes, TRouteName>>,
          options?: NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
            SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
        ]
  ): Promise<{ location: AnyLocation; error: InstanceType<TErrorClass> | undefined }>
  to: (
    to: string,
    options?: NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
      SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
  ) => Promise<{ location: AnyLocation; error: InstanceType<TErrorClass> | undefined }>
  /** Go back one entry in history (`window.history.back()`). */
  back: () => void
  /** Go forward one entry in history (`window.history.forward()`). */
  forward: () => void
}

export type RedirectHelper<TRoutes extends RoutesPretty, TAdapterNavigateFn extends AdapterNavigateFn> = {
  <TRouteName extends ExtractRoutesKeys<TRoutes>>(
    ...args: IsParamsOptional<ExtractRoute<TRoutes, TRouteName>> extends true
      ? [
          route: TRouteName,
          input?: GetPathInputByRoute<ExtractRoute<TRoutes, TRouteName>>,
          options?: RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
            SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
        ]
      : [
          route: TRouteName,
          input: GetPathInputByRoute<ExtractRoute<TRoutes, TRouteName>>,
          options?: RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
            SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
        ]
  ): RedirectTask<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>
  to: (
    to: string,
    options?: RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
      SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
  ) => RedirectTask<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>
}

export type RedirectComponentRouteProps<TRoutes extends RoutesPretty, TAdapterNavigateFn extends AdapterNavigateFn> = {
  [TRouteName in ExtractRoutesKeys<TRoutes>]: {
    route: TRouteName
  } & (IsParamsOptional<ExtractRoute<TRoutes, TRouteName>> extends true
    ? { input?: GetPathInputByRoute<ExtractRoute<TRoutes, TRouteName>> }
    : { input: GetPathInputByRoute<ExtractRoute<TRoutes, TRouteName>> }) &
    RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
    SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>
}[ExtractRoutesKeys<TRoutes>]
export type RedirectComponentProps<TRoutes extends RoutesPretty, TAdapterNavigateFn extends AdapterNavigateFn> =
  | RedirectComponentRouteProps<TRoutes, TAdapterNavigateFn>
  | ({ to: string } & RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
      SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>)
  | ({ href: string } & RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
      SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>)
  | ({
      task: RedirectTask<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>
    } & RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
      SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>)
export type RedirectComponent<TRoutes extends RoutesPretty, TAdapterNavigateFn extends AdapterNavigateFn> = (
  props: RedirectComponentProps<TRoutes, TAdapterNavigateFn>,
) => React.ReactElement | null

export type UseLocationOptions = { addHash?: boolean }
export type UseLocationFn = (options?: UseLocationOptions) => ExactLocation | UnknownLocation

export type NavigationStatus = 'idle' | 'preparing' | 'transitioning'

export type UseOnNavigateFn = (options: {
  prevLocation: AnyLocation
  nextLocation: AnyLocation
}) => undefined | (() => void)
export type UseOnNavigateDetailedFn = (options: {
  prevLocation: AnyLocation
  nextLocation: AnyLocation
  status: NavigationStatus
  error: Error | undefined
}) => void

export type NavigationPageStateSuccess = {
  status: 'success'
  error: undefined
  loading: false
  success: true
  initial: false
}
export type NavigationPageStateLoading = {
  status: 'loading'
  error: undefined
  loading: true
  success: false
  initial: false
}
export type NavigationPageStateError<TError extends ErrorPoint0 = ErrorPoint0> = {
  status: 'error'
  error: TError
  loading: false
  success: false
  initial: false
}
export type NavigationPageStateInitial = {
  status: 'initial'
  error: undefined
  loading: undefined
  success: undefined
  initial: true
}
export type NavigationPageState<TStatus extends 'success' | 'loading' | 'error' | 'initial' = any> = IfAnyThenElse<
  TStatus,
  NavigationPageStateSuccess | NavigationPageStateLoading | NavigationPageStateError | NavigationPageStateInitial,
  TStatus extends 'success'
    ? NavigationPageStateSuccess
    : TStatus extends 'loading'
      ? NavigationPageStateLoading
      : TStatus extends 'error'
        ? NavigationPageStateError
        : TStatus extends 'initial'
          ? NavigationPageStateInitial
          : never
>
export type NavigationPageStateContextValue = NavigationPageState<any>

// Page state is an imperative, externally-subscribable store rather than React
// state on the navigation provider. The framework writes the page status
// (loading / success / error) from deep inside the mountable tree on every
// navigation; if that write lived in a top-level `useState`, every write would
// re-render the whole provider subtree (and so every page). Backing it with
// `useSyncExternalStore` keeps the reactive read opt-in and component-scoped —
// a page-state change only re-renders the components that actually read it.
const initialNavigationPageState: NavigationPageStateContextValue = {
  status: 'initial',
  error: undefined,
  loading: undefined,
  success: undefined,
  initial: true,
}
const navigationPageStateListeners = singletonize('NavigationPageStateListeners', new Set<() => void>())
const getNavigationPageStateSnapshot = (): NavigationPageStateContextValue =>
  _ss.__POINT0_NAVIGATION_PAGE_STATE__.getOrUndefined() ?? initialNavigationPageState
const subscribeNavigationPageState = (listener: () => void): (() => void) => {
  navigationPageStateListeners.add(listener)
  return () => {
    navigationPageStateListeners.delete(listener)
  }
}
export const setNavigationPageState = (next: React.SetStateAction<NavigationPageStateContextValue>): void => {
  const prev = getNavigationPageStateSnapshot()
  const value =
    typeof next === 'function'
      ? (next as (prev: NavigationPageStateContextValue) => NavigationPageStateContextValue)(prev)
      : next
  // Keep the snapshot reference stable when nothing changed, so subscribers
  // (and `useSyncExternalStore`) don't re-render or loop.
  if (value === prev) {
    return
  }
  _ss.__POINT0_NAVIGATION_PAGE_STATE__.set(value)
  for (const listener of navigationPageStateListeners) {
    listener()
  }
}
export const getNavigationPageState = (): NavigationPageStateContextValue => getNavigationPageStateSnapshot()
export const useNavigationPageState = (): NavigationPageStateContextValue =>
  React.useSyncExternalStore(
    subscribeNavigationPageState,
    getNavigationPageStateSnapshot,
    getNavigationPageStateSnapshot,
  )
type SetNavigationPageStateOptions = {
  status: 'loading' | 'success' | 'initial' | 'error'
  error?: unknown
  skip?: boolean
}
export const useSetNavigationPageState = (options: SetNavigationPageStateOptions): void => {
  const helpers = useNavigationHelpers()
  const { status, error, skip } = options
  useEffectSsr(() => {
    if (skip) {
      return
    }
    helpers.setPageState((currentPageState) => {
      if (status === 'error') {
        const error0 = helpers.ErrorClass.from(error)
        if (status === currentPageState.status && error0.message === currentPageState.error.message) {
          return currentPageState
        } else {
          return {
            status: 'error',
            error: error0,
            success: false,
            initial: false,
            loading: false,
          }
        }
      } else {
        if (status === currentPageState.status) {
          return currentPageState
        } else {
          return {
            status: status,
            error: undefined,
            ...(status === 'initial'
              ? { initial: true, success: undefined, loading: undefined }
              : {
                  initial: false,
                  success: status === 'success',
                  loading: status === 'loading',
                }),
          } as NavigationPageState
        }
      }
    })
  }, [status, skip])
}
export const NavigationPageStateSetter = (
  props: { children?: React.ReactNode } & SetNavigationPageStateOptions,
): React.ReactNode => {
  const { children, ...options } = props
  useSetNavigationPageState(options)
  return typeof children === 'undefined' ? null : children
}

export type NavigationHelpersContextValue<
  TRoutes extends RoutesPretty = RoutesPretty,
  TAdapterNavigateFn extends AdapterNavigateFn = AdapterNavigateFn,
  TErrorClass extends ClassLikeError0<ErrorPoint0> = ClassLikeError0<ErrorPoint0>,
> = {
  ssrLocation: AnyLocation | null
  adapterNavigate: TAdapterNavigateFn
  navigate: NavigateHelper<TRoutes, TAdapterNavigateFn, TErrorClass>
  redirect: RedirectHelper<TRoutes, TAdapterNavigateFn>
  Redirect: RedirectComponent<TRoutes, TAdapterNavigateFn>
  useAdapterLocation: UseLocationFn
  addHashToLocation: boolean
  setPrevLocation: React.Dispatch<React.SetStateAction<AnyLocation | null>>
  setNextLocation: React.Dispatch<React.SetStateAction<AnyLocation | null>>
  setTransitionStatus: React.Dispatch<React.SetStateAction<NavigationStatus>>
  setTransitionError: React.Dispatch<React.SetStateAction<Error | undefined>>
  setPageState: React.Dispatch<React.SetStateAction<NavigationPageState>>
  ErrorClass: ClassLikeError0<ErrorPoint0>
  openExternal: OpenExternalFn
  scrollToHash: ScrollToHashPolicy
  stale: StalePolicy
  guard: NavigationGuard | undefined
}
export const NavigationHelpersContext = singletonize(
  'NavigationHelpersContext',
  React.createContext<NavigationHelpersContextValue | null>(null),
)
export const useNavigationHelpers = (): NavigationHelpersContextValue => {
  const ctx = React.useContext(NavigationHelpersContext)
  if (!ctx) throw new Error('useNavigationHelpers must be used within NavigationHelpersContextProvider')
  return ctx
}
export const getNavigationHelpers = (): NavigationHelpersContextValue => {
  const navigationHelpers = _ss.__POINT0_NAVIGATION_HELPERS__.getOrUndefined()
  if (navigationHelpers) {
    return navigationHelpers
  }
  throw new Error('NavigationHelpersContextProvider is not yet initialized')
}

export type NavigationTransitionStateContextValue = {
  prevLocation: AnyLocation | null
  currentLocation: AnyLocation
  nextLocation: AnyLocation | null
  status: NavigationStatus
  error: Error | undefined
}
export const NavigationTransitionStateContext = singletonize(
  'NavigationTransitionStateContext',
  React.createContext<NavigationTransitionStateContextValue | null>(null),
)
export const useNavigationTransitionState = (): NavigationTransitionStateContextValue => {
  const ctx = React.useContext(NavigationTransitionStateContext)
  if (!ctx) throw new Error('useNavigationTransitionState must be used within NavigationTransitionStateContextProvider')
  return ctx
}
export const getNavigationTransitionState = (): NavigationTransitionStateContextValue => {
  const navigationTransitionState = _ss.__POINT0_NAVIGATION_TRANSITION_STATE__.getOrUndefined()
  if (navigationTransitionState) {
    return navigationTransitionState
  }
  throw new Error('NavigationTransitionStateContextProvider is not yet initialized')
}

export type NavigationLocationContextValue = {
  useAdapterLocation: UseLocationFn
  currentLocation: AnyLocation
  addHashToLocation: boolean
}
export const NavigationLocationContext = singletonize(
  'NavigationLocationContext',
  React.createContext<NavigationLocationContextValue | null>(null),
)

export type NavigationContextProviderProps<
  TRoutes extends RoutesPretty = RoutesPretty,
  TAdapterNavigateFn extends AdapterNavigateFn = AdapterNavigateFn,
  TErrorClass extends ClassLikeError0<ErrorPoint0> = ClassLikeError0<ErrorPoint0>,
> = {
  children: React.ReactNode
  useAdapterLocation: UseLocationFn
  ssrLocation?: AnyLocation | null
  addHashToLocation?: boolean
  adapterNavigate: TAdapterNavigateFn
  navigate: NavigateHelper<TRoutes, TAdapterNavigateFn, TErrorClass>
  redirect: RedirectHelper<TRoutes, TAdapterNavigateFn>
  Redirect: RedirectComponent<TRoutes, TAdapterNavigateFn>
  ErrorClass?: TErrorClass
  openExternal?: OpenExternalFn
  scrollToHash?: ScrollToHashPolicy
  stale?: StalePolicy
  guard?: NavigationGuard
}

export function NavigationContextProvider<
  TRoutes extends RoutesPretty,
  TAdapterNavigateFn extends AdapterNavigateFn,
  TErrorClass extends ClassLikeError0<ErrorPoint0>,
>({
  children,
  useAdapterLocation,
  ssrLocation,
  adapterNavigate,
  navigate,
  redirect,
  Redirect,
  addHashToLocation = false,
  ErrorClass = ErrorPoint0 as unknown as TErrorClass,
  openExternal = defaultOpenExternal,
  scrollToHash = true,
  stale = 'navigate',
  guard,
}: NavigationContextProviderProps<TRoutes, TAdapterNavigateFn, TErrorClass>) {
  const [nextLocation, setNextLocation] = useState<AnyLocation | null>(null)
  const [prevLocation, setPrevLocation] = useState<AnyLocation | null>(null)
  const [transitionStatus, setTransitionStatus] = useState<NavigationStatus>('idle')
  const [transitionError, setTransitionError] = useState<Error | undefined>(undefined)

  const currentLocation = useAdapterLocation()
  useEffectAsap(() => {
    _ss.__POINT0_CURRENT_LOCATION__.set(currentLocation)
  }, [currentLocation])

  const locationValue = useMemo<NavigationLocationContextValue>(
    () => ({
      useAdapterLocation,
      currentLocation,
      addHashToLocation,
    }),
    [currentLocation, addHashToLocation, useAdapterLocation],
  )

  const helpersValue = useMemo<NavigationHelpersContextValue>(
    () => ({
      ssrLocation: ssrLocation ?? null,
      adapterNavigate,
      setNextLocation,
      setPrevLocation,
      setTransitionStatus,
      setTransitionError,
      useAdapterLocation,
      addHashToLocation,
      setPageState: setNavigationPageState,
      ErrorClass,
      navigate,
      redirect,
      Redirect,
      openExternal,
      scrollToHash,
      stale,
      guard,
    }),
    [
      ssrLocation,
      useAdapterLocation,
      adapterNavigate,
      addHashToLocation,
      ErrorClass,
      openExternal,
      scrollToHash,
      stale,
      guard,
    ],
  )
  useEffectAsap(() => {
    _ss.__POINT0_NAVIGATION_HELPERS__.set(helpersValue)
  }, [helpersValue])

  const transitionStateValue = useMemo<NavigationTransitionStateContextValue>(
    () => ({
      prevLocation,
      currentLocation,
      nextLocation,
      status: transitionStatus,
      error: transitionError,
    }),
    [prevLocation, currentLocation, nextLocation, transitionStatus, transitionError],
  )
  useEffectAsap(() => {
    _ss.__POINT0_NAVIGATION_TRANSITION_STATE__.set(transitionStateValue)
  }, [transitionStateValue])

  return (
    <NavigationHelpersContext.Provider value={helpersValue}>
      <NavigationLocationContext.Provider value={locationValue}>
        <NavigationTransitionStateContext.Provider value={transitionStateValue}>
          {children}
        </NavigationTransitionStateContext.Provider>
      </NavigationLocationContext.Provider>
    </NavigationHelpersContext.Provider>
  )
}

export const useNavigationLocationContext = (): NavigationLocationContextValue => {
  const ctx = React.useContext(NavigationLocationContext)
  if (!ctx) throw new Error('useNavigationLocationContext must be used within NavigationContextProvider')
  return ctx
}
/**
 * The current location, reactive: `useLocation()` re-renders the component on every navigation. It's the same value
 * pages and layouts already get as a `location` prop — pull it from here in any other component.
 *
 *     const location = useLocation()
 *     location.pathname // "/ideas/123"
 *     location.search // parsed query object
 *     location.params // parsed route params
 *
 * It is a hook, so it needs a React render: it works in pages, layouts and component points (islands), and **not** in a
 * server component, which Point0 unfolds as one plain function call. Read `getLocation()` there.
 *
 * For an imperative read outside React, use `getLocation()` (throws if the router hasn't mounted yet).
 *
 * Full reference: https://1gr14.dev/point0/latest/navigation
 */
export function useLocation<TRouteDefinition extends AnyRouteOrDefinition = AnyRouteOrDefinition>(
  options?: UseLocationOptions,
): UnknownLocation | ExactLocation<TRouteDefinition> {
  const locationCtx = useNavigationLocationContext()
  const addHash =
    options && 'addHash' in options && typeof options.addHash === 'boolean'
      ? options.addHash
      : locationCtx.addHashToLocation
  return locationCtx.useAdapterLocation({ ...options, addHash }) as UnknownLocation | ExactLocation<TRouteDefinition>
}
/**
 * Reads the current location imperatively (no React subscription, no re-render) — for use outside components, e.g. in a
 * loader, an event handler, or a **server component** (where hooks cannot run). Inside a component prefer the reactive
 * `useLocation()`.
 *
 * On the **client** it answers once the router has mounted, and throws `"Current location is not yet initialized"`
 * before that.
 *
 * On the **server** it answers whenever the request stands for a page, and a **page**'s own loader always does — the
 * SSR render, the navigation data-fetch, a plain refetch of its query, `ssr(false)` — as do the server components its
 * data returns. A **layout**'s loader answers while a page is rendered or prefetched around it, but a layout has no
 * route of its own: the moment its query is fetched on its own — a client-side navigation that misses the cache, an
 * invalidation, a `staleTime` refetch — there is no page to name, and it throws. A **query** or **mutation** point
 * never has one.
 *
 * Where it can throw, keep the dependency in the query input instead: the value then keys the cache, which an ambient
 * read never does.
 *
 * One caveat on the server: `origin` and `href` may come from the browser's `Referer`, so never build a
 * security-sensitive absolute url out of them (a link in an email, an outbound redirect). `pathname`, `params` and
 * `search` derive from the route and the validated input, and cannot be spoofed.
 *
 * Full reference: https://1gr14.dev/point0/latest/navigation
 */
export const getLocation = <TRouteDefinition extends AnyRouteOrDefinition = AnyRouteOrDefinition>():
  ExactLocation<TRouteDefinition> | UnknownLocation => {
  const location = _ss.__POINT0_CURRENT_LOCATION__.getOrUndefined()
  if (!location) {
    throw new Error(
      _point0_env.side.is.server
        ? 'Current location is not available: this request does not stand for a page. A query, a mutation, and a layout whose query is fetched on its own have no page — pass the value you need through the query input instead.'
        : 'Current location is not yet initialized',
    )
  }
  return location as ExactLocation<TRouteDefinition> | UnknownLocation
}

// --- Search params -------------------------------------------------------------
// `search` is already handed to pages as a parsed prop. These helpers add the
// matching setter plus a standalone hook / imperative API. A setSearch is a
// "soft" URL update: it goes straight through the adapter (replace by default),
// bypassing the navigate transition pipeline (no prefetch, no loading flash).
// The page re-renders with the new parsed `search` and its queries refetch in the
// background because `search` is part of their key.
export type SetSearchOptions = {
  /** Replace the current history entry instead of pushing a new one. Default: true. */
  replace?: boolean
}
export type SetSearchValues<TSearchInput = UnknownSearchInput> = {
  [TKey in keyof TSearchInput]?: TSearchInput[TKey] | undefined
}
export type SetSearchInput<TSearchInput = UnknownSearchInput> =
  SetSearchValues<TSearchInput> | ((prev: SetSearchValues<TSearchInput>) => SetSearchValues<TSearchInput>)
/**
 * Sets the URL query. The value is the search **input** (raw) — the same type `route.get({ '?': ... })` takes; the page
 * re-parses it through its own schema (so e.g. for a `z.coerce.number()` search the value here is the schema's input,
 * not the parsed `number`).
 *
 * The object form **replaces** the whole query — `setSearch({ a: 1 })` makes the query exactly `?a=1`, and
 * `setSearch({})` clears it. To patch, use the updater form and spread: `setSearch((prev) => ({ ...prev, a: 1 }))`.
 * `undefined` values are dropped, so `({ ...prev, a: undefined })` removes a key.
 */
export type SetSearchHelper<TSearchInput = UnknownSearchInput> = (
  next: SetSearchInput<TSearchInput>,
  options?: SetSearchOptions,
) => void

export const getSearch = <TSearch = UnknownSearchParsed,>(): TSearch => {
  return getLocation().search as TSearch
}

export const setSearch: SetSearchHelper = (next, options) => {
  // Client-only: writes the URL through the adapter navigate (history / hash /
  // memory). On the server there is nothing to navigate, so no-op — SSR code
  // paths can call it safely.
  if (_point0_env.side.is.server) {
    return
  }
  const helpers = getNavigationHelpers()
  const location = getLocation()
  // Object form replaces the whole query; the updater form gets the current raw
  // query and returns the full next one (spread `prev` to patch). `flat.stringify`
  // already drops `undefined` values, so a removed key just disappears.
  const nextValues = typeof next === 'function' ? next(location.search) : next
  const searchString = flat.stringify(nextValues)
  // Skip a redundant write when the query is unchanged (same values, or an
  // identity updater): comparing the canonical `flat` form of both sides — not
  // the raw `searchString`, whose encoding/order may differ — avoids a no-op
  // history entry and re-render. pathname + hash come from the current location
  // and never change here, so an unchanged query means an identical URL.
  if (searchString === flat.stringify(location.search)) {
    return
  }
  const to = `${location.pathname}${searchString ? `?${searchString}` : ''}${location.hash || ''}`
  helpers.adapterNavigate(to, { replace: options?.replace !== false })
}

// Returns `[search, setSearch]`. Single generic: whatever type you pass is what
// you get for both — no schema parsing or point inference, the caller owns the
// type. (`search` here is the generically-parsed query object — `flat.parse` of
// the query string — so its values are raw strings/arrays, NOT coerced by any
// schema; the schema-typed, coerced search is the page/layout `search` prop.)
export const useSearch = <TSearch = UnknownSearchParsed,>(): [TSearch, SetSearchHelper<TSearch>] => {
  const location = useLocation()
  return [location.search as TSearch, setSearch as SetSearchHelper<TSearch>]
}

const isSameNavigationLocation = (left: AnyLocation, right: AnyLocation) => {
  return left.href && right.href ? left.href === right.href : left.hrefRel === right.hrefRel
}

/**
 * Runs `fn` when a navigation **starts**; the cleanup it returns runs when that navigation settles. The right hook for
 * a progress bar or a "navigating" spinner. It skips the very first page load and fires at navigation start, not when
 * the new page paints — for first-load page-view analytics, read `useLocation()` in an effect instead.
 *
 *     useOnNavigate(() => {
 *       nprogress.start()
 *       return () => nprogress.done()
 *     })
 *
 * `useIsNavigating()` is the boolean built on top of this. Full reference: https://1gr14.dev/point0/latest/navigation
 */
export const useOnNavigate = (fn: UseOnNavigateFn) => {
  const ctx = useNavigationTransitionState()

  const prevLocationRef = useRef(ctx.currentLocation)
  const activeNextLocationRef = useRef<AnyLocation | null>(null)
  const cleanupFnRef = useRef<(() => void) | null>(null)

  const cleanupActiveNavigation = ({ commitNextLocation }: { commitNextLocation: boolean }) => {
    const activeNextLocation = activeNextLocationRef.current
    cleanupFnRef.current?.()
    cleanupFnRef.current = null
    activeNextLocationRef.current = null
    if (commitNextLocation && activeNextLocation) {
      prevLocationRef.current = activeNextLocation
    }
  }

  useEffect(() => {
    if (!ctx.nextLocation) {
      return
    }

    const prevLocation = prevLocationRef.current
    const nextLocation = ctx.nextLocation
    const activeNextLocation = activeNextLocationRef.current
    if (isSameNavigationLocation(prevLocation, nextLocation)) {
      return
    }
    if (activeNextLocation && isSameNavigationLocation(activeNextLocation, nextLocation)) {
      return
    }

    cleanupActiveNavigation({ commitNextLocation: false })
    const cleanup = fn({ prevLocation, nextLocation })
    cleanupFnRef.current = typeof cleanup === 'function' ? cleanup : null
    activeNextLocationRef.current = nextLocation
  }, [ctx.nextLocation])

  useEffect(() => {
    if (ctx.status !== 'idle' || !activeNextLocationRef.current) {
      return
    }
    cleanupActiveNavigation({ commitNextLocation: true })
  }, [ctx.status])

  useEffect(
    () => () => {
      cleanupActiveNavigation({ commitNextLocation: false })
    },
    [],
  )
}

export const useIsNavigating = (): boolean => {
  const [isNavigating, setIsNavigating] = useState(false)
  useOnNavigate(() => {
    setIsNavigating(true)
    return () => {
      setIsNavigating(false)
    }
  })
  return isNavigating
}

export type NavigationGuardProps = {
  /** Where the navigation leaves from. */
  from: AnyLocation
  /** Where it wants to land, already resolved against `from`. */
  to: AnyLocation
}
export type NavigationGuard = (props: NavigationGuardProps) => boolean | Promise<boolean>

const navigationGuards = new Set<NavigationGuard>()

/**
 * Register a guard every client navigation must pass before anything else happens — no prefetch, no transition state,
 * no history write until it answers. Guards run in registration order (after the instance `guard` of
 * `createNavigation`, when one is set) and may be async: the navigation awaits each one, so a guard is free to show a
 * dialog and resolve with the user's answer. The first `false` blocks the navigation, answered like the other
 * didn't-navigate outcomes — a `POINT0_NAVIGATION_BLOCKED`-coded error in the awaited result, never a thrown one.
 * Returns the unregister function; in React prefer {@link useNavigationGuard}, which ties the registration to the
 * component's lifetime.
 *
 * What guards never see: `setSearch` (a "soft" URL update outside the navigation pipeline), browser back/forward (on
 * `popstate` the URL has already changed by the time anyone learns of it), and full unloads — cover leaving the
 * document with a `beforeunload` listener. Full reference: https://1gr14.dev/point0/latest/navigation
 */
export const registerNavigationGuard = (guard: NavigationGuard): (() => void) => {
  navigationGuards.add(guard)
  return () => {
    navigationGuards.delete(guard)
  }
}

/**
 * {@link registerNavigationGuard} tied to the component's lifetime. The latest render's closure is the one that runs, so
 * the guard reads current state and props directly:
 *
 *     useNavigationGuard(async () => {
 *       if (!isDirty) return true
 *       return await openConfirmDialog() // resolves with the user's answer
 *     })
 *
 * Full reference: https://1gr14.dev/point0/latest/navigation
 */
export const useNavigationGuard = (guard: NavigationGuard): void => {
  const guardRef = useRef(guard)
  guardRef.current = guard
  useEffect(() => registerNavigationGuard((props) => guardRef.current(props)), [])
}

// The instance guard (createNavigation's `guard` option, off the helpers) runs first, then the registered ones. A
// literal `true` when there is no guard at all, so the caller can skip its `await` — even a resolved await defers the
// navigation's start by a microtask. The set is snapshotted, so a guard that unregisters (or registers a neighbour)
// mid-run can't skip or double-run the others.
const runNavigationGuardsIfAny = (
  props: NavigationGuardProps,
  instanceGuard: NavigationGuard | undefined,
): true | Promise<boolean> => {
  if (!instanceGuard && navigationGuards.size === 0) {
    return true
  }
  const guards = [...(instanceGuard ? [instanceGuard] : []), ...navigationGuards]
  return (async () => {
    for (const guard of guards) {
      if (!(await guard(props))) {
        return false
      }
    }
    return true
  })()
}

export const specialNavigationOptionsSymbols = {
  prefetchOnHover: Symbol('prefetchOnHover'),
  prefetch: Symbol('prefetch'),
  prefetchOnNavigate: Symbol('prefetchOnNavigate'),
  before: Symbol('before'),
  after: Symbol('after'),
  status: Symbol('status'),
  newTab: Symbol('newTab'),
  scrollToHash: Symbol('scrollToHash'),
  keepScroll: Symbol('keepScroll'),
}

export type NavigateWithTransitionsReturnType<
  TErrorClass extends ClassLikeError0<ErrorPoint0> = ClassLikeError0<ErrorPoint0>,
> = Promise<{ location: AnyLocation; error: InstanceType<TErrorClass> | undefined }>
// Resolve a navigation target against the current location, the same way a browser resolves an
// `<a href>`: a relative path (`deploy`, `../x`), a bare `#hash`, or a `?query` all resolve against
// the page you are on — while an absolute URL or a root-relative `/path` pass through unchanged.
// Without this, a relative target is resolved against the site root when computing the prefetch
// location, so prefetch misses the page the adapter navigate actually lands on and the navigation
// commits before that page's query is ready (a mid-page loading flash instead of a prefetched jump).
export const resolveNavigationTarget = (providedTo: string, currentLocation: AnyLocation): string => {
  const base = currentLocation.href ?? (typeof window !== 'undefined' ? window.location.href : undefined)
  if (base) {
    try {
      const resolved = new URL(providedTo, base)
      // Same-origin → a root-relative href (what the adapter navigate and `getLocation` expect);
      // cross-origin → the full href, so the external-navigation branch can detect and hand it off.
      return resolved.origin === new URL(base).origin
        ? resolved.pathname + resolved.search + resolved.hash
        : resolved.href
    } catch {
      // A target even `new URL` can't parse against a valid base (`http://`, a space in the
      // host): fall through to the passthrough below instead of crashing the navigation.
    }
  }
  // No absolute base to resolve against (SSR without an origin), or an unparsable target: keep
  // the historical `#hash` handling and pass everything else through untouched.
  return providedTo.startsWith('#') ? currentLocation.pathname + providedTo : providedTo
}

/**
 * Deploy invalidation, the reactive branch: a page chunk failed to load during navigation. Only a CONFIRMED newer
 * deploy triggers recovery — the current `build-version.json` is fetched fresh (or a header mismatch already marked the
 * tab stale) and compared to the version this tab runs. An unchanged version means a genuine network error: it surfaces
 * through the normal error path untouched. See {@link StalePolicy} for the reactions.
 */
async function handleStalePageChunkLoadFailure({
  error0,
  href,
  scope,
  stalePolicy,
  ErrorClass,
}: {
  error0: ErrorPoint0
  href: string
  scope: PointsScope
  stalePolicy: StalePolicy
  ErrorClass: ClassLikeError0<ErrorPoint0>
}): Promise<{ action: 'proceed'; error: ErrorPoint0 } | { action: 'navigated' } | { action: 'handled' }> {
  if (
    typeof window === 'undefined' ||
    stalePolicy === 'off' ||
    error0.code !== POINT0_ERROR_CODES_MAP.PAGE_CHUNK_LOAD_FAILED
  ) {
    return { action: 'proceed', error: error0 }
  }
  const clientBuildVersion = getClientBuildVersion()
  const latestBuildVersion =
    getStaleClientBuildState()?.latestBuildVersion ?? (await fetchLatestClientBuildVersion({ scope }))
  const confirmedStale = Boolean(clientBuildVersion && latestBuildVersion && clientBuildVersion !== latestBuildVersion)
  if (!confirmedStale || !latestBuildVersion) {
    return { action: 'proceed', error: error0 }
  }
  markClientBuildStale({ latestBuildVersion })
  const reaction = await resolveStaleReaction({
    policy: stalePolicy,
    ctx: { to: href, error: error0, clientBuildVersion, latestBuildVersion },
  })
  if (reaction === 'handled') {
    return { action: 'handled' }
  }
  if (reaction === 'navigate' && shouldAttemptStaleReload({ latestBuildVersion })) {
    documentNavigate(href)
    return { action: 'navigated' }
  }
  // 'error' — or a 'navigate' blocked by the reload-once guard: this new build already got its document load and
  // still cannot serve the chunk (a broken deploy) — surface instead of looping.
  return {
    action: 'proceed',
    error: new ErrorClass(
      `A newer client build "${latestBuildVersion}" was deployed while this tab runs "${clientBuildVersion ?? 'unknown'}" — the page chunk it requested no longer exists`,
      {
        code: POINT0_ERROR_CODES_MAP.STALE_CLIENT_BUILD,
        cause: error0,
        meta: { clientBuildVersion, latestBuildVersion },
      },
    ),
  }
}

export async function navigateWithTransitions<
  TAdapterNavigateFn extends AdapterNavigateFn = AdapterNavigateFn,
  TErrorClass extends ClassLikeError0<ErrorPoint0> = ClassLikeError0<ErrorPoint0>,
>({
  to: providedTo,
  navigate,
  options,
  ErrorClass = ErrorPoint0 as unknown as TErrorClass,
}: {
  to: string
  navigate: (to: string) => any
  options?: NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
    SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>
  ErrorClass?: TErrorClass
}): NavigateWithTransitionsReturnType<TErrorClass> {
  const helpers = getNavigationHelpers()
  const prevLocation = getLocation()
  const to = resolveNavigationTarget(providedTo, prevLocation)
  const clientPoints = getClientPoints()
  const location = clientPoints.routes._.getLocation(to)
  // Leave the SPA when the target is cross-origin, or when a new tab is requested.
  // A same-origin absolute URL stays internal (wouter handles it). Hand off to the
  // `openExternal` hook instead of the client router (which would throw on a
  // cross-origin pushState).
  const newTab = (options as { newTab?: boolean } | undefined)?.newTab === true
  const currentOrigin = prevLocation.origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  const isExternal = Boolean(location.origin && currentOrigin && location.origin !== currentOrigin)
  if (isExternal || newTab) {
    helpers.openExternal(location.href ?? to, { newTab })
    return { location, error: undefined }
  }
  // Skip a redundant navigation to the same pathname + search (e.g. a re-click on
  // the page we are already on). A hash change still goes through, so in-page
  // anchors keep working. Full no-op: no prefetch, no before/after, no history.
  if (
    location.hash === '' &&
    location.pathname === prevLocation.pathname &&
    location.searchString === prevLocation.searchString
  ) {
    return { location, error: undefined }
  }
  // The guards' veto point: before the stale checks, the prefetch, any transition state, and the navigate-id claim —
  // so a blocked (or still-asking) navigation leaves no trace, and an in-flight navigation it would otherwise have
  // superseded keeps running. The size check keeps the guard-less navigation's start synchronous — even a resolved
  // await defers the transition states by a microtask, which shifts what a same-tick render can observe. A block is
  // answered like the other didn't-navigate outcomes (a redirect, a superseding navigate): a coded error in the
  // result — an awaiting caller sees its navigation did not happen — created quietly, never thrown or logged here,
  // because a guard saying no is the guard working, not a failure.
  const guardsAnswer = runNavigationGuardsIfAny({ from: prevLocation, to: location }, helpers.guard)
  if (guardsAnswer !== true && !(await guardsAnswer)) {
    return {
      location,
      error: new ErrorClass('Navigation blocked by a navigation guard', {
        code: POINT0_ERROR_CODES_MAP.NAVIGATION_BLOCKED,
      }) as InstanceType<TErrorClass>,
    }
  }
  const navigateId = generateId()
  _ss.__POINT0_CURRENT_NAVIGATE_ID__.set(navigateId)
  // Deploy invalidation, the proactive branch: a newer client build was already noticed (via the
  // x-point0-client-build response header — see stale.ts), so don't even try to client-navigate with
  // the old chunks — leave with a full document navigation to the SAME target. `'error'` deliberately
  // proceeds: the old chunks may still load fine (or are already loaded), and if they don't, the
  // reactive branch in the catch below classifies the failure.
  const stalePolicy = helpers.stale
  const staleState = typeof window === 'undefined' ? undefined : getStaleClientBuildState()
  if (staleState && stalePolicy !== 'off' && stalePolicy !== 'error') {
    const staleReaction = await resolveStaleReaction({
      policy: stalePolicy,
      ctx: {
        to: location.href ?? to,
        error: undefined,
        clientBuildVersion: getClientBuildVersion(),
        latestBuildVersion: staleState.latestBuildVersion,
      },
    })
    if (staleReaction === 'navigate') {
      // Same reload-once-per-version guard as the failure path: if the one document load for this version already
      // happened and the mark is back (a client whose build can never match the server — e.g. shipped inside a native
      // app package — or a flapping rolling deploy), keep client-navigating normally; the loaded chunks still work.
      if (shouldAttemptStaleReload({ latestBuildVersion: staleState.latestBuildVersion })) {
        documentNavigate(location.href ?? to)
        return { location, error: undefined }
      }
    } else if (staleReaction === 'handled') {
      return { location, error: undefined }
    }
    // 'error' (or a guard-blocked 'navigate'): fall through to the normal client navigation.
  }
  // Resolve scrollToHash for this navigation. The cross-page case is handled by
  // the central scroll manager (correct timing — after the new page renders) via
  // the signal set in commitNavigate; the current-page (#anchor) case is handled
  // imperatively below, because the manager's location effect doesn't refire for
  // a hash-only change.
  const scrollToHashOption = (options as { scrollToHash?: ScrollToHashPolicy } | undefined)?.scrollToHash
  // `keepScroll` freezes the scroll for this one navigation: the manager's location effect skips its
  // whole apply (top / restore / #hash), and the imperative current-page #hash jump below is off too.
  const keepScrollOption = (options as { keepScroll?: boolean } | undefined)?.keepScroll === true
  const isCurrentPathname = location.pathname === prevLocation.pathname
  const currentScrollToHashBehavior =
    isCurrentPathname && !keepScrollOption
      ? resolveScrollToHashBehavior(scrollToHashOption, helpers.scrollToHash, 'current')
      : undefined
  // Commit the location change through the adapter. The scroll signals and the leaving page's
  // position are handled here — immediately before the commit — rather than when the navigation
  // starts: every abort path (redirect found, superseded by another navigate) returns before this
  // point, so nothing leaks into an unrelated location change (e.g. a back/forward landing while
  // a slow prefetch is still in flight), and the position is read while the leaving page's DOM is
  // still mounted (not yet clamped by a shorter incoming page). Same-page #hash changes skip all
  // of it — they don't re-fire the scroll manager's location effect, nothing would consume it.
  const commitNavigate = async () => {
    if (!isCurrentPathname) {
      saveScrollPositionForLocation(prevLocation)
      scrollToHashSignal.override = scrollToHashOption
      scrollRestorationSignal.programmaticPush = true
      scrollRestorationSignal.captureSuspended = true
      scrollRestorationSignal.keepScroll = keepScrollOption
    }
    try {
      await navigate(to)
    } catch (error) {
      // The location effect that would consume the signals may never fire — reset ALL of them, or they leak into an
      // unrelated later location change (a pop would read a stale push/keepScroll/override).
      scrollRestorationSignal.captureSuspended = false
      scrollRestorationSignal.programmaticPush = false
      scrollRestorationSignal.keepScroll = false
      scrollToHashSignal.override = undefined
      throw error
    }
  }

  helpers.setPrevLocation(prevLocation)
  helpers.setTransitionError(undefined)
  helpers.setNextLocation(location)
  helpers.setTransitionStatus('preparing')
  try {
    const queryClient = _ss.__POINT0_QUERY_CLIENT__.getOrUndefined()
    const tryTriggerRedirect = () => {
      const redirectTask = queryClient ? findRedirectTaskInQueryClientCache(queryClient, to) : undefined
      if (redirectTask && queryClient) {
        if (redirectTask.to === to) {
          removeRedirectsFromQueryClientCache(queryClient, redirectTask.to)
          return undefined
        }
        void helpers.navigate.to(redirectTask.to, {
          ...redirectTask.options,
          after: (...args) => {
            void options?.after?.(...args)
            removeRedirectsFromQueryClientCache(queryClient, redirectTask.to)
          },
        })
        return {
          location,
          error: new ErrorClass(
            'Redirect task found in query client cache, will be triggered now',
          ) as InstanceType<TErrorClass>,
        }
      }
      return undefined
    }
    void options?.before?.(to, options)
    const redirectResult1 = tryTriggerRedirect()
    if (redirectResult1) {
      return redirectResult1
    }
    await clientPoints.prefetchPage({
      location,
      policy: options?.prefetch,
      trigger: 'navigate',
    })
    const redirectResult2 = tryTriggerRedirect()
    if (redirectResult2) {
      return redirectResult2
    }
    if (navigateId !== _ss.__POINT0_CURRENT_NAVIGATE_ID__.get()) {
      return { location, error: new ErrorClass('Another navigate has been started') as InstanceType<TErrorClass> }
    }
    helpers.setTransitionStatus('transitioning')
    await commitNavigate()
    void options?.after?.(to, options)
    helpers.setTransitionStatus('idle')
    helpers.setNextLocation(null)
    // Current-page #anchor jump: the page is already mounted, so jump to the
    // element right away (cross-page jumps are done by the scroll manager).
    if (currentScrollToHashBehavior && location.hash) {
      scrollToHashElementWithRetry(location.hash, currentScrollToHashBehavior)
    }
    return { location, error: undefined }
  } catch (error) {
    log({
      level: 'error',
      category: ['navigation'],
      message: 'Error during navigation',
      error,
    })
    if (navigateId !== _ss.__POINT0_CURRENT_NAVIGATE_ID__.get()) {
      return { location, error: new ErrorClass('Another navigate has been started') as InstanceType<TErrorClass> }
    }
    const staleResult = await handleStalePageChunkLoadFailure({
      error0: ErrorClass.from(error),
      href: location.href ?? to,
      scope: clientPoints.manager.scope,
      stalePolicy,
      ErrorClass,
    })
    if (staleResult.action === 'navigated') {
      // The document navigation to the target is underway — nothing to commit client-side.
      return { location, error: undefined }
    }
    if (staleResult.action === 'handled') {
      // A custom stale handler took ownership: no document navigation, no commit of the failed
      // client navigation — the user stays where they are.
      helpers.setTransitionStatus('idle')
      helpers.setNextLocation(null)
      return { location, error: ErrorClass.from(error) as InstanceType<TErrorClass> }
    }
    const error0 = staleResult.error as InstanceType<TErrorClass>
    helpers.setTransitionError(error0)
    helpers.setTransitionStatus('transitioning')
    await commitNavigate()
    void options?.after?.(to, options)
    helpers.setTransitionStatus('idle')
    helpers.setNextLocation(null)
    return { location, error: error0 }
  }
}

export * from './redirect.js'
// Selective on purpose (not `export *`): scroll.js also exports the signal
// singletons and capture helpers this file's commit path needs — those stay
// internal.
export {
  resolveScrollToHashBehavior,
  resolveScrollToHashPolicy,
  ScrollRestoration,
  useScrollRestoration,
} from './scroll.js'
export type { ResolvedScrollToHashPolicy, ScrollToHashBehavior, ScrollToHashPolicy } from './scroll.js'
export * from './stale.js'
