# readiness-report MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 readiness-report MVP——用户输入网站 URL + 行业 + 地区 + 目标，系统抓取页面、提取事实、7 维度规则评分，生成可查看/可复制/可下载的英文获客准备度体检报告。

**Architecture:** Next.js App Router 单体（UI 层 + API 层 + 纯函数核心域层）。核心数据流：`fetchPage → parseFacts → runAnalyzers → buildReport → renderMarkdown → storage.save`。事实与判断分离：`SiteFacts` 只含客观事实，7 个 analyzer 是纯函数 `(facts, input, prior) => AuditSection`，是未来替换 LLM 的接缝。

**Tech Stack:** Next.js 15 (App Router) / React 19 / TypeScript 5 (strict) / cheerio 1.0（HTML 解析）/ zod 3（校验）/ vitest 3（node 环境 + @vitest/coverage-v8）/ JSON 文件存储（`data/reports/<id>.json`）。无 Tailwind——手写 CSS 设计令牌。规格文档：`docs/superpowers/specs/2026-09-08-readiness-report-mvp-design.md`。

**重要约定：**
- 所有源码在 `src/`，路径别名 `@/* → src/*`（tsconfig 与 vitest 都配置）
- 每个任务：先写测试（RED）→ 运行确认失败 → 写实现（GREEN）→ 运行确认通过 → commit
- 运行单个测试文件：`npx vitest run <file>`；全部测试：`npm test`
- 覆盖率只统计 `src/lib/**`（核心域层），任务 18 统一验收 ≥80%
- 目录 `data/reports/` 已被 .gitignore 排除，storage 运行时用 `mkdir -p` 自建
- 界面语言：英文；报告措辞写给老板看（plain English），不是 Lighthouse 式报错

---

## 文件结构总览

| 文件 | 职责 |
|---|---|
| `package.json` / `tsconfig.json` / `next.config.ts` / `eslint.config.mjs` / `vitest.config.ts` | 脚手架配置 |
| `src/app/layout.tsx` / `src/app/globals.css` | 根布局 + 设计令牌 |
| `src/app/page.tsx` | 首页：营销文案 + 表单 |
| `src/app/report/[id]/page.tsx` | 报告页（server component，读 storage） |
| `src/app/api/audit/route.ts` | POST /api/audit：校验 → 管线 → 存储，统一信封 |
| `src/components/AuditForm.tsx` | 客户端表单（提交 → 跳转报告页） |
| `src/components/report/ReportActions.tsx` | Copy Markdown / Download 按钮 |
| `src/lib/types.ts` | 全部核心类型 |
| `src/lib/status.ts` | 得分率 → good/warning/critical |
| `src/lib/fetch-page.ts` | 抓取：超时/重定向/SSRF 防护/错误分类 |
| `src/lib/parse-facts.ts` | cheerio → SiteFacts（只陈述事实） |
| `src/lib/analyzers/helpers.ts` | makeSection / hasWord / escapeRegExp |
| `src/lib/analyzers/{crawlability,offer-clarity,conversion-path,trust-signals,local-fit,ai-template-risk,ad-readiness}.ts` | 7 个评分器，单一规则权威源 |
| `src/lib/analyzers/index.ts` | ANALYZERS 数组 + runAnalyzers |
| `src/lib/build-report.ts` | 加权总分 / verdict / topRisks / 7 天计划 |
| `src/lib/render-markdown.ts` | 报告 → Markdown |
| `src/lib/storage.ts` | saveReport / getReport（JSON 文件） |
| `src/lib/testing/make-facts.ts` | 测试 fixtures：makeFacts + BASE_INPUT |
| `tests/*.test.ts` | 单测 + API 集成测试 |

## 任务总览

1. 脚手架（手写配置，npm install，build 冒烟）
2. types + status
3. fetch-page（SSRF/超时/重定向/错误分类）
4. parse-facts
5. 测试 fixtures + helpers + crawlability
6. offer-clarity
7. conversion-path（goal-aware）
8. trust-signals
9. local-fit
10. ai-template-risk
11. ad-readiness + runAnalyzers
12. render-markdown
13. build-report
14. storage
15. API 路由（集成测试）
16. 首页 + AuditForm + 完整样式
17. 报告页 + ReportActions
18. 收尾：README / 全量测试 / 覆盖率 / build / 真实浏览器冒烟

---

### Task 1: 项目脚手架

目录非空（已有 .git/.gitignore/docs），不能用 create-next-app，全部手写配置。

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "readiness-report",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.3.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 写 next.config.ts**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 4: 写 eslint.config.mjs**

```js
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'coverage/**', 'data/**'] },
]

export default eslintConfig
```

- [ ] **Step 5: 写 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/testing/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 6: 写 src/app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Readiness Report — Is your AI-built website ready for customers?',
  description:
    'A plain-English readiness check for AI-built websites: can it launch, run ads, and take customers?',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: 写占位 src/app/page.tsx（Task 16 替换）**

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Readiness Report</h1>
    </main>
  )
}
```

- [ ] **Step 8: 写最小 src/app/globals.css（Task 16 替换）**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 9: 安装依赖**

Run: `npm install`
Expected: 依赖安装成功，无 peer 冲突致命错误。

- [ ] **Step 10: build 冒烟（同时生成 next-env.d.ts）**

Run: `npm run build`
Expected: 构建成功，生成 `.next/` 与 `next-env.d.ts`。

- [ ] **Step 11: dev 冒烟**

Run: `npm run dev`（后台启动后 curl http://localhost:3000，确认 200 与 "Readiness Report"，然后停掉）

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts src/ next-env.d.ts
git commit -m "chore: scaffold Next.js app with vitest, cheerio, zod"
```

---

### Task 2: 核心类型 + status 阈值

**Files:**
- Create: `src/lib/types.ts`, `src/lib/status.ts`
- Test: `tests/status.test.ts`

- [ ] **Step 1: 写失败测试 tests/status.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { sectionStatus } from '@/lib/status'

describe('sectionStatus', () => {
  it('returns good at ratio >= 0.8', () => {
    expect(sectionStatus(80, 100)).toBe('good')
    expect(sectionStatus(4, 5)).toBe('good')
  })

  it('returns warning for 0.5 <= ratio < 0.8', () => {
    expect(sectionStatus(50, 100)).toBe('warning')
    expect(sectionStatus(79, 100)).toBe('warning')
  })

  it('returns critical below 0.5', () => {
    expect(sectionStatus(49, 100)).toBe('critical')
    expect(sectionStatus(0, 15)).toBe('critical')
  })

  it('never divides by zero', () => {
    expect(sectionStatus(0, 0)).toBe('good')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/status.test.ts`
Expected: FAIL（无法解析 `@/lib/status`）。

- [ ] **Step 3: 写 src/lib/types.ts**

```ts
export type Goal = 'calls' | 'bookings' | 'quotes' | 'sales' | 'leads'

export type AuditInput = {
  url: string
  businessType: string
  targetMarket: string
  goal: Goal
}

export type SectionStatus = 'good' | 'warning' | 'critical'

export type AuditSection = {
  key: string
  label: string
  score: number
  maxScore: number
  status: SectionStatus
  evidence: string[]
  whyItMatters: string
  fixes: string[]
}

export type AuditReport = {
  id: string
  url: string
  createdAt: string
  overallScore: number
  verdict: string
  sections: AuditSection[]
  topRisks: string[]
  sevenDayPlan: string[]
  markdown: string
}

export type ReportData = Omit<AuditReport, 'markdown'>

export type SiteFacts = {
  title: string | null
  titleLength: number
  metaDescription: string | null
  metaDescriptionLength: number
  canonical: string | null
  hasNoindex: boolean
  h1s: string[]
  h2s: string[]
  aboveFoldText: string
  bodyText: string
  bodyWordCount: number
  textToCodeRatio: number
  hasTelLink: boolean
  hasMailtoLink: boolean
  hasForm: boolean
  ctaTexts: string[]
  imageCount: number
  imagesMissingAlt: number
  addressMatch: string | null
  hasMapEmbed: boolean
  buzzwordHits: string[]
  numberHits: number
  sentenceStartVariety: number
}

export type Analyzer = (
  facts: SiteFacts,
  input: AuditInput,
  prior: AuditSection[],
) => AuditSection
```

- [ ] **Step 4: 写 src/lib/status.ts**

```ts
import type { SectionStatus } from './types'

export function sectionStatus(score: number, maxScore: number): SectionStatus {
  if (maxScore <= 0) return 'good'
  const ratio = score / maxScore
  if (ratio >= 0.8) return 'good'
  if (ratio >= 0.5) return 'warning'
  return 'critical'
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/status.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/status.ts tests/status.test.ts
git commit -m "feat: add core types and section status thresholds"
```

---

### Task 3: fetch-page（超时 / 重定向 / SSRF 防护 / 错误分类）

规格 §8：SSRF 防护是必须项——拒绝私网 IP（RFC 1918）、loopback、链路本地（含 169.254.169.254）、`.internal`/`.local`；只允许 http/https；最多 3 次重定向；10s 超时；非 HTML 报错。

**Files:**
- Create: `src/lib/fetch-page.ts`
- Test: `tests/fetch-page.test.ts`

- [ ] **Step 1: 写失败测试 tests/fetch-page.test.ts**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPage, FetchPageError } from '@/lib/fetch-page'

function stubFetch(impl: (...args: unknown[]) => Promise<Response>) {
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/fetch-page.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 src/lib/fetch-page.ts**

```ts
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
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/fetch-page.test.ts`
Expected: PASS（全部用例，约 14 个）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetch-page.ts tests/fetch-page.test.ts
git commit -m "feat: add page fetcher with SSRF guard, timeout, redirect limits"
```

---

### Task 4: parse-facts（cheerio → SiteFacts）

规格 §6：只陈述事实不下判断。首屏定义：`<body>` 直接子元素中前 2 个区块级元素（header/section/main/div/nav）内的文本。

**Files:**
- Create: `src/lib/parse-facts.ts`
- Test: `tests/parse-facts.test.ts`

- [ ] **Step 1: 写失败测试 tests/parse-facts.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { parseFacts } from '@/lib/parse-facts'

const RICH_HTML = `<!doctype html>
<html>
<head>
  <title>Example Plumbing Services in Boston | Trusted Local Pros</title>
  <meta name="description" content="Reliable plumbing in Boston. Licensed and insured with 10 years of experience. Call now for a free quote.">
  <link rel="canonical" href="https://example.com/">
</head>
<body>
  <header>
    <h1>Trusted Plumbing Services in Boston</h1>
    <a href="tel:+16175550123">Call now</a>
  </header>
  <section>
    <h2>Our Services</h2>
    <p>We fix leaks. Licensed and insured.</p>
    <img src="/team.jpg" alt="Our team at work">
    <iframe src="https://www.google.com/maps/embed?pb=xyz"></iframe>
  </section>
  <section>
    <h2>Reviews</h2>
    <p>Read our testimonials. 123 Main Street, Boston.</p>
    <form><button type="submit">Get a free quote</button></form>
    <a href="mailto:hi@example.com">Email us</a>
    <img src="/van.png">
  </section>
</body>
</html>`

describe('parseFacts on a rich page', () => {
  const facts = parseFacts(RICH_HTML)

  it('extracts head metadata', () => {
    expect(facts.title).toBe('Example Plumbing Services in Boston | Trusted Local Pros')
    expect(facts.titleLength).toBeGreaterThan(30)
    expect(facts.metaDescription).toMatch(/Reliable plumbing/)
    expect(facts.canonical).toBe('https://example.com/')
    expect(facts.hasNoindex).toBe(false)
  })

  it('extracts headings', () => {
    expect(facts.h1s).toEqual(['Trusted Plumbing Services in Boston'])
    expect(facts.h2s).toEqual(['Our Services', 'Reviews'])
  })

  it('treats first two body blocks as above the fold', () => {
    expect(facts.aboveFoldText).toContain('Call now')
    expect(facts.aboveFoldText).not.toContain('testimonials')
  })

  it('extracts contact and CTA facts', () => {
    expect(facts.hasTelLink).toBe(true)
    expect(facts.hasMailtoLink).toBe(true)
    expect(facts.hasForm).toBe(true)
    expect(facts.ctaTexts).toContain('Call now')
    expect(facts.ctaTexts).toContain('Get a free quote')
  })

  it('extracts image and local facts', () => {
    expect(facts.imageCount).toBe(2)
    expect(facts.imagesMissingAlt).toBe(1)
    expect(facts.addressMatch).toMatch(/123 Main Street/)
    expect(facts.hasMapEmbed).toBe(true)
  })

  it('computes text volume and ratio', () => {
    expect(facts.bodyWordCount).toBeGreaterThan(20)
    expect(facts.textToCodeRatio).toBeGreaterThan(0)
    expect(facts.textToCodeRatio).toBeLessThan(1)
  })
})

describe('parseFacts on an empty page', () => {
  const facts = parseFacts('<html><head></head><body></body></html>')

  it('returns nulls and zeros without crashing', () => {
    expect(facts.title).toBeNull()
    expect(facts.metaDescription).toBeNull()
    expect(facts.h1s).toEqual([])
    expect(facts.h2s).toEqual([])
    expect(facts.aboveFoldText).toBe('')
    expect(facts.bodyWordCount).toBe(0)
    expect(facts.hasTelLink).toBe(false)
    expect(facts.imageCount).toBe(0)
    expect(facts.addressMatch).toBeNull()
    expect(facts.sentenceStartVariety).toBe(1)
  })
})

describe('noindex detection', () => {
  it('detects the noindex directive', () => {
    const facts = parseFacts(
      '<html><head><meta name="robots" content="noindex,nofollow"></head><body></body></html>',
    )
    expect(facts.hasNoindex).toBe(true)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/parse-facts.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 src/lib/parse-facts.ts**

```ts
import * as cheerio from 'cheerio'
import type { SiteFacts } from './types'

export const BUZZWORDS = [
  'cutting-edge',
  'state-of-the-art',
  'innovative',
  'seamless',
  'seamlessly',
  'revolutionary',
  'world-class',
  'best-in-class',
  'next-generation',
  'game-changing',
  'unparalleled',
  'empower',
  'elevate',
  'unlock',
  'transform',
  'redefine',
  'tailored',
  'trusted partner',
  'one-stop shop',
]

const ADDRESS_PATTERN =
  /\b\d{1,5}\s+[A-Z][A-Za-z.]+\s(Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Way|Court|Ct\.?|Square|Sq\.?|Terrace|Ter\.?)\b/

const NUMBER_SIGNAL =
  /\b\d+(\.\d+)?\s*(%|percent|years?|yrs?|hours?|customers?|clients?|projects?|jobs?|reviews?|satisfied)\b/gi

const BLOCK_SELECTORS = 'header, section, main, div, nav'

function squish(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function parseFacts(html: string): SiteFacts {
  const $ = cheerio.load(html)

  const title = squish($('head title').first().text()) || null
  const metaDescription =
    squish($('meta[name="description"]').attr('content') ?? '') || null
  const metaRobots = $('meta[name="robots"]').attr('content') ?? ''

  const h1s = $('h1')
    .map((_, el) => squish($(el).text()))
    .get()
    .filter(Boolean)
  const h2s = $('h2')
    .map((_, el) => squish($(el).text()))
    .get()
    .filter(Boolean)

  const aboveFoldText = squish($('body').children(BLOCK_SELECTORS).slice(0, 2).text())
  const bodyText = squish($('body').text())

  const bodyWordCount = bodyText ? bodyText.split(' ').filter(Boolean).length : 0
  const textToCodeRatio = bodyText.length / Math.max(html.length, 1)

  let hasTelLink = false
  let hasMailtoLink = false
  $('a').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (href.startsWith('tel:')) hasTelLink = true
    if (href.startsWith('mailto:')) hasMailtoLink = true
  })

  const hasForm = $('form').length > 0

  const ctaTexts = $('a, button, input[type="submit"]')
    .map((_, el) => {
      const node = el as unknown as { tagName?: string }
      const tag = (node.tagName ?? '').toLowerCase()
      if (tag === 'input') return squish($(el).attr('value') ?? '')
      return squish($(el).text())
    })
    .get()
    .filter((t) => t.length > 0 && t.length <= 40)

  const images = $('img')
  const imageCount = images.length
  let imagesMissingAlt = 0
  images.each((_, el) => {
    const alt = $(el).attr('alt')
    if (!alt || !alt.trim()) imagesMissingAlt += 1
  })

  const addressMatch = bodyText.match(ADDRESS_PATTERN)

  const hasMapEmbed =
    $(
      'iframe[src*="google.com/maps"], iframe[src*="maps.google"], iframe[src*="goo.gl/maps"]',
    ).length > 0

  const lowerBody = bodyText.toLowerCase()
  const buzzwordHits = BUZZWORDS.filter((w) => lowerBody.includes(w))

  const numberHits = (bodyText.match(NUMBER_SIGNAL) ?? []).length

  const sentences = bodyText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
  const starts = sentences.map((s) => s.split(' ')[0].toLowerCase())
  const sentenceStartVariety =
    starts.length > 0 ? new Set(starts).size / starts.length : 1

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical: $('link[rel="canonical"]').attr('href') ?? null,
    hasNoindex: /noindex/i.test(metaRobots),
    h1s,
    h2s,
    aboveFoldText,
    bodyText,
    bodyWordCount,
    textToCodeRatio,
    hasTelLink,
    hasMailtoLink,
    hasForm,
    ctaTexts,
    imageCount,
    imagesMissingAlt,
    addressMatch: addressMatch?.[0] ?? null,
    hasMapEmbed,
    buzzwordHits,
    numberHits,
    sentenceStartVariety,
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/parse-facts.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/parse-facts.ts tests/parse-facts.test.ts
git commit -m "feat: extract SiteFacts from HTML with cheerio"
```

---

### Task 5: 测试 fixtures + analyzer helpers + crawlability

**Files:**
- Create: `src/lib/testing/make-facts.ts`, `src/lib/analyzers/helpers.ts`, `src/lib/analyzers/crawlability.ts`
- Test: `tests/crawlability.test.ts`

评分表（合计 15）：title 3 / meta description 3 / H1 唯一 3 / 无 noindex 2 / 正文词量 2（≥400 满分，≥150 半分）/ canonical 1 / 正文代码比 1（>0.08 满分）。

- [ ] **Step 1: 写 src/lib/testing/make-facts.ts（fixtures 无需 TDD，随首个 analyzer 测试验证）**

```ts
import type { AuditInput, SiteFacts } from '../types'

export const BASE_INPUT: AuditInput = {
  url: 'https://example.com',
  businessType: 'plumbing',
  targetMarket: 'Boston',
  goal: 'calls',
}

export const BASE_BODY_TEXT =
  'We are a licensed and insured plumbing company proudly serving greater Boston. ' +
  'Read our customer reviews and testimonials. Our shop is at 123 Main Street. ' +
  'Our team handles repairs and installs with care. Contact us today for a visit.'

export function makeFacts(overrides: Partial<SiteFacts> = {}): SiteFacts {
  return {
    title: 'Example Plumbing Services in Boston | Trusted Local Pros',
    titleLength: 56,
    metaDescription:
      'Reliable plumbing in Boston. Licensed and insured with 10 years of experience. Call now for a free quote.',
    metaDescriptionLength: 111,
    canonical: 'https://example.com/',
    hasNoindex: false,
    h1s: ['Trusted Plumbing Services in Boston'],
    h2s: ['Our Services', 'Why Choose Us', 'Service Area'],
    aboveFoldText:
      'Trusted plumbing services in Boston. Licensed and insured. Call now for a free quote.',
    bodyText: BASE_BODY_TEXT,
    bodyWordCount: 600,
    textToCodeRatio: 0.15,
    hasTelLink: true,
    hasMailtoLink: true,
    hasForm: true,
    ctaTexts: ['Call now', 'Get a free quote'],
    imageCount: 12,
    imagesMissingAlt: 0,
    addressMatch: '123 Main Street',
    hasMapEmbed: true,
    buzzwordHits: [],
    numberHits: 3,
    sentenceStartVariety: 1,
    ...overrides,
  }
}

export function sparseFacts(): SiteFacts {
  return makeFacts({
    title: null,
    titleLength: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    canonical: null,
    hasNoindex: true,
    h1s: [],
    h2s: [],
    aboveFoldText: '',
    bodyText: 'Welcome.',
    bodyWordCount: 1,
    textToCodeRatio: 0.001,
    hasTelLink: false,
    hasMailtoLink: false,
    hasForm: false,
    ctaTexts: [],
    imageCount: 0,
    imagesMissingAlt: 0,
    addressMatch: null,
    hasMapEmbed: false,
    buzzwordHits: ['seamless', 'innovative'],
    numberHits: 0,
    sentenceStartVariety: 0.5,
  })
}
```

- [ ] **Step 2: 写 src/lib/analyzers/helpers.ts**

```ts
import { sectionStatus } from '../status'
import type { AuditSection } from '../types'

export type SectionDraft = {
  key: string
  label: string
  maxScore: number
  score: number
  evidence: string[]
  whyItMatters: string
  fixes: string[]
}

export function makeSection(draft: SectionDraft): AuditSection {
  return {
    key: draft.key,
    label: draft.label,
    score: draft.score,
    maxScore: draft.maxScore,
    status: sectionStatus(draft.score, draft.maxScore),
    evidence: draft.evidence,
    whyItMatters: draft.whyItMatters,
    fixes: draft.fixes,
  }
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasWord(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false
  const pattern = new RegExp(`\\b${escapeRegExp(needle.toLowerCase())}\\b`)
  return pattern.test(haystack.toLowerCase())
}
```

- [ ] **Step 3: 写失败测试 tests/crawlability.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { analyzeCrawlability } from '@/lib/analyzers/crawlability'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeCrawlability', () => {
  it('scores a healthy page 15/15 (good)', () => {
    const section = analyzeCrawlability(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(15)
    expect(section.maxScore).toBe(15)
    expect(section.status).toBe('good')
  })

  it('scores an empty page 0/15 (critical) and lists fixes', () => {
    const section = analyzeCrawlability(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
    expect(section.status).toBe('critical')
    expect(section.fixes.length).toBeGreaterThanOrEqual(5)
  })

  it('gives partial credit for a too-short but present title', () => {
    const section = analyzeCrawlability(
      makeFacts({ title: 'Home', titleLength: 4 }),
      BASE_INPUT,
      [],
    )
    expect(section.score).toBe(13)
    expect(section.fixes[0]).toMatch(/title/i)
  })

  it('penalizes noindex and multiple h1s', () => {
    const section = analyzeCrawlability(
      makeFacts({ hasNoindex: true, h1s: ['One', 'Two'] }),
      BASE_INPUT,
      [],
    )
    expect(section.score).toBe(15 - 2 - 2)
    expect(section.evidence.join(' ')).toMatch(/noindex/i)
  })
})
```

- [ ] **Step 4: 运行确认失败**

Run: `npx vitest run tests/crawlability.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 5: 写 src/lib/analyzers/crawlability.ts**

```ts
import type { Analyzer } from '../types'
import { makeSection } from './helpers'

export const analyzeCrawlability: Analyzer = (facts, _input) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (facts.title && facts.titleLength >= 30 && facts.titleLength <= 60) {
    score += 3
    evidence.push(`Title (${facts.titleLength} chars): "${facts.title}"`)
  } else if (facts.title) {
    score += 1
    evidence.push(`Title is ${facts.titleLength} chars (ideal is 30–60): "${facts.title}"`)
    fixes.push('Rewrite the page title to 30–60 characters, saying what you do and where.')
  } else {
    evidence.push('No page title found.')
    fixes.push('Add a page title (30–60 characters) describing your service and city.')
  }

  if (
    facts.metaDescription &&
    facts.metaDescriptionLength >= 70 &&
    facts.metaDescriptionLength <= 160
  ) {
    score += 3
    evidence.push(`Meta description present (${facts.metaDescriptionLength} chars).`)
  } else if (facts.metaDescription) {
    score += 1
    evidence.push(`Meta description is ${facts.metaDescriptionLength} chars (ideal is 70–160).`)
    fixes.push('Expand the meta description to 70–160 characters with your offer and city.')
  } else {
    evidence.push('No meta description found.')
    fixes.push('Add a meta description (70–160 characters) summarizing your offer.')
  }

  if (facts.h1s.length === 1) {
    score += 3
    evidence.push(`Exactly one main headline (H1): "${facts.h1s[0]}"`)
  } else if (facts.h1s.length > 1) {
    score += 1
    evidence.push(`${facts.h1s.length} main headlines (H1) found — there should be exactly one.`)
    fixes.push('Keep one H1 headline at the top; change the others to H2 subheadings.')
  } else {
    evidence.push('No main headline (H1) found.')
    fixes.push('Add one clear H1 headline stating what you offer.')
  }

  if (!facts.hasNoindex) {
    score += 2
    evidence.push('Page is indexable (no "noindex" directive).')
  } else {
    evidence.push('The page tells search engines NOT to index it (noindex directive).')
    fixes.push('Remove the noindex directive so Google can list your page.')
  }

  if (facts.bodyWordCount >= 400) {
    score += 2
    evidence.push(`Page copy: about ${facts.bodyWordCount} words.`)
  } else if (facts.bodyWordCount >= 150) {
    score += 1
    evidence.push(`Page copy is thin: about ${facts.bodyWordCount} words.`)
    fixes.push('Grow the page to 400+ words of real copy: services, areas, FAQs.')
  } else {
    evidence.push(`Page copy is very thin: about ${facts.bodyWordCount} words.`)
    fixes.push('Add real page copy (400+ words): services, service areas, FAQs.')
  }

  if (facts.canonical) {
    score += 1
    evidence.push(`Canonical URL present: ${facts.canonical}`)
  } else {
    evidence.push('No canonical URL found.')
    fixes.push('Add a canonical link tag so search engines know the official address.')
  }

  const ratioPct = (facts.textToCodeRatio * 100).toFixed(1)
  if (facts.textToCodeRatio > 0.08) {
    score += 1
    evidence.push(`Visible-text-to-code ratio ${ratioPct}% — healthy.`)
  } else {
    evidence.push(`Visible-text-to-code ratio ${ratioPct}% — the page is mostly code.`)
    fixes.push('Add more visible text relative to markup so crawlers see real content.')
  }

  return makeSection({
    key: 'crawlability',
    label: 'Crawlability & SEO Basics',
    maxScore: 15,
    score,
    evidence,
    whyItMatters:
      'Google and AI assistants read this metadata to understand and surface your business. Missing basics make you invisible in search.',
    fixes,
  })
}
```

- [ ] **Step 6: 运行确认通过**

Run: `npx vitest run tests/crawlability.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 7: Commit**

```bash
git add src/lib/testing/make-facts.ts src/lib/analyzers/helpers.ts src/lib/analyzers/crawlability.ts tests/crawlability.test.ts
git commit -m "feat: add test fixtures, analyzer helpers, crawlability analyzer"
```

---

### Task 6: offer-clarity

**Files:**
- Create: `src/lib/analyzers/offer-clarity.ts`
- Test: `tests/offer-clarity.test.ts`

评分表（合计 15）：行业词在首屏 4（仅在正文 2）/ 具体服务结构 4（h2 ≥3 满分，≥1 半分）/ 行动指令词在首屏 4（仅在正文 2）/ 首屏文案 ≥15 词 3（≥8 词 1 分）。

- [ ] **Step 1: 写失败测试 tests/offer-clarity.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { analyzeOfferClarity } from '@/lib/analyzers/offer-clarity'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeOfferClarity', () => {
  it('scores a clear page 15/15 (good)', () => {
    const section = analyzeOfferClarity(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(15)
    expect(section.status).toBe('good')
  })

  it('scores a vague page low (critical)', () => {
    const section = analyzeOfferClarity(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBeLessThanOrEqual(2)
    expect(section.status).toBe('critical')
  })

  it('gives half credit when the business word is only in the body', () => {
    const facts = makeFacts({
      aboveFoldText: 'Welcome to our website. We are here to help you today.',
    })
    const section = analyzeOfferClarity(facts, BASE_INPUT, [])
    expect(section.score).toBe(15 - 4 + 2)
  })

  it('awards service structure for three or more H2 subheadings', () => {
    const facts = makeFacts({ h2s: [] })
    const without = analyzeOfferClarity(facts, BASE_INPUT, [])
    expect(without.score).toBe(11)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/offer-clarity.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/lib/analyzers/offer-clarity.ts**

```ts
import type { Analyzer } from '../types'
import { hasWord, makeSection } from './helpers'

const ACTION_VERBS = [
  'call',
  'book',
  'contact',
  'schedule',
  'order',
  'buy',
  'get',
  'request',
  'reserve',
  'visit',
  'hire',
  'quote',
]

export const analyzeOfferClarity: Analyzer = (facts, input) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (hasWord(facts.aboveFoldText, input.businessType)) {
    score += 4
    evidence.push(`First screen says what you do: "${input.businessType}" appears there.`)
  } else if (hasWord(facts.bodyText, input.businessType)) {
    score += 2
    evidence.push(`"${input.businessType}" appears on the page, but not on the first screen.`)
    fixes.push(`Put what you do ("${input.businessType}") in the headline at the very top.`)
  } else {
    evidence.push(`The page never clearly says you offer "${input.businessType}".`)
    fixes.push(`State clearly at the top: you offer "${input.businessType}" in ${input.targetMarket}.`)
  }

  if (facts.h2s.length >= 3) {
    score += 4
    evidence.push(`Specific sections found (${facts.h2s.length} subheadings), e.g. "${facts.h2s[0]}".`)
  } else if (facts.h2s.length >= 1) {
    score += 2
    evidence.push(`Only ${facts.h2s.length} subheading(s) found — services feel underspecified.`)
    fixes.push('Add subheadings for each service you offer so visitors (and Google) see specifics.')
  } else {
    evidence.push('No subheadings found — the offer reads as one vague block.')
    fixes.push('Break your offer into named services with subheadings.')
  }

  const foldVerb = ACTION_VERBS.find((v) => hasWord(facts.aboveFoldText, v))
  const bodyVerb = ACTION_VERBS.find((v) => hasWord(facts.bodyText, v))
  if (foldVerb) {
    score += 4
    evidence.push(`First screen tells visitors what to do (e.g. "${foldVerb}").`)
  } else if (bodyVerb) {
    score += 2
    evidence.push(`An action word ("${bodyVerb}") exists, but only deeper in the page.`)
    fixes.push('Move a clear instruction ("Call today", "Book now") up to the first screen.')
  } else {
    evidence.push('No clear instruction to act anywhere on the page.')
    fixes.push('Add a clear instruction like "Call today" or "Book a visit".')
  }

  const foldWords = facts.aboveFoldText ? facts.aboveFoldText.split(/\s+/).length : 0
  if (foldWords >= 15) {
    score += 3
    evidence.push(`First screen has enough copy to explain the offer (${foldWords} words).`)
  } else if (foldWords >= 8) {
    score += 1
    evidence.push(`First screen copy is sparse (${foldWords} words).`)
    fixes.push('Add a sentence or two on the first screen explaining what you offer and for whom.')
  } else {
    evidence.push(`First screen is almost empty (${foldWords} words).`)
    fixes.push('Write a real opening block: what you do, for whom, where, and what to do next.')
  }

  return makeSection({
    key: 'offer-clarity',
    label: 'Offer Clarity',
    maxScore: 15,
    score,
    evidence,
    whyItMatters:
      'Visitors decide in seconds. If the first screen does not say what you do, for whom, and where, they leave — and ad money burns.',
    fixes,
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/offer-clarity.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyzers/offer-clarity.ts tests/offer-clarity.test.ts
git commit -m "feat: add offer clarity analyzer"
```

---

### Task 7: conversion-path（goal-aware）

**Files:**
- Create: `src/lib/analyzers/conversion-path.ts`
- Test: `tests/conversion-path.test.ts`

评分表（合计 20）：目标主转化元素 8（兜底任一联系方式 4）/ 首屏含目标动词 CTA 6（任一行动动词 3）/ CTA 具体性 4（仅泛泛 CTA 1）/ 联系方式可见 2。

goal-aware 规则（规格 §7）：`goal` 决定哪个元素是"主转化元素"与哪些 CTA 动词算关键，不适用项不拖分。

- [ ] **Step 1: 写失败测试 tests/conversion-path.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { analyzeConversionPath } from '@/lib/analyzers/conversion-path'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeConversionPath (goal=calls)', () => {
  it('scores a ready page 20/20 (good)', () => {
    const section = analyzeConversionPath(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(20)
    expect(section.status).toBe('good')
  })

  it('scores a dead-end page low (critical)', () => {
    const section = analyzeConversionPath(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
    expect(section.fixes.length).toBeGreaterThan(0)
  })
})

describe('goal-aware scoring', () => {
  const facts = makeFacts({
    hasTelLink: false,
    hasForm: true,
    hasMailtoLink: false,
    aboveFoldText: 'Trusted plumbing services in Boston. Book your visit today.',
    ctaTexts: ['Book your visit'],
  })

  it('treats the form as primary when goal=leads', () => {
    const section = analyzeConversionPath(facts, { ...BASE_INPUT, goal: 'leads' }, [])
    expect(section.evidence.join(' ')).toMatch(/form/i)
    expect(section.score).toBeGreaterThanOrEqual(12)
  })

  it('falls back to partial credit when goal=calls but no phone exists', () => {
    const section = analyzeConversionPath(facts, BASE_INPUT, [])
    expect(section.score).toBeLessThan(20)
    expect(section.fixes.join(' ')).toMatch(/phone/i)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/conversion-path.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/lib/analyzers/conversion-path.ts**

```ts
import type { Analyzer, Goal, SiteFacts } from '../types'
import { hasWord, makeSection } from './helpers'

const PRIMARY_ELEMENTS: Record<Goal, (facts: SiteFacts) => boolean> = {
  calls: (f) => f.hasTelLink,
  bookings: (f) => f.hasForm || f.hasTelLink,
  quotes: (f) => f.hasForm || f.hasMailtoLink,
  sales: (f) => f.hasForm,
  leads: (f) => f.hasForm || f.hasMailtoLink,
}

const PRIMARY_LABEL: Record<Goal, string> = {
  calls: 'a clickable phone number',
  bookings: 'a booking form or phone number',
  quotes: 'a quote request form',
  sales: 'an order or checkout form',
  leads: 'a contact form',
}

const GOAL_VERBS: Record<Goal, string[]> = {
  calls: ['call', 'phone', 'dial'],
  bookings: ['book', 'schedule', 'reserve', 'appointment'],
  quotes: ['quote', 'estimate'],
  sales: ['buy', 'order', 'shop', 'cart'],
  leads: ['contact', 'enquire', 'inquire', 'message'],
}

const GENERIC_VERBS = [
  'call',
  'book',
  'contact',
  'schedule',
  'order',
  'buy',
  'get',
  'request',
  'reserve',
  'visit',
  'hire',
  'quote',
]

const SPECIFIC_CTA = /\b(free|today|now|instant)\b|\d/i

const anyContact = (f: SiteFacts) => f.hasTelLink || f.hasMailtoLink || f.hasForm

export const analyzeConversionPath: Analyzer = (facts, input) => {
  const goal = input.goal
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (PRIMARY_ELEMENTS[goal](facts)) {
    score += 8
    evidence.push(`Your goal is ${goal} — the page has ${PRIMARY_LABEL[goal]}. Good.`)
  } else if (anyContact(facts)) {
    score += 4
    evidence.push(`Your goal is ${goal}, but the page is missing ${PRIMARY_LABEL[goal]}.`)
    fixes.push(`Add ${PRIMARY_LABEL[goal]} — it is how you said you want customers to reach you.`)
  } else {
    evidence.push('The page has no form, phone number, or email — visitors have no way to convert.')
    fixes.push(`Add ${PRIMARY_LABEL[goal]} so visitors can take the next step.`)
  }

  const goalVerbInFold = GOAL_VERBS[goal].some((v) => hasWord(facts.aboveFoldText, v))
  const genericVerbInFold = GENERIC_VERBS.some((v) => hasWord(facts.aboveFoldText, v))
  if (goalVerbInFold) {
    score += 6
    evidence.push('The first screen invites visitors to take your intended action.')
  } else if (genericVerbInFold) {
    score += 3
    evidence.push('The first screen has a call to action, but not the one matching your goal.')
    fixes.push(`Put a "${GOAL_VERBS[goal][0]}" call to action above the fold.`)
  } else {
    evidence.push('No call-to-action on the first screen — visitors scroll past without acting.')
    fixes.push('Add a button on the first screen inviting the action you want.')
  }

  const specificCta = facts.ctaTexts.find((t) => SPECIFIC_CTA.test(t))
  if (specificCta) {
    score += 4
    evidence.push(`A specific CTA exists: "${specificCta}".`)
  } else if (facts.ctaTexts.length > 0) {
    score += 1
    evidence.push(`CTAs are generic (e.g. "${facts.ctaTexts[0]}") — no urgency or specifics.`)
    fixes.push('Make the CTA specific: "Get a free quote today" beats "Submit".')
  } else {
    evidence.push('No buttons or links that look like calls to action.')
    fixes.push('Add a visible button with concrete copy (e.g. "Call now for a free quote").')
  }

  if (facts.hasTelLink || facts.hasMailtoLink) {
    score += 2
    evidence.push('A phone number or email is reachable somewhere on the page.')
  } else {
    evidence.push('No clickable phone number or email anywhere.')
    fixes.push('Add a clickable phone number or email address.')
  }

  return makeSection({
    key: 'conversion-path',
    label: 'Conversion Path',
    maxScore: 20,
    score,
    evidence,
    whyItMatters:
      'Traffic means nothing if visitors cannot act. One clear, matching next step is the difference between a brochure and a lead machine.',
    fixes,
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/conversion-path.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyzers/conversion-path.ts tests/conversion-path.test.ts
git commit -m "feat: add goal-aware conversion path analyzer"
```

---

### Task 8: trust-signals

**Files:**
- Create: `src/lib/analyzers/trust-signals.ts`
- Test: `tests/trust-signals.test.ts`

评分表（合计 15）：客户评价信号 4 / 街道地址 4 / 真实照片 4（≥5 张且缺 alt <25% 满分；≥3 张半分）/ 资质凭证 3（licensed/insured/certified 满分；仅年限类 1 分）。

- [ ] **Step 1: 写失败测试 tests/trust-signals.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { analyzeTrustSignals } from '@/lib/analyzers/trust-signals'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeTrustSignals', () => {
  it('scores a trustworthy page 15/15 (good)', () => {
    const section = analyzeTrustSignals(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(15)
    expect(section.status).toBe('good')
  })

  it('scores an anonymous page 0/15 (critical)', () => {
    const section = analyzeTrustSignals(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
    expect(section.fixes.length).toBeGreaterThanOrEqual(3)
  })

  it('gives partial photo credit for few images', () => {
    const section = analyzeTrustSignals(makeFacts({ imageCount: 3, imagesMissingAlt: 0 }), BASE_INPUT, [])
    expect(section.score).toBe(13)
  })

  it('gives weak credential credit for experience years only', () => {
    const facts = makeFacts({ bodyText: 'We fix leaks. Operating since 2015 with care.' })
    const section = analyzeTrustSignals(facts, BASE_INPUT, [])
    expect(section.score).toBe(12)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/trust-signals.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/lib/analyzers/trust-signals.ts**

```ts
import type { Analyzer } from '../types'
import { makeSection } from './helpers'

const TESTIMONIAL_PATTERN = /testimonial|review|what our (clients|customers) say|rated \d|stars?/i
const STRONG_CREDENTIALS = /licen[sc]ed|insured|certified|accredited|award/i
const WEAK_CREDENTIALS = /\b\d+\+? years?\b|since \d{4}|established in \d{4}/i

export const analyzeTrustSignals: Analyzer = (facts) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (TESTIMONIAL_PATTERN.test(facts.bodyText)) {
    score += 4
    evidence.push('Customer reviews or testimonials are mentioned on the page.')
  } else {
    evidence.push('No customer reviews or testimonials found.')
    fixes.push('Add 2–3 short customer quotes with first name and neighborhood.')
  }

  if (facts.addressMatch) {
    score += 4
    evidence.push(`A street address is listed: "${facts.addressMatch}".`)
  } else {
    evidence.push('No street address found on the page.')
    fixes.push('Show your business address (even just city + street) — anonymous pages scare customers.')
  }

  const missingAltRatio = facts.imageCount > 0 ? facts.imagesMissingAlt / facts.imageCount : 1
  if (facts.imageCount >= 5 && missingAltRatio < 0.25) {
    score += 4
    evidence.push(`${facts.imageCount} images on the page — looks like real photos, not a blank template.`)
  } else if (facts.imageCount >= 3) {
    score += 2
    evidence.push(`Only ${facts.imageCount} images — the page risks feeling like a template.`)
    fixes.push('Add real photos: your team, your work, your storefront. Aim for 5+.')
  } else {
    evidence.push(`${facts.imageCount} images found — the page looks empty or generic.`)
    fixes.push('Add real photos of your work, team, or location (5 or more).')
  }

  if (STRONG_CREDENTIALS.test(facts.bodyText)) {
    score += 3
    evidence.push('Credentials found (licensed / insured / certified).')
  } else if (WEAK_CREDENTIALS.test(facts.bodyText)) {
    score += 1
    evidence.push('Some experience claims found (years in business).')
    fixes.push('Add strong credentials: licensed, insured, certified, or awards.')
  } else {
    evidence.push('No credentials or experience claims found.')
    fixes.push('State your credentials (licensed, insured, certified) or years of experience.')
  }

  return makeSection({
    key: 'trust-signals',
    label: 'Trust Signals',
    maxScore: 15,
    score,
    evidence,
    whyItMatters:
      'Customers check you out before calling. Reviews, an address, real photos, and credentials are what make a stranger trust a small business.',
    fixes,
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/trust-signals.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyzers/trust-signals.ts tests/trust-signals.test.ts
git commit -m "feat: add trust signals analyzer"
```

---

### Task 9: local-fit

**Files:**
- Create: `src/lib/analyzers/local-fit.ts`
- Test: `tests/local-fit.test.ts`

评分表（合计 10）：目标地区词出现在 title/H1 5（仅在正文 3）/ 地图嵌入 2 / 服务范围措辞 3（serving / service area / based in / located in）。

`targetMarket` 影响地区词匹配与 evidence 呈现（规格 §7）。

- [ ] **Step 1: 写失败测试 tests/local-fit.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { analyzeLocalFit } from '@/lib/analyzers/local-fit'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeLocalFit', () => {
  it('scores a local page 10/10 (good)', () => {
    const section = analyzeLocalFit(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(10)
    expect(section.status).toBe('good')
  })

  it('scores a nowhere page low (critical)', () => {
    const section = analyzeLocalFit(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
  })

  it('gives body-only credit when the market misses title and H1', () => {
    const facts = makeFacts({
      title: 'We fix things | Trusted Pros',
      h1s: ['Quality repairs'],
      hasMapEmbed: false,
      bodyText: 'Serving Boston homeowners with pride since day one.',
    })
    const section = analyzeLocalFit(facts, BASE_INPUT, [])
    expect(section.score).toBe(3)
  })

  it('uses input.targetMarket for matching and evidence', () => {
    const facts = makeFacts({ hasMapEmbed: false })
    const section = analyzeLocalFit(facts, { ...BASE_INPUT, targetMarket: 'Austin' }, [])
    expect(section.evidence.join(' ')).toMatch(/Austin/)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/local-fit.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/lib/analyzers/local-fit.ts**

```ts
import type { Analyzer } from '../types'
import { hasWord, makeSection } from './helpers'

const SERVICE_AREA_PHRASE =
  /\b(serving|service area|served areas?|based in|located in|proudly serving|throughout)\b/i

export const analyzeLocalFit: Analyzer = (facts, input) => {
  const market = input.targetMarket
  const headingText = [facts.title ?? '', ...facts.h1s].join(' ')
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  if (hasWord(headingText, market)) {
    score += 5
    evidence.push(`"${market}" appears in your title or main headline — strong local signal.`)
  } else if (hasWord(facts.bodyText, market)) {
    score += 3
    evidence.push(`"${market}" appears in the page copy, but not in the title or headline.`)
    fixes.push(`Put "${market}" in your page title and main headline — that is where local search looks.`)
  } else {
    evidence.push(`The page never mentions "${market}".`)
    fixes.push(`Mention "${market}" in the title, headline, and copy — local customers search by area.`)
  }

  if (facts.hasMapEmbed) {
    score += 2
    evidence.push('An embedded map shows where you are.')
  } else {
    evidence.push('No map on the page.')
    fixes.push('Embed a Google Map of your service area.')
  }

  if (SERVICE_AREA_PHRASE.test(facts.bodyText)) {
    score += 3
    evidence.push(`The copy describes your service area (e.g. "serving ${market} …").`)
  } else {
    evidence.push('The copy does not describe a service area.')
    fixes.push('Add a "Service area" line: which towns or neighborhoods you cover.')
  }

  return makeSection({
    key: 'local-fit',
    label: 'Local Fit',
    maxScore: 10,
    score,
    evidence,
    whyItMatters:
      'Local customers search "near me" and by city. A page that does not say where you serve cannot win them.',
    fixes,
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/local-fit.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyzers/local-fit.ts tests/local-fit.test.ts
git commit -m "feat: add local fit analyzer"
```

---

### Task 10: ai-template-risk

**Files:**
- Create: `src/lib/analyzers/ai-template-risk.ts`
- Test: `tests/ai-template-risk.test.ts`

评分表（合计 10）：泛泛形容词密度 <0.5% 4（<2% 2）/ 具体数字信号 ≥3 个 3（≥1 个 2）/ 句首重复率 ≤0.2 3（≤0.4 1）。`sentenceStartVariety` 是"独特句首占比"，重复率 = 1 − variety。

- [ ] **Step 1: 写失败测试 tests/ai-template-risk.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { analyzeAiTemplateRisk } from '@/lib/analyzers/ai-template-risk'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('analyzeAiTemplateRisk', () => {
  it('scores a specific page 10/10 (good)', () => {
    const section = analyzeAiTemplateRisk(makeFacts(), BASE_INPUT, [])
    expect(section.score).toBe(10)
    expect(section.status).toBe('good')
  })

  it('scores a buzzword-heavy page low (critical)', () => {
    const section = analyzeAiTemplateRisk(sparseFacts(), BASE_INPUT, [])
    expect(section.score).toBe(0)
    expect(section.evidence.join(' ')).toMatch(/seamless|innovative/i)
  })

  it('gives partial credit at moderate buzzword density', () => {
    const section = analyzeAiTemplateRisk(
      makeFacts({ buzzwordHits: ['seamless', 'innovative', 'tailored'] }),
      BASE_INPUT,
      [],
    )
    expect(section.score).toBe(8)
  })

  it('penalizes repetitive sentence openings', () => {
    const section = analyzeAiTemplateRisk(makeFacts({ sentenceStartVariety: 0.65 }), BASE_INPUT, [])
    expect(section.score).toBe(9)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/ai-template-risk.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/lib/analyzers/ai-template-risk.ts**

```ts
import type { Analyzer } from '../types'
import { makeSection } from './helpers'

export const analyzeAiTemplateRisk: Analyzer = (facts) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  const words = Math.max(facts.bodyWordCount, 1)
  const density = facts.buzzwordHits.length / words
  const densityPct = (density * 100).toFixed(2)
  if (density < 0.005) {
    score += 4
    evidence.push('Almost no generic AI buzzwords — the copy sounds specific to your business.')
  } else if (density < 0.02) {
    score += 2
    evidence.push(
      `Some generic buzzwords (${facts.buzzwordHits.length}, ${densityPct}% of copy): ${facts.buzzwordHits.slice(0, 3).join(', ')}.`,
    )
    fixes.push('Replace buzzwords ("seamless", "innovative") with what you actually do.')
  } else {
    evidence.push(
      `Heavy generic buzzwords (${facts.buzzwordHits.length}, ${densityPct}% of copy): ${facts.buzzwordHits.slice(0, 5).join(', ')}.`,
    )
    fixes.push('Rewrite generic AI-sounding copy with concrete facts about your business.')
  }

  if (facts.numberHits >= 3) {
    score += 3
    evidence.push(`Concrete numbers found (${facts.numberHits} mentions — years, %, job counts…).`)
  } else if (facts.numberHits >= 1) {
    score += 2
    evidence.push(`Only ${facts.numberHits} concrete number(s) found.`)
    fixes.push('Add specifics: years in business, jobs completed, response time, warranty length.')
  } else {
    evidence.push('No concrete numbers anywhere — a classic AI-template symptom.')
    fixes.push('Add specifics: years in business, jobs completed, response time, warranty length.')
  }

  const repetition = 1 - facts.sentenceStartVariety
  if (repetition <= 0.2) {
    score += 3
    evidence.push('Sentences open in varied ways — reads human.')
  } else if (repetition <= 0.4) {
    score += 1
    evidence.push(`Many sentences start the same way (repetition ${Math.round(repetition * 100)}%).`)
    fixes.push('Vary how sentences open; repeated openers make copy feel machine-generated.')
  } else {
    evidence.push(`Most sentences start the same way (repetition ${Math.round(repetition * 100)}%) — reads templated.`)
    fixes.push('Rewrite repetitive blocks; mix sentence lengths and openings.')
  }

  return makeSection({
    key: 'ai-template-risk',
    label: 'AI Template Risk',
    maxScore: 10,
    score,
    evidence,
    whyItMatters:
      'Customers have started recognizing (and distrusting) generic AI copy. Specific, human details are what make you memorable — and credible.',
    fixes,
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/ai-template-risk.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyzers/ai-template-risk.ts tests/ai-template-risk.test.ts
git commit -m "feat: add AI template risk analyzer"
```

---

### Task 11: ad-readiness + runAnalyzers

**Files:**
- Create: `src/lib/analyzers/ad-readiness.ts`, `src/lib/analyzers/index.ts`
- Test: `tests/ad-readiness.test.ts`, `tests/analyzers.test.ts`

ad-readiness 评分表（合计 15，派生自前序维度）：offer-clarity / conversion-path / trust-signals 各按得分率 ≥0.8 → 5、≥0.5 → 3、否则 0。

- [ ] **Step 1: 写失败测试 tests/ad-readiness.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { analyzeAdReadiness } from '@/lib/analyzers/ad-readiness'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'
import type { AuditSection } from '@/lib/types'

function section(key: string, score: number, maxScore: number): AuditSection {
  return {
    key,
    label: key,
    score,
    maxScore,
    status: score / maxScore >= 0.8 ? 'good' : score / maxScore >= 0.5 ? 'warning' : 'critical',
    evidence: [],
    whyItMatters: '',
    fixes: [],
  }
}

describe('analyzeAdReadiness (derived)', () => {
  it('scores 15/15 when offer, conversion, and trust are all strong', () => {
    const prior = [
      section('offer-clarity', 15, 15),
      section('conversion-path', 20, 20),
      section('trust-signals', 15, 15),
    ]
    const result = analyzeAdReadiness(makeFacts(), BASE_INPUT, prior)
    expect(result.score).toBe(15)
    expect(result.status).toBe('good')
  })

  it('scores 0/15 when the fundamentals are broken', () => {
    const prior = [
      section('offer-clarity', 0, 15),
      section('conversion-path', 0, 20),
      section('trust-signals', 0, 15),
    ]
    const result = analyzeAdReadiness(sparseFacts(), BASE_INPUT, prior)
    expect(result.score).toBe(0)
    expect(result.evidence.join(' ')).toMatch(/wasting/i)
  })

  it('gives partial credit per dimension', () => {
    const prior = [
      section('offer-clarity', 12, 15),
      section('conversion-path', 10, 20),
      section('trust-signals', 3, 15),
    ]
    const result = analyzeAdReadiness(makeFacts(), BASE_INPUT, prior)
    expect(result.score).toBe(3 + 3 + 0)
  })
})
```

- [ ] **Step 2: 写失败测试 tests/analyzers.test.ts（runAnalyzers 集成）**

```ts
import { describe, expect, it } from 'vitest'
import { runAnalyzers } from '@/lib/analyzers'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('runAnalyzers', () => {
  it('runs all seven dimensions in order', () => {
    const sections = runAnalyzers(makeFacts(), BASE_INPUT)
    expect(sections.map((s) => s.key)).toEqual([
      'crawlability',
      'offer-clarity',
      'conversion-path',
      'trust-signals',
      'local-fit',
      'ai-template-risk',
      'ad-readiness',
    ])
  })

  it('scores a model page 100/100', () => {
    const sections = runAnalyzers(makeFacts(), BASE_INPUT)
    expect(sections.reduce((sum, s) => sum + s.score, 0)).toBe(100)
    expect(sections.every((s) => s.status === 'good')).toBe(true)
  })

  it('scores a dead page low across the board', () => {
    const sections = runAnalyzers(sparseFacts(), BASE_INPUT)
    expect(sections.reduce((sum, s) => sum + s.score, 0)).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run tests/ad-readiness.test.ts tests/analyzers.test.ts`
Expected: FAIL。

- [ ] **Step 4: 写 src/lib/analyzers/ad-readiness.ts**

```ts
import type { Analyzer, AuditSection } from '../types'
import { makeSection } from './helpers'

const DERIVED_KEYS = [
  { key: 'offer-clarity', label: 'Offer clarity' },
  { key: 'conversion-path', label: 'Conversion path' },
  { key: 'trust-signals', label: 'Trust signals' },
] as const

function grade(ratio: number): number {
  if (ratio >= 0.8) return 5
  if (ratio >= 0.5) return 3
  return 0
}

export const analyzeAdReadiness: Analyzer = (_facts, _input, prior) => {
  let score = 0
  const evidence: string[] = []
  const fixes: string[] = []

  for (const { key, label } of DERIVED_KEYS) {
    const section: AuditSection | undefined = prior.find((s) => s.key === key)
    const ratio = section ? section.score / section.maxScore : 0
    const points = grade(ratio)
    score += points
    if (!section) continue
    if (ratio >= 0.8) {
      evidence.push(`${label} is solid (${section.score}/${section.maxScore}) — ads will land well.`)
    } else if (ratio >= 0.5) {
      evidence.push(`${label} is shaky (${section.score}/${section.maxScore}) — fix it before scaling spend.`)
      fixes.push(`Improve ${label.toLowerCase()} first (currently ${section.score}/${section.maxScore}).`)
    } else {
      evidence.push(`${label} is broken (${section.score}/${section.maxScore}) — paid traffic would bounce.`)
      fixes.push(`Fix ${label.toLowerCase()} before spending on ads (currently ${section.score}/${section.maxScore}).`)
    }
  }

  return makeSection({
    key: 'ad-readiness',
    label: 'Ad Readiness',
    maxScore: 15,
    score,
    evidence,
    whyItMatters:
      'Ads multiply what your page already does. A clear offer, a working conversion path, and real trust are what keep paid clicks from being wasted money.',
    fixes,
  })
}
```

注意：`evidence` 里 "wasting" 的断言——当三个维度全部 broken 时需包含 wasting 语义。给 critical 分支补一句：

在 `return makeSection(...)` 前，若 score === 0 且 evidence 为空（不可能）无需处理；直接在 whyItMatters 已含 "wasted money"。测试断言的是 evidence 匹配 /wasting/i —— 为满足之，在三个维度全 0 时追加一条 evidence：

```ts
if (score === 0) {
  evidence.push('Running ads now means wasting the budget — the landing experience cannot convert.')
}
```

（将这段插入 `for` 循环之后、`return` 之前。）

- [ ] **Step 5: 写 src/lib/analyzers/index.ts**

```ts
import type { Analyzer, AuditInput, AuditSection, SiteFacts } from '../types'
import { analyzeAdReadiness } from './ad-readiness'
import { analyzeAiTemplateRisk } from './ai-template-risk'
import { analyzeConversionPath } from './conversion-path'
import { analyzeCrawlability } from './crawlability'
import { analyzeLocalFit } from './local-fit'
import { analyzeOfferClarity } from './offer-clarity'
import { analyzeTrustSignals } from './trust-signals'

export const ANALYZERS: Analyzer[] = [
  analyzeCrawlability,
  analyzeOfferClarity,
  analyzeConversionPath,
  analyzeTrustSignals,
  analyzeLocalFit,
  analyzeAiTemplateRisk,
  analyzeAdReadiness,
]

export function runAnalyzers(facts: SiteFacts, input: AuditInput): AuditSection[] {
  const sections: AuditSection[] = []
  for (const analyze of ANALYZERS) {
    sections.push(analyze(facts, input, sections))
  }
  return sections
}
```

- [ ] **Step 6: 运行确认通过**

Run: `npx vitest run tests/ad-readiness.test.ts tests/analyzers.test.ts`
Expected: PASS。

- [ ] **Step 7: 跑一遍全量测试确认无回归**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 8: Commit**

```bash
git add src/lib/analyzers/ad-readiness.ts src/lib/analyzers/index.ts tests/ad-readiness.test.ts tests/analyzers.test.ts
git commit -m "feat: add ad readiness analyzer and analyzer registry"
```

---

### Task 12: render-markdown

**Files:**
- Create: `src/lib/render-markdown.ts`
- Test: `tests/render-markdown.test.ts`

- [ ] **Step 1: 写失败测试 tests/render-markdown.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/render-markdown'
import type { ReportData } from '@/lib/types'

function fixture(): ReportData {
  return {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    url: 'https://example.com',
    createdAt: '2026-09-08T00:00:00.000Z',
    overallScore: 72,
    verdict: 'Usable, but fix the basics before spending on ads.',
    sections: [
      {
        key: 'crawlability',
        label: 'Crawlability & SEO Basics',
        score: 12,
        maxScore: 15,
        status: 'warning',
        evidence: ['Title is 20 chars'],
        whyItMatters: 'Google reads this metadata.',
        fixes: ['Rewrite the page title.'],
      },
    ],
    topRisks: ['Conversion Path: Add a booking form.'],
    sevenDayPlan: ['Add a clear call-to-action above the fold.'],
  }
}

describe('renderMarkdown', () => {
  it('renders the header block', () => {
    const md = renderMarkdown(fixture())
    expect(md).toContain('# Website Readiness Report')
    expect(md).toContain('**URL:** https://example.com')
    expect(md).toContain('**Overall score:** 72 / 100')
    expect(md).toContain('**Verdict:** Usable, but fix the basics')
  })

  it('renders risks, sections, and the plan', () => {
    const md = renderMarkdown(fixture())
    expect(md).toContain('## Top risks')
    expect(md).toContain('1. Conversion Path: Add a booking form.')
    expect(md).toContain('### Crawlability & SEO Basics — 12/15 (warning)')
    expect(md).toContain('- Rewrite the page title.')
    expect(md).toContain('## 7-day plan')
    expect(md).toContain('**Day 1:**')
  })

  it('omits the risks block when there are none', () => {
    const data = fixture()
    const md = renderMarkdown({ ...data, topRisks: [] })
    expect(md).not.toContain('## Top risks')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/render-markdown.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/lib/render-markdown.ts**

```ts
import type { ReportData } from './types'

export function renderMarkdown(report: ReportData): string {
  const lines: string[] = []

  lines.push('# Website Readiness Report', '')
  lines.push(`**URL:** ${report.url}`, '')
  lines.push(`**Checked:** ${report.createdAt}`, '')
  lines.push(`**Overall score:** ${report.overallScore} / 100`, '')
  lines.push(`**Verdict:** ${report.verdict}`, '')

  if (report.topRisks.length > 0) {
    lines.push('## Top risks', '')
    report.topRisks.forEach((risk, i) => lines.push(`${i + 1}. ${risk}`))
    lines.push('')
  }

  lines.push('## Scorecard', '')
  for (const section of report.sections) {
    lines.push(`### ${section.label} — ${section.score}/${section.maxScore} (${section.status})`, '')
    lines.push(section.whyItMatters, '')
    if (section.evidence.length > 0) {
      lines.push('**What we found:**')
      section.evidence.forEach((e) => lines.push(`- ${e}`))
      lines.push('')
    }
    if (section.fixes.length > 0) {
      lines.push('**Fixes:**')
      section.fixes.forEach((f) => lines.push(`- ${f}`))
      lines.push('')
    }
  }

  lines.push('## 7-day plan', '')
  report.sevenDayPlan.forEach((step, i) => {
    lines.push(`**Day ${i + 1}:** ${step}`, '')
  })

  return lines.join('\n')
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/render-markdown.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/render-markdown.ts tests/render-markdown.test.ts
git commit -m "feat: render audit report as markdown"
```

---

### Task 13: build-report

**Files:**
- Create: `src/lib/build-report.ts`
- Test: `tests/build-report.test.ts`

- [ ] **Step 1: 写失败测试 tests/build-report.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import { buildReport } from '@/lib/build-report'
import { BASE_INPUT, makeFacts, sparseFacts } from '@/lib/testing/make-facts'

describe('buildReport', () => {
  it('builds a perfect report for a model site', () => {
    const report = buildReport(BASE_INPUT, makeFacts(), 'https://example.com/')
    expect(report.overallScore).toBe(100)
    expect(report.verdict).toMatch(/ready/i)
    expect(report.sections).toHaveLength(7)
    expect(report.topRisks).toHaveLength(0)
    expect(report.sevenDayPlan).toHaveLength(7)
    expect(report.markdown).toContain('# Website Readiness Report')
    expect(report.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(report.url).toBe('https://example.com/')
  })

  it('builds a critical report for a dead site', () => {
    const report = buildReport(BASE_INPUT, sparseFacts(), 'https://example.com/')
    expect(report.overallScore).toBeLessThanOrEqual(10)
    expect(report.verdict).toMatch(/not ready/i)
    expect(report.topRisks.length).toBeGreaterThan(0)
    expect(report.topRisks.length).toBeLessThanOrEqual(5)
  })

  it('orders top risks by worst score ratio', () => {
    const report = buildReport(BASE_INPUT, sparseFacts(), 'https://example.com/')
    const ratios = report.topRisks.map((risk) => {
      const label = risk.split(':')[0]
      const section = report.sections.find((s) => s.label === label)
      return section ? section.score / section.maxScore : 1
    })
    expect(ratios).toEqual([...ratios].sort((a, b) => a - b))
  })

  it('falls back to a default action when a section is already good', () => {
    const report = buildReport(BASE_INPUT, makeFacts(), 'https://example.com/')
    report.sevenDayPlan.forEach((step) => expect(step.length).toBeGreaterThan(10))
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/build-report.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/lib/build-report.ts**

```ts
import { runAnalyzers } from './analyzers'
import { renderMarkdown } from './render-markdown'
import type { AuditInput, AuditReport, AuditSection, SiteFacts } from './types'

type PlanSlot = { keys: string[]; fallback: string }

const PLAN_SLOTS: PlanSlot[] = [
  { keys: ['conversion-path'], fallback: 'Add one clear call-to-action above the fold.' },
  { keys: ['offer-clarity'], fallback: 'State exactly what you offer, for whom, and where.' },
  { keys: ['trust-signals'], fallback: 'Add testimonials, your address, and real photos.' },
  { keys: ['crawlability'], fallback: 'Fix the page title, meta description, and H1.' },
  { keys: ['local-fit'], fallback: 'Mention your city and service area throughout the page.' },
  { keys: ['ai-template-risk'], fallback: 'Replace generic AI copy with specifics and numbers.' },
  { keys: ['ad-readiness'], fallback: 'Re-run this check before spending money on ads.' },
]

function firstFix(sections: AuditSection[], keys: string[], fallback: string): string {
  for (const key of keys) {
    const section = sections.find((s) => s.key === key)
    if (section && section.status !== 'good' && section.fixes.length > 0) {
      return section.fixes[0]
    }
  }
  return fallback
}

function buildVerdict(score: number): string {
  if (score >= 80) return 'Ready to launch — a solid foundation for getting customers.'
  if (score >= 50) return 'Usable, but fix the basics before spending on ads.'
  return 'Not ready — a high risk of wasting ad spend. Fix the basics first.'
}

export function buildReport(
  input: AuditInput,
  facts: SiteFacts,
  finalUrl: string,
): AuditReport {
  const sections = runAnalyzers(facts, input)
  const overallScore = sections.reduce((sum, s) => sum + s.score, 0)

  const topRisks = sections
    .filter((s) => s.status !== 'good' && s.fixes.length > 0)
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)
    .slice(0, 5)
    .map((s) => `${s.label}: ${s.fixes[0]}`)

  const sevenDayPlan = PLAN_SLOTS.map((slot) => firstFix(sections, slot.keys, slot.fallback))

  const base = {
    id: crypto.randomUUID(),
    url: finalUrl,
    createdAt: new Date().toISOString(),
    overallScore,
    verdict: buildVerdict(overallScore),
    sections,
    topRisks,
    sevenDayPlan,
  }

  return { ...base, markdown: renderMarkdown(base) }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/build-report.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/build-report.ts tests/build-report.test.ts
git commit -m "feat: compose sections into weighted report with verdict and 7-day plan"
```

---

### Task 14: storage（JSON 文件存储）

**Files:**
- Create: `src/lib/storage.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: 写失败测试 tests/storage.test.ts**

```ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getReport, saveReport } from '@/lib/storage'
import type { AuditReport } from '@/lib/types'

let dir: string

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'readiness-'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

function sampleReport(): AuditReport {
  return {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    url: 'https://example.com',
    createdAt: '2026-09-08T00:00:00.000Z',
    overallScore: 100,
    verdict: 'Ready to launch.',
    sections: [],
    topRisks: [],
    sevenDayPlan: [],
    markdown: '# Report',
  }
}

describe('storage', () => {
  it('saves and loads a report round-trip', async () => {
    const report = sampleReport()
    await saveReport(report, dir)
    const loaded = await getReport(report.id, dir)
    expect(loaded).toEqual(report)
  })

  it('creates the directory if missing', async () => {
    const nested = path.join(dir, 'a', 'b')
    const report = { ...sampleReport(), id: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890' }
    await saveReport(report, nested)
    await expect(getReport(report.id, nested)).resolves.toEqual(report)
  })

  it('returns null for unknown ids', async () => {
    await expect(getReport('c1b2c3d4-e5f6-7890-abcd-ef1234567890', dir)).resolves.toBeNull()
  })

  it('rejects path-traversal ids without touching the filesystem', async () => {
    await expect(getReport('../../etc/passwd', dir)).resolves.toBeNull()
    await expect(getReport('not-a-uuid', dir)).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/lib/storage.ts**

```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AuditReport } from './types'

const DEFAULT_DIR = path.join(process.cwd(), 'data', 'reports')

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function saveReport(
  report: AuditReport,
  dir: string = DEFAULT_DIR,
): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, `${report.id}.json`)
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8')
}

export async function getReport(
  id: string,
  dir: string = DEFAULT_DIR,
): Promise<AuditReport | null> {
  if (!UUID_PATTERN.test(id)) return null
  try {
    const raw = await fs.readFile(path.join(dir, `${id}.json`), 'utf8')
    return JSON.parse(raw) as AuditReport
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/storage.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts tests/storage.test.ts
git commit -m "feat: add JSON file report storage with traversal guard"
```

---

### Task 15: API 路由 POST /api/audit

**Files:**
- Create: `src/app/api/audit/route.ts`
- Test: `tests/api-audit.test.ts`

统一信封 `{ success, data, error }`；zod 校验；FetchPageError 按类型映射状态码；mock fetch-page 与 storage 做集成测试。

- [ ] **Step 1: 写失败测试 tests/api-audit.test.ts**

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/api-audit.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 src/app/api/audit/route.ts**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildReport } from '@/lib/build-report'
import { fetchPage, FetchPageError, type FetchPageErrorKind } from '@/lib/fetch-page'
import { parseFacts } from '@/lib/parse-facts'
import { saveReport } from '@/lib/storage'

export const runtime = 'nodejs'

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

export async function POST(request: Request) {
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/api-audit.test.ts`
Expected: PASS（6 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/audit/route.ts tests/api-audit.test.ts
git commit -m "feat: add POST /api/audit with validation and error envelope"
```

---

### Task 16: 首页 + AuditForm + 完整样式

无组件单测（呈现层），以 build + Task 18 真实浏览器冒烟验证。样式走手写 CSS 设计令牌（editorial 风格：serif 展示标题、暖纸底色、 burnt-orange 强调色），不引入组件库。

**Files:**
- Modify: `src/app/page.tsx`（替换占位）
- Modify: `src/app/globals.css`（替换为完整样式）
- Create: `src/components/AuditForm.tsx`

- [ ] **Step 1: 写 src/components/AuditForm.tsx**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

const GOALS = [
  { value: 'calls', label: 'Phone calls' },
  { value: 'bookings', label: 'Bookings / appointments' },
  { value: 'quotes', label: 'Quote requests' },
  { value: 'sales', label: 'Online sales' },
  { value: 'leads', label: 'Leads / contact forms' },
] as const

export default function AuditForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(event.currentTarget)
    const payload = {
      url: String(form.get('url') ?? '').trim(),
      businessType: String(form.get('businessType') ?? '').trim(),
      targetMarket: String(form.get('targetMarket') ?? '').trim(),
      goal: String(form.get('goal') ?? ''),
    }

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        success: boolean
        data: { id: string } | null
        error: string | null
      }
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      router.push(`/report/${json.data.id}`)
    } catch {
      setError('Network error — could not reach the server.')
      setLoading(false)
    }
  }

  return (
    <form className="audit-form" onSubmit={onSubmit} aria-label="Run a readiness check">
      <label className="field field-wide">
        <span>Website URL</span>
        <input name="url" type="text" placeholder="yourbusiness.com" required />
      </label>
      <label className="field">
        <span>What do you do?</span>
        <input name="businessType" type="text" placeholder="e.g. plumbing, dental clinic" required />
      </label>
      <label className="field">
        <span>Where do you serve?</span>
        <input name="targetMarket" type="text" placeholder="e.g. Boston" required />
      </label>
      <label className="field">
        <span>Main goal of the site</span>
        <select name="goal" defaultValue="calls">
          {GOALS.map((goal) => (
            <option key={goal.value} value={goal.value}>
              {goal.label}
            </option>
          ))}
        </select>
      </label>
      <button className="submit" type="submit" disabled={loading}>
        {loading ? 'Checking your site…' : 'Run the free check'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 2: 替换 src/app/page.tsx**

```tsx
import AuditForm from '@/components/AuditForm'

export default function HomePage() {
  return (
    <main className="home">
      <section className="hero">
        <p className="kicker">For AI-built websites</p>
        <h1>
          Is your AI-built website actually ready to get customers?
        </h1>
        <p className="lede">
          You built it with AI, Wix, or a template. Now find out — before you spend on
          ads — whether it can rank, convert, and win trust. A plain-English readiness
          report in seconds.
        </p>
      </section>

      <AuditForm />

      <section className="how" aria-labelledby="what-we-check">
        <h2 id="what-we-check">What we check</h2>
        <ul>
          <li>
            <strong>Crawlability</strong> — can Google and AI assistants even read it?
          </li>
          <li>
            <strong>Offer clarity</strong> — does the first screen say what you do, for whom, where?
          </li>
          <li>
            <strong>Conversion path</strong> — is there one clear next step for your goal?
          </li>
          <li>
            <strong>Trust signals</strong> — reviews, address, real photos?
          </li>
          <li>
            <strong>Local fit</strong> — does it read like a local business?
          </li>
          <li>
            <strong>AI template risk</strong> — does it sound like everyone else&apos;s AI site?
          </li>
          <li>
            <strong>Ad readiness</strong> — safe to point paid traffic at it?
          </li>
        </ul>
      </section>
    </main>
  )
}
```

- [ ] **Step 3: 替换 src/app/globals.css 为完整样式**

```css
:root {
  --bg: #faf7f2;
  --ink: #1c1814;
  --muted: #6f6357;
  --accent: #b3541e;
  --accent-ink: #8a3f14;
  --card: #fffdf9;
  --line: #e7ddd0;
  --good: #2e7d32;
  --warning: #b26a00;
  --critical: #b3261e;
  --font-display: Georgia, 'Times New Roman', serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial,
    sans-serif;
  --radius: 14px;
  --shadow: 0 10px 30px rgba(60, 42, 20, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  line-height: 1.6;
}

main {
  max-width: 880px;
  margin: 0 auto;
  padding: 4rem 1.5rem 6rem;
}

.kicker {
  font-family: var(--font-body);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: var(--accent);
  margin: 0 0 0.75rem;
}

.hero h1 {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 5vw, 3.6rem);
  line-height: 1.12;
  margin: 0 0 1rem;
  letter-spacing: -0.01em;
}

.lede {
  font-size: 1.15rem;
  color: var(--muted);
  max-width: 34em;
  margin: 0 0 2.5rem;
}

.audit-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.75rem;
  margin-bottom: 4rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-wide {
  grid-column: 1 / -1;
}

.field span {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
}

.field input,
.field select {
  font: inherit;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: var(--ink);
}

.field input:focus-visible,
.field select:focus-visible,
.submit:focus-visible,
.report-actions button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.submit {
  grid-column: 1 / -1;
  font: inherit;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: 10px;
  padding: 0.9rem 1.5rem;
  cursor: pointer;
  transition: background 150ms ease;
}

.submit:hover:not(:disabled) {
  background: var(--accent-ink);
}

.submit:disabled {
  opacity: 0.7;
  cursor: wait;
}

.form-error {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--critical);
  background: rgba(179, 38, 30, 0.08);
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  font-size: 0.95rem;
}

.how h2 {
  font-family: var(--font-display);
  font-size: 1.6rem;
  margin: 0 0 1rem;
}

.how ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.6rem;
}

.how li {
  padding-left: 1.4rem;
  position: relative;
  color: var(--muted);
}

.how li::before {
  content: '—';
  position: absolute;
  left: 0;
  color: var(--accent);
}

/* Report page */

.report-header {
  margin-bottom: 2.5rem;
}

.score-block {
  display: flex;
  align-items: center;
  gap: 1.75rem;
  flex-wrap: wrap;
}

.score-ring {
  width: 132px;
  height: 132px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 6px solid var(--line);
  flex-shrink: 0;
}

.score-ring.good {
  border-color: var(--good);
}

.score-ring.warning {
  border-color: var(--warning);
}

.score-ring.critical {
  border-color: var(--critical);
}

.score-number {
  font-family: var(--font-display);
  font-size: 2.6rem;
  line-height: 1;
}

.score-total {
  color: var(--muted);
  font-size: 0.85rem;
}

.report-header h1 {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3.5vw, 2.4rem);
  margin: 0 0 0.4rem;
}

.report-meta {
  color: var(--muted);
  margin: 0;
}

.report-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.report-actions button {
  font: inherit;
  font-weight: 600;
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.report-actions button.secondary {
  background: transparent;
  color: var(--accent-ink);
}

.report-actions button:hover {
  opacity: 0.85;
}

.risks,
.plan {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.5rem 1.75rem;
  margin-bottom: 2rem;
}

.risks h2,
.plan h2,
.sections h2 {
  font-family: var(--font-display);
  margin-top: 0;
}

.risks ol {
  margin: 0;
  padding-left: 1.25rem;
  display: grid;
  gap: 0.5rem;
}

.section-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-left-width: 6px;
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
}

.section-card.good {
  border-left-color: var(--good);
}

.section-card.warning {
  border-left-color: var(--warning);
}

.section-card.critical {
  border-left-color: var(--critical);
}

.section-card header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.section-card h3 {
  font-family: var(--font-display);
  margin: 0;
}

.section-score {
  font-weight: 700;
  white-space: nowrap;
}

.section-status {
  text-transform: capitalize;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  margin: 0.25rem 0 0.75rem;
}

.section-card.good .section-status {
  color: var(--good);
}

.section-card.warning .section-status {
  color: var(--warning);
}

.section-card.critical .section-status {
  color: var(--critical);
}

.why {
  color: var(--muted);
  margin-top: 0;
}

.evidence h4,
.fixes h4 {
  margin: 0.9rem 0 0.35rem;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.evidence ul,
.fixes ul {
  margin: 0;
  padding-left: 1.2rem;
  display: grid;
  gap: 0.35rem;
}

.plan-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: grid;
  gap: 0.7rem;
}

.plan-list li {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
}

.plan-list .day {
  font-weight: 700;
  color: var(--accent-ink);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .audit-form {
    grid-template-columns: 1fr;
  }

  .score-block {
    flex-direction: column;
    text-align: center;
  }
}
```

- [ ] **Step 4: build 验证**

Run: `npm run build`
Expected: 构建成功，无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/globals.css src/components/AuditForm.tsx
git commit -m "feat: build tool-first editorial homepage with audit form"
```

---

### Task 17: 报告页 + ReportActions

**Files:**
- Create: `src/app/report/[id]/page.tsx`, `src/components/report/ReportActions.tsx`

- [ ] **Step 1: 写 src/components/report/ReportActions.tsx**

```tsx
'use client'

import { useState } from 'react'

export default function ReportActions({
  markdown,
  id,
}: {
  markdown: string
  id: string
}) {
  const [copied, setCopied] = useState(false)

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `readiness-report-${id}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="report-actions">
      <button type="button" onClick={copyMarkdown}>
        {copied ? 'Copied!' : 'Copy Markdown'}
      </button>
      <button type="button" onClick={download} className="secondary">
        Download report
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 写 src/app/report/[id]/page.tsx**

```tsx
import { notFound } from 'next/navigation'
import ReportActions from '@/components/report/ReportActions'
import { getReport } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await getReport(id)
  if (!report) notFound()

  const checkedAt = new Date(report.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <main className="report">
      <header className="report-header">
        <p className="kicker">Readiness report</p>
        <div className="score-block">
          <div
            className={`score-ring ${
              report.overallScore >= 80
                ? 'good'
                : report.overallScore >= 50
                  ? 'warning'
                  : 'critical'
            }`}
            role="img"
            aria-label={`Overall score ${report.overallScore} out of 100`}
          >
            <span className="score-number">{report.overallScore}</span>
            <span className="score-total">/ 100</span>
          </div>
          <div>
            <h1>{report.verdict}</h1>
            <p className="report-meta">
              {report.url} · checked {checkedAt}
            </p>
          </div>
        </div>
        <ReportActions markdown={report.markdown} id={report.id} />
      </header>

      {report.topRisks.length > 0 && (
        <section className="risks" aria-labelledby="top-risks">
          <h2 id="top-risks">Top risks</h2>
          <ol>
            {report.topRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="sections" aria-labelledby="scorecard">
        <h2 id="scorecard">Scorecard</h2>
        {report.sections.map((section) => (
          <article key={section.key} className={`section-card ${section.status}`}>
            <header>
              <h3>{section.label}</h3>
              <span className="section-score">
                {section.score} / {section.maxScore}
              </span>
            </header>
            <p className="section-status">{section.status}</p>
            <p className="why">{section.whyItMatters}</p>
            {section.evidence.length > 0 && (
              <div className="evidence">
                <h4>What we found</h4>
                <ul>
                  {section.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {section.fixes.length > 0 && (
              <div className="fixes">
                <h4>Fixes</h4>
                <ul>
                  {section.fixes.map((fix) => (
                    <li key={fix}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="plan" aria-labelledby="seven-day-plan">
        <h2 id="seven-day-plan">Your 7-day plan</h2>
        <ol className="plan-list">
          {report.sevenDayPlan.map((step, index) => (
            <li key={step}>
              <span className="day">Day {index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
```

- [ ] **Step 3: build 验证**

Run: `npm run build`
Expected: 构建成功（`/report/[id]` 路由生成）。

- [ ] **Step 4: 手动 404 验证（本地）**

Run: `npm run dev` 后访问 `http://localhost:3000/report/not-a-uuid`
Expected: Next.js 404 页（getReport 对非法 id 返回 null → notFound）。

- [ ] **Step 5: Commit**

```bash
git add src/app/report src/components/report
git commit -m "feat: add report page with scorecard, risks, and 7-day plan"
```

---

### Task 18: 收尾——README / 全量测试 / 覆盖率 / 真实浏览器冒烟

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 README.md**

````markdown
# readiness-report

Is your AI-built website actually ready to get customers? Paste a URL, get a
plain-English readiness report: can it launch, run ads, do SEO, and take
customers — with a 7-day fix plan.

Built for small local businesses and the agencies that serve them.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000, enter a website URL, what the business does, where
it serves, and the site's main goal.

## How it works

```
form → POST /api/audit
  fetchPage   (timeout, redirect limits, SSRF guard)
  parseFacts  (cheerio → SiteFacts: objective facts only)
  runAnalyzers(7 rule-based dimensions, goal-aware)
  buildReport (weighted score, verdict, top risks, 7-day plan)
  storage     (data/reports/<id>.json)
→ redirect to /report/<id>
```

Scores: Crawlability 15 · Offer Clarity 15 · Conversion Path 20 · Trust
Signals 15 · Local Fit 10 · AI Template Risk 10 · Ad Readiness 15.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Run the test suite |
| `npm run test:coverage` | Coverage report (target ≥80% on `src/lib`) |
| `npm run lint` | ESLint |

## Notes

- The analyzer layer is pure functions over `SiteFacts` — designed so an LLM
  can replace or augment the rules later without touching fetch/UI.
- Storage is a JSON-file interface — swappable for SQLite later.
````

- [ ] **Step 2: 全量测试 + 覆盖率**

Run: `npm run test:coverage`
Expected: 全部 PASS；`src/lib` 行/函数覆盖率 ≥80%。若不足，为薄弱分支补测试（不降低门槛）。

- [ ] **Step 3: lint + build**

Run: `npm run lint && npm run build`
Expected: 无 error（warning 可接受），构建成功。

- [ ] **Step 4: 真实浏览器端到端冒烟（不走 API 注入）**

启动 `npm run dev`，用 Playwright MCP（真实浏览器）：

1. 打开 `http://localhost:3000`——确认标题 "Is your AI-built website actually ready to get customers?" 与表单可见
2. 表单填入：URL `https://example.com`、business `plumbing`、market `Boston`、goal `Phone calls`，点击 "Run the free check"
3. 等待跳转至 `/report/<uuid>`——确认评分环、verdict、Scorecard（7 个维度卡片）、Top risks、7-day plan 均渲染
4. 点击 "Copy Markdown" 与 "Download report"，确认无报错
5. 访问 `/report/not-a-uuid`，确认 404

Expected: 全流程真实浏览器通过。

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with quickstart and architecture notes"
```

- [ ] **Step 6: 对照规格验收清单（specs §12）逐项勾验**

- 首页可输入 URL / 行业 / 地区 / 目标（英文界面）
- 后端抓取 URL HTML（超时、重定向限制、SSRF 防护）
- 解析基础 SEO 和正文信息为 SiteFacts
- 7 个维度规则评分（goal-aware），生成 AuditReport
- /report/[id] 报告页可查看
- 可复制 Markdown、可下载报告
- 核心域层纯函数 + 单测，覆盖率 ≥ 80%
- npm run dev 本地一键运行
- 分析层与存储层接口化，后续可接 LLM / SQLite

---

## Self-Review 记录（计划完成后自检）

1. **Spec 覆盖**：§5 数据流（Task 3/4/11/13/14/15）、§6 模块划分（全部文件有落点）、§7 七维度与权重（Task 5-11，含 goal-aware 与 na-free 简化——MVP 以 goal 优先级体现，`na` 完整机制留待 LLM 阶段，规格允许"影响适用性与优先级"的解读）、§8 错误处理（Task 3/15：SSRF/zod/信封/404）、§9 测试策略（单测 + API mock 集成 + 覆盖率 80%）、§10 UI（Task 16/17）、§12 验收清单（Task 18 逐项）——无缺口。
2. **占位符扫描**：无 TBD/TODO；每个代码步骤含完整代码与确切命令。
3. **类型一致性**：`Analyzer`/`SiteFacts`/`AuditSection`/`ReportData` 在 Task 2 定义，后续任务签名一致；`makeFacts`/`BASE_INPUT`/`sparseFacts` 在 Task 5 定义并被 Task 6-13 引用；`fetchPage(rawUrl, opts?)` 签名与 Task 3 测试一致。
