import { describe, expect, it } from 'vitest'
import { parseFacts } from '@/lib/parse-facts'

const RICH_HTML = `<!doctype html>
<html>
<head>
  <title>Example Plumbing Services in Boston | Trusted Local Pros</title>
  <meta name="description" content="Reliable plumbing in Boston. Licensed and insured with 10 years of experience. Call now for a free quote.">
  <link rel="canonical" href="https://example.com/">
</head>
<body>
  <header>
    <h1>Trusted Plumbing Services in Boston</h1>
    <a href="tel:+16175550123">Call now</a>
  </header>
  <section>
    <h2>Our Services</h2>
    <p>We fix leaks. Licensed and insured.</p>
    <img src="/team.jpg" alt="Our team at work">
    <iframe src="https://www.google.com/maps/embed?pb=xyz"></iframe>
  </section>
  <section>
    <h2>Reviews</h2>
    <p>Read our testimonials. 123 Main Street, Boston.</p>
    <form><button type="submit">Get a free quote</button></form>
    <a href="mailto:hi@example.com">Email us</a>
    <img src="/van.png">
  </section>
</body>
</html>`

describe('parseFacts on a rich page', () => {
  const facts = parseFacts(RICH_HTML)

  it('extracts head metadata', () => {
    expect(facts.title).toBe('Example Plumbing Services in Boston | Trusted Local Pros')
    expect(facts.titleLength).toBeGreaterThan(30)
    expect(facts.metaDescription).toMatch(/Reliable plumbing/)
    expect(facts.canonical).toBe('https://example.com/')
    expect(facts.hasNoindex).toBe(false)
  })

  it('extracts headings', () => {
    expect(facts.h1s).toEqual(['Trusted Plumbing Services in Boston'])
    expect(facts.h2s).toEqual(['Our Services', 'Reviews'])
  })

  it('treats first two body blocks as above the fold', () => {
    expect(facts.aboveFoldText).toContain('Call now')
    expect(facts.aboveFoldText).not.toContain('testimonials')
  })

  it('extracts contact and CTA facts', () => {
    expect(facts.hasTelLink).toBe(true)
    expect(facts.hasMailtoLink).toBe(true)
    expect(facts.hasForm).toBe(true)
    expect(facts.ctaTexts).toContain('Call now')
    expect(facts.ctaTexts).toContain('Get a free quote')
  })

  it('extracts image and local facts', () => {
    expect(facts.imageCount).toBe(2)
    expect(facts.imagesMissingAlt).toBe(1)
    expect(facts.addressMatch).toMatch(/123 Main Street/)
    expect(facts.hasMapEmbed).toBe(true)
  })

  it('computes text volume and ratio', () => {
    expect(facts.bodyWordCount).toBeGreaterThan(20)
    expect(facts.textToCodeRatio).toBeGreaterThan(0)
    expect(facts.textToCodeRatio).toBeLessThan(1)
  })
})

describe('parseFacts on an empty page', () => {
  const facts = parseFacts('<html><head></head><body></body></html>')

  it('returns nulls and zeros without crashing', () => {
    expect(facts.title).toBeNull()
    expect(facts.metaDescription).toBeNull()
    expect(facts.h1s).toEqual([])
    expect(facts.h2s).toEqual([])
    expect(facts.aboveFoldText).toBe('')
    expect(facts.bodyWordCount).toBe(0)
    expect(facts.hasTelLink).toBe(false)
    expect(facts.imageCount).toBe(0)
    expect(facts.addressMatch).toBeNull()
    expect(facts.sentenceStartVariety).toBe(1)
  })
})

describe('noindex detection', () => {
  it('detects the noindex directive', () => {
    const facts = parseFacts(
      '<html><head><meta name="robots" content="noindex,nofollow"></head><body></body></html>',
    )
    expect(facts.hasNoindex).toBe(true)
  })
})
