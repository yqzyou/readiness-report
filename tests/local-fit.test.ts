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

  describe('online markets', () => {
    const ONLINE_INPUT = { ...BASE_INPUT, targetMarket: 'Worldwide online' }

    it('does not require a map or local phrasing when the market is online', () => {
      const section = analyzeLocalFit(sparseFacts(), ONLINE_INPUT, [])
      const text = [...section.evidence, ...section.fixes].join(' ').toLowerCase()
      expect(text).not.toMatch(/map/)
      expect(text).not.toMatch(/local customers/)
      expect(text).not.toMatch(/near me/)
    })

    it('credits audience, reach, and range signals for online markets', () => {
      const facts = makeFacts({
        title: 'DevTool — Build faster',
        h1s: ['Build faster with DevTool'],
        hasMapEmbed: false,
        bodyText:
          'DevTool is built for developers and trusted by teams in 50 countries. Available worldwide.',
      })
      const section = analyzeLocalFit(facts, ONLINE_INPUT, [])
      expect(section.score).toBeGreaterThanOrEqual(8)
      expect(section.status).not.toBe('critical')
    })

    it('gives full audience credit when the headline names who it is for', () => {
      const facts = makeFacts({
        title: 'Invoicing for freelancers',
        h1s: ['Invoicing built for freelancers'],
        hasMapEmbed: false,
        bodyText: 'Simple invoicing software. Works everywhere.',
      })
      const section = analyzeLocalFit(facts, ONLINE_INPUT, [])
      expect(section.score).toBeGreaterThanOrEqual(5)
    })

    it('routes a misspelled worldwide market (mixed with audience words) to the online branch', () => {
      const input = { ...BASE_INPUT, targetMarket: 'Wordwide, Developers, SaaS' }
      const section = analyzeLocalFit(sparseFacts(), input, [])
      const text = [...section.evidence, ...section.fixes].join(' ').toLowerCase()
      expect(text).not.toMatch(/map/)
      expect(text).not.toMatch(/service area/)
    })

    it('treats continent-level markets as online (no map advice)', () => {
      const input = { ...BASE_INPUT, targetMarket: 'Europe, America.' }
      const section = analyzeLocalFit(sparseFacts(), input, [])
      const text = [...section.evidence, ...section.fixes].join(' ').toLowerCase()
      expect(text).not.toMatch(/map/)
      expect(text).not.toMatch(/near me/)
    })
  })

  it('keeps comma-separated city markets on the local branch', () => {
    const input = { ...BASE_INPUT, targetMarket: 'Austin, Texas' }
    const section = analyzeLocalFit(sparseFacts(), input, [])
    const text = [...section.evidence, ...section.fixes].join(' ')
    expect(text).toMatch(/map/i)
  })
})
