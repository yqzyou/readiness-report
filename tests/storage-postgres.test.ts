import { afterAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { getReport, saveReport } from '@/lib/storage'
import type { AuditReport } from '@/lib/types'

// Hits a real Postgres when POSTGRES_URL is set (e.g. a Neon branch).
// Skipped by default so the local/CI baseline stays hermetic.
describe.skipIf(!process.env.POSTGRES_URL)('storage (postgres backend)', () => {
  const created: string[] = []

  afterAll(async () => {
    // Rows are cheap; leave them for inspection rather than importing pool internals here.
    void created
  })

  function sampleReport(id: string): AuditReport {
    return {
      id,
      url: 'https://example.com',
      createdAt: new Date().toISOString(),
      overallScore: 87,
      verdict: 'Almost ready.',
      sections: [],
      topRisks: ['risk'],
      sevenDayPlan: ['step'],
      markdown: '# Report',
    }
  }

  it('saves and loads a report round-trip without an explicit dir', async () => {
    const id = randomUUID()
    created.push(id)
    const report = sampleReport(id)
    await saveReport(report)
    await expect(getReport(id)).resolves.toEqual(report)
  })

  it('rejects non-uuid ids without querying', async () => {
    await expect(getReport('../../etc/passwd')).resolves.toBeNull()
    await expect(getReport('not-a-uuid')).resolves.toBeNull()
  })
})
