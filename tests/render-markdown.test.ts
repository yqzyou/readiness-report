import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/render-markdown'
import type { ReportData } from '@/lib/types'

function fixture(): ReportData {
  return {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    url: 'https://example.com',
    createdAt: '2026-09-08T00:00:00.000Z',
    overallScore: 72,
    verdict: 'Usable, but fix the basics before spending on ads.',
    sections: [
      {
        key: 'crawlability',
        label: 'Crawlability & SEO Basics',
        score: 12,
        maxScore: 15,
        status: 'warning',
        evidence: ['Title is 20 chars'],
        whyItMatters: 'Google reads this metadata.',
        fixes: ['Rewrite the page title.'],
      },
    ],
    topRisks: ['Conversion Path: Add a booking form.'],
    sevenDayPlan: ['Add a clear call-to-action above the fold.'],
  }
}

describe('renderMarkdown', () => {
  it('renders the header block', () => {
    const md = renderMarkdown(fixture())
    expect(md).toContain('# Website Readiness Report')
    expect(md).toContain('**URL:** https://example.com')
    expect(md).toContain('**Overall score:** 72 / 100')
    expect(md).toContain('**Verdict:** Usable, but fix the basics')
  })

  it('renders risks, sections, and the plan', () => {
    const md = renderMarkdown(fixture())
    expect(md).toContain('## Top risks')
    expect(md).toContain('1. Conversion Path: Add a booking form.')
    expect(md).toContain('### Crawlability & SEO Basics — 12/15 (warning)')
    expect(md).toContain('- Rewrite the page title.')
    expect(md).toContain('## 7-day plan')
    expect(md).toContain('**Day 1:**')
  })

  it('omits the risks block when there are none', () => {
    const data = fixture()
    const md = renderMarkdown({ ...data, topRisks: [] })
    expect(md).not.toContain('## Top risks')
  })
})
