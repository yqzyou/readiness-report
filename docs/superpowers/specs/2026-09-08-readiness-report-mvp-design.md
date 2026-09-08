# readiness-report MVP 设计文档

- 日期：2026-09-08
- 状态：设计已获用户批准，待实现
- 输入：用户提供的完整 PRD（AI 建站验收 + 获客准备度体检 App）

## 1. 定位与背景

面向小 B / 本地服务商 / 中文出海服务方的 Web App：用户输入网站 URL、行业、地区和网站目标，系统输出一份"这个 AI 建出来的网站是否适合上线、投广告、做 SEO、接客户"的体检报告。

核心价值是**验收**网站、发现获客风险、给出 7 天修复清单。不做 AI 建站器。

目标用户：

1. 本地小 B 老板（餐厅、诊所、教练、装修、工程商等）——已用 AI/Wix/Squarespace/Shopify 建站，不确定网站能否接客、投广告、做 SEO
2. 中文出海服务方——需要快速审计客户网站，把报告作为获客线索或交付物
3. 独立站卖家 / 小型 B2B 服务商——有网站但不知转化路径、信任元素、SEO 基础是否合格

## 2. 已确认决策

| 决策项 | 结论 |
|---|---|
| 项目名 / 路径 | `readiness-report` @ `/Users/yasser/Documents/code/readiness-report` |
| 界面语言 | 英文（面向海外小 B 与出海服务方，报告可直接拿给客户看） |
| 技术方案 | 方案 A：Next.js App Router 单体 + JSON 文件存储 |
| 评分方式 | 第一阶段纯规则评分（不接 LLM），分析层接口化为后续 LLM 预留替换点 |
| 产品形态 | Web App，两个页面：`/`（营销+表单）与 `/report/[id]`（报告） |

方案取舍记录：Next.js+JSON（选定，全栈甜点区、零存储依赖、报告页原生支持）；Next.js+SQLite（否决，MVP 无查询需求、原生模块风险、YAGNI）；Vite SPA+Express（否决，双进程联调负担、报告直链 404 问题）。

## 3. 架构总览

Next.js (App Router) + TypeScript 单体应用，三个层次：

- **UI 层**：`/` 营销首页 + 输入表单；`/report/[id]` 报告页
- **API 层**：`POST /api/audit` — 抓取、分析、存储的统一入口
- **核心域层**（纯函数，不依赖 Next）：`fetch-page → parse-facts → analyzers → build-report → render-markdown`

**关键设计原则：事实与判断分离。** `parse-facts` 只提取客观事实（`SiteFacts`），7 个评分器只负责判断。这份干净的 `SiteFacts` 以后既可以喂规则引擎（MVP），也可以直接喂 LLM（第二阶段）。

## 4. 核心数据流

```
表单提交 → POST /api/audit {url, businessType, targetMarket, goal}
  ① fetchPage(url)      fetch HTML，10s 超时，最多 3 次重定向
  ② parseFacts(html)    cheerio 解析 → SiteFacts
  ③ runAnalyzers(facts, input)  7 个维度评分器 → AuditSection[]
  ④ buildReport(sections)       加权总分 + verdict + topRisks + sevenDayPlan
  ⑤ renderMarkdown(report)
  ⑥ storage.save(report)        → data/reports/<id>.json
  返回 {id} → 前端跳转 /report/<id>
```

## 5. 模块划分

| 文件 | 职责 |
|---|---|
| `lib/types.ts` | `AuditInput` / `AuditReport` / `AuditSection` / `SiteFacts` 类型（沿用 PRD 定义） |
| `lib/fetch-page.ts` | 抓取：超时、重定向限制、错误分类（DNS / 超时 / 404 / 非 HTML） |
| `lib/parse-facts.ts` | cheerio → `SiteFacts`，只陈述事实不下判断 |
| `lib/analyzers/*.ts` | 7 个维度各一个文件，统一签名 `(facts, input) => AuditSection` |
| `lib/build-report.ts` | 加权合成总分、verdict、topRisks、sevenDayPlan |
| `lib/render-markdown.ts` | 报告 → Markdown（PRD 的报告结构） |
| `lib/storage.ts` | `save` / `get`，JSON 文件读写，接口化便于以后换 SQLite |

核心类型（沿用 PRD）：

```ts
type AuditInput = {
  url: string
  businessType: string
  targetMarket: string
  goal: 'calls' | 'bookings' | 'quotes' | 'sales' | 'leads'
}

type AuditReport = {
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

type AuditSection = {
  key: string
  label: string
  score: number          // 0 到该维度满分
  maxScore: number
  status: 'good' | 'warning' | 'critical'
  evidence: string[]
  whyItMatters: string
  fixes: string[]
}
```

`SiteFacts`（parse-facts 的输出，实现时细化）至少包含：title 及长度、meta description 及长度、H1 列表、H2 概览、正文文本及字数、可见链接中的 `tel:` / `mailto:`、表单存在性、按钮与 CTA 文案列表、图片总数与无 alt 图片数、地址信号（街道模式匹配）、地图 iframe 存在性、页面是否含 targetMarket 地区词、泛泛形容词命中列表、具体数字/百分比命中数、 OG 标签、canonical、noindex 标记。

## 6. 评分维度与权重

总分 100：Crawlability 15 / Offer Clarity 15 / Conversion Path 20 / Trust Signals 15 / Local Fit 10 / AI Template Risk 10 / Ad Readiness 15。

| 维度 | 权重 | 规则要点 |
|---|---:|---|
| Crawlability | 15 | title 存在且 30–60 字符、meta description、H1 存在且唯一、noindex 检测、正文文本量阈值、canonical 合理性 |
| Offer Clarity | 15 | 首屏是否含服务对象词、具体服务项目、地区词、明确动作指令 |
| Conversion Path | 20 | 首屏 CTA、`tel:`/`mailto:`/表单存在性、移动端可点联系方式、CTA 文案具体性 |
| Trust Signals | 15 | 真实照片信号、testimonials、街道地址、评价数量 |
| Local Fit | 10 | 城市/地区词与 targetMarket 匹配、地图嵌入、GBP 提示 |
| AI Template Risk | 10 | 泛泛形容词密度、具体数字/案例缺失、区块间句式重复度 |
| Ad Readiness | 15 | 落地目标明确性、可追踪 CTA、信任充分度（部分派生自其他维度） |

status 阈值：得分率（score / maxScore）≥ 80% 为 good，50–79% 为 warning，< 50% 为 critical。

"首屏"的规则定义：MVP 不做真实渲染，以 DOM 顺序近似——`<body>` 下前 2 个区块级元素（`header` / `section` / `main` 直接子元素）范围内的内容视为首屏，CTA 与 offer 判断均以此为准。

每个评分器输出 `score` + `status` + `evidence`（引用页面原文）+ `whyItMatters` + `fixes`，全部基于规则模板，无需 LLM。

## 7. 错误处理

- URL 自动补 `https://`；zod 校验表单（URL 格式、必填项）
- 抓取失败（超时 / DNS / 404）→ 首页友好错误提示 + 重试入口，错误分类透出，不暴露堆栈
- 非 HTML 内容（PDF / 图片站）→ 明确提示"暂只支持网页"
- `/report/[id]` 不存在 → 404 页
- API 返回统一信封：`{ success, data, error }`

## 8. 测试策略

- **analyzers 单测**（vitest）：构造 `SiteFacts` fixtures，验证各维度评分与 status 边界
- **parse-facts 单测**：内嵌 HTML fixture 验证提取逻辑
- **API 集成测试**：mock `fetch`，验证完整管线与错误分支
- 覆盖率目标 80%

## 9. UI 初步方向

英文界面。

- **首页**："tool-first editorial" —— 大标题直接抛出 "Is your AI-built website actually ready to get customers?"，表单作为视觉主角（不藏在按钮后面）
- **报告页**："体检报告"版式 —— 顶部大评分 + 一句话结论，分项评分表，Top risks 卡片，7 天计划时间线；提供 Copy Markdown 与 Download report

具体视觉细节在实现阶段用前端设计技能细化，不引入重组件库。

## 10. MVP 明确不做

用户系统、支付、多页面深度爬虫、完整 SEO SaaS、排名追踪、关键词数据库、自动改网站、Chrome 插件、手机 App、复杂 dashboard、PDF 导出（后置）、Playwright 截图/移动端检查（后置）。

## 11. 第一阶段交付验收清单

- [ ] 首页可输入 URL / 行业 / 地区 / 目标（英文界面）
- [ ] 后端抓取 URL HTML（超时与重定向限制）
- [ ] 解析基础 SEO 和正文信息为 `SiteFacts`
- [ ] 7 个维度规则评分，生成 `AuditReport`
- [ ] `/report/[id]` 报告页可查看
- [ ] 可复制 Markdown、可下载报告
- [ ] 核心域层纯函数 + 单测，覆盖率 ≥ 80%
- [ ] `npm run dev` 本地一键运行
- [ ] 分析层与存储层接口化，后续可接 LLM / SQLite

## 12. 后续演进（非 MVP，仅记录方向）

- LLM 增强层：用 `SiteFacts` + 规则初评生成更自然的解释与改写建议
- Playwright 截图与移动端渲染检查
- PDF 导出、报告列表页、批量体检、付费
