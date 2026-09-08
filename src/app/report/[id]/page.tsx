import { notFound } from 'next/navigation'
import ReportActions from '@/components/report/ReportActions'
import { getReport } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await getReport(id)
  if (!report) notFound()

  const checkedAt = new Date(report.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <main className="report">
      <header className="report-header">
        <p className="kicker">Readiness report</p>
        <div className="score-block">
          <div
            className={`score-ring ${
              report.overallScore >= 80
                ? 'good'
                : report.overallScore >= 50
                  ? 'warning'
                  : 'critical'
            }`}
            role="img"
            aria-label={`Overall score ${report.overallScore} out of 100`}
          >
            <span className="score-number">{report.overallScore}</span>
            <span className="score-total">/ 100</span>
          </div>
          <div>
            <h1>{report.verdict}</h1>
            <p className="report-meta">
              {report.url} · checked {checkedAt}
            </p>
          </div>
        </div>
        <ReportActions markdown={report.markdown} id={report.id} />
      </header>

      {report.topRisks.length > 0 && (
        <section className="risks" aria-labelledby="top-risks">
          <h2 id="top-risks">Top risks</h2>
          <ol>
            {report.topRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="sections" aria-labelledby="scorecard">
        <h2 id="scorecard">Scorecard</h2>
        {report.sections.map((section) => (
          <article key={section.key} className={`section-card ${section.status}`}>
            <header>
              <h3>{section.label}</h3>
              <span className="section-score">
                {section.score} / {section.maxScore}
              </span>
            </header>
            <p className="section-status">{section.status}</p>
            <p className="why">{section.whyItMatters}</p>
            {section.evidence.length > 0 && (
              <div className="evidence">
                <h4>What we found</h4>
                <ul>
                  {section.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {section.fixes.length > 0 && (
              <div className="fixes">
                <h4>Fixes</h4>
                <ul>
                  {section.fixes.map((fix) => (
                    <li key={fix}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="plan" aria-labelledby="seven-day-plan">
        <h2 id="seven-day-plan">Your 7-day plan</h2>
        <ol className="plan-list">
          {report.sevenDayPlan.map((step, index) => (
            <li key={step}>
              <span className="day">Day {index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
