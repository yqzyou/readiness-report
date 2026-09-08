export type FetchPageErrorKind =
  | 'invalid-url'
  | 'ssrf'
  | 'dns'
  | 'timeout'
  | 'http'
  | 'non-html'
  | 'too-many-redirects'

export class FetchPageError extends Error {
  readonly kind: FetchPageErrorKind

  constructor(kind: FetchPageErrorKind, message: string) {
    super(message)
    this.name = 'FetchPageError'
    this.kind = kind
  }
}

const BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /\.internal$/i,
  /\.local$/i,
]

const PRIVATE_172 = /^172\.(1[6-9]|2\d|3[01])\./

const MAX_REDIRECTS = 3
const DEFAULT_TIMEOUT_MS = 10_000
const USER_AGENT = 'ReadinessReportBot/0.1'

export function normalizeUrl(raw: string): URL {
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw)
  const withScheme = hasScheme ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new FetchPageError('invalid-url', `That does not look like a valid website address: ${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchPageError('invalid-url', `Only http:// and https:// addresses are supported.`)
  }
  return url
}

export function assertPublicUrl(url: URL): void {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const blocked =
    hostname === '::1' ||
    BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(hostname)) ||
    PRIVATE_172.test(hostname)
  if (blocked) {
    throw new FetchPageError('ssrf', 'That address is not allowed. Only public websites can be checked.')
  }
}

export type FetchedPage = {
  url: string
  html: string
  statusCode: number
}

export async function fetchPage(
  rawUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<FetchedPage> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let current = normalizeUrl(rawUrl)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublicUrl(current)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/abort/i.test(message) || /abort/i.test(err instanceof Error ? err.name : '')) {
        throw new FetchPageError('timeout', 'The site took too long to respond (over 10 seconds).')
      }
      throw new FetchPageError('dns', 'Could not reach that website. Check the address and try again.')
    } finally {
      clearTimeout(timer)
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location')
      if (!location) {
        throw new FetchPageError('http', `The site returned a redirect (${res.status}) without a destination.`)
      }
      if (hop === MAX_REDIRECTS) {
        throw new FetchPageError('too-many-redirects', 'The site redirected too many times.')
      }
      current = normalizeUrl(new URL(location, current).toString())
      continue
    }

    if (!res.ok) {
      throw new FetchPageError('http', `The site responded with HTTP ${res.status}.`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType && !/html/i.test(contentType)) {
      throw new FetchPageError('non-html', 'That address is not a web page (only HTML pages are supported).')
    }

    const html = await res.text()
    return { url: current.toString(), html, statusCode: res.status }
  }

  throw new FetchPageError('too-many-redirects', 'The site redirected too many times.')
}
