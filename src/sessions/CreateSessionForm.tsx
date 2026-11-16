import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { SessionsClient } from '../api/sessionsClient'
import type { Session } from './types'
import { validateNewSession } from './validateNewSession'
import type { NewSessionErrors } from './validateNewSession'

type CreateSessionFormProps = {
  client: SessionsClient
  onCreated: (session: Session) => void
  onCancel?: () => void
}

export function CreateSessionForm({ client, onCreated, onCancel }: CreateSessionFormProps) {
  const id = useId()
  const titleId = `${id}-title`
  const titleErrorId = `${id}-title-error`
  const startsAtId = `${id}-starts-at`
  const startsAtErrorId = `${id}-starts-at-error`

  const [title, setTitle] = useState('')
  const [startsAtLocal, setStartsAtLocal] = useState('')
  const [errors, setErrors] = useState<NewSessionErrors>({})
  const [submitFailed, setSubmitFailed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submittingRef = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const startsAtRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    const result = validateNewSession({ title, startsAtLocal }, new Date())
    if (!result.ok) {
      setErrors(result.errors)
      if (result.errors.title !== undefined) titleRef.current?.focus()
      else startsAtRef.current?.focus()
      return
    }

    setErrors({})
    setSubmitFailed(false)
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const created = await client.createSession(result.value)
      setTitle('')
      setStartsAtLocal('')
      onCreated(created)
    } catch {
      setSubmitFailed(true)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <form className="create-form" aria-label="New session" noValidate onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={titleId}>Title</label>
        <input
          ref={titleRef}
          id={titleId}
          name="title"
          type="text"
          autoComplete="off"
          placeholder="e.g. Morning mobility…"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={errors.title !== undefined}
          aria-describedby={errors.title !== undefined ? titleErrorId : undefined}
        />
        {errors.title !== undefined ? (
          <p id={titleErrorId} className="field-error" role="alert">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={startsAtId}>Start date and time</label>
        <input
          ref={startsAtRef}
          id={startsAtId}
          name="startsAt"
          type="datetime-local"
          autoComplete="off"
          value={startsAtLocal}
          onChange={(event) => setStartsAtLocal(event.target.value)}
          aria-invalid={errors.startsAt !== undefined}
          aria-describedby={errors.startsAt !== undefined ? startsAtErrorId : undefined}
        />
        {errors.startsAt !== undefined ? (
          <p id={startsAtErrorId} className="field-error" role="alert">
            {errors.startsAt}
          </p>
        ) : null}
      </div>

      {submitFailed ? (
        <p className="form-error" role="alert">
          Couldn't create the session. Try again.
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create session'}
        </button>
        {onCancel !== undefined ? (
          <button type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
