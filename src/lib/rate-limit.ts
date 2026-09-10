export type RateLimitResult = {
  allowed: boolean
  retryAfterSec: number
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const RATE_LIMIT_WINDOW_MS = envNumber('RATE_LIMIT_WINDOW_MS', 60_000)
export const RATE_LIMIT_MAX = envNumber('RATE_LIMIT_MAX', 5)
const MAX_TRACKED_IPS = 10_000

const hits = new Map<string, number[]>()

export function checkRateLimit(
  ip: string,
  now: number = Date.now(),
  windowMs: number = RATE_LIMIT_WINDOW_MS,
  max: number = RATE_LIMIT_MAX,
): RateLimitResult {
  const stamps = (hits.get(ip) ?? []).filter((t) => t > now - windowMs)
  if (stamps.length >= max) {
    const retryAfterMs = stamps[0] + windowMs - now
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    }
  }
  stamps.push(now)
  if (hits.size > MAX_TRACKED_IPS) {
    for (const [key, stamps_] of hits) {
      const fresh = stamps_.filter((t) => t > now - windowMs)
      if (fresh.length === 0) hits.delete(key)
      else hits.set(key, fresh)
    }
  }
  hits.set(ip, stamps)
  return { allowed: true, retryAfterSec: 0 }
}

export function resetRateLimit(): void {
  hits.clear()
}
