import type { Analyzer } from '../types'
import { hasWord, makeSection } from './helpers'

const SERVICE_AREA_PHRASE =
  /\b(serving|service area|served areas?|based in|located in|proudly serving|throughout)\b/i

export const analyzeLocalFit: Analyzer = (facts, input) => {
  const market = input.targetMarket
  const headingText = [facts.title ?? '', ...facts.h1s].join(' ')
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (hasWord(headingText, market)) {
    score += 5
    evidence.push(`"${market}" appears in your title or main headline — strong local signal.`)
  } else if (hasWord(facts.bodyText, market)) {
    score += 3
    evidence.push(`"${market}" appears in the page copy, but not in the title or headline.`)
    fixes.push(`Put "${market}" in your page title and main headline — that is where local search looks.`)
  } else {
    evidence.push(`The page never mentions "${market}".`)
    fixes.push(`Mention "${market}" in the title, headline, and copy — local customers search by area.`)
  }

  if (facts.hasMapEmbed) {
    score += 2
    evidence.push('An embedded map shows where you are.')
  } else {
    evidence.push('No map on the page.')
    fixes.push('Embed a Google Map of your service area.')
  }

  if (SERVICE_AREA_PHRASE.test(facts.bodyText)) {
    score += 3
    evidence.push(`The copy describes your service area (e.g. "serving ${market} …").`)
  } else {
    evidence.push('The copy does not describe a service area.')
    fixes.push('Add a "Service area" line: which towns or neighborhoods you cover.')
  }

  return makeSection({
    key: 'local-fit',
    label: 'Local Fit',
    maxScore: 10,
    score,
    evidence,
    whyItMatters:
      'Local customers search "near me" and by city. A page that does not say where you serve cannot win them.',
    fixes,
  })
}
