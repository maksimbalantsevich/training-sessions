import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createHttpSessionsClient } from './api/sessionsClient'
import { createMockFetch } from './mocks/sessionsMock'

// `?fail=1` makes the initial session list request fail so the error and
// Retry flow can be reproduced by hand. In dev, StrictMode mounts effects
// twice, so both initial requests must fail for the error to stay on screen.
const shouldFailList = new URLSearchParams(window.location.search).get('fail') === '1'
const failListRequests = shouldFailList ? (import.meta.env.DEV ? 2 : 1) : 0

const client = createHttpSessionsClient(createMockFetch({ delayMs: 600, failListRequests }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App client={client} />
  </StrictMode>,
)
