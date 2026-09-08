import { runAnalyzers } from './analyzers'
import { renderMarkdown } from './render-markdown'
import type { AuditInput, AuditReport, AuditSection, SiteFacts } from './types'

type PlanSlot = { keys: string[]; fallback: string }

const PLAN_SLOTS: PlanSlot[] = [
  { keys: ['conversion-path'], fallback: 'Add one clear call-to-action above the fold.' },
  { keys: ['offer-clarity'], fallback: 'State exactly what you offer, for whom, and where.' },
  { keys: ['trust-signals'], fallback: 'Add testimonials, your address, and real photos.' },
  { keys: ['crawlability'], fallback: 'Fix the page title, meta description, and H1.' },
  { keys: ['local-fit'], fallback: 'Mention your city and service area throughout the page.' },
  { keys: ['ai-template-risk'], fallback: 'Replace generic AI copy with specifics and numbers.' },
  { keys: ['ad-readiness'], fallback: 'Re-run this check before spending money on ads.' },
]

function firstFix(sections: AuditSection[], keys: string[], fallback: string): string {
  for (const key of keys) {
    const section = sections.find((s) => s.key === key)
    if (section && section.status !== 'good' && section.fixes.length > 0) {
      return section.fixes[0]
    }
  }
  return fallback
}

function buildVerdict(score: number): string {
  if (score >= 80) return 'Ready to launch — a solid foundation for getting customers.'
  if (score >= 50) return 'Usable, but fix the basics before spending on ads.'
  return 'Not ready — a high risk of wasting ad spend. Fix the basics first.'
}

export function buildReport(
  input: AuditInput,
  facts: SiteFacts,
  finalUrl: string,
): AuditReport {
  const sections = runAnalyzers(facts, input)
  const overallScore = sections.reduce((sum, s) => sum + s.score, 0)

  const topRisks = sections
    .filter((s) => s.status !== 'good' && s.fixes.length > 0)
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)
    .slice(0, 5)
    .map((s) => `${s.label}: ${s.fixes[0]}`)

  const sevenDayPlan = PLAN_SLOTS.map((slot) => firstFix(sections, slot.keys, slot.fallback))

  const base = {
    id: crypto.randomUUID(),
    url: finalUrl,
    createdAt: new Date().toISOString(),
    overallScore,
    verdict: buildVerdict(overallScore),
    sections,
    topRisks,
    sevenDayPlan,
  }

  return { ...base, markdown: renderMarkdown(base) }
}
