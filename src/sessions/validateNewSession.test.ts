import { STARTS_AT_ERROR, TITLE_ERROR, validateNewSession } from './validateNewSession'

const now = new Date('2030-06-01T12:00:00')
const future = '2030-06-02T09:30'

describe('validateNewSession', () => {
  it.each([
    ['2 chars', 'ab', false],
    ['3 chars', 'abc', true],
    ['80 chars', 'a'.repeat(80), true],
    ['81 chars', 'a'.repeat(81), false],
    ['2 chars after trim', '   ab   ', false],
    ['80 chars after trim', `  ${'a'.repeat(80)}  `, true],
  ])('title with %s → valid: %s', (_label, title, valid) => {
    const result = validateNewSession({ title, startsAtLocal: future }, now)
    expect(result.ok).toBe(valid)
    if (!result.ok) expect(result.errors.title).toBe(TITLE_ERROR)
  })

  it('returns the trimmed title and an ISO start time', () => {
    const result = validateNewSession({ title: '  Hill sprints ', startsAtLocal: future }, now)
    expect(result).toEqual({
      ok: true,
      value: { title: 'Hill sprints', startsAt: new Date(future).toISOString() },
    })
  })

  it('requires a start date and time', () => {
    const result = validateNewSession({ title: 'Valid title', startsAtLocal: '' }, now)
    expect(result).toEqual({ ok: false, errors: { startsAt: STARTS_AT_ERROR } })
  })

  it('rejects an invalid start date', () => {
    const result = validateNewSession({ title: 'Valid title', startsAtLocal: 'not-a-date' }, now)
    expect(result.ok).toBe(false)
  })

  it('requires the start time to be strictly in the future', () => {
    const exactlyNow = validateNewSession({ title: 'Valid title', startsAtLocal: '2030-06-01T12:00' }, now)
    expect(exactlyNow.ok).toBe(false)

    const justBefore = new Date(now.getTime() - 1)
    const oneMsLater = validateNewSession({ title: 'Valid title', startsAtLocal: '2030-06-01T12:00' }, justBefore)
    expect(oneMsLater.ok).toBe(true)
  })

  it('reports both errors at once', () => {
    const result = validateNewSession({ title: ' ', startsAtLocal: '' }, now)
    expect(result).toEqual({
      ok: false,
      errors: { title: TITLE_ERROR, startsAt: STARTS_AT_ERROR },
    })
  })
})
