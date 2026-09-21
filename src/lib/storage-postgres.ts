import { Pool } from 'pg'
import type { AuditReport } from './types'

// Same contract as the fs backend's guard; kept local to avoid a circular import.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Single pooled connection: each serverless instance owns one connection so a
// burst of cold starts cannot exhaust the Neon free-tier connection limit.
const globalForPg = globalThis as unknown as { pgPool?: Pool }

function getPool(): Pool {
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      max: 1,
      ssl: { rejectUnauthorized: false },
    })
  }
  return globalForPg.pgPool
}

export async function saveReportPg(report: AuditReport): Promise<void> {
  await getPool().query(
    `INSERT INTO reports (id, data, created_at)
     VALUES ($1::uuid, $2::jsonb, $3::timestamptz)
     ON CONFLICT (id) DO UPDATE
       SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`,
    [report.id, JSON.stringify(report), report.createdAt],
  )
}

export async function getReportPg(id: string): Promise<AuditReport | null> {
  if (!UUID_PATTERN.test(id)) return null
  try {
    const result = await getPool().query<{ data: AuditReport }>(
      'SELECT data FROM reports WHERE id = $1::uuid',
      [id],
    )
    const row = result.rows[0]
    return row ? row.data : null
  } catch {
    return null
  }
}
