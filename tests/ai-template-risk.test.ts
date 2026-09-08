import { describe, expect, it } from 'vitest'
import { analyzeAiTemplateRisk } from '@/lib/analyzers/ai-template-risk'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeAiTemplateRisk', () => {
  it('scores a specific page 10/10 (good)', () => {
    const section = analyzeAiTemplateRisk(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(10)
    expect(section.status).toBe('good')
  })

  it('scores a buzzword-heavy page low (critical)', () => {
    const section = analyzeAiTemplateRisk(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
    expect(section.evidence.join(' ')).toMatch(/seamless|innovative/i)
  })

  it('gives partial credit at moderate buzzword density', () => {
    const section = analyzeAiTemplateRisk(
      makeFacts({ buzzwordHits: ['seamless', 'innovative', 'tailored'] }),
      BASE_INPUT,
      [],
    )
    expect(section.score).toBe(8)
  })

  it('penalizes repetitive sentence openings', () => {
    const section = analyzeAiTemplateRisk(makeFacts({ sentenceStartVariety: 0.65 }), BASE_INPUT, [])
    expect(section.score).toBe(8)
  })
})
