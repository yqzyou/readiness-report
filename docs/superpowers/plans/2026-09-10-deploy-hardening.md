# 部署加固实现计划（DNS rebinding 防护 + 速率限制）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 关闭 MVP 终审留档的两个公网部署闸门——fetch 前 DNS 解析后私网校验（防 rebinding），以及每 IP 滑动窗口限流（429 + Retry-After）。

**Architecture:** 两个独立组件：① `fetch-page.ts` 新增 `assertResolvesToPublic`（`dns.promises.lookup` 全记录 → 逐个过现有私网判定），在重定向循环每跳接线；② 新文件 `src/lib/rate-limit.ts` 纯函数滑动窗口（模块级 Map，惰性清理），`route.ts` 在 zod 校验前拦截。无新增依赖。

**Tech Stack:** Next.js App Router（现有）、Node 内置 `node:dns`、Vitest（现有）。

**规格:** `docs/superpowers/specs/2026-09-10-deploy-hardening-design.md`

**基线:** main 分支（spec 已提交），97/97 测试，ESLint 全绿。

---

### Task 1: 速率限制纯逻辑模块

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `tests/rate-limit.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/rate-limit.test.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/rate-limit.test.ts`
Expected: FAIL —— `Cannot find module '@/lib/rate-limit'`（或等价的模块不存在错误）

- [ ] **Step 3: 写最小实现**

创建 `src/lib/rate-limit.ts`：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/rate-limit.test.ts`
Expected: PASS（7 个用例全绿）

- [ ] **Step 5: 提交**

```bash
git add src/lib/rate-limit.ts tests/rate-limit.test.ts
git commit -m "feat: add per-IP sliding window rate limiter"
```

---

### Task 2: DNS 解析后校验函数

**Files:**
- Modify: `src/lib/fetch-page.ts`
- Modify: `tests/fetch-page.test.ts`

**背景:** 现有 `assertPublicUrl` 只查 hostname 字面量。本任务新增 `assertResolvesToPublic`：真实域名解析出的**全部** A/AAAA 记录逐个过私网判定，任一私网即抛 `ssrf`。本任务只加函数和测试，**不改 `fetchPage` 的调用链**（Task 3 再接线）。

- [ ] **Step 1: 写失败测试**

在 `tests/fetch-page.test.ts` 顶部（现有 import 之后）加顶层 dns mock 与辅助函数：

```ts
const dnsMocks = vi.hoisted(() => ({ lookup: vi.fn() }))

vi.mock('node:dns', () => ({
  promises: { lookup: dnsMocks.lookup },
}))
```

在现有 `afterEach` 块之前加 `beforeEach`（与现有 afterEach 并列）：

```ts
beforeEach(() => {
  dnsMocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  dnsMocks.lookup.mockReset()
})
```

注意：把现有 `afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })` 合并成上面这个（加一行 `dnsMocks.lookup.mockReset()`）。

更新 import 行加入新函数：

```ts
import { fetchPage, FetchPageError, assertResolvesToPublic } from '@/lib/fetch-page'
import { beforeEach } from 'vitest' // 合并进现有 vitest import: afterEach, beforeEach, describe, expect, it, vi
```

文件末尾追加新 describe：

```ts
describe('assertResolvesToPublic', () => {
  it('allows a domain that resolves to public addresses', async () => {
    dnsMocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700::6810:85e5', family: 6 },
    ])
    await expect(assertResolvesToPublic('example.com')).resolves.toBeUndefined()
  })

  it('rejects a domain resolving to a private IPv4', async () => {
    dnsMocks.lookup.mockResolvedValue([{ address: '192.168.1.1', family: 4 }])
    await expect(assertResolvesToPublic('evil.example')).rejects.toMatchObject({
      kind: 'ssrf',
    })
  })

  it('rejects a domain with mixed public and private records', async () => {
    dnsMocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ])
    await expect(assertResolvesToPublic('mixed.example')).rejects.toMatchObject({
      kind: 'ssrf',
    })
  })

  it('rejects a domain resolving to a private IPv6', async () => {
    dnsMocks.lookup.mockResolvedValue([{ address: 'fd12::1', family: 6 }])
    await expect(assertResolvesToPublic('v6.example')).rejects.toMatchObject({
      kind: 'ssrf',
    })
  })

  it('maps lookup failure to the dns error', async () => {
    dnsMocks.lookup.mockRejectedValue(new Error('ENOTFOUND'))
    await expect(assertResolvesToPublic('nope.example')).rejects.toMatchObject({
      kind: 'dns',
    })
  })

  it('maps an empty record list to the dns error', async () => {
    dnsMocks.lookup.mockResolvedValue([])
    await expect(assertResolvesToPublic('empty.example')).rejects.toMatchObject({
      kind: 'dns',
    })
  })

  it('skips DNS for dotted IPv4 literals', async () => {
    await expect(assertResolvesToPublic('8.8.8.8')).resolves.toBeUndefined()
    expect(dnsMocks.lookup).not.toHaveBeenCalled()
  })

  it('skips DNS for bracketed IPv6 literals', async () => {
    await expect(assertResolvesToPublic('[2606:4700::6810:85e5]')).resolves.toBeUndefined()
    expect(dnsMocks.lookup).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/fetch-page.test.ts`
Expected: FAIL —— import 报错 `assertResolvesToPublic` 未导出

- [ ] **Step 3: 写最小实现**

在 `src/lib/fetch-page.ts`：

顶部加 import：

```ts
import { promises as dnsPromises } from 'node:dns'
```

在 `assertPublicUrl` 函数之后加：

```ts
const DOTTED_IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

export async function assertResolvesToPublic(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '')
  if (DOTTED_IPV4.test(host) || host.includes(':')) return
  let records: Array<{ address: string; family: number }>
  try {
    records = await dnsPromises.lookup(host, { all: true })
  } catch {
    throw new FetchPageError('dns', 'Could not reach that website. Check the address and try again.')
  }
  if (records.length === 0) {
    throw new FetchPageError('dns', 'Could not reach that website. Check the address and try again.')
  }
  for (const { address, family } of records) {
    const privateV6 = isPrivateIPv6(expandIPv6(address) ?? [])
    if (family === 4 ? isPrivateIPv4(address) : privateV6) {
      throw new FetchPageError('ssrf', 'That address is not allowed. Only public websites can be checked.')
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/fetch-page.test.ts`
Expected: PASS（现有用例 + 新 8 个用例全绿。现有用例不受影响——本任务没有把新函数接进 `fetchPage`）

- [ ] **Step 5: 提交**

```bash
git add src/lib/fetch-page.ts tests/fetch-page.test.ts
git commit -m "feat: validate DNS results against private ranges before fetching"
```

---

### Task 3: fetchPage 每跳接线 DNS 校验

**Files:**
- Modify: `src/lib/fetch-page.ts:141-149`（fetchPage 循环开头）
- Modify: `tests/fetch-page.test.ts`（新增跨跳用例）

**背景:** 把 Task 2 的函数接进 `fetchPage` 的重定向循环——每跳 `assertPublicUrl`（字面量）之后 `await assertResolvesToPublic`（解析校验），防止公网站点 302 跳到解析为内网的域名。顶层 dns mock 已在 Task 2 就位（默认返回公网 IP `93.184.216.34`），现有用例继续绿。

- [ ] **Step 1: 写失败测试**

在 `tests/fetch-page.test.ts` 的 `describe('SSRF protection')` 块内追加：

```ts
  it('blocks a domain that resolves to a private address', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response('x')))
    dnsMocks.lookup.mockResolvedValue([{ address: '192.168.0.10', family: 4 }])
    await expect(fetchPage('https://rebind.example')).rejects.toMatchObject({
      kind: 'ssrf',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('blocks redirects to a domain that resolves to a private address', async () => {
    stubFetch(() =>
      Promise.resolve(Response.redirect('https://rebind-dest.example/secret', 302)),
    )
    // first hop: public; redirect target resolves private
    dnsMocks.lookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }])
    await expect(fetchPage('https://public.example')).rejects.toMatchObject({
      kind: 'ssrf',
    })
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/fetch-page.test.ts`
Expected: 新 2 个用例 FAIL（`fetchPage` 尚未调用 `assertResolvesToPublic`，mock 的私网解析被无视、请求照常发出），其余用例 PASS

- [ ] **Step 3: 写最小实现**

在 `src/lib/fetch-page.ts` 的 `fetchPage` 循环内，把：

```ts
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublicUrl(current)
```

改为：

```ts
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublicUrl(current)
    await assertResolvesToPublic(current.hostname)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/fetch-page.test.ts`
Expected: PASS（含新 2 例；现有用例靠顶层默认 mock 返回公网 IP 继续全绿）

- [ ] **Step 5: 提交**

```bash
git add src/lib/fetch-page.ts tests/fetch-page.test.ts
git commit -m "feat: check DNS resolution on every fetch hop (rebinding guard)"
```

---

### Task 4: API 路由限流接线

**Files:**
- Modify: `src/app/api/audit/route.ts:31`（POST 入口）
- Modify: `tests/api-audit.test.ts`

**背景:** `POST /api/audit` 在 zod 校验**之前**限流。现有测试同文件连续调 POST 且无 `x-forwarded-for` 头（IP 恒为 `unknown`）——6 个用例会撞限额，所以必须 mock `@/lib/rate-limit` 并默认放行。

- [ ] **Step 1: 写失败测试**

在 `tests/api-audit.test.ts` 顶部 import 区之后加模块 mock：

```ts
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))
```

import 区加：

```ts
import { checkRateLimit } from '@/lib/rate-limit'
```

mocked 声明区（`const mockedFetchPage = ...` 旁）加：

```ts
const mockedCheckRateLimit = vi.mocked(checkRateLimit)
```

现有 `beforeEach` 块内（`mockedSaveReport.mockReset()` 之后）加默认放行：

```ts
  mockedCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0 })
```

`describe('POST /api/audit')` 末尾追加用例：

```ts
  it('returns 429 with Retry-After when the rate limit is hit', async () => {
    mockedCheckRateLimit.mockReturnValueOnce({ allowed: false, retryAfterSec: 42 })
    const res = await POST(request(VALID_BODY))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('42')
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/quickly/i)
    expect(mockedFetchPage).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/api-audit.test.ts`
Expected: 新用例 FAIL（当前无 429 路径，`fetchPage` mock 返回 undefined 会导致 500 或其他行为，总之不是 429），现有用例 PASS

- [ ] **Step 3: 写最小实现**

在 `src/app/api/audit/route.ts`：

import 区加：

```ts
import { checkRateLimit } from '@/lib/rate-limit'
```

`fail` 函数之后加：

```ts
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || 'unknown'
}
```

`POST` 函数体最前面（读 body 之前）插入：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/api-audit.test.ts`
Expected: PASS（现有 6 用例 + 新 429 用例全绿）

- [ ] **Step 5: 提交**

```bash
git add src/app/api/audit/route.ts tests/api-audit.test.ts
git commit -m "feat: rate limit POST /api/audit (429 + Retry-After)"
```

---

### Task 5: README 部署注意 + 全量验证

**Files:**
- Modify: `README.md`（Notes 节）

- [ ] **Step 1: 更新 README**

在 `README.md` 的 Notes 列表（现有三条）末尾追加第四条：

```markdown
- Deployment: run as a single instance behind a reverse proxy that sets
  `X-Forwarded-For` (the rate limiter reads the first value). Rate limiting
  defaults to 5 requests/min/IP — override with `RATE_LIMIT_MAX` /
  `RATE_LIMIT_WINDOW_MS`. Every fetch hop resolves DNS first and rejects
  any private-range address (SSRF / rebinding guard).
```

- [ ] **Step 2: 停掉正在运行的 dev 服务器（若有）**

⚠️ 生产构建会覆盖 `.next` 开发缓存，dev 服务器运行时执行 `npm run build` 会导致 webpack 找不到分块（本项目踩过两次的坑）。先确认没有 dev server 在跑再 build。

Run: `lsof -ti :3000 || echo "no dev server"`
Expected: `no dev server`（若有输出 PID，先停掉那个进程）

- [ ] **Step 3: 全量验证**

Run: `npm run lint && npm test && npm run build`
Expected: ESLint 无问题；测试全绿（97 现有 + 8 rate-limit + 8 dns + 2 接线 + 1 route 429 = 116 个上下）；build 成功

- [ ] **Step 4: 提交**

```bash
git add README.md
git commit -m "docs: add deployment notes for rate limiting and DNS guard"
```

---

## 完成标准

- [ ] 全部 5 任务提交完成，`npm test` 全绿，`npm run lint` 零问题，`npm run build` 成功
- [ ] 手动冒烟：`npm run dev` 后对同一 URL 连续提交表单 6 次，第 6 次看到 "You're checking sites quickly..." 且响应头含 `Retry-After`
- [ ] 现有 97 个测试的断言零改动（新增 mock 声明除外）
