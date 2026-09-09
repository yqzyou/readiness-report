import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/audit/route'
import { fetchPage, FetchPageError } from '@/lib/fetch-page'
import { saveReport } from '@/lib/storage'

vi.mock('@/lib/fetch-page', () => ({
  fetchPage: vi.fn(),
  FetchPageError: class FetchPageError extends Error {
    constructor(
      public kind: string,
      message: string,
    ) {
      super(message)
    }
  },
}))

vi.mock('@/lib/storage', () => ({
  saveReport: vi.fn(),
}))

const mockedFetchPage = vi.mocked(fetchPage)
const mockedSaveReport = vi.mocked(saveReport)

function request(body: unknown): Request {
  return new Request('http://localhost/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID_BODY = {
  url: 'example.com',
  businessType: 'plumbing',
  targetMarket: 'Boston',
  goal: 'calls',
}

beforeEach(() => {
  mockedSaveReport.mockReset()
})

describe('POST /api/audit', () => {
  it('runs the pipeline and returns the report id', async () => {
    mockedFetchPage.mockResolvedValue({
      url: 'https://example.com/',
      html: '<html><head><title>Example Plumbing Services in Boston | Trusted Local Pros</title></head><body><header><h1>Plumbing</h1></header></body></html>',
      statusCode: 200,
    })
    const res = await POST(request(VALID_BODY))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(mockedSaveReport).toHaveBeenCalledOnce()
  })

  it('rejects an invalid body with 400', async () => {
    const res = await POST(request({ url: 'x', goal: 'nope' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBeTruthy()
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await POST(request('{not json'))
    expect(res.status).toBe(400)
  })

  it('maps fetch errors to 4xx/422 with friendly messages', async () => {
    mockedFetchPage.mockRejectedValueOnce(
      new FetchPageError('dns', 'Could not reach that website.'),
    )
    const res = await POST(request(VALID_BODY))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toMatch(/reach/i)
  })

  it('rejects SSRF targets with 400', async () => {
    mockedFetchPage.mockRejectedValueOnce(
      new FetchPageError('ssrf', 'That address is not allowed.'),
    )
    const res = await POST(request({ ...VALID_BODY, url: 'http://localhost' }))
    expect(res.status).toBe(400)
  })

  it('returns a generic 500 on unexpected errors', async () => {
    mockedFetchPage.mockRejectedValueOnce(new Error('boom'))
    const res = await POST(request(VALID_BODY))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toMatch(/boom/)
  })
})
