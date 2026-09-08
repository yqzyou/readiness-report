import { describe, expect, it } from 'vitest'
import { analyzeLocalFit } from '@/lib/analyzers/local-fit'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeLocalFit', () => {
  it('scores a local page 10/10 (good)', () => {
    const section = analyzeLocalFit(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(10)
    expect(section.status).toBe('good')
  })

  it('scores a nowhere page low (critical)', () => {
    const section = analyzeLocalFit(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
  })

  it('gives body-only credit when the market misses title and H1', () => {
    const facts = makeFacts({
      title: 'We fix things | Trusted Pros',
      h1s: ['Quality repairs'],
      hasMapEmbed: false,
      bodyText: 'We help Boston homeowners with pride and care.',
    })
    const section = analyzeLocalFit(facts, BASE_INPUT, [])
    expect(section.score).toBe(3)
  })

  it('uses input.targetMarket for matching and evidence', () => {
    const facts = makeFacts({ hasMapEmbed: false })
    const section = analyzeLocalFit(facts, { ...BASE_INPUT, targetMarket: 'Austin' }, [])
    expect(section.evidence.join(' ')).toMatch(/Austin/)
  })
})
