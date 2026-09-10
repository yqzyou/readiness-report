# readiness-report

Is your AI-built website actually ready to get customers? Paste a URL, get a
plain-English readiness report: can it launch, run ads, do SEO, and take
customers — with a 7-day fix plan.

Built for small local businesses and the agencies that serve them.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000, enter a website URL, what the business does, where
it serves, and the site's main goal.

## How it works

```
form → POST /api/audit
  fetchPage   (timeout, redirect limits, SSRF guard)
  parseFacts  (cheerio → SiteFacts: objective facts only)
  runAnalyzers(7 rule-based dimensions, goal-aware)
  buildReport (weighted score, verdict, top risks, 7-day plan)
  storage     (data/reports/<id>.json)
→ redirect to /report/<id>
```

Scores: Crawlability 15 · Offer Clarity 15 · Conversion Path 20 · Trust
Signals 15 · Local Fit 10 · AI Template Risk 10 · Ad Readiness 15.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Run the test suite |
| `npm run test:coverage` | Coverage report (target ≥80% on `src/lib`) |
| `npm run lint` | ESLint |

## Notes

- The analyzer layer is pure functions over `SiteFacts` — designed so an LLM
  can replace or augment the rules later without touching fetch/UI.
- Storage is a JSON-file interface — swappable for SQLite later.
- Scoring thresholds (title/meta lengths, buzzword lists, sentence analysis)
  are calibrated for English-language pages; results for non-English sites
  may be misjudged.
- Deployment: run as a single instance behind a reverse proxy that sets
  `X-Forwarded-For` (the rate limiter reads the first value). Rate limiting
  defaults to 5 requests/min/IP — override with `RATE_LIMIT_MAX` /
  `RATE_LIMIT_WINDOW_MS`. Every fetch hop resolves DNS first and rejects
  any private-range address (SSRF / rebinding guard).
- Rate-limit counters live in memory only: they reset on restart, and
  requests without an `X-Forwarded-For` header share a single
  "unknown" bucket.
