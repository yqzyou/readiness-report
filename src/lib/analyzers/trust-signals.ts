import type { Analyzer } from '../types'
import { makeSection } from './helpers'

const TESTIMONIAL_PATTERN = /testimonial|review|what our (clients|customers) say|rated \d|stars?/i
const STRONG_CREDENTIALS = /licen[sc]ed|insured|certified|accredited|award/i
const WEAK_CREDENTIALS = /\b\d+\+? years?\b|since \d{4}|established in \d{4}/i

export const analyzeTrustSignals: Analyzer = (facts) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (TESTIMONIAL_PATTERN.test(facts.bodyText)) {
    score += 4
    evidence.push('Customer reviews or testimonials are mentioned on the page.')
  } else {
    evidence.push('No customer reviews or testimonials found.')
    fixes.push('Add 2–3 short customer quotes with first name and neighborhood.')
  }

  if (facts.addressMatch) {
    score += 4
    evidence.push(`A street address is listed: "${facts.addressMatch}".`)
  } else {
    evidence.push('No street address found on the page.')
    fixes.push('Show your business address (even just city + street) — anonymous pages scare customers.')
  }

  const missingAltRatio = facts.imageCount > 0 ? facts.imagesMissingAlt / facts.imageCount : 1
  if (facts.imageCount >= 5 && missingAltRatio < 0.25) {
    score += 4
    evidence.push(`${facts.imageCount} images on the page — looks like real photos, not a blank template.`)
  } else if (facts.imageCount >= 3) {
    score += 2
    evidence.push(`Only ${facts.imageCount} images — the page risks feeling like a template.`)
    fixes.push('Add real photos: your team, your work, your storefront. Aim for 5+.')
  } else {
    evidence.push(`${facts.imageCount} images found — the page looks empty or generic.`)
    fixes.push('Add real photos of your work, team, or location (5 or more).')
  }

  if (STRONG_CREDENTIALS.test(facts.bodyText)) {
    score += 3
    evidence.push('Credentials found (licensed / insured / certified).')
  } else if (WEAK_CREDENTIALS.test(facts.bodyText)) {
    score += 1
    evidence.push('Some experience claims found (years in business).')
    fixes.push('Add strong credentials: licensed, insured, certified, or awards.')
  } else {
    evidence.push('No credentials or experience claims found.')
    fixes.push('State your credentials (licensed, insured, certified) or years of experience.')
  }

  return makeSection({
    key: 'trust-signals',
    label: 'Trust Signals',
    maxScore: 15,
    score,
    evidence,
    whyItMatters:
      'Customers check you out before calling. Reviews, an address, real photos, and credentials are what make a stranger trust a small business.',
    fixes,
  })
}
