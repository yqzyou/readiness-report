export type Goal = 'calls' | 'bookings' | 'quotes' | 'sales' | 'leads'

export type AuditInput = {
  url: string
  businessType: string
  targetMarket: string
  goal: Goal
}

export type SectionStatus = 'good' | 'warning' | 'critical'

export type AuditSection = {
  key: string
  label: string
  score: number
  maxScore: number
  status: SectionStatus
  evidence: string[]
  whyItMatters: string
  fixes: string[]
}

export type AuditReport = {
  id: string
  url: string
  createdAt: string
  overallScore: number
  verdict: string
  sections: AuditSection[]
  topRisks: string[]
  sevenDayPlan: string[]
  markdown: string
}

export type ReportData = Omit<AuditReport, 'markdown'>

export type SiteFacts = {
  title: string | null
  titleLength: number
  metaDescription: string | null
  metaDescriptionLength: number
  canonical: string | null
  hasNoindex: boolean
  h1s: string[]
  h2s: string[]
  aboveFoldText: string
  bodyText: string
  bodyWordCount: number
  textToCodeRatio: number
  hasTelLink: boolean
  hasMailtoLink: boolean
  hasForm: boolean
  ctaTexts: string[]
  imageCount: number
  imagesMissingAlt: number
  addressMatch: string | null
  hasMapEmbed: boolean
  buzzwordHits: string[]
  numberHits: number
  sentenceStartVariety: number
}

export type Analyzer = (
  facts: SiteFacts,
  input: AuditInput,
  prior: AuditSection[],
) => AuditSection
