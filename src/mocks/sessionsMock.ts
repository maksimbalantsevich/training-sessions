import type { Session } from '../sessions/types'

export type MockFetchOptions = {
  /** Artificial latency for every response, in milliseconds. */
  delayMs?: number
  /** How many first `GET /api/sessions` requests respond with 500. */
  failListRequests?: number
}

export type MockFetch = typeof fetch & {
  /** Parsed bodies of every `POST /api/sessions` received, in order. */
  readonly postBodies: unknown[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function createSeed(now: number): Session[] {
  return [
    {
      id: '1',
      title: 'Morning mobility',
      status: 'scheduled',
      startsAt: new Date(now + 2 * DAY_MS).toISOString(),
    },
    {
      id: '2',
      title: 'Interval run',
      status: 'scheduled',
      startsAt: new Date(now + 5 * DAY_MS).toISOString(),
    },
    {
      id: '3',
      title: 'Strength basics',
      status: 'completed',
      startsAt: new Date(now - 3 * DAY_MS).toISOString(),
    },
    {
      id: '4',
      title: 'Evening yoga',
      status: 'cancelled',
      startsAt: new Date(now - 1 * DAY_MS).toISOString(),
    },
  ]
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function readField(body: unknown, key: string): string {
  if (typeof body !== 'object' || body === null) return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

/**
 * In-memory, fetch-compatible stand-in for the sessions API.
 * Each instance owns its own store, so tests stay isolated.
 */
export function createMockFetch(options: MockFetchOptions = {}): MockFetch {
  const { delayMs = 0 } = options
  let remainingListFailures = options.failListRequests ?? 0
  const store = createSeed(Date.now())
  let nextId = store.length + 1
  const postBodies: unknown[] = []

  async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const isRequest = input instanceof Request
    const url = new URL(isRequest ? input.url : String(input), 'http://localhost')
    const method = (init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase()

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    if (url.pathname !== '/api/sessions') {
      return json({ message: 'Not found' }, 404)
    }

    if (method === 'GET') {
      if (remainingListFailures > 0) {
        remainingListFailures -= 1
        return json({ message: 'Internal server error' }, 500)
      }
      return json(store.map((session) => ({ ...session })), 200)
    }

    if (method === 'POST') {
      const rawBody = isRequest ? await input.text() : init?.body
      const body: unknown = typeof rawBody === 'string' ? JSON.parse(rawBody) : null
      postBodies.push(body)
      const created: Session = {
        id: String(nextId++),
        title: readField(body, 'title'),
        startsAt: readField(body, 'startsAt'),
        status: 'scheduled',
      }
      store.push(created)
      return json(created, 201)
    }

    return json({ message: 'Method not allowed' }, 405)
  }

  return Object.assign(mockFetch, { postBodies })
}
