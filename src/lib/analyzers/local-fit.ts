import type { Analyzer } from '../types'
import { hasWord, makeSection } from './helpers'

const SERVICE_AREA_PHRASE =
  /\b(serving|service area|served areas?|based in|located in|proudly serving|throughout)\b/i

const ONLINE_MARKET_PATTERN =
  /\b(worldwide|global(ly)?|online|internet|remote|everywhere|international(ly)?|anywhere|all (over )?the world)\b/i

const AUDIENCE_PATTERNS = [
  /\bfor (small |mid-|large |top )?(businesses|teams|developers|creators|agencies|startups|freelancers|enterprises|companies|shops|stores|sellers|marketers|designers|professionals|students)\b/i,
  /\b(trusted|loved|used|built) by [a-z0-9+]+( [a-z0-9+]+)?\b/i,
]

const GLOBAL_REACH_PATTERN =
  /\b(worldwide|globally|international|around the world|everywhere|multiple (languages|currencies)|\d+\+? countries)\b/i

const ONLINE_AREA_PHRASE =
  /\b(available|ships?|delivers?|serves?|works) (worldwide|globally|internationally|everywhere|anywhere|in \d+ countries?)\b/i

export function isOnlineMarket(market: string): boolean {
  return ONLINE_MARKET_PATTERN.test(market)
}

function mentionsAudience(text: string): boolean {
  return AUDIENCE_PATTERNS.some((re) => re.test(text))
}

const analyzeLocalBusiness: Analyzer = (facts, input) => {
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

const analyzeOnlineMarket: Analyzer = (facts) => {
  const headingText = [facts.title ?? '', ...facts.h1s].join(' ')
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (mentionsAudience(headingText)) {
    score += 5
    evidence.push('Your title or main headline says who the product is for — clear audience signal.')
  } else if (mentionsAudience(facts.bodyText)) {
    score += 3
    evidence.push('The page says who it serves, but not in the title or main headline.')
    fixes.push('Name your audience in the main headline — e.g. "…built for freelancers".')
  } else {
    evidence.push('The page never says who the product is for.')
    fixes.push('State your audience in the headline and copy — e.g. "for developers" or "for small teams".')
  }

  if (GLOBAL_REACH_PATTERN.test(facts.bodyText)) {
    score += 2
    evidence.push('The page shows global reach (e.g. "worldwide", "in 50 countries").')
  } else {
    evidence.push('No sign of reach — countries, languages, or "worldwide" are never mentioned.')
    fixes.push('Mention your reach — e.g. "trusted in 40+ countries" or "available worldwide".')
  }

  if (SERVICE_AREA_PHRASE.test(facts.bodyText) || ONLINE_AREA_PHRASE.test(facts.bodyText)) {
    score += 3
    evidence.push('The copy states availability — where and for whom it works.')
  } else {
    evidence.push('The copy never states availability or coverage.')
    fixes.push('Add a line about availability — e.g. "available worldwide" or who can sign up.')
  }

  return makeSection({
    key: 'local-fit',
    label: 'Local Fit',
    maxScore: 10,
    score,
    evidence,
    whyItMatters:
      'Online buyers look for two things fast: is this meant for people like me, and can I use it from where I am. Say who it serves and where it works.',
    fixes,
  })
}

export const analyzeLocalFit: Analyzer = (facts, input) =>
  isOnlineMarket(input.targetMarket)
    ? analyzeOnlineMarket(facts, input, [])
    : analyzeLocalBusiness(facts, input, [])
