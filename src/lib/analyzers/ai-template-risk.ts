import type { Analyzer } from '../types'
import { makeSection } from './helpers'

export const analyzeAiTemplateRisk: Analyzer = (facts) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  const words = Math.max(facts.bodyWordCount, 1)
  const density = facts.buzzwordHits.length / words
  const densityPct = (density * 100).toFixed(2)
  if (density < 0.005) {
    score += 4
    evidence.push('Almost no generic AI buzzwords — the copy sounds specific to your business.')
  } else if (density < 0.02) {
    score += 2
    evidence.push(
      `Some generic buzzwords (${facts.buzzwordHits.length}, ${densityPct}% of copy): ${facts.buzzwordHits.slice(0, 3).join(', ')}.`,
    )
    fixes.push('Replace buzzwords ("seamless", "innovative") with what you actually do.')
  } else {
    evidence.push(
      `Heavy generic buzzwords (${facts.buzzwordHits.length}, ${densityPct}% of copy): ${facts.buzzwordHits.slice(0, 5).join(', ')}.`,
    )
    fixes.push('Rewrite generic AI-sounding copy with concrete facts about your business.')
  }

  if (facts.numberHits >= 3) {
    score += 3
    evidence.push(`Concrete numbers found (${facts.numberHits} mentions — years, %, job counts…).`)
  } else if (facts.numberHits >= 1) {
    score += 2
    evidence.push(`Only ${facts.numberHits} concrete number(s) found.`)
    fixes.push('Add specifics: years in business, jobs completed, response time, warranty length.')
  } else {
    evidence.push('No concrete numbers anywhere — a classic AI-template symptom.')
    fixes.push('Add specifics: years in business, jobs completed, response time, warranty length.')
  }

  const repetition = 1 - facts.sentenceStartVariety
  if (repetition <= 0.2) {
    score += 3
    evidence.push('Sentences open in varied ways — reads human.')
  } else if (repetition <= 0.4) {
    score += 1
    evidence.push(`Many sentences start the same way (repetition ${Math.round(repetition * 100)}%).`)
    fixes.push('Vary how sentences open; repeated openers make copy feel machine-generated.')
  } else {
    evidence.push(`Most sentences start the same way (repetition ${Math.round(repetition * 100)}%) — reads templated.`)
    fixes.push('Rewrite repetitive blocks; mix sentence lengths and openings.')
  }

  return makeSection({
    key: 'ai-template-risk',
    label: 'AI Template Risk',
    maxScore: 10,
    score,
    evidence,
    whyItMatters:
      'Customers have started recognizing (and distrusting) generic AI copy. Specific, human details are what make you memorable — and credible.',
    fixes,
  })
}
