import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, resetRateLimit, RATE_LIMIT_MAX } from '@/lib/rate-limit'

const T0 = 1_700_000_000_000

beforeEach(() => {
  resetRateLimit()
})

describe('checkRateLimit', () => {
  it('allows up to the max requests inside the window', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit('1.1.1.1', T0 + i * 1000).allowed).toBe(true)
    }
  })

  it('blocks the request after the max inside the window', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('1.1.1.1', T0 + i * 1000)
    }
    const result = checkRateLimit('1.1.1.1', T0 + 10_000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSec).toBeGreaterThan(0)
  })

  it('reports seconds until the oldest hit leaves the window', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('1.1.1.1', T0 + i * 1000)
    }
    // oldest hit at T0, window 60s -> unbans at T0+60_000; at T0+45_000 -> 15s left
    expect(checkRateLimit('1.1.1.1', T0 + 45_000).retryAfterSec).toBe(15)
  })

  it('allows again once the window slides past old hits', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('1.1.1.1', T0 + i * 1000)
    }
    expect(checkRateLimit('1.1.1.1', T0 + 61_000).allowed).toBe(true)
  })

  it('tracks ips independently', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('1.1.1.1', T0)
    }
    expect(checkRateLimit('2.2.2.2', T0).allowed).toBe(true)
  })

  it('evicts stale entries when the map exceeds the cap', () => {
    for (let i = 0; i < 10_001; i++) {
      const ip = `10.${Math.floor(i / 65536) % 256}.${Math.floor(i / 256) % 256}.${i % 256}`
      checkRateLimit(ip, T0)
    }
    // all T0 hits are stale at T0+120_000; the cap cleanup must wipe them
    // without misbehaving, and a fresh ip must still be allowed
    expect(checkRateLimit('9.9.9.9', T0 + 120_000).allowed).toBe(true)
  })

  it('honors RATE_LIMIT_MAX from the environment', async () => {
    vi.resetModules()
    vi.stubEnv('RATE_LIMIT_MAX', '2')
    try {
      const mod = await import('@/lib/rate-limit')
      mod.resetRateLimit()
      expect(mod.checkRateLimit('1.1.1.1', T0).allowed).toBe(true)
      expect(mod.checkRateLimit('1.1.1.1', T0 + 1_000).allowed).toBe(true)
      expect(mod.checkRateLimit('1.1.1.1', T0 + 2_000).allowed).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
