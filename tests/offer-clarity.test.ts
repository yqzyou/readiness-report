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
      aboveFoldText: 'Welcome to our website. We are here to help you today.',
    })
    const section = analyzeOfferClarity(facts, BASE_INPUT, [])
    expect(section.score).toBe(15 - 4 + 2)
  })

  it('awards service structure for three or more H2 subheadings', () => {
    const facts = makeFacts({ h2s: [] })
    const without = analyzeOfferClarity(facts, BASE_INPUT, [])
    expect(without.score).toBe(11)
  })
})
