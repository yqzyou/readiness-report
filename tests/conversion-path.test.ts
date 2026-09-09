import { describe, expect, it } from 'vitest'
import { analyzeConversionPath } from '@/lib/analyzers/conversion-path'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeConversionPath (goal=calls)', () => {
  it('scores a ready page 20/20 (good)', () => {
    const section = analyzeConversionPath(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(20)
    expect(section.status).toBe('good')
  })

  it('scores a dead-end page low (critical)', () => {
    const section = analyzeConversionPath(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
    expect(section.fixes.length).toBeGreaterThan(0)
  })
})

describe('goal-aware scoring', () => {
  const facts = makeFacts({
    hasTelLink: false,
    hasForm: true,
    hasMailtoLink: false,
    aboveFoldText: 'Trusted plumbing services in Boston. Book your visit today.',
    ctaTexts: ['Book your visit'],
  })

  it('treats the form as primary when goal=leads', () => {
    const section = analyzeConversionPath(facts, { ...BASE_INPUT, goal: 'leads' }, [])
    expect(section.evidence.join(' ')).toMatch(/form/i)
    expect(section.score).toBeGreaterThanOrEqual(12)
  })

  it('falls back to partial credit when goal=calls but no phone exists', () => {
    const section = analyzeConversionPath(facts, BASE_INPUT, [])
    expect(section.score).toBeLessThan(20)
    expect(section.fixes.join(' ')).toMatch(/phone/i)
  })
})

describe('CTA specificity', () => {
  it('does not treat bare stat badges like "135+" as specific CTAs', () => {
    const facts = makeFacts({ ctaTexts: ['135+', 'Learn more'] })
    const section = analyzeConversionPath(facts, BASE_INPUT, [])
    expect(section.evidence.join(' ')).toMatch(/generic/i)
  })

  it('treats numbers paired with action words as specific', () => {
    const facts = makeFacts({ ctaTexts: ['Get $50 off'] })
    const section = analyzeConversionPath(facts, BASE_INPUT, [])
    expect(section.evidence.join(' ')).toMatch(/specific CTA exists/)
  })
})
