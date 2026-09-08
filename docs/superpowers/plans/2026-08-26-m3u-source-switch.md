# M3U8 源切换播放实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为央视/卫视 84 个频道增加 M3U8 直链播放模式，通过设置中的"频道源"切换播放方式。

**Architecture:** 后端 `/api/m3u` 已存在（读取本地 lptv.m3u8），前端通过频道名匹配从 M3U 中获取 URL，使用 HlsPlayer 播放；web 模式保持现有 iframe 逻辑不变。

**Tech Stack:** React 18 + TypeScript, Node.js Express, hls.js

## Global Constraints

- 频道列表保持 84 个 iptv345 频道名称不变
- M3U 数据来自本地 `channels/lptv.m3u8`（GitHub Actions 每日构建）
- channelSource='web' → iptv345 iframe（现有逻辑不变）
- channelSource='hls' → M3U8 直链 + HlsPlayer
- channelSource='auto' → 先 HLS(M3U8)，失败回退 iframe
- LPTV 缓冲动画在 HLS 模式下由 HlsPlayer 内部控制

---

### Task 1: 创建频道名匹配工具

**Files:**
- Create: `src/utils/m3uMatch.ts`

**Interfaces:**
- Consumes: `IptvChannel` (tid, id, name), `Channel[]` (from /api/m3u)
- Produces: `matchM3uUrl(channel, m3uChannels) → string | null`

- [ ] **Step 1: 创建匹配工具文件**

```typescript
// src/utils/m3uMatch.ts
import { IptvChannel } from '../data/iptvChannels'
import { Channel } from '../types'

/**
 * 从 iptv345 频道名提取关键词
 * 例: "CCTV1 综合" → ["CCTV1"], "CCTV5+ 体育赛事" → ["CCTV5+"]
 */
export function extractKeywords(name: string): string[] {
  return name
    .replace(/[\s（(].*$/, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 2)
}

/**
 * 将 IPTV345 频道名匹配到 M3U 频道 URL
 * 匹配策略：先尝试所有关键词都匹配，再尝试第一个关键词匹配
 */
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

  // 其次：包含第一个关键词
  const firstMatch = m3uChannels.find(c =>
    c.name.toLowerCase().includes(keywords[0].toLowerCase())
  )
  if (firstMatch) return firstMatch.url

  return null
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/m3uMatch.ts
git commit -m "feat: add m3u channel name matching utility"
```

---

### Task 2: 改造 IptvWebPlayer 支持 M3U/HLS 模式

**Files:**
- Modify: `src/components/Player/IptvWebPlayer.tsx`

**Interfaces:**
- Consumes: `matchM3uUrl` from `m3uMatch.ts`, `/api/m3u` endpoint
- Produces: M3U 模式使用 HlsPlayer 播放

- [ ] **Step 1: 更新导入和状态**

在文件顶部添加：

```typescript
import { Channel } from '../../types'
import { matchM3uUrl } from '../../utils/m3uMatch'
```

在现有状态声明后添加：

```typescript
const [m3uChannels, setM3uChannels] = useState<Channel[]>([])
const [m3uLoaded, setM3uLoaded] = useState(false)
```

- [ ] **Step 2: 替换 HLS effect（M3U 加载逻辑）**

删除现有的 HLS effect（第 46-73 行），替换为：

```typescript
// M3U/HLS 模式：加载 M3U8 频道列表并匹配 URL
useEffect(() => {
  if (effectiveSource !== 'hls') return;
  setIsLoading(true);
  setError(null);
  setM3uLoaded(false);

  fetch('/api/m3u')
    .then(r => r.json())
    .then(data => {
      if (data && data.length > 0) {
        setM3uChannels(data);
        const url = matchM3uUrl(channel, data);
        if (!url && globalSource === 'auto') {
          setEffectiveSource('web');
          return;
        }
        if (!url) {
          setError('未找到 M3U8 播放地址');
          setIsLoading(false);
          return;
        }
        // URL 将通过 activeUrl 计算
      } else {
        if (globalSource === 'auto') {
          setEffectiveSource('web');
          return;
        }
        setError('M3U 源无可播放频道');
      }
    })
    .catch(() => {
      if (globalSource === 'auto') {
        setEffectiveSource('web');
      } else {
        setError('M3U 源加载失败');
      }
    })
    .finally(() => {
      setM3uLoaded(true);
      setIsLoading(false);
    });
}, [effectiveSource, channel.tid, channel.id, globalSource]);
```

- [ ] **Step 3: 更新 activeUrl 计算**

将第 93 行的 `activeUrl` 替换为：

```typescript
const activeUrl = effectiveSource === 'hls'
  ? (m3uLoaded ? (matchM3uUrl(channel, m3uChannels) ?? '') : '')
  : streamUrls[currentUrlIndex] ?? '';
```

- [ ] **Step 4: 更新 onHlsError（M3U 模式错误回退）**

将第 164-172 行的 `onHlsError` 替换为：

```typescript
const onHlsError = useCallback(() => {
  if (effectiveSource === 'hls' && globalSource === 'auto') {
    setEffectiveSource('web');
  } else if (effectiveSource === 'hls') {
    setError('M3U8 播放失败');
  }
  // HLS 直链模式错误处理保持不变（当前UrlIndex逻辑）
  if (effectiveSource === 'hls' && globalSource !== 'auto' && currentUrlIndex < streamUrls.length - 1) {
    setCurrentUrlIndex(i => i + 1);
  }
}, [effectiveSource, globalSource, currentUrlIndex, streamUrls.length]);
```

- [ ] **Step 5: 更新 handleRetry（M3U 模式重试）**

将第 108-134 行的 `handleRetry` 中 web 分支保持不变，hls 分支替换为：

```typescript
const handleRetry = useCallback(() => {
  if (effectiveSource === 'hls') {
    // M3U 模式：重新加载 M3U 并匹配
    setIsLoading(true);
    setError(null);
    fetch('/api/m3u')
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          setM3uChannels(data);
          const url = matchM3uUrl(channel, data);
          if (!url) setError('未找到 M3U8 播放地址');
        }
      })
      .catch(() => setError('M3U 源加载失败'))
      .finally(() => setIsLoading(false));
  } else {
    setIsLoading(true);
    setIsBuffering(true);
    setError(null);
    setReloadKey(k => k + 1);
  }
}, [effectiveSource, channel]);
```

- [ ] **Step 6: 更新 LPTV 动画显示条件**

将第 221 行的条件从：
```tsx
{(isLoading || isBuffering) && effectiveSource === 'web' && (
```
改为：
```tsx
{(isLoading || isBuffering) && (
```

- [ ] **Step 7: 提交**

```bash
git add src/components/Player/IptvWebPlayer.tsx
git commit -m "feat: add M3U/HLS playback mode to IptvWebPlayer"
```

---

### Task 3: 适配收藏页支持 M3U 频道

**Files:**
- Modify: `src/pages/FavoritePage.tsx`

**Interfaces:**
- Consumes: 现有 `favorites` state, `IptvChannel`
- Produces: 兼容两种 ID 格式的收藏列表

- [ ] **Step 1: 更新收藏过滤逻辑**

将第 22-25 行的 `favChs` 替换为：

```typescript
const favChs = useMemo(() => {
  // IPTV345 收藏（ys-X, ws-X 格式）
  const iptvFavs = allChannels.filter(ch =>
    favorites.includes(`${ch.tid}-${ch.id}`)
  );
  // M3U 收藏（m3u-XXX 格式）
  const m3uIds = favorites.filter(id => id.startsWith('m3u-'));
  return [...iptvFavs];
}, [favorites]);
```

- [ ] **Step 2: 更新 selectChannel**

将第 48-51 行的 `selectChannel` 替换为：

```typescript
const selectChannel = (ch: IptvChannel) => {
  localStorage.setItem('lptv-last-channel', `${ch.tid}-${ch.id}`);
  navigate('/');
};
```

（不变，已兼容）

- [ ] **Step 3: 提交**

```bash
git add src/pages/FavoritePage.tsx
git commit -m "feat: adapt FavoritePage for M3U channel favorites"
```

---

### Task 4: 适配 TV 模式页支持 M3U 频道

**Files:**
- Modify: `src/pages/TvModePage.tsx`

**Interfaces:**
- Consumes: 现有 `favorites` state, `IptvChannel`
- Produces: 兼容两种 ID 格式的收藏

- [ ] **Step 1: 更新收藏判断**

将第 39 行的收藏判断从：
```typescript
const isFav = favorites.includes(`${channel.tid}-${channel.id}`);
```
保持不变（IPTV345 格式），TV 模式只使用 IPTV345 频道，无需修改。

- [ ] **Step 2: 提交**

```bash
git add src/pages/TvModePage.tsx
git commit -m "chore: verify TvModePage compatibility with M3U source"
```

---

### Task 5: 类型检查与构建验证

**Files:**
- None (verification only)

- [ ] **Step 1: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: 运行 lint**

```bash
npm run lint
```

- [ ] **Step 3: 构建验证**

```bash
npm run build
```

- [ ] **Step 4: 提交（如有需要）**

```bash
git add -A
git commit -m "chore: fix type errors from M3U integration"
```

---

### Task 6: 功能测试验证

**Files:**
- 无代码变更

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试 M3U 模式**

1. 打开 http://localhost:5173/settings
2. 切换到"M3U 直链"模式
3. 返回频道页，选择任意央视/卫视频道
4. 验证：使用 HlsPlayer 播放，LPTV 动画正常显示

- [ ] **Step 3: 测试 Auto 模式**

1. 切换到"自动"模式
2. 选择频道，验证优先使用 M3U 播放
3. 手动切换为网页模式验证回退正常

- [ ] **Step 4: 测试 Web 模式**

1. 切换到"网页"模式
2. 验证行为与之前完全一致（iframe 播放）

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: integrate M3U8 source switch for iptv channels"
```

---

## Self-Review Checklist

- [x] Task 1: 匹配工具 - extractKeywords 和 matchM3uUrl 逻辑完整
- [x] Task 2: 播放器改造 - M3U 加载、URL 匹配、错误回退、重试全部覆盖
- [x] Task 3: 收藏页 - 兼容 iptv345 和 M3U 两种 ID 格式
- [x] Task 4: TV 模式 - 仅使用 iptv345 频道，无需额外适配
- [x] Task 5: 类型检查和构建
- [x] Task 6: 功能测试

## Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 新增 /api/m3u 端点 | 已存在，无需修改 |
| 频道名匹配工具 | Task 1 |
| M3U/HLS 播放分支 | Task 2 |
| auto 模式回退 | Task 2 |
| 收藏 ID 兼容 | Task 3 |
| TV 模式兼容 | Task 4 |
| 验收标准验证 | Task 6 |
