# readiness-report MVP 设计文档

- 日期：2026-09-08
- 状态：设计已获用户批准（2026-09-08 竞品拆解后更新），待实现
- 输入：用户提供的完整 PRD（AI 建站验收 + 获客准备度体检 App）+ 用户竞品情报

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
| 竞品策略 | 不 fork、不复制任何竞品代码，全部自研；仅借鉴概念（见第 3 节） |

方案取舍记录：Next.js+JSON（选定，全栈甜点区、零存储依赖、报告页原生支持）；Next.js+SQLite（否决，MVP 无查询需求、原生模块风险、YAGNI）；Vite SPA+Express（否决，双进程联调负担、报告直链 404 问题）。

## 3. 竞品拆解与差异化（2026-09-08）

### 3.1 竞品结论表

| 竞品 | 许可证 | 定位 | 重合度 | 处置 |
|---|---|---|---|---|
| [Trivium](https://github.com/KaiMOdev/trivium) | **AGPL-3.0** | 全栈审计引擎：Grammar(29 技术SEO) + Logic(19 LLM readiness) + Rhetoric(20 营销)；Vite+Express 双进程；面向技术/SEO 从业者 | 最高 | **不 fork**：AGPL 强传染会锁死商业化路径；其架构恰是我们否决的方案 C；68 项检查列表风格面向专业人员而非老板。仅借鉴概念 |
| [ai-seo-audit](https://github.com/context-dot-dev/ai-seo-audit) | MIT | ChatGPT/Claude/Perplexity 可见性评分 + 生成 coding agent 修复 prompt；Next.js 16 App Router | 中 | 借鉴其"单一规则源"架构模式与 agent fix prompt 概念（列入演进）；其抓取依赖 context.dev 外部 API，我们自持 fetch+cheerio |
| [GeoKit](https://github.com/glincker/geokit) | MIT | GEO npm 工具链 + CI Action，20 规则（llms.txt、AI crawler robots 等） | 低 | 借鉴 AI 可见性检查概念（列入演进维度候选） |
| [seo-auditor](https://github.com/ravigupta0210/seo-auditor) | **无许可证** | 传统 SEO + JSON-LD + GEO/AEO | 低 | 不碰代码（无许可证 = 保留所有权利） |
| [isreadyai](https://github.com/isreadyai/isreadyai) | 不明（NOASSERTION） | AI crawler 可读性 CLI | 低 | 不碰代码 |

### 3.2 差异化定位（竞品共同空白）

现有开源项目占住的是"技术审计 / SEO / GEO readiness engine"，没有人占住"**小 B AI 建站验收 + 获客准备度**"这个具体定位：

1. **不叫 SEO audit**，叫 AI-built website readiness check
2. **不服务开发者**，服务小 B 老板 / 建站服务商 / 出海服务方
3. **不只给技术分数**，回答老板的问题：这个网站现在能不能上线？能不能投广告？会不会浪费钱？先修哪 5 件事？
4. **goal-aware + market-aware 评分**：`goal`（calls/bookings/quotes/sales/leads）与 `targetMarket` 作为输入影响检查适用性与优先级——所有竞品均无
5. **7 天行动计划 + 商业诊断式报告**，不是 Lighthouse 式报错清单
6. **AI 模板感检测**维度——竞品均无
7. （演进）Reddit 真实讨论驱动的"本周 AI 建站风险库"

### 3.3 许可证纪律

不复制任何竞品代码。Trivium 只读不抄（概念不受版权保护，代码受）；MIT 项目如未来需参考具体实现，必须保留归属声明；MVP 核心域层全部自研。

### 3.4 从竞品借鉴的概念清单（自研实现）

| 来源 | 借鉴概念 | 落点 |
|---|---|---|
| Trivium | SSRF 防护（抓取任意用户 URL 必须屏蔽私网 IP / localhost / 云 metadata 端点） | MVP 安全设计（第 8 节） |
| Trivium | 检查适用性 `na`（无关检查不拖分） | MVP 的 goal-aware 机制（第 7 节） |
| Trivium | content-to-code ratio、可读性启发式 | 充实 Crawlability / AI Template Risk 规则 |
| ai-seo-audit | 单一规则权威源（规则一处定义，评分/UI/prompt 全部派生） | analyzers 结构约定 |
| ai-seo-audit | agent fix prompt（生成可粘贴给 coding agent 的修复简报） | 演进（第 13 节） |
| GeoKit | AI 搜索可见性检查（llms.txt、GPTBot/ClaudeBot robots 规则） | 演进维度候选：AI Search Visibility |

## 4. 架构总览

Next.js (App Router) + TypeScript 单体应用，三个层次：

- **UI 层**：`/` 营销首页 + 输入表单；`/report/[id]` 报告页
- **API 层**：`POST /api/audit` — 抓取、分析、存储的统一入口
- **核心域层**（纯函数，不依赖 Next）：`fetch-page → parse-facts → analyzers → build-report → render-markdown`

**关键设计原则：事实与判断分离。** `parse-facts` 只提取客观事实（`SiteFacts`），7 个评分器只负责判断。这份干净的 `SiteFacts` 以后既可以喂规则引擎（MVP），也可以直接喂 LLM（第二阶段）。

## 5. 核心数据流

```
表单提交 → POST /api/audit {url, businessType, targetMarket, goal}
  ① fetchPage(url)      fetch HTML，10s 超时，最多 3 次重定向，SSRF 防护拦截私网地址
  ② parseFacts(html)    cheerio 解析 → SiteFacts
  ③ runAnalyzers(facts, input)  7 个维度评分器 → AuditSection[]
  ④ buildReport(sections)       加权总分 + verdict + topRisks + sevenDayPlan
  ⑤ renderMarkdown(report)
  ⑥ storage.save(report)        → data/reports/<id>.json
  返回 {id} → 前端跳转 /report/<id>
```

## 6. 模块划分

| 文件 | 职责 |
|---|---|
| `lib/types.ts` | `AuditInput` / `AuditReport` / `AuditSection` / `SiteFacts` 类型（沿用 PRD 定义） |
| `lib/fetch-page.ts` | 抓取：超时、重定向限制、**SSRF 防护（拒绝私网 IP / localhost / 169.254.169.254 等-metadata 端点）**、错误分类（DNS / 超时 / 404 / 非 HTML） |
| `lib/parse-facts.ts` | cheerio → `SiteFacts`，只陈述事实不下判断 |
| `lib/analyzers/*.ts` | 7 个维度各一个文件，统一签名 `(facts, input) => AuditSection`；单一规则权威源——规则、evidence 模板、fixes 模板全部在各 analyzer 文件内一处定义 |
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

`SiteFacts`（parse-facts 的输出，实现时细化）至少包含：title 及长度、meta description 及长度、H1 列表、H2 概览、正文文本及字数、可见链接中的 `tel:` / `mailto:`、表单存在性、按钮与 CTA 文案列表、图片总数与无 alt 图片数、地址信号（街道模式匹配）、地图 iframe 存在性、页面是否含 targetMarket 地区词、泛泛形容词命中列表、具体数字/百分比命中数、OG 标签、canonical、noindex 标记、正文/代码量比。

## 7. 评分维度与权重

总分 100：Crawlability 15 / Offer Clarity 15 / Conversion Path 20 / Trust Signals 15 / Local Fit 10 / AI Template Risk 10 / Ad Readiness 15。

| 维度 | 权重 | 规则要点 |
|---|---:|---|
| Crawlability | 15 | title 存在且 30–60 字符、meta description、H1 存在且唯一、noindex 检测、正文文本量阈值、canonical 合理性、正文/代码量比 |
| Offer Clarity | 15 | 首屏是否含服务对象词、具体服务项目、地区词、明确动作指令 |
| Conversion Path | 20 | 首屏 CTA、`tel:`/`mailto:`/表单存在性、移动端可点联系方式、CTA 文案具体性 |
| Trust Signals | 15 | 真实照片信号、testimonials、街道地址、评价数量 |
| Local Fit | 10 | 城市/地区词与 targetMarket 匹配、地图嵌入、GBP 提示 |
| AI Template Risk | 10 | 泛泛形容词密度、具体数字/案例缺失、区块间句式重复度 |
| Ad Readiness | 15 | 落地目标明确性、可追踪 CTA、信任充分度（部分派生自其他维度） |

status 阈值：得分率（score / maxScore）≥ 80% 为 good，50–79% 为 warning，< 50% 为 critical。

"首屏"的规则定义：MVP 不做真实渲染，以 DOM 顺序近似——`<body>` 下前 2 个区块级元素（`header` / `section` / `main` 直接子元素）范围内的内容视为首屏，CTA 与 offer 判断均以此为准。

**goal-aware 机制**：`input.goal` 影响检查适用性与优先级，而非改变权重。例：`goal=calls` 时 `tel:` 链接是 Conversion Path 的关键项、`goal=leads` 时表单可见性是关键项；不适用项标记为 `na` 不拖分（借鉴 Trivium 的 page-type aware 思路，改造为 goal-aware）。`targetMarket` 影响 Local Fit 的地区词匹配与 evidence 呈现。

## 8. 错误处理与安全

- URL 自动补 `https://`；zod 校验表单（URL 格式、必填项）
- **SSRF 防护**：解析目标 hostname，拒绝私网 IP（RFC 1918）、loopback、链路本地（含 `169.254.169.254` 云 metadata）——我们抓取任意用户输入的 URL，这是必须项
- 抓取失败（超时 / DNS / 404）→ 首页友好错误提示 + 重试入口，错误分类透出，不暴露堆栈
- 非 HTML 内容（PDF / 图片站）→ 明确提示"暂只支持网页"
- `/report/[id]` 不存在 → 404 页
- API 返回统一信封：`{ success, data, error }`
- 速率限制：本地 MVP 不做，部署公网前必须加（列入第 13 节演进）

## 9. 测试策略

- **analyzers 单测**（vitest）：构造 `SiteFacts` fixtures，验证各维度评分与 status 边界
- **parse-facts 单测**：内嵌 HTML fixture 验证提取逻辑
- **fetch-page 单测**：SSRF 拦截用例（私网 IP / localhost / metadata 端点必须被拒）
- **API 集成测试**：mock `fetch`，验证完整管线与错误分支
- 覆盖率目标 80%

## 10. UI 初步方向

英文界面。

- **首页**："tool-first editorial" —— 大标题直接抛出 "Is your AI-built website actually ready to get customers?"，表单作为视觉主角（不藏在按钮后面）
- **报告页**："体检报告"版式 —— 顶部大评分 + 一句话结论，分项评分表，Top risks 卡片，7 天计划时间线；提供 Copy Markdown 与 Download report

**报告措辞原则**：像商业诊断，不像 Lighthouse 报错列表——写给老板看的英文（plain English），`evidence` 引用页面原文，`fixes` 是动作清单而非技术术语；每个维度先说结论（good/warning/critical + 一句话），再看细节。

具体视觉细节在实现阶段用前端设计技能细化，不引入重组件库。

## 11. MVP 明确不做

用户系统、支付、多页面深度爬虫、完整 SEO SaaS、排名追踪、关键词数据库、自动改网站、Chrome 插件、手机 App、复杂 dashboard、PDF 导出（后置）、Playwright 截图/移动端检查（后置）、速率限制（部署前加）、多语言报告。

## 12. 第一阶段交付验收清单

- [ ] 首页可输入 URL / 行业 / 地区 / 目标（英文界面）
- [ ] 后端抓取 URL HTML（超时、重定向限制、SSRF 防护）
- [ ] 解析基础 SEO 和正文信息为 `SiteFacts`
- [ ] 7 个维度规则评分（goal-aware），生成 `AuditReport`
- [ ] `/report/[id]` 报告页可查看
- [ ] 可复制 Markdown、可下载报告
- [ ] 核心域层纯函数 + 单测，覆盖率 ≥ 80%
- [ ] `npm run dev` 本地一键运行
- [ ] 分析层与存储层接口化，后续可接 LLM / SQLite

## 13. 后续演进（非 MVP，仅记录方向）

- LLM 增强层：用 `SiteFacts` + 规则初评生成更自然的解释与改写建议
- **AI Search Visibility 维度**（候选）：llms.txt、GPTBot/ClaudeBot/PerplexityBot robots 规则、FAQ schema——AI 建站站主天然关心 AI 搜索能否看到自己（借鉴 GeoKit/Trivium 概念）
- **Agent fix brief**（候选）：报告附带一段可粘贴给 Claude Code/Cursor 的修复简报，对建站服务商尤其有用（借鉴 ai-seo-audit 概念）
- **Reddit 信号风险库**：用真实讨论更新"本周 AI 建站风险"内容板块（差异化内容护城河）
- Playwright 截图与移动端渲染检查
- PDF 导出、报告列表页、批量体检、付费、速率限制（公网部署前）
