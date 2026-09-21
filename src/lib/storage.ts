import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AuditReport } from './types'
import { getReportPg, saveReportPg } from './storage-postgres'

const DEFAULT_DIR = path.join(process.cwd(), 'data', 'reports')

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Backend selection: an explicit `dir` (tests, local tools) or a missing
// POSTGRES_URL falls back to the filesystem backend; production on Vercel
// resolves to Postgres so reports survive the ephemeral serverless filesystem.
function shouldUsePostgres(dir?: string): boolean {
  return !dir && Boolean(process.env.POSTGRES_URL)
}

export async function saveReport(
  report: AuditReport,
  dir: string = DEFAULT_DIR,
): Promise<void> {
  if (shouldUsePostgres(dir)) {
    await saveReportPg(report)
    return
  }
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, `${report.id}.json`)
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8')
}

export async function getReport(
  id: string,
  dir: string = DEFAULT_DIR,
): Promise<AuditReport | null> {
  if (shouldUsePostgres(dir)) {
    return getReportPg(id)
  }
  if (!UUID_PATTERN.test(id)) return null
  try {
    const raw = await fs.readFile(path.join(dir, `${id}.json`), 'utf8')
    return JSON.parse(raw) as AuditReport
  } catch {
    return null
  }
}
