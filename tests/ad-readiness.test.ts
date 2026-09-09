import { describe, expect, it } from 'vitest'
import { analyzeAdReadiness } from '@/lib/analyzers/ad-readiness'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'
import type { AuditSection } from '@/lib/types'

function section(key: string, score: number, maxScore: number): AuditSection {
  return {
    key,
    label: key,
    score,
    maxScore,
    status: score / maxScore >= 0.8 ? 'good' : score / maxScore >= 0.5 ? 'warning' : 'critical',
    evidence: [],
    whyItMatters: '',
    fixes: [],
  }
}

describe('analyzeAdReadiness (derived)', () => {
  it('scores 15/15 when offer, conversion, and trust are all strong', () => {
    const prior = [
      section('offer-clarity', 15, 15),
      section('conversion-path', 20, 20),
      section('trust-signals', 15, 15),
    ]
    const result = analyzeAdReadiness(makeFacts(), BASE_INPUT, prior)
    expect(result.score).toBe(15)
    expect(result.status).toBe('good')
  })

  it('scores 0/15 when the fundamentals are broken', () => {
    const prior = [
      section('offer-clarity', 0, 15),
      section('conversion-path', 0, 20),
      section('trust-signals', 0, 15),
    ]
    const result = analyzeAdReadiness(sparseFacts(), BASE_INPUT, prior)
    expect(result.score).toBe(0)
    expect(result.evidence.join(' ')).toMatch(/wasting/i)
  })

  it('gives partial credit per dimension', () => {
    const prior = [
      section('offer-clarity', 9, 15),
      section('conversion-path', 10, 20),
      section('trust-signals', 3, 15),
    ]
    const result = analyzeAdReadiness(makeFacts(), BASE_INPUT, prior)
    expect(result.score).toBe(3 + 3 + 0)
  })
})
