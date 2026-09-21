import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getReport, saveReport } from '@/lib/storage'
import { getReportPg, saveReportPg } from '@/lib/storage-postgres'
import type { AuditReport } from '@/lib/types'

vi.mock('@/lib/storage-postgres', () => ({
  saveReportPg: vi.fn(async () => undefined),
  getReportPg: vi.fn(async () => null),
}))

let dir: string

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'readiness-sel-'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

function sampleReport(): AuditReport {
  return {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    url: 'https://example.com',
    createdAt: '2026-09-08T00:00:00.000Z',
    overallScore: 100,
    verdict: 'Ready to launch.',
    sections: [],
    topRisks: [],
    sevenDayPlan: [],
    markdown: '# Report',
  }
}

describe('storage backend selection', () => {
  it('routes to Postgres when POSTGRES_URL is set and no dir is given', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgresql://test:test@localhost:5432/test')
    await saveReport(sampleReport())
    expect(saveReportPg).toHaveBeenCalledTimes(1)
    expect(saveReportPg).toHaveBeenCalledWith(expect.objectContaining({ id: sampleReport().id }))

    await getReport(sampleReport().id)
    expect(getReportPg).toHaveBeenCalledWith(sampleReport().id)
  })

  it('forces the filesystem backend when an explicit dir is given, even with POSTGRES_URL set', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgresql://test:test@localhost:5432/test')
    const report = { ...sampleReport(), id: 'd1b2c3d4-e5f6-7890-abcd-ef1234567890' }
    await saveReport(report, dir)
    await expect(getReport(report.id, dir)).resolves.toEqual(report)
    expect(saveReportPg).not.toHaveBeenCalled()
    expect(getReportPg).not.toHaveBeenCalled()
  })
})
