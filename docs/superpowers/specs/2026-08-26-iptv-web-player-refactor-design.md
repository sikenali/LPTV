# 央视/卫视播放器重构设计

**日期**: 2026-08-26  
**状态**: 待实现  
**范围**: 央视 (ys) + 卫视 (ws) 频道播放

---

## 背景

当前央视/卫视播放使用 iframe 嵌入 iptv345.com 页面，通过固定时间轮询检查 `vstPlayer` 的 src 来判断播放状态。该方案存在以下问题：

1. 缓冲检测不准确（固定 2 秒轮询）
2. iframe 内仍包含广告、EPG 列表、频道选择器等冗余内容
3. LPTV 颜色变化动画仅在 HLS 播放器中使用，iframe 模式使用旋转 loading

---

## 目标

1. 精简 iframe 内容，仅保留 video 播放器和必要脚本
2. 通过 video 事件的 waiting/playing 状态实时检测缓冲
3. 在 iframe 模式下也使用 LPTV 颜色变化动画作为缓冲指示
4. 彻底移除广告和相关追踪脚本

---

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      LPTV 前端 (React)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              IptvWebPlayer.tsx                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │                iframe (精简版)                    │  │  │
│  │  │  - video#vstPlayer                              │  │  │
│  │  │  - hls.js + mpegts.js                           │  │  │
│  │  │  - 原页面播放逻辑（含线路自动切换）               │  │  │
│  │  │  - postMessage 通信脚本                         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  监听 window message → lptv:buffering                │  │
│  │  → 控制 LPTV 动画显示/隐藏                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                    proxy-server.cjs                          │
│  GET /api/proxy/iptv/:tid/:id                               │
│  ├─ 抓取 iptv345.com 播放页                                 │
│  ├─ 清理广告脚本                                            │
│  ├─ 移除冗余 UI 元素                                        │
│  ├─ 注入 postMessage 通信脚本                                │
│  └─ 返回精简 HTML                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 详细设计

### 1. 代理服务器修改 (`scripts/proxy-server.cjs`)

#### 1.1 广告脚本过滤扩展

现有过滤关键词需扩展：

```javascript
const AD_SRC_KW = [
  'alwaysmulticulturallanding',
  'popunder',
  'popup',
  'n6wxm.com',
  'cdn-cgi',
  '51\\.la',
  'googletagmanager',
  'gtag',
  'cfasync',  // Cloudflare 验证脚本
]

const AD_INLINE_KW = [
  'n6wxm.com/vignette',
  'sdk.51.la/js-sdk-pro',
  'gtag(',
  'dataLayer',
  '__CF',
  'LA_COLLECT',  // 51.la 统计
  'googletagmanager',
]
```

#### 1.2 HTML 清理规则

除现有清理规则外，新增：

```javascript
// 移除底部版权
html = html.replace(/<div data-role="footer"[^>]*>[\s\S]*?<\/div>/gi, '')

// 移除 EPG 列表（由前端 EPG 面板替代）
html = html.replace(/<ul[^>]*id=["']myEpg["'][^>]*>[\s\S]*?<\/ul>/gi, '')

// 移除日期导航栏
html = html.replace(/<div data-role="navbar"[^>]*>[\s\S]*?<\/div>/gi, '')

// 移除频道选择下拉和全屏按钮
html = html.replace(/<li data-role="list-divider">[\s\S]*?<\/li>/gi, '')

// 移除提示文字
html = html.replace(/<div align="center">[\s\S]*?<\/div>/gi, '')
html = html.replace(/<center>[\s\S]*?<\/center>/gi, '')
```

#### 1.3 注入通信脚本

```javascript
const bufferNotifyScript = `<script>
(function() {
  function notifyBuffer(state) {
    try { window.parent.postMessage({ type: 'lptv:buffering', state: state }, '*'); } 
    catch(e) {}
  }
  
  var v = document.getElementById('vstPlayer');
  if (v) {
    v.onwaiting = function() { notifyBuffer('buffering'); };
    v.onplaying = function() { notifyBuffer('playing'); };
    v.onplay = function() { notifyBuffer('playing'); };
  }
  
  // 初始通知
  setTimeout(function() {
    if (v && v.src) notifyBuffer(v.paused ? 'buffering' : 'playing');
  }, 1000);
})();
</script>`;

html = html.replace('</head>', bufferNotifyScript + '</head>');
```

#### 1.4 样式调整

```css
/* 全屏播放器样式 */
<style>
  html, body { 
    margin: 0; 
    padding: 0; 
    background: #000; 
    overflow: hidden; 
    height: 100%; 
  }
  [data-role="page"] { min-height: 100vh; margin: 0; }
  #vstPlayer { 
    width: 100%!important; 
    height: 100vh!important; 
    aspect-ratio: unset!important; 
  }
  video#vstPlayer { 
    width: 100%!important; 
    height: 100%!important; 
    object-fit: contain; 
  }
  /* 隐藏所有 UI 元素 */
  .headerNfooter, 
  [data-role="navbar"], 
  .ui-grid-a, 
  #ad-container, 
  #errorTip,
  [data-role="list-divider"], 
  [data-role="listview"], 
  .ui-listview,
  select#playURL, 
  .ui-select, 
  .ui-btn, 
  button, 
  a[href],
  .ui-link, 
  center, 
  div[align] { 
    display: none !important; 
  }
</style>
```

---

### 2. 前端组件修改 (`src/components/Player/IptvWebPlayer.tsx`)

#### 2.1 状态管理

```typescript
const [isBuffering, setIsBuffering] = useState(false);
```

#### 2.2 消息监听

移除旧的 `iptv:playing` 监听，替换为：

```typescript
useEffect(() => {
  if (effectiveSource !== 'web') return;
  
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'lptv:buffering') {
      if (event.data.state === 'buffering') {
        setIsBuffering(true);
      } else if (event.data.state === 'playing') {
        setIsBuffering(false);
      }
    }
  };
  
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}, [effectiveSource]);
```

#### 2.3 加载状态处理

- 初始加载时 `setIsBuffering(true)`
- iframe onLoad 后不自动清除 buffering（改为由 postMessage 控制）
- 15 秒超时仍未收到 `playing` 消息则显示错误

#### 2.4 LPTV 动画渲染

```tsx
{isBuffering && (
  <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60">
    <div className="flex items-center gap-1">
      <span className="text-4xl font-black tracking-widest" 
            style={{ animation: 'lptv-color-1 1.2s ease-in-out infinite' }}>L</span>
      <span className="text-4xl font-black tracking-widest" 
            style={{ animation: 'lptv-color-2 1.2s ease-in-out infinite 0.15s' }}>P</span>
      <span className="text-4xl font-black tracking-widest" 
            style={{ animation: 'lptv-color-3 1.2s ease-in-out infinite 0.3s' }}>T</span>
      <span className="text-4xl font-black tracking-widest" 
            style={{ animation: 'lptv-color-4 1.2s ease-in-out infinite 0.45s' }}>V</span>
    </div>
  </div>
)}
```

#### 2.5 CSS 动画

从 `HlsPlayer.tsx` 提取共享动画：

```css
@keyframes lptv-color-1 { 0%,100%{color:#ffffff} 50%{color:#f97316} }
@keyframes lptv-color-2 { 0%,100%{color:#ffffff} 50%{color:#ef4444} }
@keyframes lptv-color-3 { 0%,100%{color:#ffffff} 50%{color:#3b82f6} }
@keyframes lptv-color-4 { 0%,100%{color:#ffffff} 50%{color:#22c55e} }
```

建议将动画定义移至 `src/index.css` 或创建共享样式文件。

---

### 3. 删除的代码

`IptvWebPlayer.tsx` 中删除：

```typescript
// 删除旧的轮询式 loading 检测
const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (effectiveSource !== 'web') return;
  loadTimerRef.current = setTimeout(() => {
    if (isLoadingRef.current) {
      clearLoadTimer();
      setIsLoading(false);
      setError('网页加载超时，请检查网络或重试');
    }
  }, 15000);
  return clearLoadTimer;
}, [effectiveSource, channel.tid, channel.id, reloadKey, clearLoadTimer]);

// 删除旧的 postMessage 监听
useEffect(() => {
  if (effectiveSource !== 'web') return;
  const onMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'iptv:playing') {
      clearLoadTimer();
      setIsLoading(false);
      setError(null);
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}, [effectiveSource, clearLoadTimer]);
```

---

## 数据流

```
1. 用户选择频道
   ↓
2. IptvWebPlayer 设置 effectiveSource='web'
   ↓
3. iframe 加载 /api/proxy/iptv/:tid/:id
   ↓
4. 代理服务器返回精简 HTML（含播放器逻辑 + postMessage 脚本）
   ↓
5. iptv345 播放器初始化，开始播放
   ↓
6. video#vstPlayer 触发 waiting 事件
   ↓
7. 注入脚本发送 postMessage { type: 'lptv:buffering', state: 'buffering' }
   ↓
8. LPTV 前端接收消息，setIsBuffering(true)
   ↓
9. 显示 LPTV 颜色变化动画
   ↓
10. video#vstPlayer 触发 playing 事件
   ↓
11. 发送 postMessage { type: 'lptv:buffering', state: 'playing' }
   ↓
12. setIsBuffering(false)，动画隐藏
```

---

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| iframe 15 秒内无响应 | 显示错误："网页加载超时，请检查网络或重试" |
| postMessage 通信失败 | 降级为旋转 loading，30 秒后超时 |
| 视频源失效 | iptv345 播放器自动切换线路，LPTV 层无需感知 |
| 跨域限制 | 同域 iframe（通过代理），无跨域问题 |

---

## 影响范围

### 修改文件
1. `scripts/proxy-server.cjs` — 代理逻辑增强
2. `src/components/Player/IptvWebPlayer.tsx` — 组件重构
3. `src/index.css` — 添加共享动画（可选）

### 无需修改
- `HlsPlayer.tsx` — 保持现有实现
- `IptvPlayer.tsx` — 其他播放器不受影响
- 频道数据、路由、上下文

---

## 验收标准

1. 央视/卫视频道播放时，LPTV 动画在缓冲期间显示，播放时隐藏
2. iframe 内无广告、无 EPG 列表、无频道选择器
3. 视频自动切换线路功能正常
4. 错误提示和重试功能正常
5. 与 HLS 模式播放互不影响

---

## 附录：iptv345.com 播放器关键代码

原页面播放器核心逻辑（保留）：

```javascript
// 解密函数
function avvtn(ccf) {
  ccf = ccf.split("").reverse().join("");
  ccf = ddfxx(ccf, tdsvx);
  ccf = ccf.replace("token=" + ytcen, "token=" + rqjbz);
  ccf = ccf.replace(tdsvx, "");
  return ccf;
}

// 播放流程
function startPlayer(uri, idx) {
  const puri = avvtn(uri);
  playM3U8(puri);  // 或 playFLV(puri)
}

// 缓冲检测
vstPlayer.onwaiting = () => {
  clearTimeout(bufferStallTimer);
  bufferStallTimer = setTimeout(() => {
    !isPlayingSuccess && (resetPlayer(), switchNextLine());
  }, BUFFER_TIMEOUT);  // 7000ms
};
```
