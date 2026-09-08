# 设计文档：频道源切换（URL 直链 HLS / Web iframe 网页）

日期：2026-08-20

## 背景

dev 分支目前用 `IptvChannel`（cctv 1-43 + ws 1-41，共 84 个频道）列表，播放方式为：抓取 iptv345 页面 → 解密出直链 m3u8 → 原生 HLS 播放。main 分支则对同一批频道改用 **iframe 网页代理**（`/api/proxy/iptv` 返回 iptv345 页面、保留多线路 `playURL`），让 iptv345 自带的播放器渲染并支持多线路。

两个分支对 iptv345 的消费方式不同。目标是把 main 的 web 网页播放融入 dev，并在设置中提供"频道源"选择，让用户按需切换播放机制。

外部约束（现状）：iptv345.com 可能整体不可达（TCP 超时），此时两种 HLS / Web 分支都会失败，这是外部故障而非代码问题，设计需保证失败时有清晰提示与手动兜底。

## 需求（已与用户确认）

1. 频道列表保持共用同一套：iptv345 的 84 个频道（cctv 43 + ws 41）。
2. 设置新增"频道源"三个选项：
   - **自动**：HLS 优先，失败自动回退到 Web（iframe）同频道。
   - **仅 HLS**：只走直链 HLS。
   - **仅 Web**：只走 iframe 网页。
   默认 **自动**。
3. 自动回退粒度：本次播放会话内记住回退结果，播放器中可手动切回 HLS。
4. 采用**方案 1**：统一播放器 + 播放源状态机，控制栏统一复用。

## 第 1 节：后端代理（scripts/proxy-server.cjs）

### 保持不变
- `/api/iptv/urls/:tid/:id`：抓取 iptv345 页面、解密编码线路为直链 m3u8，返回 `{ urls: string[], count }`。5 分钟缓存、15s 超时，失败返回 502 `{ urls: [] }`。**不改**（供 HLS 模式使用）。

### 改造
- `/api/proxy/iptv/:tid/:id`：当前为废弃的 JSON 别名（内部用相对路径 fetch，实际不可用），改为移植 main 的**网页页代理**：
  - `fetch("https://iptv345.com/?act=play&token=IPTV345_TOKEN&tid=&id=")` 抓取完整页面（UA/Accept/zh-CN 头，15s 超时，处理 gzip/brotli）。
  - 剥广告与无关脚本：`alwaysmulticulturallanding`、`popunder`、`popup`、googletagmanager、cfasync、`ad-container`、headerNfooter、navbar 等。
  - **关键修复（移植 d6e084f）**：正则只移除**不含** `<select id="playURL">` 的 `list-divider` 与 `ui-grid-a`，保住多线路 select —— 保证 iframe 里多线路可选。
  - 注入父页面通知脚本（加载完成/播放时 `postMessage({ type: 'iptv:playing' })`）与全屏播放样式。
  - 返回 `text/html; charset=utf-8`，2 分钟缓存、`no-cache`、带 CORS。
- 实现前 `grep` 确认 dev 前端除 IptvWebPlayer 外无人调用 `/api/proxy/iptv` 的 JSON（预期 IptvWebPlayer 走 `/api/iptv/urls`），避免误伤。

## 第 2 节：设置数据与 UI

- `src/types/index.ts`：`UserSettings` 增加 `channelSource: 'auto' | 'hls' | 'web'`，默认 `'auto'`。沿用现有 `updateSettings` 持久化。
- `src/context/AppContext.tsx`：`settings.channelSource` 随现有 `UserSettings` 流动，无新 action。
- `src/pages/SettingsPage.tsx`：「模式管理」新增"频道源"卡片（复用现有卡片/开关/动画风格），三项：自动（推荐标注）/ 仅HLS / 仅Web，点击即 `updateSettings({ channelSource })`。

## 第 3 节：播放器与自动回退

- 改造 `src/components/Player/IptvWebPlayer.tsx`（保留组件名与 `{ channel, onBack }`），内部同时支持两种渲染：
  - **HLS 分支**（沿用现有）：`/api/iptv/urls` 拉解密 `urls[]` → `HlsPlayer` 逐条，`onError` 切下一条。
  - **Web 分支**（移植 main）：`<iframe src="/api/proxy/iptv/:tid/:id">`，等 `iptv:playing` 消息消 loading，超时/错误显示重试。
- `effectiveSource` 推导：
  - `'hls'` → 恒 `'hls'`；`'web'` → 恒 `'web'`。
  - `'auto'` → 初始 `'hls'`，HLS 失败置 `'web'`（本次会话记住，可再切回）。
- 自动回退触发：HLS `onError` 且已是最后一条线路 → `effectiveSource='web'`。
- 控制栏：保留顶栏（返回/频道名）+ 底栏（播放暂停、频道名、全屏）；新增**源码切换按钮**：全局 `auto` 或本次已回退时显示（HLS↔Web），全局 `hls`/`web` 单按时隐藏。

## 第 4 节：错误处理

- HLS 无线路 / fetch 502：`auto`→自动 Web；`hls`→显示错误可重试；`web`→直接 Web。
- Web iframe 加载失败/超时：显示错误 + 重试；若由 HLS 回退而来提供"切回 HLS"。
- iptv345 整体不可达：两分支都失败 → 明确错误，`auto` 不做无限往返，控制栏"切回 HLS"手动兜底。

## 测试

- curl 验证（iptv345 恢复后）：`/api/proxy/iptv/ys/1` 返回含 `playURL` 的 HTML；`/api/iptv/urls/ys/1` 返回直链数组。同样验证 `ws/1`。
- 手动：三种设置下播放；`auto` 下诱导 HLS 失败 → 回退 iframe；回退后可"切回 HLS"。
- `npm run build` 通过（tsc + vite），lint/typecheck 通过。

## 不改动 / 边界

- 不改频道列表（仍为 iptvChannels.ts 的 84 个频道）。
- 不改 `/api/iptv/urls` 的直链逻辑。
- 不引入 M3U（`/api/m3u`）作为本功能的数据源，保持以 iptv345 为准；如需独立 m3u 直链兜底属另一需求，另行设计。
- 回退结果不持久化到存储（会话内有效即可，YAGNI）。