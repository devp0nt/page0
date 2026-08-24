import { Route0, type AnyLocation, type ExtractRoute, type ExtractRoutesKeys, type RoutesPretty } from '@1gr14/route0'
import type { ExactLocation, GetPathInputByRoute, IsParamsOptional } from '@1gr14/route0'
import { _point0_env, _ss, env, ErrorPoint0, getClientPoints, log } from '@point0/core'
import type {
  AnyNiceReadyPoint,
  ClassLikeError0,
  ClientPointsLayouts,
  NormalizedLazyPointsCollectionRecord,
  PagesTree,
  PrefetchPagePolicy,
  ReadyPointsCollectionRecord,
} from '@point0/core'
import {
  getNavigationHelpers,
  navigateWithTransitions,
  NavigationContextProvider,
  RedirectTask,
  ScrollRestoration,
  specialNavigationOptionsSymbols,
  useLocation,
  useNavigationLocationContext,
} from '@point0/core/navigation'
import type {
  AdapterNavigateFn,
  NavigateHelper,
  NavigateOptionsByAdapterNavigateFn,
  NavigateWithTransitionsReturnType,
  NavigationContextProviderProps,
  NavigationGuard,
  OpenExternalFn,
  RedirectComponent,
  RedirectHelper,
  RedirectOptionsByAdapterNavigateFn,
  ScrollToHashPolicy,
  SpecialLinkOptions,
  SpecialNavigateOptions,
  SpecialRedirectOptions,
  StalePolicy,
  UseLocationFn,
} from '@point0/core/navigation'
import React, { Fragment, useCallback, useMemo, useRef } from 'react'
import type { AnchorHTMLAttributes, MouseEventHandler, ReactElement, RefAttributes } from 'react'
import {
  Link as NativeWouterLink,
  Redirect as NativeWouterRedirect,
  Router as NativeWouterRouter,
  Route,
  Switch,
  useLocation as useWouterLocation,
  useRouter as useWouterRouter,
  useSearchParams as useWouterSearchParams,
} from 'wouter'
import type {
  AroundNavHandler,
  BaseLocationHook,
  BaseSearchHook,
  HookNavigationOptions,
  NavigationalProps,
  SsrContext,
} from 'wouter'
import {
  navigate as browserNavigate,
  useBrowserLocation,
  useSearch as useBrowserSearch,
} from 'wouter/use-browser-location'
import type { BrowserLocationHook } from 'wouter/use-browser-location'

type AsChildProps<ComponentProps, DefaultElementProps> =
  ({ asChild?: false } & DefaultElementProps) | ({ asChild: true } & ComponentProps)

type HTMLLinkAttributes = AnchorHTMLAttributes<HTMLAnchorElement>
type LinkAsChildProps = AsChildProps<
  { children: ReactElement; onClick?: MouseEventHandler },
  HTMLLinkAttributes & RefAttributes<HTMLAnchorElement>
>
// Internal: the prop bundle handed straight to wouter's <Link>. Not part of the
// public API surface — consumers use LinkComponentProps / InferLinkProps instead.
export type WouterLinkProps<H extends BaseLocationHook = BrowserLocationHook> = NavigationalProps<H> &
  LinkAsChildProps &
  SpecialLinkOptions<HookNavigationOptions<H>>
export type AdapterNavigateFnByHook<TBaseLocationHook extends BaseLocationHook = BrowserLocationHook> =
  ReturnType<TBaseLocationHook>[1]

type StringOrFalsy = string | undefined | null | false
export type NavLinkClassNameProps = {
  exactClassName?: StringOrFalsy
  sameClassName?: StringOrFalsy
  ancestorClassName?: StringOrFalsy
  descendantClassName?: StringOrFalsy
  unmatchedClassName?: StringOrFalsy
  className?:
    | StringOrFalsy
    | ((state: NavLinkStateOptions) => StringOrFalsy)
    | Partial<Record<'default' | NavLinkStateType, StringOrFalsy>>
}
export type NavLinkAsChildProps = AsChildProps<
  { children: ReactElement; onClick?: MouseEventHandler },
  Omit<HTMLLinkAttributes, 'className'> & RefAttributes<HTMLAnchorElement>
>
export type Layout404TypeOne = string | AnyNiceReadyPoint<'layout'>
export type Layout404Type = Array<Layout404TypeOne> | Layout404TypeOne
export type Page404Type = React.ComponentType | React.ReactElement

export type NavLinkStateType = 'exact' | 'same' | 'ancestor' | 'descendant' | 'unmatched'
export type NavLinkStateOptions =
  | {
      type: 'exact'
      exact: true
      same: false
      ancestor: false
      descendant: false
      unmatched: false
    }
  | {
      type: 'same'
      exact: false
      same: true
      ancestor: false
      descendant: false
      unmatched: false
    }
  | {
      type: 'ancestor'
      exact: false
      same: false
      ancestor: true
      descendant: false
      unmatched: false
    }
  | {
      type: 'descendant'
      exact: false
      same: false
      ancestor: false
      descendant: true
      unmatched: false
    }
  | {
      type: 'unmatched'
      exact: false
      same: false
      ancestor: false
      descendant: false
      unmatched: true
    }

// ─── Infer* — embeddable navigation props ────────────────────────────────────
// Navigation target + behavior props that can be embedded into ANY component
// (your own Button, Card, MenuItem, …) WITHOUT the underlying <a> HTML attributes,
// ref, `asChild` or `children`. The host component owns rendering — these only
// describe "where this navigates and how". Exposed per-instance via `InferNavigation`
// and split out at runtime with `splitLinkProps`.

// Just the typed route target: `{ route, input }` discriminated union (+ nav options).
export type InferRouteProps<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = {
  // `to?: undefined; href?: undefined` keeps all three discriminants present on
  // every branch (so consumers can read `linkProps.to` etc.) and makes route ⇿
  // to ⇿ href mutually exclusive in both directions.
  [TRouteName in ExtractRoutesKeys<TRoutes>]: {
    route: TRouteName
    to?: undefined
    href?: undefined
  } & (IsParamsOptional<ExtractRoute<TRoutes, TRouteName>> extends true
    ? { input?: GetPathInputByRoute<ExtractRoute<TRoutes, TRouteName>> }
    : { input: GetPathInputByRoute<ExtractRoute<TRoutes, TRouteName>> }) &
    HookNavigationOptions<TBaseLocationHook> &
    SpecialLinkOptions<HookNavigationOptions<TBaseLocationHook>>
}[ExtractRoutesKeys<TRoutes>]

export type InferLinkProps<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> =
  | InferRouteProps<TRoutes, TBaseLocationHook>
  // `route?: never` keeps the branches mutually exclusive: passing `route` forces
  // a valid route name + its typed `input` (the route branch) instead of silently
  // falling back to the loose `to` branch.
  | ({ route?: never; to?: string; href?: undefined } & HookNavigationOptions<TBaseLocationHook> &
      SpecialLinkOptions<HookNavigationOptions<TBaseLocationHook>>)
  | ({ route?: never; href?: string; to?: undefined } & HookNavigationOptions<TBaseLocationHook> &
      SpecialLinkOptions<HookNavigationOptions<TBaseLocationHook>>)

// Like InferLinkProps but with NavLink's state-driven className props, for components
// that also want exact/same/ancestor/descendant/unmatched styling.
export type InferNavLinkProps<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = InferLinkProps<TRoutes, TBaseLocationHook> & NavLinkClassNameProps

// ─── *ComponentProps — the full props each component accepts ──────────────────
// = the embeddable Infer* navigation props + the native <a> surface
// (asChild / children / anchor attributes / ref).
export type LinkRouteProps<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = InferRouteProps<TRoutes, TBaseLocationHook> & LinkAsChildProps

export type LinkComponentProps<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = InferLinkProps<TRoutes, TBaseLocationHook> & LinkAsChildProps

export type CreatedLink<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = (props: LinkComponentProps<TRoutes, TBaseLocationHook>) => React.ReactElement

export type NavLinkRouteProps<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = InferRouteProps<TRoutes, TBaseLocationHook> & NavLinkClassNameProps & NavLinkAsChildProps

export type NavLinkComponentProps<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = InferNavLinkProps<TRoutes, TBaseLocationHook> & NavLinkAsChildProps

export type CreatedNavLink<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = (props: NavLinkComponentProps<TRoutes, TBaseLocationHook>) => React.ReactElement

// What `useNavLink` accepts: just the navigation target, no anchor/className/options.
export type UseNavLinkProps<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = InferLinkProps<TRoutes, TBaseLocationHook>
// What `useNavLink` returns: the resolved match state (NavLinkStateOptions) plus the
// resolved target. Mirrors what NavLink computes internally for its className.
export type UseNavLinkResult = NavLinkStateOptions & {
  tohref: string
  to: string | undefined
  href: string | undefined
}
export type CreatedUseNavLink<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = (props: UseNavLinkProps<TRoutes, TBaseLocationHook>) => UseNavLinkResult

/**
 * Type-only handle returned from `createNavigation`. At runtime it is `null` — it exists purely so you can read the
 * navigation prop shapes off it in type position (it carries the route generic, so `route`/`input` stay typed):
 *
 * export const { Link, InferNavigation } = createNavigation({ routes }) type ButtonProps = MyOwnProps & typeof
 * InferNavigation.LinkProps
 *
 * Never read its members at runtime.
 */
export type InferNavigation<
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
> = {
  /** Embeddable Link props: route/to/href + prefetch/before/after + adapter opts. No <a> attrs, no asChild. */
  LinkProps: InferLinkProps<TRoutes, TBaseLocationHook>
  /** Like LinkProps, plus NavLink's state className props (exactClassName, sameClassName, …). */
  NavLinkProps: InferNavLinkProps<TRoutes, TBaseLocationHook>
  /** The typed route target only: `{ route, input }` discriminated union (no to/href). */
  RouteProps: InferRouteProps<TRoutes, TBaseLocationHook>
}

const _resolveFinalTo = <TRoutes extends RoutesPretty>({
  routes,
  routeName,
  input,
  providedTo,
  providedHref,
}: {
  routes: TRoutes
  routeName?: string
  input: Record<string, unknown>
  providedTo?: string
  providedHref?: string
  componentName: 'Link' | 'NavLink' | 'Redirect'
}): { tohref: string } & ({ to: string; href: undefined } | { to: undefined; href: string }) => {
  if (providedTo !== undefined) {
    return { tohref: providedTo, to: providedTo, href: undefined }
  }
  if (providedHref !== undefined) {
    return { tohref: providedHref, to: undefined, href: providedHref }
  }
  if (routeName === undefined) {
    return { tohref: '#', to: '#', href: undefined }
  }
  const route = routes[routeName]
  if (!route) {
    const error = new Error(`Route "${routeName}" not found`)
    log({ level: 'error', category: ['wouter'], error, message: error.message })
    return { tohref: '#', to: '#', href: undefined }
  }
  const ginalTo = route.get(input)
  return { tohref: ginalTo, to: ginalTo, href: undefined }
}

// --- Single source of truth for "what is a link/navigation prop" ----------------
// Keep these lists in sync with SpecialLinkOptions (core) and wouter's
// NavigationalProps. `splitLinkProps`, `_getNativeAnchorProps` and `splitOptions`
// all derive from them so they can never drift apart.
export const linkSpecialOptionKeys = [
  'prefetch',
  'prefetchOnHover',
  'prefetchOnNavigate',
  'before',
  'after',
  'newTab',
  'scrollToHash',
  'keepScroll',
] as const
export const linkTargetKeys = ['route', 'input', 'to', 'href'] as const
// wouter HookNavigationOptions / NavigationalProps (adapter-level nav options).
export const linkAdapterNavKeys = ['replace', 'state'] as const
export const linkPropKeys = [...linkTargetKeys, ...linkAdapterNavKeys, ...linkSpecialOptionKeys] as const
export type LinkPropKey = (typeof linkPropKeys)[number]
const linkPropKeySet: ReadonlySet<string> = new Set(linkPropKeys)

// Distribute Pick/Omit over unions so a discriminated props type
// (e.g. `OwnProps & InferNavigation.LinkProps`) keeps its branches after splitting.
type DistributivePick<T, K extends PropertyKey> = T extends unknown ? Pick<T, Extract<keyof T, K>> : never
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * Split a props object into `[linkProps, restProps, isLink]`: the navigation-specific props (route/input/to/href +
 * replace/state + prefetch/before/after), everything else (your component's own props + native element attributes), and
 * whether a navigation target was actually passed.
 *
 * `isLink` is `true` only when a target (`to` / `href` / `route`) is present — link options on their own (e.g. just
 * `prefetch`) don't make it a link. Use it to pick the element to render, no manual `to ?? href ?? route` check
 * needed:
 *
 * const [linkProps, rest, isLink] = splitLinkProps(props) const Comp = isLink ? Link : 'button' return <Comp {...rest}
 * {...linkProps} />
 */
export const splitLinkProps = <P extends Record<string, any>>(
  props: P,
): [DistributivePick<P, LinkPropKey>, DistributiveOmit<P, LinkPropKey>, boolean] => {
  const linkProps: Record<string, unknown> = {}
  const rest: Record<string, unknown> = {}
  for (const key of Object.keys(props)) {
    if (linkPropKeySet.has(key)) {
      linkProps[key] = props[key]
    } else {
      rest[key] = props[key]
    }
  }
  const isLink = Boolean(linkProps.to ?? linkProps.href ?? linkProps.route)
  return [linkProps as DistributivePick<P, LinkPropKey>, rest as DistributiveOmit<P, LinkPropKey>, isLink]
}

const _getNativeAnchorProps = (props: Record<string, any>): React.ComponentProps<'a'> => {
  const nativeProps = Object.assign({}, props)
  delete nativeProps.tohref
  delete nativeProps.status
  for (const key of linkAdapterNavKeys) {
    delete nativeProps[key]
  }
  for (const key of linkSpecialOptionKeys) {
    delete nativeProps[key]
  }
  return nativeProps
}

/**
 * Render the plain native `<a>` for a link target. Used for `href` links (no SPA routing) and for any `newTab` link,
 * regardless of how the target was given (`to` / `href` / `route`).
 *
 * `newTab` leaves the SPA, so we render a real `target="_blank"` + `rel="noopener noreferrer"` anchor (honoring an
 * explicit `target`/`rel` if the caller passed one) instead of letting the client router intercept the click. The
 * native target is more robust than a JS-driven `window.open`: it works before hydration, honors cmd/middle-click, and
 * is announced to assistive tech. Imperative `navigate({ newTab })` has no anchor, so it still leaves the SPA via
 * `openExternal`.
 */
const _getNativeAnchorElement = (props: Record<string, any>, tohref: string, newTab: boolean): React.ReactElement => {
  const nativeProps = _getNativeAnchorProps(props)
  if (!newTab) {
    return <a {...nativeProps} href={tohref} />
  }
  return (
    <a
      {...nativeProps}
      href={tohref}
      target={(nativeProps.target as string | undefined) ?? '_blank'}
      rel={(nativeProps.rel as string | undefined) ?? 'noopener noreferrer'}
    />
  )
}

// const _useFinalTo = <TRoutes extends RoutesPretty>({
//   routes,
//   routeName,
//   input,
//   providedTo,
//   providedHref,
//   componentName,
// }: {
//   routes: TRoutes
//   routeName?: string
//   input: Record<string, unknown>
//   providedTo?: string
//   providedHref?: string
//   componentName: 'Link' | 'NavLink' | 'Redirect'
// }): { tohref: string } & ({ to: string; href: undefined } | { to: undefined; href: string }) => {
//   return useMemo(
//     () => _resolveFinalTo({ routes, routeName, input, providedTo, providedHref, componentName }),
//     [routes, routeName, JSON.stringify(input), providedTo, providedHref, componentName],
//   )
// }

const _getWouterLinkProps = <TBaseLocationHook extends BaseLocationHook = BrowserLocationHook>(
  props: WouterLinkProps<TBaseLocationHook> & { tohref: string },
): {
  wouterLinkProps: WouterLinkProps
  tohref: string
  pointWithLocation:
    { point: NormalizedLazyPointsCollectionRecord | ReadyPointsCollectionRecord; location: AnyLocation } | undefined
} => {
  const {
    to,
    href,
    tohref,
    onMouseEnter: providedOnMouseEnter,
    onMouseLeave: providedOnMouseLeave,
    prefetchOnNavigate,
    prefetchOnHover,
    prefetch,
    before,
    after,
    newTab,
    scrollToHash,
    keepScroll,
    ...rest
  } = props as WouterLinkProps<any> & { tohref: string } & SpecialLinkOptions<
      HookNavigationOptions<TBaseLocationHook>
    > & {
      onMouseEnter?: (e: React.MouseEvent<HTMLAnchorElement>) => void
      onMouseLeave?: (e: React.MouseEvent<HTMLAnchorElement>) => void
    }
  const clientPoints = getClientPoints()
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { pointWithLocation, providedPolh, defaultPolh, polhEnabled } = useMemo<
    | {
        pointWithLocation: {
          point: NormalizedLazyPointsCollectionRecord | ReadyPointsCollectionRecord
          location: ExactLocation
        }
        providedPolh: PrefetchPagePolicy | undefined
        defaultPolh: number | boolean
        polhEnabled: true
      }
    | {
        pointWithLocation: {
          point: NormalizedLazyPointsCollectionRecord | ReadyPointsCollectionRecord
          location: ExactLocation
        }
        providedPolh: PrefetchPagePolicy | undefined
        defaultPolh: number | boolean
        polhEnabled: false
      }
    | {
        pointWithLocation: undefined
        providedPolh: undefined
        defaultPolh: undefined
        polhEnabled: false
      }
  >(() => {
    if (!tohref || tohref.startsWith('#')) {
      return { pointWithLocation: undefined, providedPolh: undefined, defaultPolh: undefined, polhEnabled: false }
    }
    const pointWithLocation = clientPoints._getPageByHref(tohref)
    if (!pointWithLocation) {
      return { pointWithLocation: undefined, providedPolh: undefined, defaultPolh: undefined, polhEnabled: false }
    }
    const providedPolh = prefetchOnHover !== undefined ? prefetchOnHover : prefetch
    const defaultPolh = pointWithLocation.point.polh
    const polhProividedDisables = providedPolh === false || providedPolh === 'none'
    const polhEnabled = !polhProividedDisables && defaultPolh !== false
    return {
      pointWithLocation,
      providedPolh,
      defaultPolh,
      polhEnabled: polhEnabled as true,
    }
  }, [tohref, prefetchOnHover, prefetch])
  const onMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (polhEnabled) {
        // Clear any existing timeout
        if (prefetchTimeoutRef.current) {
          clearTimeout(prefetchTimeoutRef.current)
        }
        // Set a N ms delay before prefetching
        prefetchTimeoutRef.current = setTimeout(
          () => {
            prefetchTimeoutRef.current = null
            clientPoints
              .prefetchPage({
                location: pointWithLocation.location,
                policy: providedPolh,
                trigger: 'linkHover',
              })
              .catch((error: unknown) => {
                // A hover prefetch is a best-effort warm-up — a failure (offline, a stale-deploy chunk 404) must stay
                // quiet: the real navigation will load the page itself and run the stale-deploy recovery if needed.
                log({
                  level: 'debug',
                  category: ['navigation', 'prefetch'],
                  message: 'Prefetch on link hover failed',
                  error,
                })
              })
          },
          typeof defaultPolh === 'number' ? defaultPolh : 30,
        )
      }
      void providedOnMouseEnter?.(e)
    },
    [pointWithLocation, providedPolh, defaultPolh, polhEnabled],
  )
  const onMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current)
        prefetchTimeoutRef.current = null
      }
      void providedOnMouseLeave?.(e)
    },
    [prefetchTimeoutRef],
  )
  return {
    tohref,
    pointWithLocation,
    wouterLinkProps: {
      ...rest,
      onMouseEnter,
      onMouseLeave,
      to,
      href,
      [specialNavigationOptionsSymbols.prefetchOnHover]: prefetchOnHover,
      [specialNavigationOptionsSymbols.prefetch]: prefetchOnNavigate !== undefined ? prefetchOnNavigate : prefetch,
      [specialNavigationOptionsSymbols.prefetchOnNavigate]: prefetchOnNavigate,
      [specialNavigationOptionsSymbols.before]: before,
      [specialNavigationOptionsSymbols.after]: after,
      [specialNavigationOptionsSymbols.newTab]: newTab,
      [specialNavigationOptionsSymbols.scrollToHash]: scrollToHash,
      [specialNavigationOptionsSymbols.keepScroll]: keepScroll,
    } as WouterLinkProps, // & SpecialLinkOptionsInDataAttributes,
  }
}

const splitOptions = <TAdapterNavigateFn extends AdapterNavigateFn = AdapterNavigateFn>(
  options:
    | undefined
    | (NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
        SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>> &
        SpecialLinkOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>> &
        SpecialRedirectOptions),
): {
  normalOptions: SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>> &
    SpecialLinkOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>
  wouterOptions: NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>
} => {
  const getOptionValue = (key: keyof typeof specialNavigationOptionsSymbols) => {
    const normalValue = options?.[key]
    if (typeof normalValue !== 'undefined') {
      return normalValue
    }
    const symbolValue = (options as any)?.[specialNavigationOptionsSymbols[key]]
    if (typeof symbolValue !== 'undefined') {
      return symbolValue
    }
    return undefined
  }
  const specialOptionsWithStringKeys = {
    prefetchOnNavigate: getOptionValue('prefetchOnNavigate'),
    prefetchOnHover: getOptionValue('prefetchOnHover'),
    prefetch: getOptionValue('prefetch'),
    before: getOptionValue('before'),
    after: getOptionValue('after'),
    status: getOptionValue('status'),
    newTab: getOptionValue('newTab'),
    scrollToHash: getOptionValue('scrollToHash'),
    keepScroll: getOptionValue('keepScroll'),
  }
  const specialOptionsWithSymbolKeys = {
    [specialNavigationOptionsSymbols.prefetchOnNavigate]: specialOptionsWithStringKeys.prefetchOnNavigate,
    [specialNavigationOptionsSymbols.prefetchOnHover]: specialOptionsWithStringKeys.prefetchOnHover,
    [specialNavigationOptionsSymbols.prefetch]: specialOptionsWithStringKeys.prefetch,
    [specialNavigationOptionsSymbols.before]: specialOptionsWithStringKeys.before,
    [specialNavigationOptionsSymbols.after]: specialOptionsWithStringKeys.after,
    [specialNavigationOptionsSymbols.status]: specialOptionsWithStringKeys.status,
    [specialNavigationOptionsSymbols.newTab]: specialOptionsWithStringKeys.newTab,
    [specialNavigationOptionsSymbols.scrollToHash]: specialOptionsWithStringKeys.scrollToHash,
    [specialNavigationOptionsSymbols.keepScroll]: specialOptionsWithStringKeys.keepScroll,
  }
  const optionsWithoutSpecialKeys = {
    ...options,
  }
  delete optionsWithoutSpecialKeys.prefetchOnNavigate
  delete optionsWithoutSpecialKeys.prefetchOnHover
  delete optionsWithoutSpecialKeys.prefetch
  delete optionsWithoutSpecialKeys.before
  delete optionsWithoutSpecialKeys.after
  delete optionsWithoutSpecialKeys.status
  delete optionsWithoutSpecialKeys.newTab
  delete optionsWithoutSpecialKeys.scrollToHash
  delete optionsWithoutSpecialKeys.keepScroll
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.prefetchOnNavigate]
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.prefetchOnHover]
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.prefetch]
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.before]
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.after]
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.status]
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.newTab]
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.scrollToHash]
  delete (optionsWithoutSpecialKeys as any)[specialNavigationOptionsSymbols.keepScroll]
  const wouterOptions = {
    ...optionsWithoutSpecialKeys,
    ...specialOptionsWithSymbolKeys,
  }
  const normalOptions = {
    ...optionsWithoutSpecialKeys,
    ...specialOptionsWithStringKeys,
  }
  return {
    wouterOptions,
    normalOptions,
  }
}

const getRoutes = () => {
  try {
    return getClientPoints().routes
  } catch {
    throw new Error('You should provide routes, or call ClientPoints.mount(points) before createNavigation')
  }
}

export const createNavigate = <
  TRoutes extends RoutesPretty,
  TAdapterNavigateFn extends AdapterNavigateFn = typeof browserNavigate,
  TErrorClass extends ClassLikeError0<ErrorPoint0> = ClassLikeError0<ErrorPoint0>,
>({
  routes,
  navigate: adapterNavigate,
  ErrorClass = ErrorPoint0 as unknown as TErrorClass,
}: {
  routes: TRoutes
  navigate?: TAdapterNavigateFn
  ErrorClass?: TErrorClass
}): NavigateHelper<TRoutes, TAdapterNavigateFn, TErrorClass> => {
  // No explicit `navigate` → use the adapter navigate the Router derived from the
  // location `hook` (stored in the navigation helpers), so imperative navigation
  // stays consistent with the configured hook. Outside a Router (standalone use),
  // fall back to browser navigate.
  const resolveAdapterNavigate = (): AdapterNavigateFn => {
    if (adapterNavigate) {
      return adapterNavigate as AdapterNavigateFn
    }
    try {
      return getNavigationHelpers().adapterNavigate
    } catch {
      return browserNavigate
    }
  }
  const wrappedNavigate = (
    to: string,
    options?: NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
      SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
  ): NavigateWithTransitionsReturnType<TErrorClass> => {
    const { normalOptions, wouterOptions } = splitOptions(options)
    return navigateWithTransitions({
      to,
      options: normalOptions,
      navigate: (resolvedTo) => resolveAdapterNavigate()(resolvedTo, wouterOptions),
      ErrorClass,
    })
  }
  async function navigate<TRouteName extends ExtractRoutesKeys<TRoutes>>(
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
  ): NavigateWithTransitionsReturnType<TErrorClass> {
    const routeName = args[0] as ExtractRoutesKeys<TRoutes>
    const input = args[1] as unknown
    const options = args[2] as
      | (NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
          SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>)
      | undefined
    const route = routes[routeName]
    if (!route) {
      throw new ErrorClass(`Route "${routeName}" not found`)
    }

    const to = route.get(input || {}) as string
    const { normalOptions, wouterOptions } = splitOptions(options)
    return await navigateWithTransitions({
      to,
      options: normalOptions,
      navigate: (resolvedTo) => resolveAdapterNavigate()(resolvedTo, wouterOptions),
      ErrorClass,
    })
  }
  return Object.assign(navigate, {
    to: wrappedNavigate,
    back: () => {
      if (typeof window !== 'undefined') {
        window.history.back()
      }
    },
    forward: () => {
      if (typeof window !== 'undefined') {
        window.history.forward()
      }
    },
  })
}

export const createLink = <
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
>({
  routes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hook,
}: {
  routes: TRoutes
  hook?: TBaseLocationHook
}): CreatedLink<TRoutes, TBaseLocationHook> => {
  function Link(props: LinkComponentProps<TRoutes, TBaseLocationHook>): React.ReactElement
  function Link(props: {
    to?: string
    href?: string
    route?: string
    input?: Record<string, unknown>
  }): React.ReactElement {
    const { route: routeName, input = {}, to: providedTo, href: providedHref, ...rest } = props
    const finalTo = _resolveFinalTo({
      routes,
      routeName,
      input,
      providedTo,
      providedHref,
      componentName: 'Link',
    })

    const newTab = (rest as { newTab?: boolean }).newTab === true
    if (finalTo.to && !newTab) {
      const { wouterLinkProps } = _getWouterLinkProps({ ...rest, ...finalTo })
      return <NativeWouterLink {...wouterLinkProps} />
    }
    return _getNativeAnchorElement(rest, finalTo.tohref, newTab)
  }
  return Link
}

export const createUseNavLink = <
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
>({
  routes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hook,
}: {
  routes: TRoutes
  hook?: TBaseLocationHook
}): CreatedUseNavLink<TRoutes, TBaseLocationHook> => {
  function useNavLink(props: UseNavLinkProps<TRoutes, TBaseLocationHook>): UseNavLinkResult
  function useNavLink(props: {
    to?: string
    href?: string
    route?: string
    input?: Record<string, unknown>
  }): UseNavLinkResult {
    const { route: routeName, input = {}, to: providedTo, href: providedHref } = props
    const finalTo = _resolveFinalTo({
      routes,
      routeName,
      input,
      providedTo,
      providedHref,
      componentName: 'NavLink',
    })
    const currentLocation = useLocation()
    const pointWithLocation = useMemo(() => {
      if (!finalTo.tohref || finalTo.tohref.startsWith('#')) {
        return undefined
      }
      return getClientPoints()._getPageByHref(finalTo.tohref)
    }, [finalTo.tohref])
    const route = pointWithLocation?.point.route
    const relation = useMemo(() => {
      if (!route) {
        return undefined
      }
      return route.getRelation(currentLocation.pathname)
    }, [pointWithLocation?.point.route?.definition, currentLocation.pathname])
    const state = useMemo<NavLinkStateOptions>(() => {
      const unmatched = {
        type: 'unmatched',
        exact: false,
        same: false,
        ancestor: false,
        descendant: false,
        unmatched: true,
      } as const
      if (!relation || relation.unmatched) {
        return unmatched
      }
      if (relation.exact) {
        if (
          currentLocation.origin
            ? Route0.toAbsLocation(Route0.getLocation(finalTo.tohref), currentLocation.origin).href ===
              currentLocation.href
            : finalTo.tohref === currentLocation.hrefRel
        ) {
          return { type: 'exact', exact: true, same: false, ancestor: false, descendant: false, unmatched: false }
        }
        return { type: 'same', exact: false, same: true, ancestor: false, descendant: false, unmatched: false }
      }
      if (relation.ancestor) {
        return { type: 'ancestor', exact: false, same: false, ancestor: true, descendant: false, unmatched: false }
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (relation.descendant) {
        return { type: 'descendant', exact: false, same: false, ancestor: false, descendant: true, unmatched: false }
      }
      return unmatched
    }, [
      relation,
      currentLocation.origin,
      currentLocation.href,
      currentLocation.hrefRel,
      currentLocation.pathname,
      finalTo.tohref,
    ])
    return { ...state, tohref: finalTo.tohref, to: finalTo.to, href: finalTo.href }
  }
  return useNavLink
}

export const createNavLink = <
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
>({
  routes,
  hook,
}: {
  routes: TRoutes
  hook?: TBaseLocationHook
}): CreatedNavLink<TRoutes, TBaseLocationHook> => {
  const useNavLink = createUseNavLink<TRoutes, TBaseLocationHook>({ routes, hook })
  function NavLink(props: NavLinkComponentProps<TRoutes, TBaseLocationHook>): React.ReactElement
  function NavLink(props: {
    to?: string
    href?: string
    route?: string
    input?: Record<string, unknown>
  }): React.ReactElement {
    const {
      route: routeName,
      input = {},
      to: providedTo,
      href: providedHref,
      exactClassName,
      sameClassName,
      ancestorClassName,
      descendantClassName,
      unmatchedClassName,
      className,
      ...rest
    } = props as typeof props &
      NavLinkClassNameProps & {
        input?: Record<string, unknown>
        to?: string
        href?: string
      }
    const navLink = useNavLink({
      route: routeName,
      input,
      to: providedTo,
      href: providedHref,
    } as UseNavLinkProps<TRoutes, TBaseLocationHook>)
    // Resolve the target again here (pure + cheap) to keep the discriminated
    // { to, href } correlation that _getWouterLinkProps needs; useNavLink only
    // owns the match state.
    const finalTo = _resolveFinalTo({
      routes,
      routeName,
      input,
      providedTo,
      providedHref,
      componentName: 'NavLink',
    })
    const { wouterLinkProps } = _getWouterLinkProps<TBaseLocationHook>({
      ...rest,
      ...finalTo,
    })
    const resolvedClassName = useMemo(() => {
      const classNameFromFnOrString =
        typeof className === 'function' ? className(navLink) : typeof className === 'string' ? className : undefined
      const classNamesFromMap =
        typeof className === 'object' && className !== null ? [className.default, className[navLink.type]] : []
      const allClassNames = [
        classNameFromFnOrString,
        ...classNamesFromMap,
        navLink.exact ? exactClassName : undefined,
        navLink.same ? sameClassName : undefined,
        navLink.ancestor ? ancestorClassName : undefined,
        navLink.descendant ? descendantClassName : undefined,
        navLink.unmatched ? unmatchedClassName : undefined,
      ]
      const mergedClassNames = allClassNames.filter((value): value is string => Boolean(value)).join(' ')
      return mergedClassNames || undefined
    }, [className, navLink, exactClassName, sameClassName, ancestorClassName, descendantClassName, unmatchedClassName])
    const finalWouterLinkProps = useMemo<WouterLinkProps>(() => {
      if ('asChild' in wouterLinkProps && wouterLinkProps.asChild) {
        return wouterLinkProps
      }
      return { ...wouterLinkProps, className: resolvedClassName }
    }, [wouterLinkProps, resolvedClassName])
    const newTab = (rest as { newTab?: boolean }).newTab === true
    if (finalTo.to && !newTab) {
      return <NativeWouterLink {...finalWouterLinkProps} />
    }
    return _getNativeAnchorElement(finalWouterLinkProps, finalTo.tohref, newTab)
  }
  return NavLink
}

export const createRedirectComponent = <
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
>({
  routes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hook,
}: {
  routes: TRoutes
  hook?: TBaseLocationHook
}): RedirectComponent<TRoutes, AdapterNavigateFnByHook<TBaseLocationHook>> => {
  const Redirect: RedirectComponent<TRoutes, AdapterNavigateFnByHook<TBaseLocationHook>> = (
    props: {
      to?: string
      href?: string
      route?: string
      input?: Record<string, unknown>
      task?: RedirectTask<HookNavigationOptions<TBaseLocationHook>>
      status?: number
    } & SpecialNavigateOptions<HookNavigationOptions<TBaseLocationHook>>,
  ): React.ReactElement | null => {
    const {
      route: routeName,
      input = {},
      to: providedTo,
      href: providedHref,
      task: providedTask,
      before: providedBefore,
      after: providedAfter,
      prefetch: providedPrefetch,
      status: providedStatus,
      ...rest
    } = props
    const toByTaskOrProvided = providedTask?.to !== undefined ? providedTask.to : providedTo
    const prefetchByTaskOrProvided =
      providedTask?.options?.prefetch !== undefined ? providedTask.options.prefetch : providedPrefetch
    const beforeByTaskOrProvided =
      providedTask?.options?.before !== undefined
        ? providedBefore !== undefined
          ? (...args: [any]) => {
              void providedBefore(...args)
              void providedTask.options?.before(...args)
            }
          : providedTask.options?.before
        : providedBefore
    const afterByTaskOrProvided =
      providedTask?.options?.after !== undefined
        ? providedAfter !== undefined
          ? (...args: [any]) => {
              void providedAfter(...args)
              void providedTask.options?.after(...args)
            }
          : providedTask.options?.after
        : providedAfter
    const statusByTaskOrProvided = providedStatus !== undefined ? providedStatus : providedTask?.status
    const validStatus =
      statusByTaskOrProvided !== undefined && [301, 302, 303, 307, 308].includes(statusByTaskOrProvided)
        ? statusByTaskOrProvided
        : undefined

    // Adapter-level nav options (replace, state) reach the component via `rest` when
    // <Redirect> is used as JSX, but are nested in `task.options` when it comes from the
    // redirect() helper / a page redirect. Forward those too — otherwise a page-level
    // redirect.to(to, { replace: true }) silently loses `replace`, so the redirect source
    // is pushed onto history and Back returns to it instead of skipping it.
    const taskAdapterNavOptions: Record<string, unknown> = {}
    if (providedTask?.options) {
      for (const key of linkAdapterNavKeys) {
        const value = (providedTask.options as Record<string, unknown>)[key]
        if (value !== undefined) {
          taskAdapterNavOptions[key] = value
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tohref, ...finalTo } = _resolveFinalTo({
      routes,
      routeName,
      input,
      providedTo: toByTaskOrProvided,
      providedHref,
      componentName: 'Redirect',
    })

    const router = useWouterRouter()
    const { ssrContext } = router
    if (ssrContext && validStatus !== undefined) {
      ssrContext.statusCode = validStatus
    }

    return (
      <NativeWouterRedirect
        {...rest}
        {...taskAdapterNavOptions}
        {...{
          prefetch: prefetchByTaskOrProvided,
          before: beforeByTaskOrProvided,
          after: afterByTaskOrProvided,
        }}
        {...finalTo}
      />
    )
  }

  return Redirect
}

export const createRedirectHelper = <
  TRoutes extends RoutesPretty,
  TAdapterNavigateFn extends AdapterNavigateFn = typeof browserNavigate,
  TErrorClass extends ClassLikeError0<ErrorPoint0> = ClassLikeError0<ErrorPoint0>,
>({
  routes,
}: {
  routes: TRoutes
  navigate?: TAdapterNavigateFn
  ErrorClass?: TErrorClass
}): RedirectHelper<TRoutes, TAdapterNavigateFn> => {
  const redirectTo = (
    to: string,
    options?: RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
      SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
  ) => {
    const { status, ...rest } = options ?? {}
    const task = new RedirectTask<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>({
      to,
      status,
      options: rest as NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn> &
        SpecialNavigateOptions<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>>,
    })
    return task
  }
  function redirect<TRouteName extends ExtractRoutesKeys<TRoutes>>(
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
  ): RedirectTask<NavigateOptionsByAdapterNavigateFn<TAdapterNavigateFn>> {
    const routeName = args[0] as ExtractRoutesKeys<TRoutes>
    const input = (args[1] ?? {}) as unknown
    const options = args[2] as RedirectOptionsByAdapterNavigateFn<TAdapterNavigateFn> | undefined
    const route = routes[routeName]
    if (!route) {
      throw new Error(`Route "${routeName}" not found`)
    }
    const to = route.get(input) as string
    return redirectTo(to, options)
  }
  return Object.assign(redirect, { to: redirectTo })
}

// Derives the imperative "adapter navigate" from the configured wouter location
// `hook` and feeds the resolved one into NavigationContextProvider. wouter
// location hooks return `[location, navigate]`, and that navigate already matches
// the hook's semantics (browser history / hash / memory / custom). This mirrors
// how `searchHook` is auto-derived from the hook (`hook.searchHook ?? …`), so
// configuring only `hook` keeps imperative `navigate()` / `setSearch()`
// consistent with it — no need to also hand-pass a matching `navigate`. An
// explicit `navigate` (here `providedNavigate`) still wins.
//
// Runs inside <NativeWouterRouter>, so `useWouterRouter()` returns the active
// router and `hook(router)` honors its ssr/base options. The extra location
// subscription this adds re-renders only this thin wrapper; the provider it wraps
// already re-renders on every location change.
function AdapterNavigateProvider<
  TRoutes extends RoutesPretty,
  TAdapterNavigateFn extends AdapterNavigateFn,
  TErrorClass extends ClassLikeError0<ErrorPoint0>,
>({
  hook,
  providedNavigate,
  ...providerProps
}: Omit<NavigationContextProviderProps<TRoutes, TAdapterNavigateFn, TErrorClass>, 'adapterNavigate'> & {
  hook: BaseLocationHook
  providedNavigate?: AdapterNavigateFn
}): React.ReactElement {
  const wouterRouter = useWouterRouter()
  // wouter location hooks always return `[location, navigate]`, so `hookNavigate`
  // is guaranteed present — no further fallback needed.
  const [, hookNavigate] = hook(wouterRouter)
  const adapterNavigate = (providedNavigate ?? hookNavigate) as TAdapterNavigateFn
  return (
    <NavigationContextProvider<TRoutes, TAdapterNavigateFn, TErrorClass>
      adapterNavigate={adapterNavigate}
      {...providerProps}
    />
  )
}

export const createRouter = <
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
  TErrorClass extends ClassLikeError0<ErrorPoint0> = ClassLikeError0<ErrorPoint0>,
>({
  addHashToLocation,
  routes = getRoutes(),
  Page404: ProvidedPage404,
  layout404: providedLayout404,
  pagesTree,
  layouts,
  hook = useBrowserLocation,
  searchHook = hook.searchHook ?? useBrowserSearch,
  navigate: providedNavigate,
  ErrorClass,
  forceRerender,
  prependRoutes,
  appendRoutes,
  openExternal,
  scrollToHash = true,
  stale,
  guard: providedGuard,
  _navigate = createNavigate({ routes, navigate: providedNavigate, ErrorClass }),
  _redirect = createRedirectHelper({ routes, navigate: providedNavigate, ErrorClass }),
  _Redirect = createRedirectComponent({ routes, hook }),
}: {
  addHashToLocation?: boolean
  routes?: RoutesPretty
  Page404?: Page404Type
  layout404?: Layout404Type
  pagesTree?: PagesTree
  layouts?: ClientPointsLayouts
  hook?: BaseLocationHook
  searchHook?: BaseSearchHook
  navigate?: AdapterNavigateFn
  ErrorClass?: ClassLikeError0<ErrorPoint0>
  forceRerender?: boolean
  prependRoutes?: React.ReactNode
  appendRoutes?: React.ReactNode
  openExternal?: OpenExternalFn
  scrollToHash?: ScrollToHashPolicy
  /** Stale-deploy reaction for client navigations — see {@link StalePolicy}. Default `'navigate'`. */
  stale?: StalePolicy
  /** The instance navigation guard — see {@link registerNavigationGuard} for the contract. */
  guard?: NavigationGuard
  _navigate?: NavigateHelper<TRoutes, AdapterNavigateFnByHook<TBaseLocationHook>, TErrorClass>
  _Redirect?: RedirectComponent<TRoutes, AdapterNavigateFnByHook<TBaseLocationHook>>
  _redirect?: RedirectHelper<TRoutes, AdapterNavigateFnByHook<TBaseLocationHook>>
}): ((props: {
  children?: React.ReactNode
  ssrLocation?: AnyLocation | undefined
  Page404?: Page404Type
  layout404?: Layout404Type
  guard?: NavigationGuard
}) => React.ReactElement) => {
  function RouterRoutes({
    Page404,
    layout404,
  }: {
    Page404?: Page404Type
    layout404?: Layout404Type
  }): React.ReactElement {
    if (forceRerender) {
      useNavigationLocationContext()
    }
    return (
      <RenderPagesTree
        pagesTree={pagesTree ?? getClientPoints().pagesTree}
        layouts={layouts ?? getClientPoints().layouts}
        Page404={Page404}
        layout404={layout404}
        prepend={prependRoutes}
        append={appendRoutes}
      />
    )
  }

  return function Router({
    children,
    ssrLocation = _ss.__POINT0_SSR_LOCATION__.get(),
    Page404 = ProvidedPage404,
    layout404 = providedLayout404,
    guard = providedGuard,
  }: {
    children?: React.ReactNode
    ssrLocation?: AnyLocation | undefined
    Page404?: Page404Type
    layout404?: Layout404Type
    guard?: NavigationGuard
  }) {
    const wouterSsrProps = useMemo(() => {
      if (env.side.is.client) {
        return {}
      }
      if (!ssrLocation) {
        throw new Error(`ssrLocation is required on ssr`)
      }
      return { ssrPath: ssrLocation.pathname, ssrSearch: ssrLocation.searchString }
    }, [ssrLocation])

    const useAdapterLocation = useCallback<UseLocationFn>((options) => {
      const [wouterLocation] = useWouterLocation()
      const [wouterSearchParams] = useWouterSearchParams()
      const pathnameWithSearchParams = [wouterLocation, wouterSearchParams.toString()].filter(Boolean).join('?')
      const hash = options?.addHash ? (typeof window !== 'undefined' ? window.location.hash : '') : ''
      const origin = env.side.is.server
        ? ssrLocation?.origin
        : typeof window !== 'undefined'
          ? window.location.origin
          : undefined
      // No origin → a relative href, never the string "undefined" glued in front of the path. An origin-less location
      // is a legitimate state (a page location rebuilt from a route with no origin to resolve against), and stringifying
      // `undefined` into it used to corrupt the pathname itself — "/undefined/ideas/42".
      return routes._.getLocation(`${origin ?? ''}${pathnameWithSearchParams}${hash}`)
    }, [])

    const aroundNav = useCallback<AroundNavHandler>((navigate, to, options) => {
      const { normalOptions, wouterOptions } = splitOptions(options)
      return navigateWithTransitions({
        to,
        options: normalOptions,
        navigate: (resolvedTo) => navigate(resolvedTo, wouterOptions),
        ErrorClass,
      })
    }, [])

    const ssrContext = _point0_env.side.is.client
      ? {}
      : useMemo(() => {
          const value = {} as SsrContext
          const syncRedirectTask = (): void => {
            const to = value.redirectTo
            const status = value.statusCode
            if (!to) {
              return
            }
            _ss.__POINT0_SSR_REDIRECT_TASK__.set({ task: new RedirectTask({ to, status }), handled: false })
          }
          return new Proxy(value, {
            set(target, property, nextValue, receiver) {
              const result = Reflect.set(target, property, nextValue, receiver)
              if (property === 'redirectTo' || property === 'statusCode') {
                syncRedirectTask()
              }
              return result
            },
          }) as SsrContext
        }, [])

    return (
      <NativeWouterRouter
        {...wouterSsrProps}
        hook={hook}
        searchHook={searchHook}
        aroundNav={aroundNav}
        ssrContext={ssrContext}
      >
        <AdapterNavigateProvider
          hook={hook}
          providedNavigate={providedNavigate}
          useAdapterLocation={useAdapterLocation}
          ssrLocation={ssrLocation}
          addHashToLocation={addHashToLocation}
          navigate={_navigate}
          redirect={_redirect}
          Redirect={_Redirect}
          ErrorClass={ErrorClass}
          openExternal={openExternal}
          scrollToHash={scrollToHash}
          stale={stale}
          guard={guard}
        >
          <ScrollRestoration />
          {children ?? <RouterRoutes Page404={Page404} layout404={layout404} />}
        </AdapterNavigateProvider>
      </NativeWouterRouter>
    )
  }
}

const DefaultPage404 = () => <>Page Not Found</>

export const createRouterRoutes = ({
  pagesTree,
  layouts,
  Page404: ProvidedPage404,
  layout404: providedLayout404,
  forceRerender,
  prepend: providedPrepend,
  append: providedAppend,
}: {
  pagesTree?: PagesTree
  layouts?: ClientPointsLayouts
  Page404?: Page404Type
  layout404?: Layout404Type
  forceRerender?: boolean
  prepend?: React.ReactNode
  append?: React.ReactNode
}) => {
  return function RouterRoutes({
    Page404 = ProvidedPage404,
    layout404 = providedLayout404,
    prepend = providedPrepend,
    append = providedAppend,
  }: {
    Page404?: Page404Type
    layout404?: Layout404Type
    prepend?: React.ReactNode
    append?: React.ReactNode
  }) {
    if (forceRerender) {
      useNavigationLocationContext()
    }
    return (
      <RenderPagesTree
        pagesTree={pagesTree ?? getClientPoints().pagesTree}
        layouts={layouts ?? getClientPoints().layouts}
        Page404={Page404}
        layout404={layout404}
        prepend={prepend}
        append={append}
      />
    )
  }
}

export const createNavigation = <
  TRoutes extends RoutesPretty,
  TBaseLocationHook extends BaseLocationHook = BrowserLocationHook,
  TAdapterNavigateFn extends AdapterNavigateFnByHook<TBaseLocationHook> = AdapterNavigateFnByHook<TBaseLocationHook>,
  TErrorClass extends ClassLikeError0<ErrorPoint0> = ClassLikeError0<ErrorPoint0>,
>({
  addHashToLocation,
  routes = getRoutes(),
  Page404,
  layout404,
  pagesTree,
  layouts,
  hook = useBrowserLocation as TBaseLocationHook,
  searchHook = hook.searchHook ?? useBrowserSearch,
  ErrorClass = ErrorPoint0 as unknown as TErrorClass,
  navigate: providedNavigate,
  forceRerender = false,
  prependRoutes,
  appendRoutes,
  openExternal,
  scrollToHash,
  stale,
  guard,
}: {
  addHashToLocation?: boolean
  routes?: TRoutes
  Page404?: Page404Type
  layout404?: Layout404Type
  pagesTree?: PagesTree
  layouts?: ClientPointsLayouts
  hook?: TBaseLocationHook
  searchHook?: BaseSearchHook
  ErrorClass?: TErrorClass
  navigate?: TAdapterNavigateFn
  forceRerender?: boolean
  prependRoutes?: React.ReactNode
  appendRoutes?: React.ReactNode
  openExternal?: OpenExternalFn
  scrollToHash?: ScrollToHashPolicy
  /**
   * Reaction to a stale client build during client navigation (a redeploy changed the chunk hashes while this tab was
   * open): `'navigate'` (default) recovers with a full document navigation to the same target, `'error'` surfaces a
   * `POINT0_STALE_CLIENT_BUILD`-coded error through the page's `.error()`, `'off'` disables the reaction, and a custom
   * function gets full control — see {@link StalePolicy}.
   *
   *     createNavigation({ routes, hook, stale: 'error' })
   *
   * Full reference: https://1gr14.dev/point0/latest/navigation
   */
  stale?: StalePolicy
  /**
   * The instance navigation guard: every client navigation must pass it before anything runs — no prefetch, no
   * transition state, no history write. May be async (show a dialog, resolve with the answer); `false` blocks the
   * navigation with a `POINT0_NAVIGATION_BLOCKED`-coded error in its result. Also overridable per `<Router guard>`; for
   * a guard tied to a component's lifetime use `useNavigationGuard` — see {@link registerNavigationGuard} for the full
   * contract.
   *
   *     createNavigation({ routes, hook, guard: ({ to }) => to.pathname !== '/closed' })
   *
   * Full reference: https://1gr14.dev/point0/latest/navigation
   */
  guard?: NavigationGuard
} = {}): {
  navigate: NavigateHelper<TRoutes, TAdapterNavigateFn, TErrorClass>
  Link: CreatedLink<TRoutes, TBaseLocationHook>
  NavLink: CreatedNavLink<TRoutes, TBaseLocationHook>
  Redirect: RedirectComponent<TRoutes, AdapterNavigateFnByHook<TBaseLocationHook>>
  Router: (props: {
    children?: React.ReactNode
    ssrLocation?: AnyLocation | undefined
    Page404?: Page404Type
    layout404?: Layout404Type
    guard?: NavigationGuard
  }) => React.ReactElement
  RouterRoutes: (props: {
    Page404?: Page404Type
    layout404?: Layout404Type
    prepend?: React.ReactNode
    append?: React.ReactNode
  }) => React.ReactElement
  redirect: RedirectHelper<TRoutes, TAdapterNavigateFn>
  useNavLink: CreatedUseNavLink<TRoutes, TBaseLocationHook>
  InferNavigation: InferNavigation<TRoutes, TBaseLocationHook>
} => {
  const navigate = createNavigate({ routes, navigate: providedNavigate, ErrorClass })
  const redirect = createRedirectHelper({ routes, navigate: providedNavigate, ErrorClass })
  const Redirect = createRedirectComponent({ routes, hook })
  return {
    navigate,
    Link: createLink({ routes, hook }),
    NavLink: createNavLink({ routes, hook }),
    Redirect,
    Router: createRouter({
      addHashToLocation,
      routes,
      Page404,
      layout404,
      pagesTree,
      layouts,
      hook,
      searchHook,
      navigate: providedNavigate,
      ErrorClass,
      forceRerender,
      prependRoutes,
      appendRoutes,
      openExternal,
      scrollToHash,
      stale,
      guard,
      _navigate: navigate,
      _redirect: redirect,
      _Redirect: Redirect,
    }),
    RouterRoutes: createRouterRoutes({
      pagesTree,
      layouts,
      Page404,
      layout404,
      forceRerender,
      prepend: prependRoutes,
      append: appendRoutes,
    }),
    redirect,
    useNavLink: createUseNavLink({ routes, hook }),
    // Phantom type-only handle — `null` at runtime, never read; only used via
    // `typeof InferNavigation.LinkProps` in type position.
    InferNavigation: null as unknown as InferNavigation<TRoutes, TBaseLocationHook>,
  }
}

const WrappedPage404 = ({
  Page404,
  layout404,
  layouts,
}: {
  layouts: ClientPointsLayouts
  Page404: Page404Type
  layout404?: Layout404Type
}) => {
  const page404Node = React.isValidElement(Page404) ? Page404 : <Page404 />
  const items: Layout404TypeOne[] = (Array.isArray(layout404) ? layout404 : [layout404]).filter(
    (item): item is Layout404TypeOne => Boolean(item),
  )

  if (items.length === 0) {
    return page404Node
  }

  return items.reduceRight<React.ReactNode>((children, layoutItem) => {
    if (typeof layoutItem === 'string') {
      if (!(layoutItem in layouts)) {
        return children
      }
      const LayoutByName = layouts[layoutItem as keyof ClientPointsLayouts]
      return <LayoutByName>{children}</LayoutByName>
    }

    const LayoutByPoint = layoutItem.X
    return <LayoutByPoint>{children}</LayoutByPoint>
  }, page404Node)
}

export const RenderPagesTree = ({
  pagesTree,
  layouts,
  Page404 = DefaultPage404,
  layout404,
  level = 0,
  prepend,
  append,
}: {
  pagesTree: PagesTree
  layouts: ClientPointsLayouts
  Page404?: Page404Type
  layout404?: Layout404Type
  level?: number
  append?: React.ReactNode
  prepend?: React.ReactNode
}) => {
  return (
    <Switch>
      {level === 0 && prepend}
      {pagesTree.map((node) => {
        if (node.Layout) {
          const Layout = node.Layout
          return (
            <Route key={`layout-${node.layoutName}`} path={node.pagesRoutesRegex}>
              <Layout>
                <Switch>
                  {node.pages.map(({ pageRoute, Page }) => {
                    return (
                      <Route key={pageRoute.definition} path={pageRoute.regex}>
                        <Page />
                      </Route>
                    )
                  })}
                  {node.nested && (
                    <RenderPagesTree
                      pagesTree={node.nested}
                      layouts={layouts}
                      Page404={Page404}
                      layout404={layout404}
                      level={level + 1}
                    />
                  )}
                  <WrappedPage404 layouts={layouts} Page404={Page404} layout404={layout404} />
                </Switch>
              </Layout>
            </Route>
          )
        }
        return (
          <Fragment key={`nolayout-${node.layoutName}`}>
            {node.pages.map(({ pageRoute, Page }) => {
              return (
                <Route key={pageRoute.definition} path={pageRoute.regex}>
                  <Page />
                </Route>
              )
            })}

            {node.nested && (
              <RenderPagesTree
                pagesTree={node.nested}
                layouts={layouts}
                Page404={Page404}
                layout404={layout404}
                level={level + 1}
              />
            )}
          </Fragment>
        )
      })}

      <Route path="*">
        <WrappedPage404 layouts={layouts} Page404={Page404} layout404={layout404} />
      </Route>
      {level === 0 && append}
    </Switch>
  )
}
