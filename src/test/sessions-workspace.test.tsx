import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { createHttpSessionsClient } from '../api/sessionsClient'
import { createMockFetch } from '../mocks/sessionsMock'
import type { MockFetchOptions } from '../mocks/sessionsMock'

const SCHEDULED_TITLES = ['Morning mobility', 'Interval run']
const COMPLETED_TITLE = 'Strength basics'
const CANCELLED_TITLE = 'Evening yoga'

function renderWorkspace(options?: MockFetchOptions) {
  const mockFetch = createMockFetch(options)
  render(<App client={createHttpSessionsClient(mockFetch)} />)
  return { mockFetch, user: userEvent.setup() }
}

function visibleTitles() {
  const list = screen.getByRole('list', { name: 'Sessions' })
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.session-title')?.textContent)
}

describe('training sessions workspace', () => {
  it('filters sessions by Scheduled status', async () => {
    const { user } = renderWorkspace()

    expect(screen.getByRole('status')).toHaveTextContent('Loading sessions…')
    const list = await screen.findByRole('list', { name: 'Sessions' })

    const allButton = screen.getByRole('button', { name: 'All' })
    const scheduledButton = screen.getByRole('button', { name: 'Scheduled' })
    expect(allButton).toHaveAttribute('aria-pressed', 'true')
    expect(scheduledButton).toHaveAttribute('aria-pressed', 'false')

    const allTitles = [...SCHEDULED_TITLES, COMPLETED_TITLE, CANCELLED_TITLE]
    expect(visibleTitles()).toEqual(expect.arrayContaining(allTitles))
    expect(within(list).getByText('Completed')).toBeInTheDocument()
    expect(within(list).getByText('Cancelled')).toBeInTheDocument()

    await user.click(scheduledButton)
    expect(scheduledButton).toHaveAttribute('aria-pressed', 'true')
    expect(allButton).toHaveAttribute('aria-pressed', 'false')
    expect(visibleTitles()).toEqual(SCHEDULED_TITLES)
    expect(screen.queryByText(COMPLETED_TITLE)).not.toBeInTheDocument()
    expect(screen.queryByText(CANCELLED_TITLE)).not.toBeInTheDocument()

    await user.click(allButton)
    expect(allButton).toHaveAttribute('aria-pressed', 'true')
    expect(visibleTitles()).toEqual(expect.arrayContaining(allTitles))
  })

  it('creates a session and shows it in the list', async () => {
    const { user, mockFetch } = renderWorkspace()
    await screen.findByRole('list', { name: 'Sessions' })

    await user.click(screen.getByRole('button', { name: 'Scheduled' }))
    await user.click(screen.getByRole('button', { name: 'New session' }))

    const form = screen.getByRole('form', { name: 'New session' })
    expect(within(form).queryByLabelText(/status/i)).not.toBeInTheDocument()

    await user.type(within(form).getByLabelText('Title'), '  Hill sprints  ')
    await user.type(within(form).getByLabelText('Start date and time'), '2099-01-01T10:00')
    await user.click(within(form).getByRole('button', { name: 'Create session' }))

    const createdTitle = await screen.findByText('Hill sprints')
    const createdItem = createdTitle.closest('li')
    expect(createdItem).not.toBeNull()
    expect(within(createdItem as HTMLElement).getByText('Scheduled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scheduled' })).toHaveAttribute('aria-pressed', 'true')
    expect(visibleTitles()).toContain('Hill sprints')

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(visibleTitles()).toContain('Hill sprints')

    expect(mockFetch.postBodies).toHaveLength(1)
    const [body] = mockFetch.postBodies
    expect(body).toEqual({
      title: 'Hill sprints',
      startsAt: new Date('2099-01-01T10:00').toISOString(),
    })
    expect(body).not.toHaveProperty('status')
  })

  it('shows validation messages and does not send invalid sessions', async () => {
    const { user, mockFetch } = renderWorkspace()
    await screen.findByRole('list', { name: 'Sessions' })
    await user.click(screen.getByRole('button', { name: 'New session' }))

    const form = screen.getByRole('form', { name: 'New session' })
    await user.type(within(form).getByLabelText('Title'), '  ab  ')
    await user.type(within(form).getByLabelText('Start date and time'), '2000-01-01T10:00')
    await user.click(within(form).getByRole('button', { name: 'Create session' }))

    expect(within(form).getByText('Title must be 3–80 characters')).toBeInTheDocument()
    expect(within(form).getByText('Choose a date and time in the future')).toBeInTheDocument()
    expect(within(form).getByLabelText('Title')).toHaveAccessibleDescription(
      'Title must be 3–80 characters',
    )
    expect(mockFetch.postBodies).toHaveLength(0)
  })

  it('sends only one request when the form is submitted twice', async () => {
    const { user, mockFetch } = renderWorkspace({ delayMs: 50 })
    await screen.findByRole('list', { name: 'Sessions' })
    await user.click(screen.getByRole('button', { name: 'New session' }))

    const form = screen.getByRole('form', { name: 'New session' })
    await user.type(within(form).getByLabelText('Title'), 'Tempo run')
    await user.type(within(form).getByLabelText('Start date and time'), '2099-01-01T10:00')
    const submit = within(form).getByRole('button', { name: 'Create session' })
    await user.dblClick(submit)

    await screen.findByText('Tempo run')
    expect(mockFetch.postBodies).toHaveLength(1)
  })

  it('shows an error and recovers after Retry', async () => {
    const { user } = renderWorkspace({ failListRequests: 1 })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load sessions.")
    expect(alert).not.toHaveTextContent(/500|error|status/i)
    expect(screen.queryByRole('list', { name: 'Sessions' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await screen.findByRole('list', { name: 'Sessions' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(visibleTitles()).toEqual(expect.arrayContaining(SCHEDULED_TITLES))
  })
})
