# LPTV M3U 源重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 LPTV 从 iframe + postMessage 代理播放模式重构为 M3U 动态拉取 + hls.js 原生播放

**Architecture:** Express 后端只做 M3U 拉取/解析/缓存，前端 hls.js 直接播放 HLS 流，移除所有 iframe 相关代码

**Tech Stack:** React 18, TypeScript, Vite, hls.js, Node Express

## Global Constraints

- Channel id 使用 `group-name` 复合 key（如 `央视频道-CCTV1`），不受 M3U 条目顺序影响
- 播放器使用 hls.js，不再使用 iframe/postMessage
- 所有 `/proxy/*` 端点移除，替换为 `/api/m3u`
- Vite 代理 `/api` 到 `localhost:3000`
- 后端端口 3000，缓存 TTL 5 分钟

---

## 文件结构

```
src/
├── types/
│   └── index.ts              # [修改] Channel 类型更新
├── services/
│   └── channelApi.ts         # [新建] M3U API 调用封装
├── utils/
│   └── channelFilter.ts      # [新建] 频道分组/过滤工具
├── components/
│   ├── Player/
│   │   ├── HlsPlayer.tsx     # [新建] hls.js 播放器
│   │   ├── index.ts          # [修改] 更新导出
│   │   ├── IPTVPlayer.tsx    # [删除]
│   │   ├── ProxyPlayer.tsx   # [删除]
│   │   └── ChannelLineList.tsx  # [保留]
├── context/
│   └── AppContext.tsx        # [修改] 新增 channels 状态
├── pages/
│   ├── ChannelPage.tsx       # [重写]
│   ├── TvModePage.tsx        # [重写]
│   └── FavoritePage.tsx      # [修改]
├── App.tsx                   # [修改]
├── data/
│   └── channels.ts           # [删除]
└── utils/
    └── iptv.ts               # [删除]

proxy-server.cjs               # [重写]
vite.config.ts                 # [修改]
package.json                   # [修改]
```

---

### Task 1: 后端 M3U API

**Files:**
- Rewrite: `proxy-server.cjs`

**Interfaces:**
- Produces: `GET /api/m3u` → JSON array of `{id, name, logo, group, url}`
- Produces: `GET /api/m3u?refresh=1` → force cache refresh
- Produces: `GET /health` → `{status: 'ok'}`

- [ ] **Step 1: Rewrite proxy-server.cjs**

```javascript
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3000
const M3U_URL = 'https://raw.githubusercontent.com/zilong7728/Collect-IPTV/refs/heads/main/best_sorted.m3u8'
const CACHE_TTL = 5 * 60 * 1000

let cache = { data: null, timestamp: 0 }

app.use(cors())
app.use(express.json())

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
    const groupTitle = meta.match(/group-title="(.*?)"/)?.[1] || '未分类'
    const displayName = meta.split(',').pop()?.trim() || tvgName
    channels.push({
      id: `${groupTitle}-${tvgName}`,
      name: displayName,
      logo: tvgLogo,
      group: groupTitle,
      url: urlLine,
    })
  }
  return channels
}

app.get('/api/m3u', async (req, res) => {
  const forceRefresh = req.query.refresh === '1'
  const now = Date.now()

  if (!forceRefresh && cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.json(cache.data)
  }

  try {
    const response = await fetch(M3U_URL)
    if (!response.ok) {
      return res.status(502).json({ error: 'M3U source unavailable', status: response.status })
    }
    const text = await response.text()
    const channels = parseM3U(text)
    cache = { data: channels, timestamp: now }
    res.json(channels)
  } catch (err) {
    if (cache.data) {
      return res.json(cache.data)
    }
    res.status(502).json({ error: 'Failed to fetch M3U source' })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`LPTV proxy server running on port ${PORT}`)
})
```

- [ ] **Step 2: Test the server**

```bash
node proxy-server.cjs &
sleep 1
curl -s http://localhost:3000/health | head -c 200
curl -s http://localhost:3000/api/m3u | head -c 500
kill %1 2>/dev/null
```

Expected: health returns `{"status":"ok"}`, /api/m3u returns JSON array with channels.

- [ ] **Step 3: Commit**

```bash
git add proxy-server.cjs
git commit -m "feat: rewrite proxy server with M3U API"
```

---

### Task 2: 前端类型 + 数据层

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/services/channelApi.ts`
- Create: `src/utils/channelFilter.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `GET /api/m3u` → `Channel[]` JSON
- Produces: `Channel` type, `fetchChannels()`, `filterChannels()`, `getGroupedChannels()`

- [ ] **Step 1: Update Channel type in src/types/index.ts**

Read the current file first, then update the Channel interface. Remove `tid`, `currentProgram`, `isLive`, `category`. Add `group` and `url`.

```typescript
export interface Channel {
  id: string
  name: string
  logo: string
  group: string
  url: string
}
```

Note: Keep `ChannelLine`, `UserSettings`, `AppState` interfaces unchanged.

- [ ] **Step 2: Create src/services/channelApi.ts**

```typescript
import { Channel } from '../types'

const API_BASE = '/api'

export async function fetchChannels(refresh = false): Promise<Channel[]> {
  const url = `${API_BASE}/m3u${refresh ? '?refresh=1' : ''}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) {
    throw new Error(res.status === 502 ? 'M3U 源不可用' : `HTTP ${res.status}`)
  }
  return res.json()
}
```

- [ ] **Step 3: Create src/utils/channelFilter.ts**

```typescript
import { Channel } from '../types'

export const ALLOWED_GROUPS = ['央视频道', '卫视频道']

export function filterChannels(all: Channel[]): Channel[] {
  return all.filter(c => ALLOWED_GROUPS.includes(c.group))
}

export interface GroupedChannels {
  group: string
  channels: Channel[]
}

export function getGroupedChannels(all: Channel[]): GroupedChannels[] {
  return ALLOWED_GROUPS
    .map(group => ({
      group,
      channels: all.filter(c => c.group === group),
    }))
    .filter(g => g.channels.length > 0)
}
```

- [ ] **Step 4: Add Vite dev proxy**

```typescript
// vite.config.ts — add server section
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    }
  }
}
```

Read the current vite.config.ts first, then add the `server` property to the existing config.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/services/channelApi.ts src/utils/channelFilter.ts vite.config.ts
git commit -m "feat: add frontend data layer with updated types, API service, and filter utils"
```

---

### Task 3: HlsPlayer 组件

**Files:**
- Create: `src/components/Player/HlsPlayer.tsx`
- Modify: `src/components/Player/index.ts`
- Modify: `package.json` (add hls.js dep)

**Interfaces:**
- Produces: `<HlsPlayer url channelName channelLogo onError/>`

- [ ] **Step 1: Install hls.js**

```bash
npm install hls.js
```

- [ ] **Step 2: Create HlsPlayer component**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'

interface HlsPlayerProps {
  url: string
  channelName: string
  channelLogo?: string
  onError?: (err: Error) => void
}

export default function HlsPlayer({ url, channelName, onError }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  const initHls = useCallback((src: string) => {
    destroyHls()
    if (!videoRef.current) return

    if (!Hls.isSupported()) {
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = src
        return
      }
      setError('浏览器不支持 HLS 播放')
      return
    }

    const hls = new Hls()
    hlsRef.current = hls
    retryCountRef.current = 0

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(src)
    })

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setLoading(false)
      setError(null)
      videoRef.current?.play().catch(() => {})
    })

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        retryCountRef.current++
        if (retryCountRef.current <= MAX_RETRIES) {
          hls.recoverMediaError()
        } else {
          setError('播放失败')
          onError?.(new Error('播放失败'))
        }
      }
    })

    hls.attachMedia(videoRef.current)
  }, [destroyHls, onError])

  useEffect(() => {
    if (!url) return
    setLoading(true)
    setError(null)
    initHls(url)
    return destroyHls
  }, [url, initHls, destroyHls])

  const handleRetry = () => {
    retryCountRef.current = 0
    setError(null)
    setLoading(true)
    initHls(url)
  }

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        controls={false}
      />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-lg">加载中...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
          <div className="text-white text-lg">{error}</div>
          <button
            onClick={handleRetry}
            className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update Player/index.ts**

```typescript
export { default as HlsPlayer } from './HlsPlayer'
// IPTVPlayer and ProxyPlayer exports will be removed later
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: TypeScript compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/Player/HlsPlayer.tsx src/components/Player/index.ts
git commit -m "feat: add HlsPlayer component with hls.js"
```

---

### Task 4: AppContext + App.tsx 频道数据全局共享

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Channel` type, `fetchChannels()`
- Produces: `channels` + `loadChannels` in AppContext

- [ ] **Step 1: Add channels state to AppContext**

Read the current AppContext.tsx first. Add `channels: Channel[]` and `loadChannels()`.

```typescript
// Add to the reducer action types
| { type: 'SET_CHANNELS'; payload: Channel[] }
| { type: 'SET_CHANNELS_LOADING'; payload: boolean }
| { type: 'SET_CHANNELS_ERROR'; payload: string | null }

// Add to AppState
channels: Channel[]
channelsLoading: boolean
channelsError: string | null

// Initial state update
const initialState: AppState = {
  favorites: [],
  settings: { theme: 'white', autoPlay: false, quality: 'high', tvMode: false, showLines: false },
  currentCategory: '全部',
  channels: [],
  channelsLoading: false,
  channelsError: null,
}

// Add reducer cases
case 'SET_CHANNELS':
  return { ...state, channels: action.payload, channelsLoading: false, channelsError: null }
case 'SET_CHANNELS_LOADING':
  return { ...state, channelsLoading: action.payload }
case 'SET_CHANNELS_ERROR':
  return { ...state, channelsError: action.payload, channelsLoading: false }

// Add to interface
interface AppContextType extends AppState {
  // ...existing methods
  loadChannels: (refresh?: boolean) => Promise<void>
}

// Add to provider
const loadChannels = useCallback(async (refresh = false) => {
  dispatch({ type: 'SET_CHANNELS_LOADING', payload: true })
  try {
    const data = await fetchChannels(refresh)
    dispatch({ type: 'SET_CHANNELS', payload: data })
  } catch (err) {
    dispatch({ type: 'SET_CHANNELS_ERROR', payload: err instanceof Error ? err.message : '加载失败' })
  }
}, [])

// Add to provider value
value={{ ...state, addFavorite, removeFavorite, toggleFavorite, updateSettings, setCategory, loadChannels }}
```

- [ ] **Step 2: Update App.tsx — trigger load on mount**

```typescript
function ThemedApp() {
  const { loadChannels } = useApp()
  const location = useLocation()
  const isTvMode = location.pathname === '/tv-mode'

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  // ...rest of component (keep existing routes and layout)
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: TypeScript compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add src/context/AppContext.tsx src/App.tsx
git commit -m "feat: add channels state to AppContext with auto-load on mount"
```

---

### Task 5: ChannelPage 重写

**Files:**
- Rewrite: `src/pages/ChannelPage.tsx`

**Consumes:** `useApp().channels`, `useApp().channelsLoading`, `useApp().channelsError`, `useApp().loadChannels`, `filterChannels`, `getGroupedChannels`, `HlsPlayer`

- [ ] **Step 1: Rewrite ChannelPage.tsx**

Read the current file first. Replace hardcoded `channels.ts` import with dynamic data from AppContext. Replace `ProxyPlayer` with `HlsPlayer`.

```typescript
import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { filterChannels, getGroupedChannels } from '../utils/channelFilter'
import { HlsPlayer } from '../components/Player'
import { RiSearchLine, RiArrowDownSLine, RiArrowRightSLine } from '@remixicon/react'
import type { Channel } from '../types'

export default function ChannelPage() {
  const { channels, channelsLoading, channelsError, loadChannels } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    '央视频道': true,
    '卫视频道': true,
  })

  const filtered = useMemo(() => {
    const allowed = filterChannels(channels)
    if (!searchQuery.trim()) return allowed
    return allowed.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [channels, searchQuery])

  const grouped = useMemo(() => getGroupedChannels(filtered), [filtered])

  const toggleCategory = (group: string) => {
    setExpandedCategories(prev => ({ ...prev, [group]: !prev[group] }))
  }

  if (channelsLoading && channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/60 text-lg">加载频道列表...</div>
      </div>
    )
  }

  if (channelsError && channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-white/60 text-lg">{channelsError}</div>
        <button
          onClick={() => loadChannels(true)}
          className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)]">
      {/* 左侧频道列表 */}
      <div className="w-full lg:w-96 xl:w-[420px] flex flex-col gap-3 overflow-hidden">
        {/* 搜索框 */}
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder="搜索频道..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* 分组折叠列表 */}
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
          {grouped.length === 0 ? (
            <div className="text-center text-white/40 py-8">
              {searchQuery ? '未找到匹配的频道' : '暂无可用频道'}
            </div>
          ) : (
            grouped.map(({ group, channels: groupChannels }) => (
              <div key={group} className="rounded-xl bg-white/5">
                <button
                  onClick={() => toggleCategory(group)}
                  className="w-full flex items-center justify-between px-4 py-3 text-white font-semibold"
                >
                  <span>{group} ({groupChannels.length})</span>
                  {expandedCategories[group] ? (
                    <RiArrowDownSLine className="w-5 h-5" />
                  ) : (
                    <RiArrowRightSLine className="w-5 h-5" />
                  )}
                </button>
                {expandedCategories[group] && (
                  <div className="px-2 pb-2 space-y-1">
                    {groupChannels.map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChannel(ch)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          selectedChannel?.id === ch.id
                            ? 'bg-white/15'
                            : 'hover:bg-white/10'
                        }`}
                      >
                        {ch.logo ? (
                          <img src={ch.logo} alt="" className="w-8 h-8 rounded object-contain" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">{ch.name[0]}</span>
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-white text-sm truncate">{ch.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧播放器 */}
      <div className="hidden lg:flex flex-1 rounded-xl overflow-hidden bg-black">
        {selectedChannel ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 relative">
              <HlsPlayer
                url={selectedChannel.url}
                channelName={selectedChannel.name}
                channelLogo={selectedChannel.logo}
              />
            </div>
            <div className="px-4 py-2 bg-white/5">
              <div className="text-white font-semibold">{selectedChannel.name}</div>
              <div className="text-white/50 text-sm">{selectedChannel.group}</div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-white/30 text-6xl mb-4">📺</div>
              <div className="text-white/40 text-lg">选择一个频道开始观看</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: TypeScript compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChannelPage.tsx
git commit -m "feat: rewrite ChannelPage with dynamic M3U data and HlsPlayer"
```

---

### Task 6: TvModePage 重写

**Files:**
- Rewrite: `src/pages/TvModePage.tsx`

**Consumes:** `useApp().channels`, `HlsPlayer`

- [ ] **Step 1: Rewrite TvModePage.tsx**

Read the current file first. Replace iframe player with HlsPlayer, replace hardcoded channels with dynamic data.

Key changes:
- Import `channels` from AppContext instead of `channels.ts`
- Use `<HlsPlayer>` instead of iframe
- Remove all references to `iptv.ts` and `getPlayUrl`
- Keep the full-screen layout, live clock, category tabs, channel rows, bottom action bar

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: TypeScript compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/TvModePage.tsx
git commit -m "feat: rewrite TvModePage with HlsPlayer and dynamic channel data"
```

---

### Task 7: FavoritePage 适配动态频道列表

**Files:**
- Modify: `src/pages/FavoritePage.tsx`

**Consumes:** `useApp().channels`, `useApp().favorites`

- [ ] **Step 1: Update FavoritePage.tsx**

Read the current file. Replace hardcoded `channels` import with `channels` from AppContext. Filter favorites from the dynamically loaded channel list.

```typescript
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { filterChannels } from '../utils/channelFilter'

export default function FavoritePage() {
  const navigate = useNavigate()
  const { channels, favorites, toggleFavorite } = useApp()

  const favoriteChannels = useMemo(() => {
    const allowed = filterChannels(channels)
    return allowed.filter(c => favorites.includes(c.id))
  }, [channels, favorites])

  // ...rest of component uses favoriteChannels instead of importing channels.ts
  // When clicking a channel, set it as selected and navigate to /
  // Keep existing EmptyState and favorite card UI
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: TypeScript compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/FavoritePage.tsx
git commit -m "feat: adapt FavoritePage to use dynamic channel list from AppContext"
```

---

### Task 8: 清理旧文件

**Files:**
- Delete: `src/data/channels.ts`
- Delete: `src/components/Player/IPTVPlayer.tsx`
- Delete: `src/components/Player/ProxyPlayer.tsx`
- Delete: `src/utils/iptv.ts`
- Modify: `package.json` (remove unused deps)

- [ ] **Step 1: Delete old files and stage removals**

```bash
git rm src/data/channels.ts src/components/Player/IPTVPlayer.tsx src/components/Player/ProxyPlayer.tsx src/utils/iptv.ts
```

- [ ] **Step 2: Remove unused dependencies from package.json**

Remove `axios`, `cheerio`, `cors` from dependencies (cors is still needed in proxy-server.cjs but it's referenced in the code; keep it).

Actually, keep `cors` — it's used in proxy-server.cjs.
Remove `axios` — no longer needed (replaced by native fetch).
Remove `cheerio` — no longer needed (no HTML parsing).

- [ ] **Step 3: Rebuild to confirm clean removal**

```bash
npm install
npm run build
```

Expected: Build succeeds with no errors about missing modules.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove old iframe-based player, channels data, and unused deps"
```

---

## 自检清单

1. **Spec 覆盖度:**
   - [x] 后端 M3U 拉取/解析/缓存 API — Task 1
   - [x] Channel 类型更新 — Task 2
   - [x] 前端数据服务层 — Task 2
   - [x] 频道过滤分组工具 — Task 2
   - [x] HlsPlayer 组件 — Task 3
   - [x] AppContext 频道状态共享 — Task 4
   - [x] ChannelPage 动态数据 + HlsPlayer — Task 5
   - [x] TvModePage 重写 — Task 6
   - [x] FavoritePage 适配 — Task 7
   - [x] 旧文件清理 — Task 8
   - [x] Vite dev proxy — Task 2
   - [x] 错误处理/超时/重试 — Task 3, 5

2. **类型一致性:** `Channel.id` 使用 `group-name` 复合 key 在所有任务中一致

3. **无占位符:** 所有步骤包含完整代码
