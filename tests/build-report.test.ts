import { describe, expect, it } from 'vitest'
import { buildReport } from '@/lib/build-report'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('buildReport', () => {
  it('builds a perfect report for a model site', () => {
    const report = buildReport(BASE_INPUT, makeFacts(), 'https://example.com/')
    expect(report.overallScore).toBe(100)
    expect(report.verdict).toMatch(/ready/i)
    expect(report.sections).toHaveLength(7)
    expect(report.topRisks).toHaveLength(0)
    expect(report.sevenDayPlan).toHaveLength(7)
    expect(report.markdown).toContain('# Website Readiness Report')
    expect(report.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(report.url).toBe('https://example.com/')
  })

  it('builds a critical report for a dead site', () => {
    const report = buildReport(BASE_INPUT, sparseFacts(), 'https://example.com/')
    expect(report.overallScore).toBeLessThanOrEqual(10)
    expect(report.verdict).toMatch(/not ready/i)
    expect(report.topRisks.length).toBeGreaterThan(0)
    expect(report.topRisks.length).toBeLessThanOrEqual(5)
  })

  it('orders top risks by worst score ratio', () => {
    const report = buildReport(BASE_INPUT, sparseFacts(), 'https://example.com/')
    const ratios = report.topRisks.map((risk) => {
      const label = risk.split(':')[0]
      const section = report.sections.find((s) => s.label === label)
      return section ? section.score / section.maxScore : 1
    })
    expect(ratios).toEqual([...ratios].sort((a, b) => a - b))
  })

  it('falls back to a default action when a section is already good', () => {
    const report = buildReport(BASE_INPUT, makeFacts(), 'https://example.com/')
    report.sevenDayPlan.forEach((step) => expect(step.length).toBeGreaterThan(10))
  })
})
