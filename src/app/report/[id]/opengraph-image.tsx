import { ImageResponse } from 'next/og'
import { getReport } from '@/lib/storage'

export const alt = 'Website readiness score card'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a'
  if (score >= 50) return '#d97706'
  return '#dc2626'
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await getReport(id)
  const score = report?.overallScore ?? 0
  const url = report?.url ?? 'unknown site'
  const verdict = report?.verdict ?? 'Report unavailable'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 32, letterSpacing: 4, color: '#94a3b8' }}>
          READINESS REPORT
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 220, fontWeight: 700, lineHeight: 1, color: scoreColor(score) }}>
            {score}
          </div>
          <div style={{ display: 'flex', fontSize: 56, color: '#64748b', paddingBottom: 24 }}>/ 100</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 600 }}>{url}</div>
          <div style={{ display: 'flex', fontSize: 30, color: '#94a3b8' }}>{verdict}</div>
        </div>
      </div>
    ),
    size,
  )
}
