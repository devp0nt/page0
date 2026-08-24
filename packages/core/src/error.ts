import { _point0_env } from './env.js'
import { RedirectTask } from './redirect.js'
import type { DataTransformerExtended } from './types.js'

// Walk an error and its `cause` chain, invoking the global stacktrace-fixer hook on each link.
// The hook (installed by @point0/engine when running under vite dev) follows the single-error
// contract — it remaps one Error's `.stack` in place. We walk causes here so every error in
// the chain gets its stack remapped. Idempotent and safe for circular chains (seen-set).
const fixStackChain = (start: unknown): void => {
  if (_point0_env.build.was) return
  const hook = (globalThis as unknown as Record<string, unknown>).__ERROR0_FIX_STACKTRACE__
  if (typeof hook !== 'function') return
  const seen = new Set<unknown>()
  const maxDepth = 99
  let next: unknown = start
  let depth = 0
  while (next && depth < maxDepth && !seen.has(next)) {
    seen.add(next)
    try {
      ;(hook as (v: unknown) => void)(next)
    } catch {}
    next = (next as { cause?: unknown }).cause
    depth += 1
  }
}

export class ErrorPoint0 extends Error {
  status?: number
  code?: string
  redirect?: RedirectTask
  /**
   * "Do not try this again" — the client's retry machinery honors it wherever it retries: react-query stops retrying
   * the query, a rejected socket connect stops the reconnect loop, a denied join is not replayed. Throw it from a
   * connector, a joiner, or any loader when the failure is terminal (a 401 after logout, a hard deny), and the client
   * stops knocking. Travels in the public serialization — it is a behavioral contract, not a secret.
   */
  preventRetry?: boolean
  response?: Response
  headers?: Record<string, string | undefined>
  meta?: Record<string, unknown>

  constructor(
    message?: string,
    options: {
      cause?: unknown
      status?: number
      code?: string
      redirect?: RedirectTask
      preventRetry?: boolean
      response?: Response
      headers?: Record<string, string | undefined>
      meta?: Record<string, unknown>
    } = {},
  ) {
    super(message || 'Unknown error', { cause: options.cause })
    if (options.status) {
      this.status = options.status
    }
    if (options.code) {
      this.code = options.code
    }
    if (options.redirect) {
      this.redirect = options.redirect
    }
    if (options.preventRetry) {
      this.preventRetry = true
    }
    if (options.response) {
      this.response = options.response
    }
    if (options.headers) {
      this.headers = options.headers
    }
    if (options.meta) {
      this.meta = options.meta
    }
    this.name = 'ErrorPoint0'
    // Safety net for accidental JSON.stringify of a payload carrying the error: only the
    // public projection may leak implicitly. Logs use serializePrivate explicitly.
    Object.defineProperty(this, 'toJSON', {
      value: () => (this.constructor as typeof ErrorPoint0).serializePublic(this),
      writable: false,
      enumerable: false,
      configurable: false,
    })
    // Walk `this` and the cause chain so every link's stack is remapped (when the engine
    // installed the hook under vite dev).
    fixStackChain(this)
  }

  static from(error: unknown): ErrorPoint0 {
    if (error instanceof ErrorPoint0) {
      return error
    }
    // Mutate the original error's `.stack` chain in place before we wrap it — that way the
    // wrapped `cause` (which IS the original error) keeps a meaningful stack downstream.
    fixStackChain(error)
    const record = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {}
    const redirect = RedirectTask.is(error)
      ? error
      : record.redirect
        ? RedirectTask.from(record.redirect as never)
        : undefined
    const message =
      typeof record.message === 'string'
        ? record.message
        : typeof error === 'string'
          ? error
          : redirect
            ? 'Page Redirect'
            : 'Unknown error'
    const isErrorInstance = error instanceof Error
    const isOriginalError = isErrorInstance && error.constructor === Error
    const cause: unknown = isOriginalError || !isErrorInstance ? undefined : error
    const status = typeof record.status === 'number' ? record.status : undefined
    const code = typeof record.code === 'string' ? record.code : undefined
    const stack = typeof record.stack === 'string' ? record.stack : undefined
    const preventRetry = record.preventRetry === true ? true : undefined
    const meta =
      record.meta && typeof record.meta === 'object' && !Array.isArray(record.meta)
        ? (record.meta as Record<string, unknown>)
        : undefined
    const error0 = new ErrorPoint0(message, {
      cause,
      status,
      code,
      redirect,
      preventRetry,
      meta,
    })
    if (stack) {
      error0.stack = stack
    }
    return error0
  }

  // The two audiences. Public — what an untrusted client may see: message, code, and an optional
  // redirect; never a stack, never meta, regardless of env (the caller picks the projection per env,
  // not the serializer). The class name is omitted: every error is coerced to this one class, so the
  // name carries nothing, and `from()` reconstructs by field type — it never reads it.
  static serializePublic(error: ErrorPoint0): Record<string, unknown> {
    return {
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.redirect ? { redirect: error.redirect.serialize() } : {}),
      ...(error.preventRetry ? { preventRetry: true } : {}),
    }
  }

  // Private — the full operator view (logs, dev tooling): message, code, status, meta, stack, and the
  // cause chain (each link keeps its own native name). The top-level class name is omitted for the same
  // reason as the public projection — it's a constant, and the stack already carries it.
  static serializePrivate(error: ErrorPoint0): Record<string, unknown> {
    const meta = (() => {
      if (!error.meta) {
        return undefined
      }
      try {
        return JSON.parse(JSON.stringify(error.meta)) as Record<string, unknown>
      } catch {
        return undefined
      }
    })()
    const cause = serializeCauseChainForLog((error as { cause?: unknown }).cause)
    return {
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.status ? { status: error.status } : {}),
      ...(meta ? { meta } : {}),
      ...(error.stack ? { stack: error.stack } : {}),
      ...(error.redirect ? { redirect: error.redirect.serialize() } : {}),
      ...(error.preventRetry ? { preventRetry: true } : {}),
      ...(cause ? { cause } : {}),
    }
  }

  serializePublic(): Record<string, unknown> {
    return (this.constructor as typeof ErrorPoint0).serializePublic(this)
  }

  serializePrivate(): Record<string, unknown> {
    return (this.constructor as typeof ErrorPoint0).serializePrivate(this)
  }
}

// Serialize an error's cause chain for the private/log projection: identity and stack of every
// link, verbatim, with cycle and depth guards.
export const serializeCauseChainForLog = (
  cause: unknown,
  seen = new Set<unknown>(),
  depth = 0,
): Record<string, unknown> | undefined => {
  if (!(cause instanceof Error) || seen.has(cause) || depth > 99) {
    return undefined
  }
  seen.add(cause)
  const record: Record<string, unknown> = { name: cause.name, message: cause.message }
  const code = (cause as { code?: unknown }).code
  if (typeof code === 'string') {
    record.code = code
  }
  if (cause.stack) {
    record.stack = cause.stack
  }
  const nested = serializeCauseChainForLog((cause as { cause?: unknown }).cause, seen, depth + 1)
  if (nested) {
    record.cause = nested
  }
  return record
}

export type ClassLikeError0<T extends ErrorPoint0 = ErrorPoint0> = {
  new (
    message?: string,
    options?: {
      cause?: unknown
      status?: number
      code?: any
      redirect?: RedirectTask
      preventRetry?: boolean
      response?: Response
      headers?: Record<string, string | undefined>
      meta?: Record<string, unknown>
    },
  ): T
  from(error: unknown): T
  serializePublic(error: T): Record<string, unknown>
  serializePrivate(error: T): Record<string, unknown>
}

// Project an error for a client audience: coerce to the configured class, then serialize public in production, private
// in dev (the developer is the audience there). The single gate for what an error reveals across the wire — the
// dehydrated state, streamed query pushes, and deferred-hole error fills all pass through here. Reviving the result with
// `ErrorClass.from(...)` gives the same instance the client boundary receives.
export const serializeStateError = (
  ErrorClass: ClassLikeError0<ErrorPoint0>,
  error: unknown,
): Record<string, unknown> => {
  const error0 = ErrorClass.from(error)
  return _point0_env.mode.is.production ? ErrorClass.serializePublic(error0) : ErrorClass.serializePrivate(error0)
}

/**
 * Registry of all `POINT0_*` error codes the framework attaches (via `error.code`) to the errors it creates. This is
 * the single source of truth: every code is written here exactly once. Keep it in sync when adding a new coded error —
 * the throw sites reference {@link POINT0_ERROR_CODES_MAP}, derived from this list, and userland can document, grep, or
 * match against it.
 */
export const POINT0_ERROR_CODES = [
  // input schema (@point0/core)
  'POINT0_INPUT_SCHEMA_PROMISE_NOT_ALLOWED',
  'POINT0_INPUT_SCHEMA_UNKNOWN',
  'POINT0_INPUT_SCHEMA_INVALID',
  'POINT0_INPUT_SCHEMA_NOT_ALLOWED',
  'POINT0_PARAMS_SCHEMA_NOT_ALLOWED',
  'POINT0_SEARCH_SCHEMA_NOT_ALLOWED',
  // prefetch (@point0/core)
  'POINT0_ROUTE_NOT_SET',
  // queries (@point0/core)
  'POINT0_POINT_NO_LOADER',
  // client chunks / deploy invalidation (@point0/core)
  'POINT0_PAGE_CHUNK_LOAD_FAILED',
  'POINT0_STALE_CLIENT_BUILD',
  // navigation (@point0/core)
  'POINT0_NAVIGATION_BLOCKED', // a navigation guard answered `false` — an expected interruption, not a failure
  // fetch / execute (@point0/engine)
  'POINT0_INPUT_PARSE_FAILED',
  'POINT0_POINT_NOT_FOUND',
  'POINT0_POINT_NO_SERVER_LOADER',
  'POINT0_POINT_NO_ROUTE',
  'POINT0_CLIENT_NOT_FOUND',
  'POINT0_CLIENT_NO_INDEX_HTML',
  'POINT0_HTML_OUTPUT_UNSUPPORTED_POINT_TYPE',
  'POINT0_DEHYDRATED_STATE_UNSUPPORTED_POINT_TYPE',
  'POINT0_NO_OUTPUT',
  'POINT0_NOT_FOUND',
  'POINT0_REDIRECT',
  'POINT0_ERROR_STRINGIFY_FAILED',
  // ssr (@point0/engine)
  'POINT0_SSR_STREAM_RENDER_ERROR',
  // rsc: elements as data (@point0/core) — a loader returned something that can't cross the wire (a server component
  // that THROWS is not coded here: it is coerced with `ErrorClass.from` and re-thrown as-is)
  'POINT0_RSC_DEPTH_EXCEEDED', // an element/deferred subtree sits deeper than the point's .rsc({ depth }) allows
  'POINT0_RSC_INVALID_OUTPUT', // a ref, a function prop, a class component, a non-component point, …
  // deferred RSC holes (@point0/core) — a streamed data fetch dropped before a hole's subtree arrived
  'POINT0_RSC_STREAM_INCOMPLETE',
  // deferred RSC holes (@point0/core) — a hole's subtree did not settle within the engine's `rsc.holeTimeoutMs`
  'POINT0_RSC_HOLE_TIMEOUT',
  // socket channels & handlers (@point0/core client runtime, @point0/engine socket server)
  'POINT0_SOCKET_CONNECTION_LOST', // a send had no live socket/connection and its window ran out
  'POINT0_SOCKET_TICKET_INVALID', // a claim carried an unknown or expired connect ticket
  'POINT0_SOCKET_CONNECTION_NOT_FOUND', // the claimed/addressed connection does not exist (record lapsed, wrong cid)
  'POINT0_SOCKET_HANDLER_NOT_FOUND', // a send named a serverHandler this server does not have
  'POINT0_SOCKET_MAX_CONNECTIONS', // the channel's maxConnections cap rejected a claim
  'POINT0_SOCKET_MESSAGE_TOO_BIG', // an incoming socket message exceeded the channel's maxMessageSize
  'POINT0_SOCKET_SPACE_NOT_FOUND', // a join named a space point this server does not have
  'POINT0_SOCKET_JOIN_NOT_ALLOWED', // a client join hit a space with no `.joiner` — only the server enrolls into it
  'POINT0_SOCKET_NOT_IN_ROOM', // a space-handler send named a room the connection does not hold — or named none at all
  'POINT0_SOCKET_MAX_ROOMS', // the space's maxRooms cap refused the write (rooms per connection per space)
  // subscription streams (@point0/core)
  'POINT0_SUBSCRIPTION_LOST', // the stream broke (no terminal line) and reconnect was off or gave up
  // data transformer (@point0/core, @point0/engine)
  'POINT0_SERIALIZE_FAILED', // the app transformer answered `undefined` for a value that MUST serialize
] as const

export type Point0ErrorCode = (typeof POINT0_ERROR_CODES)[number]

/**
 * The same codes as {@link POINT0_ERROR_CODES}, keyed by their short name (the `POINT0_` prefix stripped) so the throw
 * sites can reference them ergonomically and stay in sync by construction: `POINT0_ERROR_CODES_MAP.NOT_FOUND ===
 * 'POINT0_NOT_FOUND'`. Built from the array above (each code written once); the assertion narrows
 * `Object.fromEntries`'s widened `{ [k: string]: string }` back to the precise key → code mapping.
 */
export const POINT0_ERROR_CODES_MAP = Object.fromEntries(
  POINT0_ERROR_CODES.map((code) => [code.replace(/^POINT0_/, ''), code]),
) as { [C in Point0ErrorCode as C extends `POINT0_${infer TShort}` ? TShort : C]: C }

/**
 * `transformer.stringify` for a value that MUST serialize — query/mutation keys, socket keys, identities, rooms, frame
 * payloads, stream envelopes, dehydrated payloads. `stringify` answers `undefined` when the transformer's `serialize`
 * refused the value (a custom transformer bug); coercing that would merge distinct keys, put the literal string
 * `"undefined"` on the wire, or ship an empty body — so it fails loud with
 * {@link POINT0_ERROR_CODES_MAP.SERIALIZE_FAILED} instead.
 *
 * `subject` names what was being serialized — a point id in the common case, otherwise the caller's own words (`cookie
 * "theme"`, `pushed query …`).
 *
 * Lives here, next to the codes, rather than in `utils.ts`: throwing an `ErrorPoint0` needs the class as a VALUE, and
 * `utils.ts` sits UNDER `error.ts` in the import graph (`error → env → super-store → utils`), so importing it there
 * would close a runtime cycle and hit `super-store`'s top-level `singletonize` in its TDZ.
 */
export const stringifyOrThrow = (transformer: DataTransformerExtended, value: unknown, subject: string): string => {
  const serialized = transformer.stringify(value)
  if (serialized === undefined) {
    throw new ErrorPoint0(`Transformer returned undefined serializing a value on ${subject}`, {
      code: POINT0_ERROR_CODES_MAP.SERIALIZE_FAILED,
      meta: { subject },
    })
  }
  return serialized
}
