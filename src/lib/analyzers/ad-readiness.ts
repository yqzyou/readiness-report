import type { Analyzer, AuditSection } from '../types'
import { makeSection } from './helpers'

const DERIVED_KEYS = [
  { key: 'offer-clarity', label: 'Offer clarity' },
  { key: 'conversion-path', label: 'Conversion path' },
  { key: 'trust-signals', label: 'Trust signals' },
] as const

function grade(ratio: number): number {
  if (ratio >= 0.8) return 5
  if (ratio >= 0.5) return 3
  return 0
}

export const analyzeAdReadiness: Analyzer = (_facts, _input, prior) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  for (const { key, label } of DERIVED_KEYS) {
    const section: AuditSection | undefined = prior.find((s) => s.key === key)
    const ratio = section ? section.score / section.maxScore : 0
    const points = grade(ratio)
    score += points
    if (!section) continue
    if (ratio >= 0.8) {
      evidence.push(`${label} is solid (${section.score}/${section.maxScore}) — ads will land well.`)
    } else if (ratio >= 0.5) {
      evidence.push(`${label} is shaky (${section.score}/${section.maxScore}) — fix it before scaling spend.`)
      fixes.push(`Improve ${label.toLowerCase()} first (currently ${section.score}/${section.maxScore}).`)
    } else {
      evidence.push(`${label} is broken (${section.score}/${section.maxScore}) — paid traffic would bounce.`)
      fixes.push(`Fix ${label.toLowerCase()} before spending on ads (currently ${section.score}/${section.maxScore}).`)
    }
  }

  if (score === 0) {
    evidence.push('Running ads now means wasting the budget — the landing experience cannot convert.')
  }

  return makeSection({
    key: 'ad-readiness',
    label: 'Ad Readiness',
    maxScore: 15,
    score,
    evidence,
    whyItMatters:
      'Ads multiply what your page already does. A clear offer, a working conversion path, and real trust are what keep paid clicks from being wasted money.',
    fixes,
  })
}
