export type SessionStatus = 'scheduled' | 'completed' | 'cancelled'

export type Session = {
  id: string
  title: string
  status: SessionStatus
  /** ISO 8601 */
  startsAt: string
}

/** Payload for creating a session. Status is assigned by the API. */
export type NewSessionInput = {
  title: string
  /** ISO 8601 */
  startsAt: string
}
