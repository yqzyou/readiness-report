import type { SectionStatus } from './types'

export function sectionStatus(score: number, maxScore: number): SectionStatus {
  if (maxScore <= 0) return 'good'
  const ratio = score / maxScore
  if (ratio >= 0.8) return 'good'
  if (ratio >= 0.5) return 'warning'
  return 'critical'
}
