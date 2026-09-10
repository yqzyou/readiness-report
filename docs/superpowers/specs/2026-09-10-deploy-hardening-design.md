# 部署加固设计文档（DNS rebinding 防护 + 速率限制）

- 日期：2026-09-10
- 状态：设计已获用户批准，待实现
- 输入：MVP 终审留档的 2 条 Important（部署公网前必须补）+ 用户拍板的三个方向决策
- 前置：MVP 已合并 main @ 8a87a72（PR #1），97/97 测试

## 1. 定位与背景

MVP 的两个安全缺口，部署公网前的闸门：

1. **DNS rebinding**：`assertPublicUrl`（`src/lib/fetch-page.ts:120`）只校验 hostname 字面量（localhost、私网 IPv4 段、IPv6 字面量）。攻击者注册 `evil.com` 并让它解析到 `192.168.1.1`，校验被绕过，服务端 fetch 直接打进内网。
2. **无速率限制**：`POST /api/audit`（`src/app/api/audit/route.ts`）无任何限流。每次请求触发一次外部抓取 + 解析 + 评分 + 落盘，公网上是现成的成本放大器。

## 2. 已确认决策

| 决策项 | 结论 |
|---|---|
| 部署平台 | 单实例容器 / VPS（内存限流可靠，JSON 存储继续可用） |
| DNS 防护深度 | 解析后校验（接受极小 TOCTOU 理论窗口） |
| 限流算法 | 内存滑动窗口 |
| 默认限额 | 每 IP 每 60 秒 5 次 |
| 超限响应 | 429 + `Retry-After` 头 |
| IP 来源 | `x-forwarded-for` 第一个值（自管反向代理，可信），缺失时 `unknown` |

方案取舍记录：解析后校验（选定，消除 99% 风险且实现简单）；锁定 IP 连接（否决——需自定义 undici dispatcher，HTTPS SNI/证书处理不当反引入漏洞，约 3 倍工作量）；固定窗口（否决——边界处可突刺 2 倍限额）；token bucket（否决——无平滑突发需求，复杂度不值）；JSON 持久化限流（否决——重启清零对攻击者收益微不足道，YAGNI）。

## 3. 组件 1：DNS 解析后校验

改动文件：`src/lib/fetch-page.ts`。

新增导出函数：

```ts
async function assertResolvesToPublic(hostname: string): Promise<void>
```

逻辑：

1. hostname 是字面量 IPv4（`/^\d+\./` 等数字形式）或 IPv6（含 `:`）→ 跳过 DNS，直接返回（字面量已由 `assertPublicUrl` 覆盖）
2. 否则 `dns.promises.lookup(hostname, { all: true })` 获取**全部** A/AAAA 记录
3. 逐条校验：
   - IPv4 address（点分字符串）→ `isPrivateIPv4(address)`
   - IPv6 address → `expandIPv6(address)` 取组 → `isPrivateIPv6(groups)`
4. **任何一条**命中私网 → 抛 `FetchPageError('ssrf', 'That address is not allowed. Only public websites can be checked.')`（复用现有文案）
5. `lookup` 抛错（ENOTFOUND / EAI_AGAIN 等）→ 抛 `FetchPageError('dns', 'Could not reach that website. Check the address and try again.')`（复用现有文案与错误类型，不新增 kind）
6. 空记录列表（理论上不出现）→ 按 dns 错误处理

调用点：`fetchPage` 的重定向循环内，每跳先 `assertPublicUrl(current)`（字面量），紧接 `await assertResolvesToPublic(current.hostname)`，再发 fetch——防止公网站点重定向跳向解析到内网的域名。

现有私网判断函数（`isPrivateIPv4` / `expandIPv6` / `isPrivateIPv6`）保持不动，直接复用；其中 `isPrivateIPv4` 与 `expandIPv6` 需要导出（当前 `expandIPv6` 已导出，`isPrivateIPv4` 补导出）。

## 4. 组件 2：速率限制

新文件 `src/lib/rate-limit.ts`，纯逻辑模块（不依赖 Next.js，可单测）：

```ts
export type RateLimitResult = {
  allowed: boolean
  retryAfterSec: number
}

export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX = 5
const MAX_TRACKED_IPS = 10_000

export function checkRateLimit(
  ip: string,
  now: number = Date.now(),
  windowMs: number = RATE_LIMIT_WINDOW_MS,
  max: number = RATE_LIMIT_MAX,
): RateLimitResult
```

逻辑：

1. 模块级 `Map<string, number[]>`（key = IP，value = 窗口内请求时间戳）
2. 取出该 IP 的时间戳数组，丢弃 `<= now - windowMs` 的过期项
3. 若剩余长度 `>= max` → `{ allowed: false, retryAfterSec: 最旧时间戳 + windowMs - now 向上取整秒 }`
4. 否则 push 当前时间戳、写回 Map → `{ allowed: true, retryAfterSec: 0 }`
5. 内存保护：写入前若 `Map.size > MAX_TRACKED_IPS`，遍历全 Map 清理所有 IP 的过期戳、删除空数组键

接线 `src/app/api/audit/route.ts`：

```ts
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || 'unknown'
}
```

`POST` 入口第一件事（zod 解析**之前**）：`checkRateLimit(clientIp(request))`；不允许时返回 429 + `Retry-After: <sec>` 头 + 文案 `"You're checking sites quickly — give it a minute and try again."`（沿用现有失败信封 `{ success: false, data: null, error }`）。

限流状态不持久化、不跨进程共享——单实例前提下成立（已确认决策）。

## 5. 错误处理

- DNS 解析失败映射到现有 `dns` 错误（422），用户侧文案不变
- 解析到私网映射到现有 `ssrf` 错误（400），文案不变
- 限流拒绝是独立的新失败路径（429），带 `Retry-After` 头，符合 HTTP 语义
- 其余异常路径（fetch/解析/评分）完全不动

## 6. 测试策略

- `tests/fetch-page.test.ts` 扩展，`vi.mock('node:dns')` 模拟 `lookup`：
  - 域名解析出全部公网 IP → 放行
  - 域名解析出任一私网 IP（混合公网+私网）→ 抛 ssrf
  - 域名解析出仅私网 IP → 抛 ssrf
  - `lookup` reject（ENOTFOUND）→ 抛 dns
  - 字面量 IP hostname（如 `8.8.8.8`、`192.168.1.1`）→ 不触发 DNS 调用（断言 mock 未被调用）
  - 重定向到解析为私网的域名 → 抛 ssrf（跨 hop 生效）
- 新文件 `tests/rate-limit.test.ts` 纯函数单测：窗口内计数放行/拒绝、过期后重置、`retryAfterSec` 计算、注入 `now` 控制时间、Map 上限触发全量清理
- `tests/api-audit.test.ts` 扩展：同一 IP 连发 6 次（前 5 次过 zod 校验路径、第 6 次）断言 429 + `Retry-After` 头存在；429 响应体信封格式正确
- 现有 97 个测试不改动断言、必须继续全绿

## 7. 范围外（非目标）

- 锁定 IP 连接（彻底消除 TOCTOU）——若未来多租户/高风险场景再评估
- 限流持久化 / 跨实例共享（Redis 等）
- 按目标 URL / 域名维度的限流
- IP 头伪造防护（单实例自管反代，信任模型成立；若反代配置变更需重新评估）
- LLM 接入 analyzer（子项目 B，独立 spec）

## 8. 部署注意（实现时同步更新 README 演进节）

- 反向代理必须正确设置 `X-Forwarded-For`（nginx/Caddy 默认支持，需确认透传）
- 环境变量预留：`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` 可覆盖默认值（实现为 `Number(process.env.X) || 默认`，无新增依赖）
