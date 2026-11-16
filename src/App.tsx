import { useEffect, useState } from 'react'
import type { SessionsClient } from './api/sessionsClient'
import { CreateSessionForm } from './sessions/CreateSessionForm'
import type { Session, SessionStatus } from './sessions/types'
import './App.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; sessions: Session[] }

type Filter = 'all' | 'scheduled'

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
]

const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

type AppProps = {
  client: SessionsClient
}

function App({ client }: AppProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    let ignore = false
    client.listSessions().then(
      (sessions) => {
        if (!ignore) setLoadState({ status: 'ready', sessions })
      },
      () => {
        if (!ignore) setLoadState({ status: 'error' })
      },
    )
    return () => {
      ignore = true
    }
  }, [client, loadAttempt])

  function retry() {
    setLoadState({ status: 'loading' })
    setLoadAttempt((attempt) => attempt + 1)
  }

  function handleCreated(session: Session) {
    setLoadState((current) =>
      current.status === 'ready'
        ? { status: 'ready', sessions: [...current.sessions, session] }
        : current,
    )
    setIsFormOpen(false)
  }

  return (
    <main className="workspace">
      <h1>Training sessions</h1>
      {renderContent()}
    </main>
  )

  function renderContent() {
    if (loadState.status === 'loading') {
      return (
        <p className="state-message" role="status">
          Loading sessions…
        </p>
      )
    }

    if (loadState.status === 'error') {
      return (
        <div className="state-message">
          <p role="alert">Couldn't load sessions.</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )
    }

    const visibleSessions =
      filter === 'all'
        ? loadState.sessions
        : loadState.sessions.filter((session) => session.status === filter)

    return (
      <>
        <div className="toolbar">
          <div className="filter" role="group" aria-label="Filter by status">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {isFormOpen ? null : (
            <button type="button" onClick={() => setIsFormOpen(true)}>
              New session
            </button>
          )}
        </div>

        {isFormOpen ? (
          <CreateSessionForm
            client={client}
            onCreated={handleCreated}
            onCancel={() => setIsFormOpen(false)}
          />
        ) : null}

        <ul className="session-list" aria-label="Sessions">
          {visibleSessions.map((session) => (
            <li key={session.id} className="session">
              <span className="session-title">{session.title}</span>
              <span className={`session-status session-status--${session.status}`}>
                {STATUS_LABELS[session.status]}
              </span>
              <time className="session-time" dateTime={session.startsAt}>
                {dateTimeFormat.format(new Date(session.startsAt))}
              </time>
            </li>
          ))}
        </ul>
      </>
    )
  }
}

export default App
