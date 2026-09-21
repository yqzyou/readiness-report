import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const v = process.env.POSTGRES_URL
  return NextResponse.json({
    hasPg: typeof v === 'string' && v.length > 0,
    len: v?.length ?? 0,
  })
}
