import type { AuditInput, SiteFacts } from '../types'

export const BASE_INPUT: AuditInput = {
  url: 'https://example.com',
  businessType: 'plumbing',
  targetMarket: 'Boston',
  goal: 'calls',
}

export const BASE_BODY_TEXT =
  'We are a licensed and insured plumbing company proudly serving greater Boston. ' +
  'Read our customer reviews and testimonials. Our shop is at 123 Main Street. ' +
  'Our team handles repairs and installs with care. Contact us today for a visit.'

export function makeFacts(overrides: Partial<SiteFacts> = {}): SiteFacts {
  return {
    title: 'Example Plumbing Services in Boston | Trusted Local Pros',
    titleLength: 56,
    metaDescription:
      'Reliable plumbing in Boston. Licensed and insured with 10 years of experience. Call now for a free quote.',
    metaDescriptionLength: 111,
    canonical: 'https://example.com/',
    hasNoindex: false,
    h1s: ['Trusted Plumbing Services in Boston'],
    h2s: ['Our Services', 'Why Choose Us', 'Service Area'],
    aboveFoldText:
      'Trusted plumbing services in Boston. Licensed and insured with fast response. Call now for a free quote.',
    bodyText: BASE_BODY_TEXT,
    bodyWordCount: 600,
    textToCodeRatio: 0.15,
    hasTelLink: true,
    hasMailtoLink: true,
    hasForm: true,
    ctaTexts: ['Call now', 'Get a free quote'],
    imageCount: 12,
    imagesMissingAlt: 0,
    addressMatch: '123 Main Street',
    hasMapEmbed: true,
    buzzwordHits: [],
    numberHits: 3,
    sentenceStartVariety: 1,
    ...overrides,
  }
}

export function sparseFacts(): SiteFacts {
  return makeFacts({
    title: null,
    titleLength: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    canonical: null,
    hasNoindex: true,
    h1s: [],
    h2s: [],
    aboveFoldText: '',
    bodyText: 'Welcome.',
    bodyWordCount: 1,
    textToCodeRatio: 0.001,
    hasTelLink: false,
    hasMailtoLink: false,
    hasForm: false,
    ctaTexts: [],
    imageCount: 0,
    imagesMissingAlt: 0,
    addressMatch: null,
    hasMapEmbed: false,
    buzzwordHits: ['seamless', 'innovative'],
    numberHits: 0,
    sentenceStartVariety: 0.5,
  })
}
