import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getReport, saveReport } from '@/lib/storage'
import type { AuditReport } from '@/lib/types'

let dir: string

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'readiness-'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
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

describe('storage', () => {
  it('saves and loads a report round-trip', async () => {
    const report = sampleReport()
    await saveReport(report, dir)
    const loaded = await getReport(report.id, dir)
    expect(loaded).toEqual(report)
  })

  it('creates the directory if missing', async () => {
    const nested = path.join(dir, 'a', 'b')
    const report = { ...sampleReport(), id: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890' }
    await saveReport(report, nested)
    await expect(getReport(report.id, nested)).resolves.toEqual(report)
  })

  it('returns null for unknown ids', async () => {
    await expect(getReport('c1b2c3d4-e5f6-7890-abcd-ef1234567890', dir)).resolves.toBeNull()
  })

  it('rejects path-traversal ids without touching the filesystem', async () => {
    await expect(getReport('../../etc/passwd', dir)).resolves.toBeNull()
    await expect(getReport('not-a-uuid', dir)).resolves.toBeNull()
  })
})
