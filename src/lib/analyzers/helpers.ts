import { sectionStatus } from '../status'
import type { AuditSection } from '../types'

export type SectionDraft = {
  key: string
  label: string
  maxScore: number
  score: number
  evidence: string[]
  whyItMatters: string
  fixes: string[]
}

export function makeSection(draft: SectionDraft): AuditSection {
  return {
    key: draft.key,
    label: draft.label,
    score: draft.score,
    maxScore: draft.maxScore,
    status: sectionStatus(draft.score, draft.maxScore),
    evidence: draft.evidence,
    whyItMatters: draft.whyItMatters,
    fixes: draft.fixes,
  }
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasWord(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false
  const pattern = new RegExp(`\\b${escapeRegExp(needle.toLowerCase())}\\b`)
  return pattern.test(haystack.toLowerCase())
}
