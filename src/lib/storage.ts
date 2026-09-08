import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AuditReport } from './types'

const DEFAULT_DIR = path.join(process.cwd(), 'data', 'reports')

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function saveReport(
  report: AuditReport,
  dir: string = DEFAULT_DIR,
): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, `${report.id}.json`)
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8')
}

export async function getReport(
  id: string,
  dir: string = DEFAULT_DIR,
): Promise<AuditReport | null> {
  if (!UUID_PATTERN.test(id)) return null
  try {
    const raw = await fs.readFile(path.join(dir, `${id}.json`), 'utf8')
    return JSON.parse(raw) as AuditReport
  } catch {
    return null
  }
}
