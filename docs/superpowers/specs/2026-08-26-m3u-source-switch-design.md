# M3U8 源切换播放设计

**日期**: 2026-08-26  
**状态**: 待实现  
**范围**: 央视/卫视频道增加 M3U8 直链播放模式

---

## 背景

当前央视/卫视播放仅支持 iptv345 iframe 模式（web）和解密直链模式（hls）。需要新增 M3U8 源支持：使用 GitHub Actions 每日构建的最新频道列表，通过 HlsPlayer 直接播放。

---

## 目标

1. 保持 84 个 iptv345 频道名称不变
2. 设置中切换 `channelSource: 'hls'` 时使用 M3U8 直链播放
3. `auto` 模式下优先 M3U8，失败回退到 iptv345 iframe
4. 收藏功能兼容两种源

---

## 架构

```
channelSource = 'web'  →  iptv345 iframe（现有逻辑不变）
channelSource = 'hls'  →  M3U8 直链 + HlsPlayer
channelSource = 'auto' →  先 HLS(M3U8)，失败回退 iframe
```

**M3U8 数据流：**
```
GitHub Actions (每4小时)
  → 拉取 best_sorted.m3u8
  → 解析生成 channels/lptv.m3u8
  → 推送到 GitHub

前端 GET /api/m3u
  → 后端拉取 raw M3U8 URL
  → 解析为 JSON {id, name, logo, group, url}
  → 缓存 30 分钟
  → 返回前端
```

---

## 详细设计

### 1. 后端：新增 `/api/m3u` 端点 (`scripts/proxy-server.cjs`)

#### 1.1 M3U8 解析函数

```javascript
const M3U_SOURCE_URL = 'https://raw.githubusercontent.com/zilong7728/Collect-IPTV/main/best_sorted.m3u8'
const M3U_CACHE_TTL = 30 * 60 * 1000 // 30 分钟

function parseM3U(text) {
  const channels = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXTINF:')) continue
    const meta = lines[i]
    const urlLine = lines[i + 1]?.trim()
    if (!urlLine || urlLine.startsWith('#')) continue

    const tvgName = meta.match(/tvg-name="(.*?)"/)?.[1] || ''
    const tvgLogo = meta.match(/tvg-logo="(.*?)"/)?.[1] || ''
    const groupTitle = meta.match(/group-title="(.*?)"/)?.[1] || '其他'
    // 取逗号后的显示名
    const displayName = meta.split(',').pop()?.trim() || tvgName

    channels.push({
      id: `m3u-${tvgName}`,
      name: displayName,
      logo: tvgLogo,
      group: groupTitle,
      url: urlLine,
    })
    i++ // 跳过 URL 行
  }
  return channels
}
```

#### 1.2 API 端点

```javascript
let m3uCache = { data: null, time: 0 }

app.get('/api/m3u', async (req, res) => {
  const forceRefresh = req.query.refresh === '1'
  const now = Date.now()

  if (!forceRefresh && m3uCache.data && now - m3uCache.time < M3U_CACHE_TTL) {
    return res.json(m3uCache.data)
  }

  try {
    const resp = await fetch(M3U_SOURCE_URL, {
      headers: { 'User-Agent': 'LPTV/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const text = await resp.text()
    const channels = parseM3U(text)
    m3uCache = { data: channels, time: now }
    res.json(channels)
  } catch (err) {
    if (m3uCache.data) return res.json(m3uCache.data)
    res.status(502).json({ error: 'M3U 源获取失败', channels: [] })
  }
})
```

---

### 2. 前端：频道名匹配工具 (`src/utils/m3uMatch.ts`)

#### 2.1 匹配算法

将 IPTV345 频道名映射到 M3U8 频道的 URL。

**匹配规则（按优先级）：**
1. 提取 IPTV345 频道名关键词（去掉空格后的数字后缀，如 "CCTV1 综合" → "CCTV1"）
2. 与 M3U8 的 `tvg-name` 做包含匹配（不区分大小写）
3. 多关键词频道（如 "CCTV4 欧洲 HD"）尝试逐个关键词匹配

**已验证的匹配结果：**

| IPTV345 频道名 | 提取关键词 | M3U8 tvg-name | 匹配结果 |
|---|---|---|---|
| CCTV1 综合 | CCTV1 | CCTV1 | ✅ |
| CCTV4 中文国际 | CCTV4 | CCTV-4 中文国际 | ✅ |
| CCTV5 体育 | CCTV5 | CCTV5 | ✅ |
| CCTV5+ 体育赛事 | CCTV5+ | CCTV5+ | ✅ |
| CCTV6 电影 | CCTV6 | CCTV-6电影 | ✅ |
| CCTV9 纪录 | CCTV9 | CCTV-9 纪录 | ✅ |
| 湖南卫视 | 湖南卫视 | 湖南卫视 | ✅ |
| 江苏卫视 | 江苏卫视 | 江苏卫视 | ✅ |
| CCTV4 欧洲 HD | CCTV4 | CCTV-4 中文国际 | ✅（备选） |
| CCTV8K 高清 | CCTV8K | （无匹配） | ❌ → 回退 web |

```typescript
import { IptvChannel } from '../data/iptvChannels'
import { Channel } from '../types'

/**
 * 从 iptv345 频道名提取关键词列表
 * 例: "CCTV1 综合" → ["CCTV1"], "CCTV4 欧洲 HD" → ["CCTV4", "欧洲", "HD"]
 */
export function extractKeywords(name: string): string[] {
  return name
    .replace(/[\s（(].*$/, ' ')  // 去掉后半部分描述
    .split(/\s+/)
    .filter(k => k.length >= 2)
}

export function matchM3uUrl(
  iptvChannel: IptvChannel,
  m3uChannels: Channel[]
): string | null {
  const keywords = extractKeywords(iptvChannel.name)
  if (keywords.length === 0) return null

  // 优先：包含所有关键词
  const allMatch = m3uChannels.find(c =>
    keywords.every(kw => c.name.toLowerCase().includes(kw.toLowerCase()))
  )
  if (allMatch) return allMatch.url

  // 其次：包含第一个（最重要）关键词
  const firstMatch = m3uChannels.find(c =>
    c.name.toLowerCase().includes(keywords[0].toLowerCase())
  )
  if (firstMatch) return firstMatch.url

  return null
}
```

---

### 3. 播放器改造 (`src/components/Player/IptvWebPlayer.tsx`)

#### 3.1 新增状态

```typescript
const [m3uChannels, setM3uChannels] = useState<Channel[]>([])
const [m3uLoading, setM3uLoading] = useState(false)
const [m3uError, setM3uError] = useState<string | null>(null)
```

#### 3.2 M3U 加载逻辑

```typescript
// HLS/M3U 模式：加载 M3U8 频道列表
useEffect(() => {
  if (effectiveSource !== 'hls') return;
  setM3uLoading(true);
  setM3uError(null);
  fetch('/api/m3u')
    .then(r => r.json())
    .then(data => {
      if (data.channels && data.channels.length > 0) {
        setM3uChannels(data.channels);
      } else {
        if (globalSource === 'auto') {
          setEffectiveSource('web');
        } else {
          setM3uError('M3U 源无可播放频道');
        }
      }
    })
    .catch(() => {
      if (globalSource === 'auto') {
        setEffectiveSource('web');
      } else {
        setM3uError('M3U 源加载失败');
      }
    })
    .finally(() => setM3uLoading(false));
}, [effectiveSource, globalSource]);
```

#### 3.3 URL 匹配与播放

```typescript
const m3uUrl = effectiveSource === 'hls'
  ? matchM3uUrl(channel, m3uChannels)
  : '';
```

在渲染分支中，M3U 模式使用 HlsPlayer：

```tsx
{effectiveSource === 'hls' ? (
  m3uUrl ? (
    <HlsPlayer
      key={`${channel.tid}-${channel.id}-m3u`}
      ref={hlsPlayerRef}
      url={m3uUrl}
      onError={onHlsError}
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="text-white/60 text-sm">未找到 M3U8 播放地址</div>
    </div>
  )
) : (
  // 现有 iframe web 模式...
)}
```

#### 3.4 错误回退

```typescript
const onHlsError = useCallback(() => {
  if (globalSource === 'auto') {
    setEffectiveSource('web');
  } else {
    setError('M3U8 播放失败');
  }
}, [globalSource]);
```

---

### 4. 收藏 ID 兼容

| 源模式 | 收藏 ID 格式 | 示例 |
|--------|------------|------|
| IPTV345 (web) | `tid-id` | `ys-1`, `ws-5` |
| M3U8 (hls) | `m3u-tvgName` | `m3u-CCTV1`, `m3u-湖南卫视` |

**FavoritePage 和 TvModePage** 中收藏逻辑不变，因为 `toggleFavorite` 接收字符串 ID，只需在 `selectChannel` 时生成对应格式的 ID。

---

### 5. 无需修改的文件

- `iptvChannels.ts` — 频道数据保持 84 个不变
- `IptvPlayer.tsx` — 其他播放器不受影响
- `proxy-server.cjs` 现有端点 — `/api/proxy/iptv/:tid/:id`、`/api/iptv/urls/:tid/:id` 保持不变
- HlsPlayer.tsx — 复用现有 HLS 播放器组件

---

## 数据流

```
用户设置 channelSource = 'hls'
    ↓
IptvWebPlayer 检测到 effectiveSource = 'hls'
    ↓
fetch('/api/m3u') → 获取 M3U8 频道列表
    ↓
matchM3uUrl(channel, m3uChannels) → 找到匹配 URL
    ↓
HlsPlayer 播放 URL（通过 /api/proxy/stream 代理）
    ↓
LPTV 缓冲动画（来自 HlsPlayer 内部）
```

---

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| M3U 源获取失败 | `auto` → 回退 web；`hls` → 显示错误 |
| 频道名无法匹配 | 显示"未找到播放地址" |
| HlsPlayer 播放失败 | `auto` → 回退 web；`hls` → 显示错误 + 重试 |
| M3U 缓存命中 | 直接返回缓存数据，不重复请求 |

---

## 验收标准

1. 设置中切换到"M3U 直链"模式，选择任意央视/卫视频道可正常播放
2. 设置中切换到"自动"模式，优先使用 M3U 源，M3U 失败时回退到 iframe
3. 设置中切换到"网页"模式，行为与之前完全一致
4. 收藏功能在两种模式下均正常工作
5. 频道列表保持 84 个频道名称不变

---

## 修改文件清单

| 文件 | 操作 |
|------|------|
| `scripts/proxy-server.cjs` | 新增 `GET /api/m3u` 端点 |
| `src/utils/m3uMatch.ts` | 新建频道名匹配工具 |
| `src/components/Player/IptvWebPlayer.tsx` | 新增 M3U/HLS 播放分支 |
| `src/pages/FavoritePage.tsx` | 适配 M3U 频道收藏 ID |
| `src/pages/TvModePage.tsx` | 适配 M3U 频道选择 |
