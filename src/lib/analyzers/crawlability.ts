import type { Analyzer } from '../types'
import { makeSection } from './helpers'

export const analyzeCrawlability: Analyzer = (facts, _input) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (facts.title && facts.titleLength >= 30 && facts.titleLength <= 60) {
    score += 3
    evidence.push(`Title (${facts.titleLength} chars): "${facts.title}"`)
  } else if (facts.title) {
    score += 1
    evidence.push(`Title is ${facts.titleLength} chars (ideal is 30–60): "${facts.title}"`)
    fixes.push('Rewrite the page title to 30–60 characters, saying what you do and where.')
  } else {
    evidence.push('No page title found.')
    fixes.push('Add a page title (30–60 characters) describing your service and city.')
  }

  if (
    facts.metaDescription &&
    facts.metaDescriptionLength >= 70 &&
    facts.metaDescriptionLength <= 160
  ) {
    score += 3
    evidence.push(`Meta description present (${facts.metaDescriptionLength} chars).`)
  } else if (facts.metaDescription) {
    score += 1
    evidence.push(`Meta description is ${facts.metaDescriptionLength} chars (ideal is 70–160).`)
    fixes.push('Expand the meta description to 70–160 characters with your offer and city.')
  } else {
    evidence.push('No meta description found.')
    fixes.push('Add a meta description (70–160 characters) summarizing your offer.')
  }

  if (facts.h1s.length === 1) {
    score += 3
    evidence.push(`Exactly one main headline (H1): "${facts.h1s[0]}"`)
  } else if (facts.h1s.length > 1) {
    score += 1
    evidence.push(`${facts.h1s.length} main headlines (H1) found — there should be exactly one.`)
    fixes.push('Keep one H1 headline at the top; change the others to H2 subheadings.')
  } else {
    evidence.push('No main headline (H1) found.')
    fixes.push('Add one clear H1 headline stating what you offer.')
  }

  if (!facts.hasNoindex) {
    score += 2
    evidence.push('Page is indexable (no "noindex" directive).')
  } else {
    evidence.push('The page tells search engines NOT to index it (noindex directive).')
    fixes.push('Remove the noindex directive so Google can list your page.')
  }

  if (facts.bodyWordCount >= 400) {
    score += 2
    evidence.push(`Page copy: about ${facts.bodyWordCount} words.`)
  } else if (facts.bodyWordCount >= 150) {
    score += 1
    evidence.push(`Page copy is thin: about ${facts.bodyWordCount} words.`)
    fixes.push('Grow the page to 400+ words of real copy: services, areas, FAQs.')
  } else {
    evidence.push(`Page copy is very thin: about ${facts.bodyWordCount} words.`)
    fixes.push('Add real page copy (400+ words): services, service areas, FAQs.')
  }

  if (facts.canonical) {
    score += 1
    evidence.push(`Canonical URL present: ${facts.canonical}`)
  } else {
    evidence.push('No canonical URL found.')
    fixes.push('Add a canonical link tag so search engines know the official address.')
  }

  const ratioPct = (facts.textToCodeRatio * 100).toFixed(1)
  if (facts.textToCodeRatio > 0.08) {
    score += 1
    evidence.push(`Visible-text-to-code ratio ${ratioPct}% — healthy.`)
  } else {
    evidence.push(`Visible-text-to-code ratio ${ratioPct}% — the page is mostly code.`)
    fixes.push('Add more visible text relative to markup so crawlers see real content.')
  }

  return makeSection({
    key: 'crawlability',
    label: 'Crawlability & SEO Basics',
    maxScore: 15,
    score,
    evidence,
    whyItMatters:
      'Google and AI assistants read this metadata to understand and surface your business. Missing basics make you invisible in search.',
    fixes,
  })
}
