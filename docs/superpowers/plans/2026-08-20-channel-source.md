# 频道源切换（URL 直链 HLS / Web iframe 网页） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 dev 分支的播放器内增加"频道源"三模式（自动/仅HLS/仅Web），并把 main 分支的 iptv345 iframe 网页播放（含 d6e084f 的 `playURL` 保留修复）移植进来。

**Architecture:** 统一 `IptvWebPlayer` 同时支持 HLS（直链，走 `/api/iptv/urls`）与 Web（iframe，走 `/api/proxy/iptv`）两种渲染；由一个依据全局设置推导的 `effectiveSource` 状态机驱动（auto 下 HLS 失败即回退 Web）。后端把废弃的 `/api/proxy/iptv` JSON 别名改造成网页页代理。

**Tech Stack:** Express proxy-server.cjs（Node），React 18 + TS + Vite，HlsPlayer + Hls.js，SettingsPage。

## Global Constraints

- 频道列表不变：仍用 `src/data/iptvChannels.ts` 的 cctv (1-43) + ws (1-41) 共 84 个频道。
- 不改 `/api/iptv/urls` 的直链解密逻辑。
- Web 分支的 HTML 页代理必须保留 `<select id="playURL">` 及其所属的 `list-divider`/`ui-grid-a`（d6e084f 修复点）。
- 新增设置字段默认 `channelSource: 'auto'`，持久化沿用现有 `lptv-settings` localStorage。
- 不改动 `/api/m3u`，M3U 不作为本功能数据源。
- 回退结果仅本次播放会话内有效，不持久化。
- 每任务结束运行 `npm run build` 通过（tsc + vite）。

---

### Task 1: 后端移植 iframe 网页页代理（/api/proxy/iptv）

**Files:**
- Modify: `scripts/proxy-server.cjs:24`（新增缓存 Map），`scripts/proxy-server.cjs:691-703`（替换废弃 JSON 别名路由）

**Interfaces:**
- Consumes: `IPTV345_TOKEN_ORIG`（line 594，值 `'79e9e4ac43fa67c36a3236b7ae8a2027'`）、已 `require('zlib')`（line 6）
- Produces: `GET /api/proxy/iptv/:tid/:id` → `text/html`（含 `playURL` select、注入通知脚本、全屏样式），2 分钟缓存，失败 502

- [ ] **Step 1: 在 line 24 后新增 iframe 页缓存 Map**

在 `src/proxy-server.cjs` 的 line 24 `let iptvUrlCache = new Map()` 后追加：

```js
let iptvCache = new Map()
```

- [ ] **Step 2: 替换废弃 JSON 别名路由为网页页代理**

用下面的实现整体替换当前 line 691-703 的 `/api/proxy/iptv/:tid/:id`（现在是一个 fetch 自身相对路径的废弃 JSON 别名）：

```js
// ── iptv345.com iframe 播放页代理（web 资源模式）──
app.get('/api/proxy/iptv/:tid/:id', async (req, res) => {
  const { tid, id } = req.params
  const cacheKey = `iptv_iframe_${tid}_${id}`
  const now = Date.now()

  if (iptvCache.has(cacheKey)) {
    const cached = iptvCache.get(cacheKey)
    if (now - cached.time < 2 * 60 * 1000) {
      return res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
      }).send(cached.data)
    }
    iptvCache.delete(cacheKey)
  }

  const targetUrl = `https://iptv345.com/?act=play&token=${IPTV345_TOKEN_ORIG}&tid=${tid}&id=${id}`

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return res.status(response.status).send(`Failed: HTTP ${response.status}`)
    }

    const buf = Buffer.from(await response.arrayBuffer())
    let html
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      html = zlib.gunzipSync(buf).toString('utf8')
    } else if (buf[0] === 0x28 && buf[1] === 0xCA) {
      html = zlib.brotliDecompressSync(buf).toString('utf8')
    } else {
      html = buf.toString('utf8')
    }

    // ── 清理广告和无关内容 ──
    html = html.replace(/<script[^>]*src=["'][^"']*alwaysmulticulturallanding[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<script[^>]*src=["']popunder[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<script[^>]*src=["']popup[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<script[^>]*src=["']https:\/\/www\.googletagmanager[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<div id="ad-container"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<script[^>]*data-cfasync[^>]*>[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<script[^>]*>[\s\S]*?cfasync[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<script[^>]*>[\s\S]*?popunder[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<script[^>]*>[\s\S]*?popup[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<div class="headerNfooter"[^>]*>[\s\S]*?<\/div>/gi, '')
    // 只移除不含播放器的 list-divider（保留含 <select id="playURL"> 的）—— d6e084f 修复点
    html = html.replace(/<li data-role="list-divider">(?!.*id=["']playURL["'])[ \s\S]*?<\/li>/gi, '')
    // 不删除含 playURL select 的 ui-grid-a，只删除其他的
    html = html.replace(/<div class="ui-grid-a">(?!.*id=["']playURL["'])[ \s\S]*?<\/div>/gi, '')
    html = html.replace(/<div data-role="navbar"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<div align="center">[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<center>[\s\S]*?<\/center>/gi, '')
    html = html.replace(/<div id="errorTip"[^>]*>[\s\S]*?<\/div>/gi, '')

    // ── 注入播放器通信脚本（通知父页面已播放）──
    const injectScript = `<script>
(function() {
  function notifyPlay() {
    var v = document.getElementById('vstPlayer');
    if (v && (v.src || v.currentSrc)) {
      try { window.parent.postMessage({ type: 'iptv:playing' }, '*'); } catch(e) {}
    }
  }
  var t = setInterval(notifyPlay, 2000);
  setTimeout(notifyPlay, 3000);
  setTimeout(notifyPlay, 8000);
  setTimeout(notifyPlay, 20000);
  document.addEventListener('DOMContentLoaded', notifyPlay);
})();
</script>`
    html = html.replace('</head>', injectScript + '</head>')

    // ── 全屏播放器样式 ──
    const customStyle = `<style>
  html, body { margin: 0; padding: 0; background: #000; overflow: hidden; height: 100%; }
  [data-role="page"] { min-height: 100vh; margin: 0; }
  #vstPlayer { width: 100%!important; height: 100vh!important; aspect-ratio: unset!important; }
  video#vstPlayer { width: 100%!important; height: 100%!important; object-fit: contain; }
  .headerNfooter, [data-role="navbar"], .ui-grid-a, #ad-container, #errorTip,
  [data-role="list-divider"] { display: none !important; }
</style>`
    html = html.replace('<head>', '<head>' + customStyle)

    iptvCache.set(cacheKey, { data: html, time: now })
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Cache-Control': 'no-cache',
    })
    res.send(html)
  } catch (err) {
    console.error('[proxy/iptv] Error:', err.message)
    res.status(502).send('IPTV proxy error: ' + err.message)
  }
})
```

- [ ] **Step 3: 语法检查 + 本地起服冒烟**

Run: `node --check scripts/proxy-server.cjs`
Expected: 无输出（exit 0）。

Run: `PORT=3999 node scripts/proxy-server.cjs & sleep 2; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" -X GET "http://127.0.0.1:3999/api/proxy/iptv/ys/1"; kill %1`
Expected: 若本机可连通 iptv345（外部依赖），返回 `200 text/html; charset=utf-8`；若 iptv345 不可达则返回 `502`（内容为文本）。两者都说明路由已生效、不再返回 JSON。

- [ ] **Step 4: 提交**

```bash
git add scripts/proxy-server.cjs
git commit -m "feat: proxy iptv345 page for web playback (preserve playURL select)"
```

---

### Task 2: 设置数据与类型（channelSource）

**Files:**
- Modify: `src/types/index.ts:29`（UserSettings），`src/context/AppContext.tsx:26`（默认 settings），`src/context/AppContext.tsx:89`（接口带出类型即可，自动）

**Interfaces:**
- Produces: `UserSettings.channelSource: 'auto' | 'hls' | 'web'`（默认 `'auto'`）；`AppContext.settings.channelSource` 可从 `useApp()` 读取

- [ ] **Step 1: 在 UserSettings 增加字段**

`src/types/index.ts` 的 `UserSettings` 内（`autoRefresh: boolean;` 之后）追加：

```ts
  channelSource: 'auto' | 'hls' | 'web';
```

- [ ] **Step 2: 默认值**

`src/context/AppContext.tsx:26` 的 settings 初始化追加：

```ts
  settings: { theme: 'glass', autoPlay: false, quality: 'high', tvMode: false, autoRefresh: true, channelSource: 'auto' },
```

- [ ] **Step 3: 构建校验**

Run: `npm run build`
Expected: 编译通过（tsc + vite），无 TS 报错。

- [ ] **Step 4: 提交**

```bash
git add src/types/index.ts src/context/AppContext.tsx
git commit -m "feat: add channelSource setting (auto|hls|web)"
```

---

### Task 3: 设置页新增"频道源"卡片

**Files:**
- Modify: `src/pages/SettingsPage.tsx`（模式管理 tab 内新增卡片）

**Interfaces:**
- Consumes: `useApp()` 的 `settings.channelSource`、`updateSettings`
- Produces: 用户在 UI 上可改 `channelSource`，持久化到 localStorage

- [ ] **Step 1: 引入图标**（顶部 import 加一项）

```tsx
import { RiPaletteLine, RiLayoutGridLine, RiCheckLine, RiArrowRightSLine, RiTv2Line } from '@remixicon/react';
```

- [ ] **Step 2: 定义选项数组**（组件内常量，放 `tabItems` 之后）

```tsx
const sourceOptions: { id: 'auto' | 'hls' | 'web'; label: string; sub: string }[] = [
  { id: 'auto', label: '自动', sub: 'HLS 优先，失败自动回退网页' },
  { id: 'hls', label: '仅 HLS', sub: '只走直链 HLS 播放' },
  { id: 'web', label: '仅 Web', sub: '只走 iframe 网页播放' },
];
```

- [ ] **Step 3: 在"模式管理"内容里、TV 模式卡片之后追加"频道源"卡片**

在 `</motion.div>`（line 228，TV 模式卡片闭合后）与 line 230 的 `</AnimatePresence>` 之间插入：

```tsx
                  <div className="rounded-xl border" style={{ background: cardBg, borderColor: cardBorder, marginTop: 16 }}>
                    <div className="flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}`, padding: 20 }}>
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: sidebarBg }}>
                          <span className="text-xl">📡</span>
                        </div>
                        <div>
                          <div className="font-semibold leading-tight" style={{ color: textPri, fontSize: 15, lineHeight: 1.33 }}>频道源</div>
                          <div className="mt-1 leading-tight" style={{ color: '#8b7e6a', fontSize: 12, lineHeight: 1.33 }}>选择频道播放的资源方式</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col" style={{ padding: 12 }}>
                      {sourceOptions.map((opt) => {
                        const isSelected = settings.channelSource === opt.id;
                        return (
                          <motion.button
                            key={opt.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => updateSettings({ channelSource: opt.id })}
                            className="flex items-center gap-3 rounded-lg transition-colors px-3 py-3"
                            style={{ background: isSelected ? (isBlack ? 'rgba(196,61,61,0.15)' : 'rgba(196,61,61,0.08)') : 'transparent', border: `1px solid ${isSelected ? '#c43d3d' : 'transparent'}`, marginBottom: 4 }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold leading-tight" style={{ color: isSelected ? '#c43d3d' : textPri, fontSize: 14, lineHeight: 1.33 }}>{opt.label}</div>
                              <div className="leading-tight" style={{ color: mutedColor, fontSize: 12, lineHeight: 1.33 }}>{opt.sub}</div>
                            </div>
                            {isSelected && <RiCheckLine className="w-5 h-5" style={{ color: '#c43d3d' }} />}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
```

- [ ] **Step 4: 构建设计校验**

Run: `npm run build`
Expected: 编译通过。浏览器打开设置>模式管理能看到"频道源"三项（视觉上沿用样式，不必二次截图）。

- [ ] **Step 5: 提交**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: add channel source selector in settings (auto/hls/web)"
```

---

### Task 4: 前端 iptv 工具函数新增网页代理地址

**Files:**
- Modify: `src/utils/iptv.ts`

**Interfaces:**
- Produces: `getIptvProxyUrl(tid: string, id: string): string` → `/api/proxy/iptv/${tid}/${id}`

- [ ] **Step 1: 追加函数**

`src/utils/iptv.ts` 末尾追加：

```ts
export function getIptvProxyUrl(tid: string, id: string): string {
  return `/api/proxy/iptv/${tid}/${id}`
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/iptv.ts
git commit -m "feat: add getIptvProxyUrl helper"
```

---

### Task 5: 统一播放器实现 HLS/Web 双分支 + 自动回退

**Files:**
- Rewrite: `src/components/Player/IptvWebPlayer.tsx`

**Interfaces:**
- Consumes: `useApp()` 的 `settings.channelSource`；`getIptvUrlsUrl`、`getIptvProxyUrl`（Task 4）；`HlsPlayer`（现有）
- Produces: 组件 props 保持 `{ channel: IptvChannel; onBack: () => void }`，行为由全局 `channelSource` 决定

- [ ] **Step 1: 整体改写 IptvWebPlayer.tsx**

用以下完整实现替换整个文件（统一播放器 + effectiveSource 状态机 + 自动回退 + 源码切换按钮）：

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RiArrowLeftLine, RiRefreshLine, RiErrorWarningLine, RiPlayFill, RiPauseFill, RiFullscreenFill, RiFullscreenExitFill, RiComputerLine } from '@remixicon/react';
import { getIptvUrlsUrl, getIptvProxyUrl } from '../../utils/iptv';
import { IptvChannel } from '../../data/iptvChannels';
import { useApp } from '../../context/AppContext';
import HlsPlayer from './HlsPlayer';

interface IptvWebPlayerProps {
  channel: IptvChannel;
  onBack: () => void;
}

type Source = 'hls' | 'web';

const IptvWebPlayer: React.FC<IptvWebPlayerProps> = ({ channel, onBack }) => {
  const { settings } = useApp();
  const globalSource = settings.channelSource;

  const [streamUrls, setStreamUrls] = useState<string[]>([]);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [effectiveSource, setEffectiveSource] = useState<Source>(
    globalSource === 'hls' || globalSource === 'web' ? globalSource : 'hls'
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLoadTimer = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
  }, []);

  // 频道变化时重置有效源码
  useEffect(() => {
    setEffectiveSource(globalSource === 'hls' || globalSource === 'web' ? globalSource : 'hls');
    setStreamUrls([]);
    setCurrentUrlIndex(0);
    setError(null);
    setIsLoading(true);
    setIsPaused(false);
  }, [channel.tid, channel.id, globalSource]);

  // HLS：加载解密后的直链
  useEffect(() => {
    if (effectiveSource !== 'hls') return;
    setIsLoading(true);
    setError(null);
    setCurrentUrlIndex(0);
    fetch(getIptvUrlsUrl(channel.tid, channel.id))
      .then(r => r.json())
      .then(data => {
        if (data.urls && data.urls.length > 0) {
          setStreamUrls(data.urls);
        } else {
          if (globalSource === 'auto') {
            setEffectiveSource('web');
          } else {
            setError(data.error || '未找到可用线路');
          }
        }
      })
      .catch(() => {
        if (globalSource === 'auto') {
          setEffectiveSource('web');
        } else {
          setError('获取频道地址失败');
        }
      })
      .finally(() => setIsLoading(false));
  }, [effectiveSource, channel.tid, channel.id, globalSource]);

  // Web：iframe 15s 兜底消 loading
  useEffect(() => {
    if (effectiveSource !== 'web') return;
    loadTimerRef.current = setTimeout(() => {
      if (isLoading) {
        clearLoadTimer();
        setIsLoading(false);
      }
    }, 15000);
    return clearLoadTimer;
  }, [effectiveSource, channel.tid, channel.id]);

  const activeUrl = effectiveSource === 'hls' ? streamUrls[currentUrlIndex] ?? '' : '';

  const handleTouch = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const switchSource = useCallback(() => {
    setEffectiveSource(prev => (prev === 'hls' ? 'web' : 'hls'));
    setError(null);
    setIsLoading(true);
    setIsPaused(false);
  }, []);

  const handleRetry = useCallback(() => {
    if (effectiveSource === 'hls') {
      if (currentUrlIndex < streamUrls.length - 1) {
        setCurrentUrlIndex(i => i + 1);
      } else {
        setIsLoading(true);
        setError(null);
        fetch(getIptvUrlsUrl(channel.tid, channel.id))
          .then(r => r.json())
          .then(data => {
            if (data.urls && data.urls.length > 0) {
              setStreamUrls(data.urls);
              setCurrentUrlIndex(0);
            } else {
              setError(data.error || '未找到可用线路');
            }
          })
          .catch(() => setError('重试失败'))
          .finally(() => setIsLoading(false));
      }
    } else {
      setIsLoading(true);
      setError(null);
      if (iframeRef.current) iframeRef.current.src = getIptvProxyUrl(channel.tid, channel.id);
    }
  }, [effectiveSource, streamUrls, currentUrlIndex, channel]);

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleIframeLoad = useCallback(() => {
    clearLoadTimer();
    setIsLoading(false);
    setError(null);
  }, [clearLoadTimer]);

  const handleTogglePlay = useCallback(() => {
    setIsPaused(p => !p);
    if (effectiveSource === 'web' && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: 'iptv:toggle' }, '*');
      } catch { /* cross-origin, ignore */ }
    }
  }, [effectiveSource]);

  const onHlsError = useCallback(() => {
    if (currentUrlIndex < streamUrls.length - 1) {
      setCurrentUrlIndex(i => i + 1);
    } else if (globalSource === 'auto') {
      setEffectiveSource('web');
    } else {
      setError('所有线路均播放失败');
    }
  }, [currentUrlIndex, streamUrls.length, globalSource]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <RiErrorWarningLine className="w-16 h-16 text-red-400/60 mx-auto mb-4" />
          <div className="text-white/70 text-sm mb-4">{error}</div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleRetry} className="px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors">重试</button>
            {globalSource === 'auto' && (
              <button onClick={switchSource} className="px-6 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors">
                切到{effectiveSource === 'hls' ? '网页' : '直链'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black flex flex-col"
      ref={containerRef}
      onTouchStart={handleTouch}
      onMouseMove={handleTouch}
    >
      <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-4 bg-gradient-to-b from-black/90 to-transparent">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <RiArrowLeftLine className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold truncate">{channel.name}</div>
            <div className="text-white/50 text-xs truncate">{channel.currentProgram}</div>
          </div>
          {globalSource === 'auto' && (
            <button onClick={switchSource} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title={`当前${effectiveSource === 'hls' ? '直链' : '网页'}，点击切换`}>
              <RiComputerLine className="w-5 h-5" />
            </button>
          )}
          <button onClick={handleRetry} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="刷新/切线路">
            <RiRefreshLine className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mx-auto mb-4"></div>
              <div className="text-white/60 text-sm">正在加载 {channel.name}（{effectiveSource === 'hls' ? '直链' : '网页'}）...</div>
            </div>
          </div>
        )}

        {effectiveSource === 'hls' ? (
          <HlsPlayer
            key={`${channel.tid}-${channel.id}-${currentUrlIndex}`}
            url={activeUrl}
            onError={onHlsError}
          />
        ) : (
          <iframe
            key={`${channel.tid}-${channel.id}`}
            ref={iframeRef}
            src={getIptvProxyUrl(channel.tid, channel.id)}
            className="w-full h-full border-0"
            style={{ minHeight: 'calc(100vh - 56px)' }}
            allowFullScreen
            onLoad={handleIframeLoad}
          />
        )}
      </div>

      <div className={`absolute inset-x-0 bottom-0 flex items-center justify-between px-4 h-14 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
        <div className="flex items-center gap-1">
          <button onClick={handleTogglePlay} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            {isPaused ? <RiPlayFill className="w-5 h-5 text-white" /> : <RiPauseFill className="w-5 h-5 text-white" />}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-sm truncate max-w-[200px]">{channel.name}</span>
          <button onClick={handleToggleFullscreen} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            {document.fullscreenElement ? <RiFullscreenExitFill className="w-4 h-4 text-white" /> : <RiFullscreenFill className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IptvWebPlayer;
```

- [ ] **Step 2: 类型校验**

Run: `npm run build`
Expected: 编译通过，无 TS 报错（确认 `RiComputerLine` 在 @remixicon/react 存在；若不存在则替换为 `RiWifiLine`）。

- [ ] **Step 3: 手动验证三种模式**（iptv345 恢复后）

设置>频道源：
1. `仅 Web`：点任一频道 → iframe 网页播放，多线路下拉可见。
2. `仅 HLS`：播放为原生直链 HLS。
3. `自动`：正常频道直链播放；对无有效直链的频道 → 自动切到网页分支并在顶栏出现源码切换按钮；点击可在 直链↔网页 间切换。

- [ ] **Step 4: 提交**

```bash
git add src/components/Player/IptvWebPlayer.tsx
git commit -m "feat: unified player with HLS/Web source modes and auto fallback"
```

---

## Self-Review

**Spec 覆盖检查：**
- 第 1 节（后端 iframe 网页代理，保留 playURL）→ Task 1 ✓
- 第 2 节（channelSource 类型 + 默认 + 设置页 UI）→ Task 2, 3 ✓
- 第 3 节（统一播放器 + effectiveSource 状态机 + 自动回退 + 切换按钮）→ Task 4（helper）, 5 ✓
- 第 4 节（错误处理：HLS无线路/502→auto回退；Web超时→重试；整体不可达→明确错误不无限往返）→ Task 5 的 HLS fetch 失败分支与 iframe 15s 兜底 ✓

**占位符扫描：** 无 TBD/TODO；所有代码步骤含完整可执行代码与预期输出。

**类型一致性：** `channelSource: 'auto'|'hls'|'web'`（Task 2/3/5 一致）；`Source` 类型（Task 5）与 `sourceOptions` 的 id（Task 3）均为 `'auto'|'hls'|'web'`；`getIptvProxyUrl`（Task 4）与 Task 5/1 路由 `/api/proxy/iptv/:tid/:id` 一致；`getIptvUrlsUrl` 保持现有签名。

**待确认风险：** `RiComputerLine` 图标是否存在于 @remixicon/react —— Task 5 Step 2 已给出替换方案。