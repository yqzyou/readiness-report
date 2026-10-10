import Link from 'next/link'
import AuditForm from '@/components/AuditForm'
import { countReports } from '@/lib/storage'

// Example.com report generated on 2026-10-10; lives in Postgres on Vercel.
const SAMPLE_REPORT_ID = 'b8dbd0c3-5054-43a1-bd97-61b350824d53'

// ISR: the counter refreshes every 5 minutes; the page itself stays static.
export const revalidate = 300

export default async function HomePage() {
  const checkedCount = await countReports()

  return (
    <main className="home">
      <section className="hero">
        <p className="kicker">For AI-built websites</p>
        <h1>
          Is your AI-built website actually ready to get customers?
        </h1>
        <p className="lede">
          You built it with AI, Wix, or a template. Now find out — before you spend on
          ads — whether it can rank, convert, and win trust. A plain-English readiness
          report in seconds.
        </p>
      </section>

      <AuditForm />

      <p className="proof">
        {checkedCount !== null && checkedCount > 0 && (
          <>
            <strong>{checkedCount}</strong> sites checked so far ·{' '}
          </>
        )}
        <Link href={`/report/${SAMPLE_REPORT_ID}`}>See a sample report →</Link>
      </p>

      <section className="how" aria-labelledby="what-we-check">
        <h2 id="what-we-check">What we check</h2>
        <ul>
          <li>
            <strong>Crawlability</strong> — can Google and AI assistants even read it?
          </li>
          <li>
            <strong>Offer clarity</strong> — does the first screen say what you do, for whom, where?
          </li>
          <li>
            <strong>Conversion path</strong> — is there one clear next step for your goal?
          </li>
          <li>
            <strong>Trust signals</strong> — reviews, address, real photos?
          </li>
          <li>
            <strong>Local fit</strong> — does it read like a local business?
          </li>
          <li>
            <strong>AI template risk</strong> — does it sound like everyone else&apos;s AI site?
          </li>
          <li>
            <strong>Ad readiness</strong> — safe to point paid traffic at it?
          </li>
        </ul>
      </section>
    </main>
  )
}
