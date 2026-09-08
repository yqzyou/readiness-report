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

const INTEGER_IP_PATTERN = /^(?:\d+|0x[0-9a-f]+)$/i

function isPrivateIPv4(host: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(host)) || PRIVATE_172.test(host)
}

/**
 * Expand an IPv6 literal (without brackets) into its 8 lowercase 4-hex-digit
 * groups. Handles `::` shorthand and a trailing IPv4 part (`::ffff:1.2.3.4`).
 * Returns null when the input is not an IPv6 literal.
 */
export function expandIPv6(hostname: string): string[] | null {
  if (!hostname.includes(':')) return null
  const bare = hostname.replace(/^\[|\]$/g, '')
  const [head, tail = '', ...extra] = bare.split('::')
  if (extra.length > 0) return null

  const parsePart = (part: string): string[] => {
    if (part === '') return []
    const groups: string[] = []
    for (const piece of part.split(':')) {
      const ipv4Match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(piece)
      if (ipv4Match) {
        const bytes = ipv4Match.slice(1).map(Number)
        if (bytes.some((b) => b > 255)) return []
        groups.push(bytes[0].toString(16).padStart(2, '0') + bytes[1].toString(16).padStart(2, '0'))
        groups.push(bytes[2].toString(16).padStart(2, '0') + bytes[3].toString(16).padStart(2, '0'))
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(piece)) return []
        groups.push(piece.toLowerCase().padStart(4, '0'))
      }
    }
    return groups
  }

  const headGroups = parsePart(head)
  const tailGroups = parsePart(tail)
  if (headGroups.length === 0 && tailGroups.length === 0 && bare !== '::') return null
  const missing = 8 - headGroups.length - tailGroups.length
  if (missing < 0) return null
  const hasShorthand = bare.includes('::')
  if (!hasShorthand && missing !== 0) return null
  return [...headGroups, ...Array.from({ length: missing }, () => '0000'), ...tailGroups]
}

function isPrivateIPv6(groups: string[]): boolean {
  // ::1 in any written form
  if (groups.slice(0, 7).every((g) => g === '0000') && groups[7] === '0001') return true
  // IPv4-mapped (::ffff:a.b.c.d or ::ffff:aabb:ccdd) -> reuse IPv4 blocklist
  if (groups.slice(0, 5).every((g) => g === '0000') && groups[5] === 'ffff') {
    const ipv4 = [
      parseInt(groups[6].slice(0, 2), 16),
      parseInt(groups[6].slice(2), 16),
      parseInt(groups[7].slice(0, 2), 16),
      parseInt(groups[7].slice(2), 16),
    ].join('.')
    if (isPrivateIPv4(ipv4)) return true
  }
  // Link-local fe80::/10
  const first = parseInt(groups[0], 16)
  if (first >= 0xfe80 && first <= 0xfebf) return true
  return false
}

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
  let blocked = isPrivateIPv4(hostname) || hostname === '::1'
  if (!blocked && INTEGER_IP_PATTERN.test(hostname)) {
    throw new FetchPageError('ssrf', 'That address is not allowed. Only public websites can be checked.')
  }
  if (!blocked && hostname.includes(':')) {
    const groups = expandIPv6(hostname)
    if (groups) blocked = isPrivateIPv6(groups)
  }
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
      const isAbort =
        (err instanceof Error && err.name === 'AbortError') ||
        /abort/i.test(message) ||
        /abort/i.test(err instanceof Error ? err.name : '')
      if (isAbort) {
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
