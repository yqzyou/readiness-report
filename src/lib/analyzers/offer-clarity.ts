import type { Analyzer } from '../types'
import { hasWord, makeSection } from './helpers'

const ACTION_VERBS = [
  'call',
  'book',
  'contact',
  'schedule',
  'order',
  'buy',
  'get',
  'request',
  'reserve',
  'visit',
  'hire',
  'quote',
]

export const analyzeOfferClarity: Analyzer = (facts, input) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (hasWord(facts.aboveFoldText, input.businessType)) {
    score += 4
    evidence.push(`First screen says what you do: "${input.businessType}" appears there.`)
  } else if (hasWord(facts.bodyText, input.businessType)) {
    score += 2
    evidence.push(`"${input.businessType}" appears on the page, but not on the first screen.`)
    fixes.push(`Put what you do ("${input.businessType}") in the headline at the very top.`)
  } else {
    evidence.push(`The page never clearly says you offer "${input.businessType}".`)
    fixes.push(`State clearly at the top: you offer "${input.businessType}" in ${input.targetMarket}.`)
  }

  if (facts.h2s.length >= 3) {
    score += 4
    evidence.push(`Specific sections found (${facts.h2s.length} subheadings), e.g. "${facts.h2s[0]}".`)
  } else if (facts.h2s.length >= 1) {
    score += 2
    evidence.push(`Only ${facts.h2s.length} subheading(s) found — services feel underspecified.`)
    fixes.push('Add subheadings for each service you offer so visitors (and Google) see specifics.')
  } else {
    evidence.push('No subheadings found — the offer reads as one vague block.')
    fixes.push('Break your offer into named services with subheadings.')
  }

  const foldVerb = ACTION_VERBS.find((v) => hasWord(facts.aboveFoldText, v))
  const bodyVerb = ACTION_VERBS.find((v) => hasWord(facts.bodyText, v))
  if (foldVerb) {
    score += 4
    evidence.push(`First screen tells visitors what to do (e.g. "${foldVerb}").`)
  } else if (bodyVerb) {
    score += 2
    evidence.push(`An action word ("${bodyVerb}") exists, but only deeper in the page.`)
    fixes.push('Move a clear instruction ("Call today", "Book now") up to the first screen.')
  } else {
    evidence.push('No clear instruction to act anywhere on the page.')
    fixes.push('Add a clear instruction like "Call today" or "Book a visit".')
  }

  const foldWords = facts.aboveFoldText ? facts.aboveFoldText.split(/\s+/).filter(Boolean).length : 0
  if (foldWords >= 15) {
    score += 3
    evidence.push(`First screen has enough copy to explain the offer (${foldWords} words).`)
  } else if (foldWords >= 8) {
    score += 1
    evidence.push(`First screen copy is sparse (${foldWords} words).`)
    fixes.push('Add a sentence or two on the first screen explaining what you offer and for whom.')
  } else {
    evidence.push(`First screen is almost empty (${foldWords} words).`)
    fixes.push('Write a real opening block: what you do, for whom, where, and what to do next.')
  }

  return makeSection({
    key: 'offer-clarity',
    label: 'Offer Clarity',
    maxScore: 15,
    score,
    evidence,
    whyItMatters:
      'Visitors decide in seconds. If the first screen does not say what you do, for whom, and where, they leave — and ad money burns.',
    fixes,
  })
}
