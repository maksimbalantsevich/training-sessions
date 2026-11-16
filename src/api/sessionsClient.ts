import type { NewSessionInput, Session, SessionStatus } from '../sessions/types'

export type SessionsClient = {
  listSessions(): Promise<Session[]>
  createSession(input: NewSessionInput): Promise<Session>
}

const SESSIONS_URL = '/api/sessions'

const STATUSES: readonly SessionStatus[] = ['scheduled', 'completed', 'cancelled']

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.startsAt === 'string' &&
    STATUSES.includes(candidate.status as SessionStatus)
  )
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return response.json()
}

export function createHttpSessionsClient(fetchFn: typeof fetch): SessionsClient {
  return {
    async listSessions() {
      const data = await readJson(await fetchFn(SESSIONS_URL))
      if (!Array.isArray(data) || !data.every(isSession)) {
        throw new Error('Unexpected sessions response')
      }
      return data
    },

    async createSession(input) {
      const body: NewSessionInput = { title: input.title, startsAt: input.startsAt }
      const response = await fetchFn(SESSIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await readJson(response)
      if (!isSession(data)) {
        throw new Error('Unexpected created session response')
      }
      return data
    },
  }
}
