import { render, screen } from '@testing-library/react'
import App from '../App'
import { createHttpSessionsClient } from '../api/sessionsClient'
import { createMockFetch } from '../mocks/sessionsMock'

it('renders the app', async () => {
  render(<App client={createHttpSessionsClient(createMockFetch())} />)
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  await screen.findByRole('list', { name: 'Sessions' })
})
