'use client'

import { useState } from 'react'

export default function ReportActions({
  markdown,
  id,
}: {
  markdown: string
  id: string
}) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function share() {
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: document.title, url })
      } catch {
        // user dismissed the native share sheet
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setLinkCopied(false)
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `readiness-report-${id}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="report-actions">
      <button type="button" onClick={copyMarkdown}>
        {copied ? 'Copied!' : 'Copy Markdown'}
      </button>
      <button type="button" onClick={download} className="secondary">
        Download report
      </button>
      <button type="button" onClick={share} className="secondary">
        {linkCopied ? 'Link copied!' : 'Share'}
      </button>
    </div>
  )
}
