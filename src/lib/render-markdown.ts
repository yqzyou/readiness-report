import type { ReportData } from './types'

export function renderMarkdown(report: ReportData): string {
  const lines: string[] = []

  lines.push('# Website Readiness Report', '')
  lines.push(`**URL:** ${report.url}`, '')
  lines.push(`**Checked:** ${report.createdAt}`, '')
  lines.push(`**Overall score:** ${report.overallScore} / 100`, '')
  lines.push(`**Verdict:** ${report.verdict}`, '')

  if (report.topRisks.length > 0) {
    lines.push('## Top risks', '')
    report.topRisks.forEach((risk, i) => lines.push(`${i + 1}. ${risk}`))
    lines.push('')
  }

  lines.push('## Scorecard', '')
  for (const section of report.sections) {
    lines.push(`### ${section.label} — ${section.score}/${section.maxScore} (${section.status})`, '')
    lines.push(section.whyItMatters, '')
    if (section.evidence.length > 0) {
      lines.push('**What we found:**')
      section.evidence.forEach((e) => lines.push(`- ${e}`))
      lines.push('')
    }
    if (section.fixes.length > 0) {
      lines.push('**Fixes:**')
      section.fixes.forEach((f) => lines.push(`- ${f}`))
      lines.push('')
    }
  }

  lines.push('## 7-day plan', '')
  report.sevenDayPlan.forEach((step, i) => {
    lines.push(`**Day ${i + 1}:** ${step}`, '')
  })

  return lines.join('\n')
}
