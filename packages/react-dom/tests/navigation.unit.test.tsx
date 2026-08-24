import { Routes } from '@1gr14/route0'
import { describe, expect, expectTypeOf, it } from 'bun:test'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createNavigation, splitLinkProps } from '../src/router.js'
import type { InferLinkProps } from '../src/router.js'

// A small routes set mirroring how an app wires routes (examples/basic, the site).
const routes = Routes.create({
  home: '/',
  about: '/about',
  ideaView: '/ideas/:id',
})

// Real-world usage pattern: destructure InferNavigation off createNavigation and
// read prop shapes off it via `typeof` in type position.
const { InferNavigation, navigate, redirect, Link } = createNavigation({ routes })

// How a consumer embeds link props into their own component (cf. the site's Button).
type ButtonOwnProps = { variant?: 'primary' | 'secondary'; loading?: boolean; children?: ReactNode }
type ButtonProps = ButtonOwnProps & typeof InferNavigation.LinkProps

// A real component built the intended way: merge `InferNavigation.LinkProps` into its
// own props, then `splitLinkProps` at runtime. (Renders a plain element here so the
// test needs no Router context; Link rendering itself is covered in main.int.test.tsx.)
const Button = (props: ButtonProps) => {
  const [linkProps, rest] = splitLinkProps(props)
  const target = linkProps.route ?? linkProps.to ?? linkProps.href
  return (
    <button data-variant={rest.variant} data-target={target}>
      {rest.children}
    </button>
  )
}

describe('InferNavigation (runtime)', () => {
  it('is a type-only handle — null at runtime, never read', () => {
    expect(InferNavigation).toBeNull()
  })
})

describe('InferNavigation.LinkProps (types)', () => {
  it('accepts a typed route with its required input', () => {
    ;({ variant: 'primary', route: 'ideaView', input: { id: '1' } }) satisfies ButtonProps
  })

  it('accepts a route whose input is optional, with no input', () => {
    ;({ route: 'home' }) satisfies ButtonProps
    ;({ route: 'about', loading: true }) satisfies ButtonProps
  })

  it('accepts `to` / `href` targets with adapter + special options', () => {
    ;({ to: '/about', replace: true, prefetch: 'serverQuery' }) satisfies ButtonProps
    ;({ href: 'https://1gr14.dev', before: () => {} }) satisfies ButtonProps
  })

  it('accepts plain props with no navigation target (just a button)', () => {
    ;({ variant: 'secondary', loading: true }) satisfies ButtonProps
    ;({}) satisfies ButtonProps
  })

  it('does NOT carry the <a>/asChild/children surface', () => {
    // @ts-expect-error asChild belongs to <Link>, not the embeddable LinkProps
    ;({ asChild: true }) satisfies typeof InferNavigation.LinkProps
    // @ts-expect-error className / children are the host element's concern
    ;({ children: 'x' }) satisfies typeof InferNavigation.LinkProps
  })

  it('forces a valid route name', () => {
    // @ts-expect-error 'nope' is not a known route
    ;({ route: 'nope' }) satisfies ButtonProps
  })

  it('forces the route input (cannot omit a required param)', () => {
    // @ts-expect-error ideaView requires { input: { id } }
    ;({ route: 'ideaView' }) satisfies ButtonProps
    // @ts-expect-error id is required on input
    ;({ route: 'ideaView', input: {} }) satisfies ButtonProps
  })

  it('keeps route / to / href mutually exclusive', () => {
    // @ts-expect-error cannot pass both a route and a raw `to`
    ;({ route: 'home', to: '/about' }) satisfies ButtonProps
  })
})

describe('InferNavigation.NavLinkProps (types)', () => {
  type NavLinkProps = typeof InferNavigation.NavLinkProps

  it('adds state className props on top of LinkProps', () => {
    ;({ route: 'home', exactClassName: 'on', sameClassName: 'near' }) satisfies NavLinkProps
    ;({ to: '/about', className: (state) => (state.exact ? 'x' : undefined) }) satisfies NavLinkProps
  })

  it('LinkProps itself does not include className state props', () => {
    // @ts-expect-error exactClassName is NavLink-only
    ;({ route: 'home', exactClassName: 'on' }) satisfies typeof InferNavigation.LinkProps
  })
})

describe('InferNavigation.RouteProps (types)', () => {
  type RouteProps = typeof InferNavigation.RouteProps

  it('is the typed { route, input } target', () => {
    ;({ route: 'ideaView', input: { id: '7' } }) satisfies RouteProps
    // @ts-expect-error RouteProps has no `to`
    ;({ to: '/about' }) satisfies RouteProps
  })
})

describe('splitLinkProps (runtime)', () => {
  it('separates navigation props from the host props', () => {
    const before = () => {}
    const onClick = () => {}
    const [linkProps, rest, isLink] = splitLinkProps({
      to: '/about',
      replace: true,
      prefetch: true,
      before,
      className: 'btn',
      variant: 'primary',
      onClick,
    })
    expect(linkProps).toEqual({ to: '/about', replace: true, prefetch: true, before })
    expect(rest).toEqual({ className: 'btn', variant: 'primary', onClick })
    expect(isLink).toBe(true)
  })

  it('keeps route + input on the link side, leaves element attrs in rest', () => {
    const [linkProps, rest, isLink] = splitLinkProps({
      route: 'ideaView',
      input: { id: '1' },
      target: '_blank',
      children: 'x',
    })
    expect(linkProps).toEqual({ route: 'ideaView', input: { id: '1' } })
    expect(rest).toEqual({ target: '_blank', children: 'x' })
    expect(isLink).toBe(true)
  })

  it('returns empty link half and isLink=false when there are no navigation props', () => {
    const [linkProps, rest, isLink] = splitLinkProps({ variant: 'primary', loading: true })
    expect(linkProps).toEqual({})
    expect(rest).toEqual({ variant: 'primary', loading: true })
    expect(isLink).toBe(false)
  })

  it('isLink is false when only link options (no target) are passed', () => {
    const [linkProps, rest, isLink] = splitLinkProps({ prefetch: 'serverQuery', replace: true, variant: 'primary' })
    expect(linkProps).toEqual({ prefetch: 'serverQuery', replace: true })
    expect(rest).toEqual({ variant: 'primary' })
    expect(isLink).toBe(false)
  })

  it('typed split keeps each prop on the correct side', () => {
    const props: ButtonProps & { onClick: () => void } = {
      route: 'home',
      variant: 'primary',
      onClick: () => {},
    }
    const [linkProps, rest, isLink] = splitLinkProps(props)
    // navigation prop is reachable on the link half...
    void linkProps.route
    // ...and the host props on the rest half
    void rest.variant
    void rest.onClick
    // ...and the third element is the boolean "has a navigation target" flag
    expectTypeOf(isLink).toEqualTypeOf<boolean>()
    // @ts-expect-error `variant` is not a navigation prop
    void linkProps.variant
    // @ts-expect-error `route` was split out of the rest
    void rest.route
  })
})

// The most faithful check: actually call <Button /> in JSX, exactly as a consumer
// would. JSX attribute checking subsumes what `satisfies` does (assignability +
// excess-property checks) on the real call site.
describe('<Button /> usage (types)', () => {
  it('accepts valid navigation props', () => {
    const tree = (
      <>
        <Button route="ideaView" input={{ id: '1' }} />
        <Button route="home" />
        <Button to="/about" variant="primary" />
        <Button href="https://1gr14.dev" />
        <Button variant="secondary">label</Button>
      </>
    )
    expect(tree).toBeTruthy()
  })

  it('rejects invalid navigation props', () => {
    // @ts-expect-error ideaView requires { input: { id } }
    const a = <Button route="ideaView" />
    // @ts-expect-error 'nope' is not a known route
    const b = <Button route="nope" />
    // @ts-expect-error id is required on input
    const c = <Button route="ideaView" input={{}} />
    // @ts-expect-error route and to are mutually exclusive
    const d = <Button route="home" to="/about" />
    void a
    void b
    void c
    void d
  })
})

describe('<Button /> usage (runtime)', () => {
  it('splits a route through to render', () => {
    const html = renderToStaticMarkup(
      <Button route="ideaView" input={{ id: '1' }} variant="primary">
        go
      </Button>,
    )
    expect(html).toContain('data-target="ideaView"')
    expect(html).toContain('data-variant="primary"')
    expect(html).toContain('go')
  })

  it('renders a plain button when no navigation target is given', () => {
    const html = renderToStaticMarkup(<Button variant="secondary">just a button</Button>)
    expect(html).not.toContain('data-target')
    expect(html).toContain('just a button')
  })
})

describe('<Link newTab /> (runtime)', () => {
  // newTab leaves the SPA, so the anchor must carry a native target="_blank" for
  // every target kind — not rely on the client router intercepting the click.
  it('renders a native target="_blank" anchor for an href target', () => {
    const html = renderToStaticMarkup(
      <Link href="https://1gr14.dev" newTab>
        go
      </Link>,
    )
    expect(html).toContain('href="https://1gr14.dev"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('renders a native target="_blank" anchor for a `to` target', () => {
    const html = renderToStaticMarkup(
      <Link to="/about" newTab>
        go
      </Link>,
    )
    expect(html).toContain('href="/about"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('renders a native target="_blank" anchor for a typed route target', () => {
    const html = renderToStaticMarkup(
      <Link route="ideaView" input={{ id: '1' }} newTab>
        go
      </Link>,
    )
    expect(html).toContain('href="/ideas/1"')
    expect(html).toContain('target="_blank"')
  })

  it('keeps a plain href anchor (no target) when newTab is absent', () => {
    const html = renderToStaticMarkup(<Link href="https://1gr14.dev">go</Link>)
    expect(html).toContain('href="https://1gr14.dev"')
    expect(html).not.toContain('target=')
  })

  it('honors an explicit target/rel over the newTab defaults', () => {
    const html = renderToStaticMarkup(
      <Link href="https://1gr14.dev" newTab target="_self" rel="noopener">
        go
      </Link>,
    )
    expect(html).toContain('target="_self"')
    expect(html).toContain('rel="noopener"')
  })
})

// Where expectTypeOf is the right tool (type ↔ type identity, not value assignability):
// assert the member type equals the standalone exported type.
describe('InferNavigation type identity', () => {
  it('InferNavigation.LinkProps === InferLinkProps<typeof routes>', () => {
    expectTypeOf<typeof InferNavigation.LinkProps>().toEqualTypeOf<InferLinkProps<typeof routes>>()
  })
})

describe('navigate history helpers', () => {
  it('exposes back() and forward()', () => {
    expectTypeOf(navigate.back).toEqualTypeOf<() => void>()
    expectTypeOf(navigate.forward).toEqualTypeOf<() => void>()
  })
})

describe('scrollToHash / newTab options (types)', () => {
  it('navigate / navigate.to / redirect accept the presets + newTab', () => {
    // Never called — body is type-checked, but navigate() needs a mounted provider
    // at runtime, so we don't actually invoke it here.
    const _typecheck = () => {
      void navigate('home', undefined, { scrollToHash: 'pushHard', newTab: true })
      void navigate('ideaView', { id: '1' }, { scrollToHash: 'pushHardCurrentSmooth' })
      void navigate.to('#section', { scrollToHash: 'pushHardCurrentHard' })
      void navigate.to('/about', { newTab: true, replace: true })
      redirect('home', undefined, { scrollToHash: false })
      redirect.to('/about', { newTab: true })
      // @ts-expect-error kebab-case is not a valid scrollToHash preset
      void navigate.to('/x', { scrollToHash: 'push-hard' })
    }
    void _typecheck
    expect(typeof navigate).toBe('function')
  })

  it('LinkProps accepts scrollToHash presets + newTab', () => {
    ;({ to: '/about', scrollToHash: 'pushHard', newTab: true }) satisfies typeof InferNavigation.LinkProps
    ;({ route: 'home', scrollToHash: false }) satisfies typeof InferNavigation.LinkProps
    ;({ to: '/about', scrollToHash: 'pushHardCurrentSmooth' }) satisfies typeof InferNavigation.LinkProps
    // @ts-expect-error unknown scrollToHash preset
    ;({ to: '/about', scrollToHash: 'nope' }) satisfies typeof InferNavigation.LinkProps
  })
})

describe('scrollToHash / newTab via splitLinkProps (runtime)', () => {
  it('routes scrollToHash + newTab onto the link half', () => {
    const [linkProps, rest, isLink] = splitLinkProps({
      to: '/about',
      scrollToHash: 'pushHard',
      newTab: true,
      variant: 'primary',
    })
    expect(linkProps).toEqual({ to: '/about', scrollToHash: 'pushHard', newTab: true })
    expect(rest).toEqual({ variant: 'primary' })
    expect(isLink).toBe(true)
  })
})

describe('createNavigation options (types)', () => {
  it('accepts global scrollToHash, openExternal, and a Page404 element or component', () => {
    createNavigation({ routes, scrollToHash: 'pushHardCurrentHard' })
    createNavigation({ routes, scrollToHash: false })
    createNavigation({
      routes,
      openExternal: (to, { newTab }) => {
        void to
        void newTab
      },
    })
    createNavigation({ routes, Page404: () => null })
    createNavigation({ routes, Page404: <span /> })
    // @ts-expect-error kebab-case is not a valid global scrollToHash preset
    createNavigation({ routes, scrollToHash: 'push-hard' })
    expect(true).toBe(true)
  })

  it('accepts a sync or async `guard`, on the options and on the Router prop', () => {
    createNavigation({ routes, guard: ({ from, to }) => from.pathname === to.pathname })
    const { Router } = createNavigation({ routes, guard: async () => Promise.resolve(true) })
    void (<Router guard={({ to }) => to.pathname !== '/closed'} />)
    // @ts-expect-error a guard must answer boolean, not void
    createNavigation({ routes, guard: () => {} })
    expect(true).toBe(true)
  })
})
