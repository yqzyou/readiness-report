import { describe, expect, it } from 'vitest'
import { runAnalyzers } from '@/lib/analyzers'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('runAnalyzers', () => {
  it('runs all seven dimensions in order', () => {
    const sections = runAnalyzers(makeFacts(), BASE_INPUT)
    expect(sections.map((s) => s.key)).toEqual([
      'crawlability',
      'offer-clarity',
      'conversion-path',
      'trust-signals',
      'local-fit',
      'ai-template-risk',
      'ad-readiness',
    ])
  })

  it('scores a model page 100/100', () => {
    const sections = runAnalyzers(makeFacts(), BASE_INPUT)
    expect(sections.reduce((sum, s) => sum + s.score, 0)).toBe(100)
    expect(sections.every((s) => s.status === 'good')).toBe(true)
  })

  it('scores a dead page low across the board', () => {
    const sections = runAnalyzers(sparseFacts(), BASE_INPUT)
    expect(sections.reduce((sum, s) => sum + s.score, 0)).toBeLessThanOrEqual(10)
  })
})
