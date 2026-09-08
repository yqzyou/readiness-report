import * as cheerio from 'cheerio'
import type { SiteFacts } from './types'

export const BUZZWORDS = [
  'cutting-edge',
  'state-of-the-art',
  'innovative',
  'seamless',
  'seamlessly',
  'revolutionary',
  'world-class',
  'best-in-class',
  'next-generation',
  'game-changing',
  'unparalleled',
  'empower',
  'elevate',
  'unlock',
  'transform',
  'redefine',
  'tailored',
  'trusted partner',
  'one-stop shop',
]

const ADDRESS_PATTERN =
  /\b\d{1,5}\s+[A-Z][A-Za-z.]+\s(Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Way|Court|Ct\.?|Square|Sq\.?|Terrace|Ter\.?)\b/

const NUMBER_SIGNAL =
  /\b\d+(\.\d+)?\s*(%|percent|years?|yrs?|hours?|customers?|clients?|projects?|jobs?|reviews?|satisfied)\b/gi

const BLOCK_SELECTORS = 'header, section, main, div, nav'

function squish(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function parseFacts(html: string): SiteFacts {
  const $ = cheerio.load(html)

  const title = squish($('head title').first().text()) || null
  const metaDescription =
    squish($('meta[name="description"]').attr('content') ?? '') || null
  const metaRobots = $('meta[name="robots"]').attr('content') ?? ''

  const h1s = $('h1')
    .map((_, el) => squish($(el).text()))
    .get()
    .filter(Boolean)
  const h2s = $('h2')
    .map((_, el) => squish($(el).text()))
    .get()
    .filter(Boolean)

  const aboveFoldText = squish($('body').children(BLOCK_SELECTORS).slice(0, 2).text())
  const bodyText = squish($('body').text())

  const bodyWordCount = bodyText ? bodyText.split(' ').filter(Boolean).length : 0
  const textToCodeRatio = bodyText.length / Math.max(html.length, 1)

  let hasTelLink = false
  let hasMailtoLink = false
  $('a').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (href.startsWith('tel:')) hasTelLink = true
    if (href.startsWith('mailto:')) hasMailtoLink = true
  })

  const hasForm = $('form').length > 0

  const ctaTexts = $('a, button, input[type="submit"]')
    .map((_, el) => {
      const node = el as unknown as { tagName?: string }
      const tag = (node.tagName ?? '').toLowerCase()
      if (tag === 'input') return squish($(el).attr('value') ?? '')
      return squish($(el).text())
    })
    .get()
    .filter((t) => t.length > 0 && t.length <= 40)

  const images = $('img')
  const imageCount = images.length
  let imagesMissingAlt = 0
  images.each((_, el) => {
    const alt = $(el).attr('alt')
    if (!alt || !alt.trim()) imagesMissingAlt += 1
  })

  const addressMatch = bodyText.match(ADDRESS_PATTERN)

  const hasMapEmbed =
    $(
      'iframe[src*="google.com/maps"], iframe[src*="maps.google"], iframe[src*="goo.gl/maps"]',
    ).length > 0

  const lowerBody = bodyText.toLowerCase()
  const buzzwordHits = BUZZWORDS.filter((w) => lowerBody.includes(w))

  const numberHits = (bodyText.match(NUMBER_SIGNAL) ?? []).length

  const sentences = bodyText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
  const starts = sentences.map((s) => s.split(' ')[0].toLowerCase())
  const sentenceStartVariety =
    starts.length > 0 ? new Set(starts).size / starts.length : 1

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical: $('link[rel="canonical"]').attr('href') ?? null,
    hasNoindex: /noindex/i.test(metaRobots),
    h1s,
    h2s,
    aboveFoldText,
    bodyText,
    bodyWordCount,
    textToCodeRatio,
    hasTelLink,
    hasMailtoLink,
    hasForm,
    ctaTexts,
    imageCount,
    imagesMissingAlt,
    addressMatch: addressMatch?.[0] ?? null,
    hasMapEmbed,
    buzzwordHits,
    numberHits,
    sentenceStartVariety,
  }
}
