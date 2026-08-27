# 央视/卫视播放器重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精简 iframe 播放页，通过 video 事件实时检测缓冲状态，使用 LPTV 颜色变化动画作为缓冲指示器。

**Architecture:** 代理服务器清理 iptv345.com 页面并注入 postMessage 通信脚本，前端组件监听缓冲状态控制 LPTV 动画显示。

**Tech Stack:** Node.js (proxy-server.cjs), React + TypeScript (IptvWebPlayer.tsx)

## Global Constraints

- 保留 iptv345.com 原播放器完整逻辑（含线路自动切换、缓冲超时检测）
- LPTV 动画颜色序列：L=橙 #f97316, P=红 #ef4444, T=蓝 #3b82f6, V=绿 #22c55e
- 动画延迟序列：L(0s) → P(0.15s) → T(0.3s) → V(0.45s)
- 修改文件仅限：`scripts/proxy-server.cjs`、`src/components/Player/IptvWebPlayer.tsx`、`src/index.css`

---

### Task 1: 扩展广告过滤 + 增强 HTML 清理

**Files:**
- Modify: `scripts/proxy-server.cjs:84-120`

**Interfaces:**
- Consumes: 现有 AD_SRC_KW 和 AD_INLINE_KW 数组
- Produces: 更完整的广告过滤规则

- [ ] **Step 1: 扩展广告过滤关键词**

在 `scripts/proxy-server.cjs` 中扩展 AD_SRC_KW 和 AD_INLINE_KW：

```javascript
// 将第 84-91 行替换为：
const AD_SRC_KW = [
  'alwaysmulticulturallanding', 'popunder', 'popup',
  'n6wxm.com', 'cdn-cgi', '51\\.la', 'googletagmanager', 'gtag',
  'cfasync'  // Cloudflare 验证脚本
]
const AD_INLINE_KW = [
  'n6wxm.com/vignette', 'sdk.51.la/js-sdk-pro',
  'gtag(', 'dataLayer', '__CF',
  'LA_COLLECT',  // 51.la 统计
  'googletagmanager'
]
```

- [ ] **Step 2: 增强 HTML 清理规则**

在现有清理规则后（约第 120 行后）添加：

```javascript
// 移除隐藏 span（包含额外广告脚本）
html = html.replace(/<span\s+style="display:none"[^>]*>[\s\S]*?<\/span>/gi, '')
// 移除 popunder 脚本引用
html = html.replace(/<script\s+src=["']popunder[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '')
html = html.replace(/<script\s+src=["']popup[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '')
```

- [ ] **Step 3: 提交变更**

```bash
git add scripts/proxy-server.cjs
git commit -m "chore: extend ad filtering in iptv proxy"
```

---

### Task 2: 替换通信脚本为缓冲事件通知

**Files:**
- Modify: `scripts/proxy-server.cjs:132-147`

**Interfaces:**
- Consumes: Task 1 的清理后 HTML
- Produces: 注入新的 postMessage 通信脚本

- [ ] **Step 1: 替换 injectScript 内容**

将第 132-147 行的 injectScript 替换为：

```javascript
const injectScript = `<script>
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
  
  // 初始通知（延迟 1 秒确保播放器已初始化）
  setTimeout(function() {
    if (v && v.src) notifyBuffer(v.paused ? 'buffering' : 'playing');
  }, 1000);
})();
</script>`
```

- [ ] **Step 2: 提交变更**

```bash
git add scripts/proxy-server.cjs
git commit -m "feat: inject buffering event notification script"
```

---

### Task 3: 添加 LPTV 缓冲动画 CSS

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: 无
- Produces: 全局可用的 lptv-color-* 动画

- [ ] **Step 1: 在 index.css 末尾添加动画定义**

```css
/* LPTV buffering animation */
@keyframes lptv-color-1 { 0%,100%{color:#ffffff} 50%{color:#f97316} }
@keyframes lptv-color-2 { 0%,100%{color:#ffffff} 50%{color:#ef4444} }
@keyframes lptv-color-3 { 0%,100%{color:#ffffff} 50%{color:#3b82f6} }
@keyframes lptv-color-4 { 0%,100%{color:#ffffff} 50%{color:#22c55e} }
```

- [ ] **Step 2: 提交变更**

```bash
git add src/index.css
git commit -m "feat: add LPTV buffering animation CSS"
```

---

### Task 4: 重构 IptvWebPlayer 缓冲状态管理

**Files:**
- Modify: `src/components/Player/IptvWebPlayer.tsx`

**Interfaces:**
- Consumes: Task 2 的 postMessage 协议 `{ type: 'lptv:buffering', state: 'buffering'|'playing' }`
- Produces: `isBuffering` 状态用于渲染 LPTV 动画

- [ ] **Step 1: 添加 isBuffering 状态和相关 ref**

在组件顶部状态声明处（第 19-35 行附近）添加：

```typescript
const [isBuffering, setIsBuffering] = useState(false);
const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

在 `clearLoadTimer` 后添加：

```typescript
const clearBufferingTimeout = useCallback(() => {
  if (bufferingTimeoutRef.current) {
    clearTimeout(bufferingTimeoutRef.current);
    bufferingTimeoutRef.current = null;
  }
}, []);
```

- [ ] **Step 2: 替换旧的 postMessage 监听**

删除第 83-95 行的旧监听代码，替换为：

```typescript
// Web: 监听缓冲状态事件
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

- [ ] **Step 3: 更新频道切换时的重置逻辑**

在第 45-52 行的频道切换 effect 中，添加 `setIsBuffering(true)`：

```typescript
useEffect(() => {
  setEffectiveSource(globalSource === 'hls' || globalSource === 'web' ? globalSource : 'hls');
  setStreamUrls([]);
  setCurrentUrlIndex(0);
  setError(null);
  setIsLoading(true);
  setIsBuffering(true);
  setIsPaused(false);
}, [channel.tid, channel.id, globalSource]);
```

- [ ] **Step 4: 更新错误处理中的重置**

在第 125-150 行的 `handleRetry` 中，web 模式下添加：

```typescript
} else {
  setIsLoading(true);
  setIsBuffering(true);
  setError(null);
  setReloadKey(k => k + 1);
}
```

- [ ] **Step 5: 提交变更**

```bash
git add src/components/Player/IptvWebPlayer.tsx
git commit -m "feat: add buffering state management for web player"
```

---

### Task 5: 替换 loading 动画为 LPTV 动画

**Files:**
- Modify: `src/components/Player/IptvWebPlayer.tsx`

**Interfaces:**
- Consumes: Task 4 的 `isBuffering` 状态
- Produces: LPTV 颜色变化动画替代旋转 loading

- [ ] **Step 1: 替换 loading 渲染部分**

删除第 237-244 行的旋转 loading 代码，替换为：

```tsx
{(isLoading || isBuffering) && effectiveSource === 'web' && (
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

- [ ] **Step 2: 提交变更**

```bash
git add src/components/Player/IptvWebPlayer.tsx
git commit -m "feat: replace loading spinner with LPTV buffering animation"
```

---

### Task 6: 清理不再使用的代码

**Files:**
- Modify: `src/components/Player/IptvWebPlayer.tsx`

**Interfaces:**
- Consumes: 无
- Produces: 更简洁的代码

- [ ] **Step 1: 删除不再使用的 ref 和变量**

删除以下不再使用的代码：
- 第 32 行: `const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);`
- 第 37-42 行: `clearLoadTimer` 函数
- 第 97-108 行: 旧的 15 秒超时 effect（基于 loadTimerRef）
- 第 34 行: `const isLoadingRef = useRef(isLoading);`
- 第 35 行: `isLoadingRef.current = isLoading;`

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交变更**

```bash
git add src/components/Player/IptvWebPlayer.tsx
git commit -m "chore: clean up unused code in IptvWebPlayer"
```

---

### Task 7: 测试验证

**Files:**
- 无代码变更

**Interfaces:**
- Consumes: 所有前述任务
- Produces: 验证功能正常

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 访问 TV 模式验证**

1. 打开 http://localhost:5173/tv
2. 选择任意央视或卫视频道
3. 观察：
   - 初始加载时显示 LPTV 颜色动画
   - 视频开始播放后动画消失
   - 缓冲时（可切换线路触发）动画重新显示
   - iframe 内无广告、无 EPG、无频道选择器

- [ ] **Step 3: 验证 HLS 模式不受影响**

1. 切换到 HLS 源模式
2. 播放同一频道
3. 确认 LPTV 动画正常工作

- [ ] **Step 4: 最终提交（如有需要）**

```bash
git add -A
git commit -m "feat: refactor iptv web player with buffering detection"
```

---

## Self-Review Checklist

- [x] Task 1: 广告过滤扩展 - 覆盖所有已知广告域名
- [x] Task 2: 通信脚本 - 正确监听 waiting/playing 事件
- [x] Task 3: CSS 动画 - 颜色序列和延迟正确
- [x] Task 4: 状态管理 - isBuffering 正确更新
- [x] Task 5: 动画渲染 - 条件显示正确
- [x] Task 6: 代码清理 - 无遗留无用代码
- [x] Task 7: 测试验证 - 覆盖所有场景

## Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 精简 iframe 内容 | Task 1, 2 |
| 移除广告脚本 | Task 1 |
| 移除 EPG/导航 | Task 1 |
| 注入 postMessage 通信 | Task 2 |
| 监听 video 缓冲事件 | Task 2 |
| 添加 LPTV CSS 动画 | Task 3 |
| 前端状态管理 | Task 4 |
| 替换 loading 动画 | Task 5 |
| 清理无用代码 | Task 6 |
| 验收标准验证 | Task 7 |
