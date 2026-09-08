import type { Analyzer, Goal, SiteFacts } from '../types'
import { hasWord, makeSection } from './helpers'

const PRIMARY_ELEMENTS: Record<Goal, (facts: SiteFacts) => boolean> = {
  calls: (f) => f.hasTelLink,
  bookings: (f) => f.hasForm || f.hasTelLink,
  quotes: (f) => f.hasForm || f.hasMailtoLink,
  sales: (f) => f.hasForm,
  leads: (f) => f.hasForm || f.hasMailtoLink,
}

const PRIMARY_LABEL: Record<Goal, string> = {
  calls: 'a clickable phone number',
  bookings: 'a booking form or phone number',
  quotes: 'a quote request form',
  sales: 'an order or checkout form',
  leads: 'a contact form',
}

const GOAL_VERBS: Record<Goal, string[]> = {
  calls: ['call', 'phone', 'dial'],
  bookings: ['book', 'schedule', 'reserve', 'appointment'],
  quotes: ['quote', 'estimate'],
  sales: ['buy', 'order', 'shop', 'cart'],
  leads: ['contact', 'enquire', 'inquire', 'message'],
}

const GENERIC_VERBS = [
  'call', 'book', 'contact', 'schedule', 'order', 'buy',
  'get', 'request', 'reserve', 'visit', 'hire', 'quote',
]

const SPECIFIC_CTA = /\b(free|today|now|instant)\b|\d/i

const anyContact = (f: SiteFacts) => f.hasTelLink || f.hasMailtoLink || f.hasForm

export const analyzeConversionPath: Analyzer = (facts, input) => {
  const goal = input.goal
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (PRIMARY_ELEMENTS[goal](facts)) {
    score += 8
    evidence.push(`Your goal is ${goal} — the page has ${PRIMARY_LABEL[goal]}. Good.`)
  } else if (anyContact(facts)) {
    score += 4
    evidence.push(`Your goal is ${goal}, but the page is missing ${PRIMARY_LABEL[goal]}.`)
    fixes.push(`Add ${PRIMARY_LABEL[goal]} — it is how you said you want customers to reach you.`)
  } else {
    evidence.push('The page has no form, phone number, or email — visitors have no way to convert.')
    fixes.push(`Add ${PRIMARY_LABEL[goal]} so visitors can take the next step.`)
  }

  const goalVerbInFold = GOAL_VERBS[goal].some((v) => hasWord(facts.aboveFoldText, v))
  const genericVerbInFold = GENERIC_VERBS.some((v) => hasWord(facts.aboveFoldText, v))
  if (goalVerbInFold) {
    score += 6
    evidence.push('The first screen invites visitors to take your intended action.')
  } else if (genericVerbInFold) {
    score += 3
    evidence.push('The first screen has a call to action, but not the one matching your goal.')
    fixes.push(`Put a "${GOAL_VERBS[goal][0]}" call to action above the fold.`)
  } else {
    evidence.push('No call-to-action on the first screen — visitors scroll past without acting.')
    fixes.push('Add a button on the first screen inviting the action you want.')
  }

  const specificCta = facts.ctaTexts.find((t) => SPECIFIC_CTA.test(t))
  if (specificCta) {
    score += 4
    evidence.push(`A specific CTA exists: "${specificCta}".`)
  } else if (facts.ctaTexts.length > 0) {
    score += 1
    evidence.push(`CTAs are generic (e.g. "${facts.ctaTexts[0]}") — no urgency or specifics.`)
    fixes.push('Make the CTA specific: "Get a free quote today" beats "Submit".')
  } else {
    evidence.push('No buttons or links that look like calls to action.')
    fixes.push('Add a visible button with concrete copy (e.g. "Call now for a free quote").')
  }

  if (facts.hasTelLink || facts.hasMailtoLink) {
    score += 2
    evidence.push('A phone number or email is reachable somewhere on the page.')
  } else {
    evidence.push('No clickable phone number or email anywhere.')
    fixes.push('Add a clickable phone number or email address.')
  }

  return makeSection({
    key: 'conversion-path',
    label: 'Conversion Path',
    maxScore: 20,
    score,
    evidence,
    whyItMatters:
      'Traffic means nothing if visitors cannot act. One clear, matching next step is the difference between a brochure and a lead machine.',
    fixes,
  })
}
