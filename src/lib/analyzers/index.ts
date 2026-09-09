import type { Analyzer, AuditInput, AuditSection, SiteFacts } from '../types'
import { analyzeAdReadiness } from './ad-readiness'
import { analyzeAiTemplateRisk } from './ai-template-risk'
import { analyzeConversionPath } from './conversion-path'
import { analyzeCrawlability } from './crawlability'
import { analyzeLocalFit } from './local-fit'
import { analyzeOfferClarity } from './offer-clarity'
import { analyzeTrustSignals } from './trust-signals'

export const ANALYZERS: Analyzer[] = [
  analyzeCrawlability,
  analyzeOfferClarity,
  analyzeConversionPath,
  analyzeTrustSignals,
  analyzeLocalFit,
  analyzeAiTemplateRisk,
  analyzeAdReadiness,
]

export function runAnalyzers(facts: SiteFacts, input: AuditInput): AuditSection[] {
  const sections: AuditSection[] = []
  for (const analyze of ANALYZERS) {
    sections.push(analyze(facts, input, sections))
  }
  return sections
}
