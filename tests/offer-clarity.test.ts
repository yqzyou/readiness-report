import { describe, expect, it } from 'vitest'
import { analyzeOfferClarity } from '@/lib/analyzers/offer-clarity'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeOfferClarity', () => {
  it('scores a clear page 15/15 (good)', () => {
    const section = analyzeOfferClarity(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(15)
    expect(section.status).toBe('good')
  })

  it('scores a vague page low (critical)', () => {
    const section = analyzeOfferClarity(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBeLessThanOrEqual(2)
    expect(section.status).toBe('critical')
  })

  it('gives half credit when the business word is only in the body', () => {
    const facts = makeFacts({
      aboveFoldText:
        'Welcome to our website. We are here to help you with anything. Call us today for support.',
    })
    const section = analyzeOfferClarity(facts, BASE_INPUT, [])
    expect(section.score).toBe(13)
  })

  it('awards service structure for three or more H2 subheadings', () => {
    const facts = makeFacts({ h2s: [] })
    const without = analyzeOfferClarity(facts, BASE_INPUT, [])
    expect(without.score).toBe(11)
  })

  it('uses singular "word" when the first screen has exactly one word', () => {
    const facts = makeFacts({ aboveFoldText: 'Welcome.' })
    const section = analyzeOfferClarity(facts, BASE_INPUT, [])
    const joined = section.evidence.join(' ')
    expect(joined).toMatch(/1 word\b/)
    expect(joined).not.toMatch(/1 words/)
  })
})
