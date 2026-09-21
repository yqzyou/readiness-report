import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildReport } from '@/lib/build-report'
import { fetchPage, FetchPageError, type FetchPageErrorKind } from '@/lib/fetch-page'
import { parseFacts } from '@/lib/parse-facts'
import { saveReport } from '@/lib/storage'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  url: z.string().min(3, 'Website URL is required'),
  businessType: z.string().min(2, 'Tell us what your business does'),
  targetMarket: z.string().min(2, 'Tell us where you serve customers'),
  goal: z.enum(['calls', 'bookings', 'quotes', 'sales', 'leads']),
})

const ERROR_STATUS: Record<FetchPageErrorKind, number> = {
  'invalid-url': 400,
  ssrf: 400,
  dns: 422,
  timeout: 422,
  http: 422,
  'non-html': 422,
  'too-many-redirects': 422,
}

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, data: null, error }, { status })
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || 'unknown'
}

export async function POST(request: Request) {
  const limit = checkRateLimit(clientIp(request))
  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "You're checking sites quickly — give it a minute and try again.",
      },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSec) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('Could not read the request body.', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message).join(' ')
    return fail(`Please check the form: ${messages}`, 400)
  }

  try {
    const page = await fetchPage(parsed.data.url)
    const facts = parseFacts(page.html)
    const report = buildReport(
      { ...parsed.data, url: page.url },
      facts,
      page.url,
    )
    await saveReport(report)
    return NextResponse.json({ success: true, data: { id: report.id }, error: null })
  } catch (err) {
    if (err instanceof FetchPageError) {
      return fail(err.message, ERROR_STATUS[err.kind])
    }
    console.error('audit failed', err)
    return fail('Something went wrong while checking the site. Please try again.', 500)
  }
}
