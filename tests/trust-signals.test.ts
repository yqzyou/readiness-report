import { describe, expect, it } from 'vitest'
import { analyzeTrustSignals } from '@/lib/analyzers/trust-signals'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeTrustSignals', () => {
  it('scores a trustworthy page 15/15 (good)', () => {
    const section = analyzeTrustSignals(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(15)
    expect(section.status).toBe('good')
  })

  it('scores an anonymous page 0/15 (critical)', () => {
    const section = analyzeTrustSignals(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
    expect(section.fixes.length).toBeGreaterThanOrEqual(3)
  })

  it('gives partial photo credit for few images', () => {
    const section = analyzeTrustSignals(makeFacts({ imageCount: 3, imagesMissingAlt: 0 }), BASE_INPUT, [])
    expect(section.score).toBe(13)
  })

  it('gives weak credential credit for experience years only', () => {
    const facts = makeFacts({
      bodyText:
        'We fix leaks and install pipes. Read our customer reviews and testimonials. Operating since 2015 with care.',
    })
    const section = analyzeTrustSignals(facts, BASE_INPUT, [])
    expect(section.score).toBe(13)
  })
})
