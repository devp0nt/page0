import { Routes } from '@1gr14/route0'
import type { AnyLocation } from '@1gr14/route0'
import { Point0 } from '@point0/core'
import { registerNavigationGuard, useLocation, useNavigationGuard, useOnNavigate } from '@point0/core/navigation'
import { createNavigation } from '@point0/react-dom/router'
import { describe, expect, it, setDefaultTimeout } from 'bun:test'
import React, { useState } from 'react'
import { z } from 'zod'
import { createTestThings } from './utils/internal-testing.js'

setDefaultTimeout(20000)

const createTestPointsAndHelpers = () => {
  const root = Point0.lets('root', 'root')
    .loading(() => <div id="loading">...</div>)
    .error(({ error }) => <div id="error">{error.message}</div>)
    .prefetchPageOnNavigate('serverAndClientQuery')
    .prefetchPageOnLinkHover('serverAndClientQuery')
    .queryOptions({
      retry: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
    })
    .root()

  const routes = Routes.create({
    home: '/',
    about: '/about',
    posts: '/posts',
    post: '/posts/:id',
  })

  const { Link, NavLink, navigate } = createNavigation({ routes, forceRerender: true })

  const getClassNames = (defaultClassName: string) => ({
    default: defaultClassName,
    exact: 'exact',
    same: 'same',
    ancestor: 'ancestor',
    descendant: 'descendant',
    unmatched: 'unmatched',
  })

  const layout = root.lets('layout', 'layout').layout(({ children }) => {
    const location = useLocation()
    const [state, setState] = useState<{
      prevLocation: AnyLocation | null
      nextLocation: AnyLocation | null
      isNavigating: boolean
    }>({
      prevLocation: null,
      nextLocation: null,
      isNavigating: false,
    })
    useOnNavigate(({ prevLocation, nextLocation }) => {
      setState({
        prevLocation,
        nextLocation,
        isNavigating: true,
      })
      return () => {
        setState({
          prevLocation: null,
          nextLocation: null,
          isNavigating: false,
        })
      }
    })
    return (
      <>
        <nav id="nav">
          <NavLink route="home" className={({ type }) => `link-home ${type}`}>
            home
          </NavLink>
          <NavLink route="about" className={getClassNames('link-about')}>
            about
          </NavLink>
          <NavLink to="/posts" className={getClassNames('link-posts')}>
            posts
          </NavLink>
          <NavLink route="post" input={{ id: '1' }} className={getClassNames('link-post-1')}>
            post 1
          </NavLink>
          <NavLink route="post" input={{ id: '2' }} className={getClassNames('link-post-2')}>
            post 2
          </NavLink>
        </nav>
        <div id="info">
          <div id="route">{location.route || 'undefined'}</div>
          <div id="href">{location.hrefRel || 'undefined'}</div>
          <div id="is-navigating">{state.isNavigating ? 'true' : 'false'}</div>
          <div id="from">{state.prevLocation?.hrefRel || 'undefined'}</div>
          <div id="to">{state.nextLocation?.hrefRel || 'undefined'}</div>
        </div>
        {children}
      </>
    )
  })
  const homePage = layout.lets('page', 'home', '/').page(() => <div id="home">home</div>)
  const aboutPage = layout.lets('page', 'about', '/about').page(() => <div id="about">about</div>)
  const postsPage = layout
    .lets('page', 'posts', '/posts')
    .loader(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return { posts: [1, 2] }
    })
    .page(({ data }) => {
      return (
        <div id="posts">
          {data.posts.map((post) => (
            <React.Fragment key={post}>
              <NavLink className={getClassNames(`link-post-preview-${post}`)} route="post" input={{ id: post }}>
                link post {post}
              </NavLink>
              {post === 1 && (
                <>
                  <Link className={`link-post-by-link-${post}`} route="post" input={{ id: post }}>
                    link helper post {post}
                  </Link>
                  <button
                    className={`navigate-post-preview-${post}`}
                    onClick={() => {
                      void navigate('post', { id: post })
                    }}
                  >
                    navigate post {post}
                  </button>
                </>
              )}
            </React.Fragment>
          ))}
        </div>
      )
    })
  const postPage = layout
    .lets('page', 'post', '/posts/:id')
    .loader(async ({ params }) => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return { post: params.id }
    })
    .page(({ data }) => <div id="post">post {data.post}</div>)
  const Page404 = () => (
    <layout.X>
      <div id="page-404">Page Not Found</div>
    </layout.X>
  )
  return { root, routes, Link, NavLink, navigate, homePage, aboutPage, postsPage, postPage, layout, Page404 }
}

// const cut = async (tale: any) => {
//   const result = await tale()
//   return result.replaceAll(
//     `
// #nav:
//   a: home
//   a: about
//   a: posts`,
//     '',
//   )
// }
const createT = async () => {
  const testPointsAndHelpers = createTestPointsAndHelpers()
  const { root, layout, homePage, aboutPage, postsPage, postPage, Page404 } = testPointsAndHelpers
  const testThings = await createTestThings({
    ssr: true,
    points: [root, layout, homePage, aboutPage, postsPage, postPage],
    Page404,
  })
  return { ...testPointsAndHelpers, ...testThings }
}

describe('navigate', () => {
  // beforeAll(async () => {
  //   await tpf.cleanup({ files: true, processes: true, ports: true, browser: true })
  //   tpf.setBrowser(await PlaywrightBrowser.init())
  // })

  // afterAll(async () => {
  //   await tpf.cleanup({ files: !preventFinalFilesCleanup, processes: true, ports: true, browser: true })
  // })

  it(
    'navigate from home to about',
    async () => {
      const t = await createT()
      await t.render(t.homePage.route(), async ({ waitContent, tale, click }) => {
        await waitContent('#home')
        await click('.link-about')
        await waitContent('#about')
        expect(await tale()).toMatchInlineSnapshot(`
        "
        /
          #nav:
            .link-home.exact: home
            .link-about.unmatched: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: /
            #href: /
            #is-navigating: false
            #from: undefined
            #to: undefined
          #home: home

        /about
          #nav:
            .link-home.exact: home
            .link-about.unmatched: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: /
            #href: /
            #is-navigating: true
            #from: /
            #to: /about
          #home: home

          #nav:
            .link-home.ancestor: home
            .link-about.exact: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: /about
            #href: /about
            #is-navigating: true
            #from: /
            #to: /about
          #about: about

          #nav:
            .link-home.ancestor: home
            .link-about.exact: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: /about
            #href: /about
            #is-navigating: false
            #from: undefined
            #to: undefined
          #about: about
        "
      `)
      })
    },
    {
      retry: 3,
    },
  )

  it(
    'navigate from about to posts',
    async () => {
      const t = await createT()
      await t.render(t.aboutPage.route(), async ({ waitContent, tale, click }) => {
        await waitContent('#about')
        await click('.link-posts')
        await waitContent('#posts')
        expect(await tale()).toMatchInlineSnapshot(`
        "
        /about
          #nav:
            .link-home.ancestor: home
            .link-about.exact: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: /about
            #href: /about
            #is-navigating: false
            #from: undefined
            #to: undefined
          #about: about

          #nav:
            .link-home.ancestor: home
            .link-about.exact: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: /about
            #href: /about
            #is-navigating: true
            #from: /about
            #to: /posts
          #about: about

        /posts
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: true
            #from: /about
            #to: /posts
          #posts:
            .link-post-preview-1.descendant: link post 1
            .link-post-by-link-1: link helper post 1
            .navigate-post-preview-1: navigate post 1
            .link-post-preview-2.descendant: link post 2

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: false
            #from: undefined
            #to: undefined
          #posts:
            .link-post-preview-1.descendant: link post 1
            .link-post-by-link-1: link helper post 1
            .navigate-post-preview-1: navigate post 1
            .link-post-preview-2.descendant: link post 2
        "
      `)
      })
    },
    {
      retry: 3,
    },
  )

  it(
    'navigate from posts to post',
    async () => {
      const t = await createT()
      await t.render(t.postsPage.route(), async ({ waitContent, tale, click }) => {
        await waitContent('#posts')
        await click('.link-post-preview-1')
        await waitContent('#post')
        expect(await tale()).toMatchInlineSnapshot(`
        "
        /posts
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: false
            #from: undefined
            #to: undefined
          #loading: ...

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: false
            #from: undefined
            #to: undefined
          #posts:
            .link-post-preview-1.descendant: link post 1
            .link-post-by-link-1: link helper post 1
            .navigate-post-preview-1: navigate post 1
            .link-post-preview-2.descendant: link post 2

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: true
            #from: /posts
            #to: /posts/1
          #posts:
            .link-post-preview-1.descendant: link post 1
            .link-post-by-link-1: link helper post 1
            .navigate-post-preview-1: navigate post 1
            .link-post-preview-2.descendant: link post 2

        /posts/1
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: true
            #from: /posts
            #to: /posts/1
          #post: post 1

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: false
            #from: undefined
            #to: undefined
          #post: post 1
        "
      `)
      })
    },
    {
      retry: 3,
    },
  )

  it(
    'navigate from post to post via link',
    async () => {
      const t = await createT()
      await t.render(t.postPage.route({ id: '1' }), async ({ waitContent, tale, click }) => {
        await waitContent('#post')
        await click('.link-post-2')
        await waitContent('#post')
        expect(await tale()).toMatchInlineSnapshot(`
        "
        /posts/1
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: false
            #from: undefined
            #to: undefined
          #loading: ...

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: false
            #from: undefined
            #to: undefined
          #post: post 1

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: true
            #from: /posts/1
            #to: /posts/2
          #post: post 1

        /posts/2
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.same: post 1
            .link-post-2.exact: post 2
          #info:
            #route: /posts/:id
            #href: /posts/2
            #is-navigating: true
            #from: /posts/1
            #to: /posts/2
          #post: post 2

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.same: post 1
            .link-post-2.exact: post 2
          #info:
            #route: /posts/:id
            #href: /posts/2
            #is-navigating: false
            #from: undefined
            #to: undefined
          #post: post 2
        "
      `)
      })
    },
    {
      retry: 3,
    },
  )

  it(
    'navigate from posts to post via link',
    async () => {
      const t = await createT()
      await t.render(t.postsPage.route(), async ({ waitContent, tale, click }) => {
        await waitContent('#posts')
        await click('.link-post-by-link-1')
        await waitContent('#post')
        expect(await tale()).toMatchInlineSnapshot(`
        "
        /posts
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: false
            #from: undefined
            #to: undefined
          #loading: ...

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: false
            #from: undefined
            #to: undefined
          #posts:
            .link-post-preview-1.descendant: link post 1
            .link-post-by-link-1: link helper post 1
            .navigate-post-preview-1: navigate post 1
            .link-post-preview-2.descendant: link post 2

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: true
            #from: /posts
            #to: /posts/1
          #posts:
            .link-post-preview-1.descendant: link post 1
            .link-post-by-link-1: link helper post 1
            .navigate-post-preview-1: navigate post 1
            .link-post-preview-2.descendant: link post 2

        /posts/1
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: true
            #from: /posts
            #to: /posts/1
          #post: post 1

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: false
            #from: undefined
            #to: undefined
          #post: post 1
        "
      `)
      })
    },
    {
      retry: 3,
    },
  )

  it(
    'navigate from post to post via navigate',
    async () => {
      const t = await createT()
      await t.render(t.postsPage.route(), async ({ waitContent, tale, click }) => {
        await waitContent('#posts')
        await click('.navigate-post-preview-1')
        await waitContent('#post')
        expect(await tale()).toMatchInlineSnapshot(`
        "
        /posts
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: false
            #from: undefined
            #to: undefined
          #loading: ...

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: false
            #from: undefined
            #to: undefined
          #posts:
            .link-post-preview-1.descendant: link post 1
            .link-post-by-link-1: link helper post 1
            .navigate-post-preview-1: navigate post 1
            .link-post-preview-2.descendant: link post 2

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.exact: posts
            .link-post-1.descendant: post 1
            .link-post-2.descendant: post 2
          #info:
            #route: /posts
            #href: /posts
            #is-navigating: true
            #from: /posts
            #to: /posts/1
          #posts:
            .link-post-preview-1.descendant: link post 1
            .link-post-by-link-1: link helper post 1
            .navigate-post-preview-1: navigate post 1
            .link-post-preview-2.descendant: link post 2

        /posts/1
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: true
            #from: /posts
            #to: /posts/1
          #post: post 1

          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.ancestor: posts
            .link-post-1.exact: post 1
            .link-post-2.same: post 2
          #info:
            #route: /posts/:id
            #href: /posts/1
            #is-navigating: false
            #from: undefined
            #to: undefined
          #post: post 1
        "
      `)
      })
    },
    {
      retry: 3,
    },
  )

  it('visit to 404', async () => {
    const t = await createT()
    await t.render(t.homePage.route() + '404', async ({ waitContent, tale }) => {
      await waitContent('Page Not Found')
      expect(await tale()).toMatchInlineSnapshot(`
        "
        /404
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: undefined
            #href: /404
            #is-navigating: false
            #from: undefined
            #to: undefined
          #page-404: Page Not Found
        "
      `)
    })
  })

  it(
    'navigate to 404',
    async () => {
      const t = await createT()
      await t.render(t.homePage.route(), async ({ waitContent, tale }) => {
        await waitContent('#home')
        await t.navigate.to('/404')
        await waitContent('Page Not Found')
        expect(await tale()).toMatchInlineSnapshot(`
        "
        /
          #nav:
            .link-home.exact: home
            .link-about.unmatched: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: /
            #href: /
            #is-navigating: false
            #from: undefined
            #to: undefined
          #home: home

        /404
          #nav:
            .link-home.ancestor: home
            .link-about.unmatched: about
            .link-posts.unmatched: posts
            .link-post-1.unmatched: post 1
            .link-post-2.unmatched: post 2
          #info:
            #route: undefined
            #href: /404
            #is-navigating: false
            #from: undefined
            #to: undefined
          #page-404: Page Not Found
        "
      `)
      })
    },
    {
      retry: 3,
    },
  )
})

describe('navigation guards', () => {
  const sleep = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms))

  it(
    'a guard answering false blocks the navigation, sees from/to, and unregistering frees it',
    async () => {
      const t = await createT()
      await t.render(t.homePage.route(), async ({ waitContent, click }) => {
        await waitContent('#home')
        const seen: Array<{ from: string | undefined; to: string | undefined }> = []
        const unregister = registerNavigationGuard(({ from, to }) => {
          seen.push({ from: from.hrefRel, to: to.hrefRel })
          return false
        })
        try {
          await click('.link-about')
          await sleep(200)
          expect(window.document.querySelector('#about')).toBeNull()
          expect(window.document.querySelector('#home')).not.toBeNull()
          expect(seen).toEqual([{ from: '/', to: '/about' }])
          // An awaiting caller learns its navigation did not happen — the same way as a superseding navigate.
          const result = await t.navigate.to('/about')
          expect(result.error?.code).toBe('POINT0_NAVIGATION_BLOCKED')
        } finally {
          unregister()
        }
        await click('.link-about')
        await waitContent('#about')
      })
    },
    { retry: 3 },
  )

  it(
    'the createNavigation `guard` option holds every navigation of the instance',
    async () => {
      const root = Point0.lets('root', 'root')
        .loading(() => <div id="loading">...</div>)
        .error(({ error }) => <div id="error">{error.message}</div>)
        .queryOptions({ retry: false })
        .root()
      let armed = true
      const homePage = root.lets('page', 'home', '/').page(() => <div id="home">home</div>)
      const aboutPage = root.lets('page', 'about', '/about').page(() => <div id="about">about</div>)
      const t = await createTestThings({ ssr: true, points: [root, homePage, aboutPage], guard: () => !armed })
      await t.render('/', async ({ waitContent }) => {
        await waitContent('#home')
        const blocked = await t.navigate.to('/about')
        expect(blocked.error?.code).toBe('POINT0_NAVIGATION_BLOCKED')
        expect(window.document.querySelector('#about')).toBeNull()
        armed = false
        await t.navigate.to('/about')
        await waitContent('#about')
      })
    },
    { retry: 3 },
  )

  it(
    'an async guard parks the navigation until it resolves — the confirm-dialog flow',
    async () => {
      const t = await createT()
      await t.render(t.homePage.route(), async ({ waitContent, click }) => {
        await waitContent('#home')
        let resolveAnswer: ((answer: boolean) => void) | undefined
        const unregister = registerNavigationGuard(
          async () =>
            await new Promise<boolean>((resolve) => {
              resolveAnswer = resolve
            }),
        )
        try {
          await click('.link-about')
          await sleep(100)
          // Parked while the "dialog" is open: nothing navigated, nothing errored.
          expect(window.document.querySelector('#about')).toBeNull()
          resolveAnswer?.(true)
          await waitContent('#about')
        } finally {
          unregister()
        }
      })
    },
    { retry: 3 },
  )

  it(
    'useNavigationGuard reads the latest render state and lives with its component',
    async () => {
      const root = Point0.lets('root', 'root')
        .loading(() => <div id="loading">...</div>)
        .error(({ error }) => <div id="error">{error.message}</div>)
        .queryOptions({ retry: false })
        .root()
      const routes = Routes.create({ home: '/', about: '/about' })
      const { NavLink } = createNavigation({ routes, forceRerender: true })
      const layout = root.lets('layout', 'guard-layout').layout(({ children }) => {
        const [armed, setArmed] = useState(false)
        useNavigationGuard(() => !armed)
        return (
          <>
            <button id="arm" onClick={() => setArmed(true)}>
              arm
            </button>
            <button id="disarm" onClick={() => setArmed(false)}>
              disarm
            </button>
            <NavLink route="about" className="link-about">
              about
            </NavLink>
            {children}
          </>
        )
      })
      const homePage = layout.lets('page', 'home', '/').page(() => <div id="home">home</div>)
      const aboutPage = layout.lets('page', 'about', '/about').page(() => <div id="about">about</div>)
      const t = await createTestThings({ ssr: true, points: [root, layout, homePage, aboutPage] })
      await t.render('/', async ({ waitContent, click }) => {
        await waitContent('#home')
        await click('#arm')
        await click('.link-about')
        await sleep(150)
        expect(window.document.querySelector('#about')).toBeNull()
        await click('#disarm')
        await click('.link-about')
        await waitContent('#about')
      })
    },
    { retry: 3 },
  )
})

describe('setSearch', () => {
  // A page that owns a URL search and mutates it via the `setSearch` prop. The
  // harness wires createNavigation WITHOUT an explicit `navigate`, so `setSearch`
  // goes through the adapter navigate derived from the location `hook` — so this
  // verifies the hook-derived navigate path end-to-end (page prop → navigation
  // helpers → real browser history → URL), not just the helper in isolation.
  //
  // We assert the URL (`window.location.search`), not the rendered DOM: in this
  // happy-dom harness wouter's history is never patched, so its location
  // subscription doesn't fire — React re-renders are driven only by
  // `navigateWithTransitions`' own state. `setSearch` deliberately bypasses that
  // pipeline (a "soft" URL update), so here it writes the URL without re-rendering
  // the tree. The URL write is the contract; the re-render-on-setSearch path works
  // in a real browser (history patched) and the updater / short-circuit / replace
  // behaviors are covered as a unit in packages/core/tests/navigation.unit.test.ts.
  const createSearchT = async () => {
    const root = Point0.lets('root', 'root')
      .loading(() => <div id="loading">...</div>)
      .error(({ error }) => <div id="error">{error.message}</div>)
      .queryOptions({
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
        refetchIntervalInBackground: false,
      })
      .root()
    const searchPage = root
      .lets('page', 'search', '/search')
      .search(z.object({ tab: z.string().optional(), sort: z.string().optional() }))
      .page(({ search, setSearch }) => {
        const location = useLocation()
        return (
          <div id="search-page">
            <div id="ss">ss={location.searchString || '-'}</div>
            <div id="tab">tab={search.tab ?? '-'}</div>
            <button id="set-tab" onClick={() => setSearch({ tab: 'a' })}>
              set tab
            </button>
            <button id="set-sort" onClick={() => setSearch({ sort: 'desc' })}>
              set sort
            </button>
          </div>
        )
      })
    const testThings = await createTestThings({ ssr: true, points: [root, searchPage] })
    return { root, searchPage, ...testThings }
  }

  it(
    'object form writes the query to the URL via the hook-derived adapter navigate',
    async () => {
      const t = await createSearchT()
      await t.render('/search', async ({ waitContent, click }) => {
        // setSearch writes the URL synchronously, but poll to stay robust.
        const waitForSearch = async (expected: string) => {
          for (let i = 0; i < 100; i++) {
            if (window.location.search === expected) {
              return
            }
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          expect(window.location.search).toBe(expected)
        }
        await waitContent('ss=-') // page mounted at /search with no query
        await click('#set-tab')
        await waitForSearch('?tab=a') // object form set the query
        await click('#set-sort')
        await waitForSearch('?sort=desc') // object form replaces the whole query
      })
    },
    { retry: 3 },
  )
})
