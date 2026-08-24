import { CookieStore } from '@point0/core/cookie-store'
import { createQueryClient, isQueryClientDehydratedStateQuery } from '@point0/core'
import type {
  AnyNiceRequestableReadyPoint,
  RequestableReadyPointType,
  AppComponent,
  FetchOptions,
  PointsDefinition,
  ReadyPoint,
  QueryKey,
} from '@point0/core'
import { UnheadProvider } from '@point0/core/unhead'
import assert from 'node:assert'
import nodePath from 'node:path'
// import { AsyncLocalStorage } from 'node:async_hooks'
import type { RoutesPretty } from '@1gr14/route0'
import { ClientPoints, Point0 } from '@point0/core'
import type { AnyNiceReadyPoint } from '@point0/core'
import type { NavigationGuard } from '@point0/core/navigation'
import { createNavigation } from '@point0/react-dom/router'
import { notifyManager } from '@tanstack/query-core'
import { QueryClientProvider, type DehydratedState, type QueryClient } from '@tanstack/react-query'
import * as rtl from '@testing-library/react/pure.js'
import { YAML } from 'bun'
import { Window } from 'happy-dom'
import React from 'react'
import type { EngineOptions, SsrOptions } from '../../src/config.js'
import { Engine } from '../../src/engine.js'
import { FakeClient } from '../../src/fake-client.js'
import { ElementViewer } from './element-viewer.js'
import { FetchRecorder } from './fetch-recorder.js'
import { HtmlView } from './html-view.js'

// export const getFakeBrowserGlobals = (options: { url?: string } = {}) => {
//   const url = options.url ?? 'http://localhost/'
//   const window = new Window({
//     url,
//   })
//   // Get all enumerable properties from window
//   const globals: Record<string, any> = {}
//   for (const key in window) {
//     globals[key] = (window as any)[key]
//   }
//   return globals
// }

// let _rtl: {
//   rtl: typeof import('@testing-library/react')
//   globals: Record<string, any>
// } | undefined
// const importRtl = async () => {
//   // if (_rtl) {
//   //   return _rtl
//   // }
//   const storage = new AsyncLocalStorage()
//   const knownKeys = Object.keys(Window)
//   const rtlGlobals = {}
//   const rtl = await storage.run(rtlGlobals, async () => {
//     for (const key of knownKeys) {
//       try {
//         Object.defineProperty(globalThis, key, {
//           get: () => {
//             return (rtlGlobals as any)[key]
//           },
//           set: (value) => {
//             ;(rtlGlobals as any)[key] = value
//           },
//         })
//       } catch (error) {
//         console.error(`Error setting global ${key}`, error)
//       }
//     }
//     return await import('@testing-library/react')
//   })
//   return {
//     rtl,
//     rtlGlobals,
//   }
//   // _rtl = {
//   //   rtl,
//   //   globals: newGlobals,
//   // }
//   // return _rtl
// }
// export const { rtl, rtlGlobals } = await importRtl()
// export const rtl = {
//   ..._rtl.rtl,
//   globals: _rtl.globals,
// }

export const getFakeBrowserGlobals = (options: { url?: string } = {}) => {
  const url = options.url ?? 'http://localhost/'
  const window = new Window({
    url,
  })
  // const result = {
  //   window,
  //   ...Object.fromEntries(
  //     Object.entries(window)
  //       .map(([key, value]) => {
  //         if (['timeStamp'].includes(key)) {
  //           return null as never
  //         }
  //         if (typeof value === 'undefined' || value === null) {
  //           return null as never
  //         }
  //         if (typeof value === 'function') {
  //           return [key, value.bind(window)]
  //         }
  //         return [key, value]
  //       })
  //       .filter((x: any) => x !== null),
  //   ),
  // }
  // return result
  return {
    window,
    document: window.document,
    navigator: window.navigator,
    location: window.location,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    DOMParser: window.DOMParser,
    MutationObserver: window.MutationObserver,
    history: window.history,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    event: window.Event,
  }
}

export const getOriginalValuesOfFakeBrowserGlobals = () => {
  const globals = getFakeBrowserGlobals()
  const keys = Object.keys(globals)
  return Object.fromEntries(keys.map((key) => [key, (globalThis as any)[key]]))
}

export const withFakeBrowserGlobals = async <TResult,>(fn: () => Promise<TResult>): Promise<TResult> => {
  const globals = getFakeBrowserGlobals()
  const keys = Object.keys(globals)
  const originals = Object.fromEntries(keys.map((key) => [key, (globalThis as any)[key]]))
  const restore = () => {
    for (const key of keys) {
      ;(globalThis as any)[key] = originals[key]
    }
  }
  try {
    const result = await fn()
    restore()
    return result
  } catch (error) {
    restore()
    throw error
  }
}

export const waitReturn = async <T = undefined,>(value?: T, timeout = 100): Promise<T> => {
  await new Promise((resolve) => setTimeout(resolve, timeout))
  return value as T
}

export const waitThrow = async <T = undefined,>(error: Error, timeout = 100): Promise<T> => {
  await new Promise((resolve) => setTimeout(resolve, timeout))
  throw error
}

export const ymlify = (result: any) => {
  const yml = YAML.stringify(result, undefined, 2)
  return '\n' + normalizeYmlKeys(yml) + '\n'
}

export const ymlifyline = (result: any) => {
  return normalizeYmlKeys(YAML.stringify(result, undefined, 2))
    .split('\n')
    .join(', ')
}

const normalizeYmlKeys = (yml: string) => {
  // Bun YAML may quote keys like "y". For test snapshots we keep keys unquoted.
  return yml.replace(/(^\s*)"([^"\n]+)"(?=\s*:)/gm, '$1$2')
}

let isNotifyManagerBound = false
const bindNotifyManager = () => {
  if (isNotifyManagerBound) {
    return
  }
  notifyManager.setNotifyFunction((callback) => {
    callback()
  })
  notifyManager.setScheduler((callback) => {
    callback()
  })
  isNotifyManagerBound = true
}

const createFilteredConsole = () => {
  const originalConsole = console
  const shouldFilterMessage = (...args: any[]): boolean => {
    const message = args.map((arg) => String(arg)).join(' ')
    return (
      message.includes('When testing, code that causes React state updates should be wrapped into act(...)') ||
      message.includes('ected multiple renderers concurrently rendering the same context')
    )
  }

  const createFilteredMethod = (method: (...args: any[]) => void) => {
    return (...args: any[]) => {
      if (!shouldFilterMessage(...args)) {
        method.apply(originalConsole, args)
      }
    }
  }

  return {
    ...originalConsole,
    log: createFilteredMethod(originalConsole.log.bind(originalConsole)),
    warn: createFilteredMethod(originalConsole.warn.bind(originalConsole)),
    error: createFilteredMethod(originalConsole.error.bind(originalConsole)),
    info: createFilteredMethod(originalConsole.info.bind(originalConsole)),
    debug: createFilteredMethod(originalConsole.debug.bind(originalConsole)),
    trace: createFilteredMethod(originalConsole.trace.bind(originalConsole)),
    dir: createFilteredMethod(originalConsole.dir.bind(originalConsole)),
    dirxml: createFilteredMethod(originalConsole.dirxml.bind(originalConsole)),
    group: createFilteredMethod(originalConsole.group.bind(originalConsole)),
    groupEnd: createFilteredMethod(originalConsole.groupEnd.bind(originalConsole)),
    groupCollapsed: createFilteredMethod(originalConsole.groupCollapsed.bind(originalConsole)),
    time: createFilteredMethod(originalConsole.time.bind(originalConsole)),
    timeEnd: createFilteredMethod(originalConsole.timeEnd.bind(originalConsole)),
    timeLog: createFilteredMethod(originalConsole.timeLog.bind(originalConsole)),
    table: createFilteredMethod(originalConsole.table.bind(originalConsole)),
    clear: createFilteredMethod(originalConsole.clear.bind(originalConsole)),
    count: createFilteredMethod(originalConsole.count.bind(originalConsole)),
    countReset: createFilteredMethod(originalConsole.countReset.bind(originalConsole)),
    assert: createFilteredMethod(originalConsole.assert.bind(originalConsole)),
    profile: createFilteredMethod(originalConsole.profile.bind(originalConsole)),
    profileEnd: createFilteredMethod(originalConsole.profileEnd.bind(originalConsole)),
    timeStamp: createFilteredMethod(originalConsole.timeStamp.bind(originalConsole)),
  }
}

export const lineQueryKey = (queryKey: any) => {
  const normalized = queryKey as QueryKey
  const obj = normalized[1]
  return [
    'point0',
    obj.scope,
    obj.type,
    obj.name,
    obj.mode,
    obj.finiteness,
    obj.tags.join(','),
    obj.output,
    obj.input,
  ].join('|')
}

type TestThingsState = {
  body: HTMLElement
  document: Document
  getHtmlView: () => Promise<HtmlView>
  viewer: ElementViewer
  preview: ElementViewer['preview']
  tale: ElementViewer['tale']
  queryClient: QueryClient
  titles: string[]
  titlesTale: () => Promise<string>
  pruneTitles: () => void
  titlesInterval: NodeJS.Timeout
  getQueryClientPreview: () => string
  waitContent: ElementViewer['waitContent']
  click: (selector: string) => Promise<void>
  _locationCleanup: () => void
  _unmount?: () => void
}
type FetchPoint = <
  T extends AnyNiceRequestableReadyPoint<Exclude<RequestableReadyPointType, 'channel' | 'subscription'>>,
>(
  point: T,
  ...args: T['Infer']['IsInputOptional'] extends true
    ? [input?: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
    : [input: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
) => ReturnType<T['fetch']>
type FetchPointYml = <T extends AnyNiceRequestableReadyPoint>(
  point: T,
  ...args: T['Infer']['IsInputOptional'] extends true
    ? [input?: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
    : [input: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
) => Promise<string>
type FetchHtmlView = <T extends AnyNiceRequestableReadyPoint>(
  point: T,
  ...args: T['Infer']['IsInputOptional'] extends true
    ? [input?: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
    : [input: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
) => Promise<HtmlView>
type FetchHtmlPreview = <T extends AnyNiceRequestableReadyPoint>(
  point: T,
  ...args: T['Infer']['IsInputOptional'] extends true
    ? [input?: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
    : [input: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
) => Promise<string>
type FetchSsr = <T extends AnyNiceRequestableReadyPoint>(
  point: T,
  ...args: T['Infer']['IsInputOptional'] extends true
    ? [input?: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
    : [input: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
) => Promise<{
  html: string
  preview: string
  dehydratedSuperStore: Record<string, unknown>
  queryClientDehydratedState: DehydratedState
  queryClientQueriesKeys: string[]
  queryClientQueriesState: Record<string, { status: string; data: string | undefined; error: string | undefined }>
  queryClientQueriesPreview: string
  rendersCount: number
  response: Response
}>
type FetchQueryClientDehydratedState = <T extends AnyNiceRequestableReadyPoint>(
  point: T,
  ...args: T['Infer']['IsInputOptional'] extends true
    ? [input?: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
    : [input: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
) => Promise<{
  dehydratedState: DehydratedState
  queryClientQueriesKeys: string[]
  queryClientQueriesState: Record<string, { status: string; data: string | undefined; error: string | undefined }>
  queryClientQueriesPreview: string
  rendersCount: number
  response: Response
}>
type FetchTitle = <T extends AnyNiceRequestableReadyPoint>(
  point: T,
  ...args: T['Infer']['IsInputOptional'] extends true
    ? [input?: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
    : [input: T['Infer']['InputRawOrUndefined'], options?: FetchOptions]
) => Promise<string>
type RenderTestThings = {
  <TResult = undefined>(callback?: (state: TestThingsState) => TResult): Promise<TResult>
  <TResult = undefined>(path: string, callback?: (state: TestThingsState) => TResult): Promise<TResult>
}
export type TestThings<TRoutes extends RoutesPretty> = {
  engine: Engine
  client: FakeClient<TestThingsState, any>
  render: RenderTestThings
  app: AppComponent
  fetch: FakeClient<any, any>['fetch']
  fetchSsr: FetchSsr
  fetchQueryClientDehydratedState: FetchQueryClientDehydratedState
  loadPoint: FetchPoint
  loadPointYml: FetchPointYml
  fetchView: FetchHtmlView
  fetchPreview: FetchHtmlPreview
  fetchRecorder: ReturnType<typeof FetchRecorder.create>
  fetchesTale: ReturnType<typeof FetchRecorder.create>['tale']
  fetchTitle: FetchTitle
} & ReturnType<typeof createNavigation<TRoutes>>

type Layout404TypeOne = string | AnyNiceReadyPoint<'layout'>
type Layout404Type = Array<Layout404TypeOne> | Layout404TypeOne
export const createTestThings = async <TRoutes extends RoutesPretty>({
  points = [Point0.lets('root', 'root').root()],
  wrapper,
  ssr = false,
  app: appProvided,
  globals = getFakeBrowserGlobals(),
  engineOptions,
  Page404,
  layout404,
  routes,
  guard,
}: {
  wrapper?: React.ComponentType<{ children: React.ReactNode }>
  points?: PointsDefinition<any, any>
  ssr?: boolean | SsrOptions
  app?: AppComponent
  globals?: Record<string, any>
  engineOptions?: Partial<EngineOptions>
  Page404?: React.ComponentType
  layout404?: Layout404Type
  routes?: TRoutes
  guard?: NavigationGuard
}): Promise<TestThings<TRoutes>> => {
  bindNotifyManager()
  const Wrapper = wrapper ?? undefined
  routes ??= ClientPoints.createFromDefintion(points).routes
  const navigation = createNavigation({ routes, forceRerender: true, Page404, layout404, guard })
  const { Router, RouterRoutes } = navigation
  const queryClient = createQueryClient()
  const app =
    appProvided ??
    (() => (
      <QueryClientProvider client={queryClient}>
        <UnheadProvider>
          {Wrapper ? (
            <Router>
              <Wrapper>
                <RouterRoutes />
              </Wrapper>
            </Router>
          ) : (
            <Router />
          )}
        </UnheadProvider>
      </QueryClientProvider>
    ))
  const fetchRecorder = FetchRecorder.create({
    limit: 100,
    enabled: true,
  })
  for (const point of points) {
    if ('_middlewares' in point.point) {
      point.point._middlewares.unshift(fetchRecorder.middleware)
    }
  }
  const engine = await Engine.create({
    compiler: false,
    file: nodePath.resolve(__dirname, '../temp/never'),
    server: { scope: 'root', points },
    client: { scope: 'root', points, indexHtml: '__POINT0_TEST_INDEX_HTML__', app },
    ssr,
    ...engineOptions,
  }).preload({ prepare: true })
  const client = FakeClient.create<TestThingsState, any>({
    engine,
    scope: 'root',
    globals: {
      // ...rtlGlobals,
      ...globals,
      console: createFilteredConsole(),
    },
    onDestroyInside: async (state) => {
      state.viewer.destroy()
      // Clean up location change listeners
      state._locationCleanup()
      state._unmount?.()
      state._unmount = undefined
    },
    onRunEndInside: async (state) => {
      state._unmount?.()
      state._unmount = undefined
    },
    cookieGetter: CookieStore.clientDocumentCookieGetter,
    cookieSetter: CookieStore.clientDocumentCookieSetter,
  })
  async function render<TResult = undefined>(callback?: (state: TestThingsState) => TResult): Promise<TResult>
  async function render<TResult = undefined>(
    path: string,
    callback?: (state: TestThingsState) => TResult,
  ): Promise<TResult>
  async function render(
    ...args:
      [callback?: (state: TestThingsState) => unknown] | [path: string, callback?: (state: TestThingsState) => unknown]
  ): Promise<any> {
    const [path = '/', callback = () => undefined] =
      typeof args[0] === 'string' ? [args[0], args[1]] : [undefined, args[0]]
    const location = new URL(path, 'http://localhost/')
    return await client.run(callback, {
      onEndInside: async (state) => {
        clearInterval(state.titlesInterval)
      },
      onStartInside: async (state) => {
        const window = globals.window as Window
        window.location.href = location.href

        const root = document.createElement('div')
        root.id = 'root'
        document.body.appendChild(root)

        const head = document.createElement('head')
        document.body.appendChild(head)
        const title = document.createElement('title')
        head.appendChild(title)

        state.titles = []
        // const titleObserver = new MutationObserver(() => {
        //   state.titles.push(document.title)
        // })
        // titleObserver.observe(title, {
        //   childList: true,
        // })
        state.titlesInterval = setInterval(() => {
          const lastTitle = state.titles[state.titles.length - 1]
          const currentTitle = document.title
          if (lastTitle !== currentTitle && currentTitle) {
            state.titles.push(currentTitle)
          }
        }, 5)
        state.pruneTitles = () => {
          state.titles.splice(0, state.titles.length)
        }
        state.titlesTale = async () => {
          return '\n' + state.titles.join('\n') + '\n'
        }

        const rendered = rtl.render(React.createElement(app), { container: root })
        state._unmount = rendered.unmount
        state.body = document.body
        state.document = document
        state.getHtmlView = async () => {
          return await HtmlView.parse(root.innerHTML)
        }
        // state.viewer = ElementViewer.create(host)
        state.viewer = ElementViewer.create(root)
        state.preview = async () => await state.viewer.preview()
        state.tale = async () => await state.viewer.tale()
        state.click = async (selector: string) => {
          // await rtl.act(async () => {
          await state.viewer.waitContent(selector)
          const element = root.querySelector(selector)
          assert(element)
          rtl.fireEvent.click(element)
          // })
        }
        state.waitContent = async (search: string, timeout?: number) => {
          await state.viewer.waitContent(search, timeout)
        }

        // Listen for window URL changes and update viewer
        const updateViewerUrl = () => {
          state.viewer.setUrl(window.location.href)
        }

        // Listen to popstate events (browser back/forward)
        window.addEventListener('popstate', updateViewerUrl)

        // Override history.pushState to catch programmatic navigation
        const originalPushState = window.history.pushState.bind(window.history)
        window.history.pushState = (...args: Parameters<typeof originalPushState>) => {
          originalPushState(...args)
          updateViewerUrl()
        }

        // Override history.replaceState to catch programmatic navigation
        const originalReplaceState = window.history.replaceState.bind(window.history)
        window.history.replaceState = (...args: Parameters<typeof originalReplaceState>) => {
          originalReplaceState(...args)
          updateViewerUrl()
        }

        // Watch for direct location changes using a MutationObserver on location
        // Note: happy-dom's location might not be observable, so we also use a polling approach
        let lastUrl = window.location.href
        const checkLocationChange = () => {
          const currentUrl = window.location.href
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl
            updateViewerUrl()
          }
        }

        // Poll for location changes (fallback for direct location.href assignments)
        const locationCheckInterval = setInterval(checkLocationChange, 10)

        // Store cleanup function in state
        state._locationCleanup = () => {
          window.removeEventListener('popstate', updateViewerUrl)
          window.history.pushState = originalPushState
          window.history.replaceState = originalReplaceState
          clearInterval(locationCheckInterval)
        }

        state.queryClient = queryClient
        state.getQueryClientPreview = () => {
          const queryClientState = state.queryClient.getQueryCache().findAll()
          // const queryClientQueriesKeys = queryClientState.map((query) =>
          //   query.queryKey.join('|'),
          // )
          const queryClientQueriesState = Object.fromEntries(
            queryClientState.map((query) => [
              lineQueryKey(query.queryKey),
              {
                status: query.state.status,
                data: query.state.data ? JSON.stringify(query.state.data) : undefined,
                error: query.state.error?.message,
              },
            ]),
          )
          const queryClientQueriesPreview =
            Object.entries(queryClientQueriesState)
              .map(([key, value]) => {
                return `${key}
    ${value.error ? `Error: ${value.error}` : value.data ? value.data : `Status: ${value.status}`}`
              })
              .join('\n') + '\n'
          return queryClientQueriesPreview
        }
      },
    })
  }
  const fetch: FakeClient<any, any>['fetch'] = async (input, init) => {
    return await client.run(async () => {
      return await client.fetch(input, init)
    })
  }
  const loadPoint = (async (point: ReadyPoint, ...args: [any]) => {
    return await client.run(async () => {
      return await point.fetch(...args)
    })
  }) as unknown as FetchPoint
  const loadPointYml = (async (point: ReadyPoint, ...args: [any]) => {
    const result = await loadPoint(point as any, ...args)
    return ymlify(result)
  }) as unknown as FetchPointYml
  const fetchView = (async (point: ReadyPoint, ...args: [any]) => {
    return await client.run(async () => {
      if (!point.route) {
        throw new Error(`Point "${point.toString()}" has no route`)
      }
      const response = await client.fetch(
        point.route.get(args[0] || {}, { origin: 'http://localhost' }),
        ...args.slice(1),
      )
      return await HtmlView.parse(await response.text())
    })
  }) as unknown as FetchHtmlView
  const fetchPreview = (async (point: ReadyPoint, ...args: [any]) => {
    return await client.run(async () => {
      if (!point.route) {
        throw new Error(`Point "${point.toString()}" has no route`)
      }
      const response = await client.fetch(
        point.route.get(args[0] || {}, { origin: 'http://localhost' }),
        ...args.slice(1),
      )
      return (await HtmlView.parse(await response.text())).preview
    })
  }) as unknown as FetchHtmlPreview
  const fetchSsr = (async (point: ReadyPoint, ...args: [any]) => {
    return await client.run(async () => {
      if (!point.route) {
        throw new Error(`Point "${point.toString()}" has no route`)
      }
      const url = point.route.get(args[0] || {}, { origin: 'http://localhost' })
      const response = await client.fetch(url, ...args.slice(1))
      const transformer = point.point._getTransformer()
      const view = await HtmlView.parse(await response.text())
      const scriptMatch = /<script id="__POINT0_DEHYDRATED_SUPER_STORE_SCRIPT__">([\s\S]+?)<\/script>/.exec(view.html)
      if (!scriptMatch) {
        console.error(view.html)
        throw new Error('Dehydrated super store script not found')
      }
      const scriptContent = scriptMatch[1]
      // Extract the JSON string value from: window.__POINT0_DEHYDRATED_SUPER_STORE__ = "...";
      // The value is JSON.stringify'd, so it's a double-quoted string that may contain escaped characters
      // Match from the opening quote to the closing quote (handling escaped quotes)
      const valueMatch = /window\.__POINT0_DEHYDRATED_SUPER_STORE__\s*=\s*("(?:[^"\\]|\\.)*")\s*;/.exec(scriptContent)
      if (!valueMatch) {
        throw new Error('Could not extract dehydrated super store value from script')
      }
      // Parse the JSON string to get the actual string value (first JSON.parse removes the outer quotes)
      // Parse to get the actual JSON object
      const dehydratedSuperStore = transformer.parse(JSON.parse(valueMatch[1])) as Record<string, unknown>
      const queryClientDehydratedState = (dehydratedSuperStore as any).__POINT0_QUERY_CLIENT__ as DehydratedState
      // if (queryClientDehydratedState.queries.length === 0) {
      //   throw new Error('Query client dehydrated state is empty')
      // }
      const queryClientDehydratedStateInDehydratedStateQuery = queryClientDehydratedState.queries.find(
        isQueryClientDehydratedStateQuery,
      )
      // if (!queryClientDehydratedStateInDehydratedStateQuery) {
      //   throw new Error(
      //     `Query client dehydrated state query in dehydrated state is not found: ${JSON.stringify(queryClientDehydratedState, null, 2)}`,
      //   )
      // }
      if (queryClientDehydratedState.queries.length > 1) {
        throw new Error(
          `There is not only one query client dehydrated state in dehydrated state: ${JSON.stringify(queryClientDehydratedState, null, 2)}`,
        )
      }
      const queryClientDehydratedStateInDehydratedState = (queryClientDehydratedStateInDehydratedStateQuery as any)
        ?.state.data?.dehydratedState as DehydratedState | undefined
      // if (!queryClientDehydratedStateInDehydratedState) {
      //   throw new Error(
      //     `Query client dehydrated state data in dehydrated state query is not found: ${JSON.stringify(queryClientDehydratedStateInDehydratedStateQuery, null, 2)}`,
      //   )
      // }
      const queryClientQueriesKeys =
        queryClientDehydratedStateInDehydratedState?.queries.map((query) => lineQueryKey(query.queryKey)) || []
      const queryClientQueriesState = queryClientDehydratedStateInDehydratedState
        ? Object.fromEntries(
            queryClientDehydratedStateInDehydratedState.queries.map((query) => [
              lineQueryKey(query.queryKey),
              {
                status: query.state.status,
                data: query.state.data ? JSON.stringify(query.state.data) : undefined,
                error: query.state.error?.message,
              },
            ]),
          )
        : {}
      const rendersCount = Number(response.headers.get('x-point0-discovery-renders'))
      const queryClientQueriesPreview =
        Object.entries(queryClientQueriesState)
          .map(([key, value]) => {
            return `${key}
${value.error ? `Error: ${value.error}` : value.data ? value.data : `Status: ${value.status}`}`
          })
          .join('\n') + '\n'
      return {
        html: view.html,
        preview: view.preview,
        dehydratedSuperStore,
        queryClientQueriesKeys,
        queryClientDehydratedState,
        queryClientQueriesState,
        queryClientQueriesPreview,
        response,
        rendersCount,
      } satisfies Awaited<ReturnType<FetchSsr>>
    })
  }) as unknown as FetchSsr

  // Data-only request (outputType: queryClientDehydratedState) — the client navigation
  // prefetch path. Hits the page's ENDPOINT route (e.g. /_point0/<scope>/page/<name>),
  // not the display route, with the queryClientDehydratedState header. Returns the
  // dehydrated query state only (no HTML). The page owns an endpoint whenever it SSRs —
  // a server loader is NOT required for this output. On the server this runs the same
  // executor.prefetchAppPagePointDeep loop
  // as HTML (committing staged SSR-store/cookie values between passes), just without the
  // final HTML render.
  const fetchQueryClientDehydratedState = (async (point: ReadyPoint, ...args: [any, any?]) => {
    return await client.run(async () => {
      const endpoint = (point.point as any)._endpoint
      if (!endpoint?.route) {
        throw new Error(
          `Point "${point.toString()}" has no endpoint route — a page needs a server loader to be fetchable as data`,
        )
      }
      const url = endpoint.route.get(args[0] || {}, { origin: 'http://localhost' })
      const response = await client.fetch(url, {
        ...(args[1] ?? {}),
        headers: {
          'x-point0-output-type': 'queryClientDehydratedState',
          Accept: 'application/json',
          ...((args[1]?.headers as Record<string, string> | undefined) ?? {}),
        },
      })
      const transformer = point.point._getTransformer()
      const parsed = transformer.parse(await response.text()) as { dehydratedState: DehydratedState }
      const dehydratedState = parsed.dehydratedState
      const queryClientQueriesKeys = dehydratedState.queries.map((query) => lineQueryKey(query.queryKey))
      const queryClientQueriesState = Object.fromEntries(
        dehydratedState.queries.map((query) => [
          lineQueryKey(query.queryKey),
          {
            status: query.state.status,
            data: query.state.data ? JSON.stringify(query.state.data) : undefined,
            error: (query.state.error as Error | undefined)?.message,
          },
        ]),
      )
      const queryClientQueriesPreview =
        Object.entries(queryClientQueriesState)
          .map(([key, value]) => {
            return `${key}
${value.error ? `Error: ${value.error}` : value.data ? value.data : `Status: ${value.status}`}`
          })
          .join('\n') + '\n'
      const rendersCount = Number(response.headers.get('x-point0-discovery-renders'))
      return {
        dehydratedState,
        queryClientQueriesKeys,
        queryClientQueriesState,
        queryClientQueriesPreview,
        response,
        rendersCount,
      } satisfies Awaited<ReturnType<FetchQueryClientDehydratedState>>
    })
  }) as unknown as FetchQueryClientDehydratedState

  const fetchesTale = fetchRecorder.tale.bind(fetchRecorder)

  const fetchTitle = (async (point: ReadyPoint, ...args: [any]) => {
    const view = await fetchView(point as never, ...args)
    const title = /<title>(.*?)<\/title>/.exec(view.html)?.[1]
    return title
  }) as unknown as FetchTitle

  return {
    engine,
    client,
    render,
    app,
    fetch,
    fetchSsr,
    fetchQueryClientDehydratedState,
    loadPoint,
    loadPointYml,
    fetchView,
    fetchPreview,
    fetchRecorder,
    fetchesTale,
    fetchTitle,
    ...navigation,
  }
}

export type ItFn = (done: (err?: unknown) => void) => void | Promise<void>
