import type { NewSessionInput } from './types'

export type NewSessionValues = {
  title: string
  /** Value of an `<input type="datetime-local">`, interpreted in local time. */
  startsAtLocal: string
}

export type NewSessionErrors = {
  title?: string
  startsAt?: string
}

export type NewSessionValidation =
  | { ok: true; value: NewSessionInput }
  | { ok: false; errors: NewSessionErrors }

export const TITLE_MIN_LENGTH = 3
export const TITLE_MAX_LENGTH = 80

export const TITLE_ERROR = `Title must be ${TITLE_MIN_LENGTH}–${TITLE_MAX_LENGTH} characters`
export const STARTS_AT_ERROR = 'Choose a date and time in the future'

export function validateNewSession(values: NewSessionValues, now: Date): NewSessionValidation {
  const errors: NewSessionErrors = {}

  const title = values.title.trim()
  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    errors.title = TITLE_ERROR
  }

  const startsAt = values.startsAtLocal === '' ? null : new Date(values.startsAtLocal)
  if (startsAt === null || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= now.getTime()) {
    errors.startsAt = STARTS_AT_ERROR
  }

  if (errors.title !== undefined || errors.startsAt !== undefined || startsAt === null) {
    return { ok: false, errors }
  }

  return { ok: true, value: { title, startsAt: startsAt.toISOString() } }
}
