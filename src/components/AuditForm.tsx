'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

const GOALS = [
  { value: 'calls', label: 'Phone calls' },
  { value: 'bookings', label: 'Bookings / appointments' },
  { value: 'quotes', label: 'Quote requests' },
  { value: 'sales', label: 'Online sales' },
  { value: 'leads', label: 'Leads / contact forms' },
] as const

export default function AuditForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(event.currentTarget)
    const payload = {
      url: String(form.get('url') ?? '').trim(),
      businessType: String(form.get('businessType') ?? '').trim(),
      targetMarket: String(form.get('targetMarket') ?? '').trim(),
      goal: String(form.get('goal') ?? ''),
    }

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        success: boolean
        data: { id: string } | null
        error: string | null
      }
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      router.push(`/report/${json.data.id}`)
    } catch {
      setError('Network error — could not reach the server.')
      setLoading(false)
    }
  }

  return (
    <form className="audit-form" onSubmit={onSubmit} aria-label="Run a readiness check">
      <label className="field field-wide">
        <span>Website URL</span>
        <input name="url" type="text" placeholder="yourbusiness.com" required />
      </label>
      <label className="field">
        <span>What do you do?</span>
        <input name="businessType" type="text" placeholder="e.g. plumbing, dental clinic" required />
      </label>
      <label className="field">
        <span>Where do you serve?</span>
        <input name="targetMarket" type="text" placeholder="e.g. Boston" required />
      </label>
      <label className="field">
        <span>Main goal of the site</span>
        <select name="goal" defaultValue="calls">
          {GOALS.map((goal) => (
            <option key={goal.value} value={goal.value}>
              {goal.label}
            </option>
          ))}
        </select>
      </label>
      <button className="submit" type="submit" disabled={loading}>
        {loading ? 'Checking your site…' : 'Run the free check'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
