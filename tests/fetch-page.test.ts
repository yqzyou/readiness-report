import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPage, FetchPageError } from '@/lib/fetch-page'

function stubFetch(impl: (url: unknown, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SSRF protection', () => {
  const privateTargets = [
    'http://2130706433/',
    'http://0x7f000001/',
    'http://[::ffff:127.0.0.1]/',
    'http://[0:0:0:0:0:ffff:7f00:1]/',
    'http://[0:0:0:0:0:0:0:1]/',
    'http://[fe80::1]/',
    'http://localhost:3000/admin',
    'http://127.0.0.1/',
    'https://192.168.1.1/',
    'https://172.16.0.1/',
    'https://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data',
    'https://portal.internal/',
    'https://printer.local/',
  ]

  for (const target of privateTargets) {
    it(`rejects ${target} without fetching`, async () => {
      const fetchMock = stubFetch(() => Promise.resolve(new Response('x')))
      await expect(fetchPage(target)).rejects.toMatchObject({ kind: 'ssrf' })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  }

  it('allows public IPv6 literal addresses', async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response('<html><body>hi</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    )
    const page = await fetchPage('http://[2606:4700::6810:85e5]/')
    expect(page.statusCode).toBe(200)
  })

  it('blocks redirects that lead to a private address', async () => {
    stubFetch(() =>
      Promise.resolve(Response.redirect('http://localhost:4000/secret', 302)),
    )
    await expect(fetchPage('https://example.com')).rejects.toMatchObject({
      kind: 'ssrf',
    })
  })
})

describe('URL normalization', () => {
  it('rejects non-http protocols', async () => {
    await expect(fetchPage('ftp://example.com')).rejects.toMatchObject({
      kind: 'invalid-url',
    })
  })

  it('rejects malformed URLs', async () => {
    await expect(fetchPage('not a url at all')).rejects.toMatchObject({
      kind: 'invalid-url',
    })
  })
})

describe('fetch outcomes', () => {
  it('returns html for a 200 page', async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response('<html><body>hi</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    )
    const page = await fetchPage('example.com')
    expect(page.html).toContain('<body>')
    expect(page.url).toBe('https://example.com/')
  })

  it('follows up to 3 redirects and reports the final url', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.redirect('https://example.com/final', 302)))
    fetchMock
      .mockResolvedValueOnce(Response.redirect('https://example.com/one', 302))
      .mockResolvedValueOnce(Response.redirect('https://example.com/final', 302))
      .mockResolvedValueOnce(
        new Response('<html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      )
    const page = await fetchPage('https://example.com')
    expect(page.url).toBe('https://example.com/final')
  })

  it('rejects when more than 3 redirects', async () => {
    stubFetch(() => Promise.resolve(Response.redirect('https://example.com/loop', 302)))
    await expect(fetchPage('https://example.com')).rejects.toMatchObject({
      kind: 'too-many-redirects',
    })
  })

  it('maps HTTP errors', async () => {
    stubFetch(() => Promise.resolve(new Response('nope', { status: 404 })))
    await expect(fetchPage('https://example.com/missing')).rejects.toMatchObject({
      kind: 'http',
    })
  })

  it('rejects non-HTML content types', async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response('%PDF', {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
      ),
    )
    await expect(fetchPage('https://example.com/menu.pdf')).rejects.toMatchObject({
      kind: 'non-html',
    })
  })

  it('maps network failure to dns', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')))
    await expect(fetchPage('https://does-not-resolve.example')).rejects.toMatchObject({
      kind: 'dns',
    })
  })

  it('maps abort to timeout', async () => {
    stubFetch(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('This operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )
    await expect(
      fetchPage('https://slow.example', { timeoutMs: 50 }),
    ).rejects.toMatchObject({ kind: 'timeout' })
  })
})

describe('FetchPageError', () => {
  it('carries a kind', () => {
    const err = new FetchPageError('dns', 'boom')
    expect(err.kind).toBe('dns')
    expect(err.message).toBe('boom')
  })
})
