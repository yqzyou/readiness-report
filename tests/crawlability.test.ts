import { describe, expect, it } from 'vitest'
import { analyzeCrawlability } from '@/lib/analyzers/crawlability'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeCrawlability', () => {
  it('scores a healthy page 15/15 (good)', () => {
    const section = analyzeCrawlability(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(15)
    expect(section.maxScore).toBe(15)
    expect(section.status).toBe('good')
  })

  it('scores an empty page 0/15 (critical) and lists fixes', () => {
    const section = analyzeCrawlability(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
    expect(section.status).toBe('critical')
    expect(section.fixes.length).toBeGreaterThanOrEqual(5)
  })

  it('gives partial credit for a too-short but present title', () => {
    const section = analyzeCrawlability(
      makeFacts({ title: 'Home', titleLength: 4 }),
      BASE_INPUT,
      [],
    )
    expect(section.score).toBe(13)
    expect(section.fixes[0]).toMatch(/title/i)
  })

  it('penalizes noindex and multiple h1s', () => {
    const section = analyzeCrawlability(
      makeFacts({ hasNoindex: true, h1s: ['One', 'Two'] }),
      BASE_INPUT,
      [],
    )
    expect(section.score).toBe(15 - 2 - 2)
    expect(section.evidence.join(' ')).toMatch(/noindex/i)
  })
})
