# CORS 跨域问题解决方案设计

**日期：** 2026-04-13  
**状态：** 待实现  
**范围：** 开发环境 CORS 代理配置

---

## 问题描述

LPTV 应用在以下两个场景遇到 CORS 跨域问题：

1. **获取 M3U 源文件** - 从 GitHub 等外部 URL 下载 M3U/M3U8 文件时被 CORS 阻止
2. **HLS 视频流播放** - hls.js 请求 .m3u8 播放列表或 .ts 视频片段时被 CORS 阻止

---

## 解决方案：Vite 代理 + URL 重写

### 架构概述

通过 Vite 开发服务器代理所有外部请求，将跨域请求转为同源请求：

```
浏览器 → Vite Dev Server (代理) → 外部 IPTV/流媒体服务器
         ↓ 代理转发
浏览器 ← Vite Dev Server ← 响应数据
```

### 核心组件

| 组件 | 职责 |
|------|------|
| `vite.config.ts` | 配置代理规则，匹配外部请求路径 |
| `src/services/http.ts` | URL 转换逻辑，将外部 URL 转为代理路径 |
| `src/components/VideoPlayer.vue` | HLS 请求重写，通过代理获取 .m3u8 和 .ts 文件 |

---

## 详细设计

### 1. Vite 代理配置 (`vite.config.ts`)

**现有配置：**
```ts
server: {
  proxy: {
    '/live3': { target: 'http://23.237.228.134', changeOrigin: true },
    '/gslb': { target: 'http://38.75.136.137:98', changeOrigin: true, rewrite: ... }
  }
}
```

**新增配置：**
```ts
server: {
  proxy: {
    // ... 保留现有配置
    
    // 通用 API 代理端点
    '/api/proxy': {
      target: 'https://example.com',  // 占位符，实际目标由 rewrite 动态设置
      changeOrigin: true,
      rewrite: (path) => {
        // 从查询参数 ?url= 中提取目标 URL
        // 此规则需要自定义代理逻辑
      },
      configure: (proxy) => {
        // 使用 http-proxy-middleware 事件处理动态目标
      }
    }
  }
}
```

**代理规则说明：**
- `/api/proxy?url=<encoded-target-url>` - 通用代理端点，动态设置目标
- 支持所有 HTTP 方法（GET/POST 等）
- `changeOrigin: true` 确保请求头正确

### 2. URL 转换逻辑 (`src/services/http.ts`)

**新增函数：**
```ts
function isDevEnvironment(): boolean {
  return import.meta.env.DEV
}

function toProxyUrl(url: string): string {
  if (!isDevEnvironment()) return url
  return `/api/proxy?url=${encodeURIComponent(url)}`
}
```

**修改 `fetchWithRetry`：**
```ts
export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<string> {
  const targetUrl = toProxyUrl(url)  // 开发环境转为代理 URL
  // ... 其余逻辑不变，使用 targetUrl 发起请求
}
```

### 3. HLS 视频流代理 (`src/components/VideoPlayer.vue`)

**修改 hls.js 配置：**
```ts
import Hls from 'hls.js'

function initPlayer() {
  if (Hls.isSupported()) {
    hls = new Hls({
      xhrSetup: (xhr, url) => {
        // 开发环境下将 .m3u8 和 .ts 请求通过代理转发
        if (import.meta.env.DEV && isExternalUrl(url)) {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`
          xhr.open('GET', proxyUrl, true)
        }
      }
    })
    hls.loadSource(import.meta.env.DEV ? toProxyUrl(props.url) : props.url)
    hls.attachMedia(video)
  }
}

function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}
```

---

## 数据流

### 获取 M3U 源文件
```
source-loader.ts
  → fetchWithRetry(url)
    → toProxyUrl(url) [开发环境]
      → /api/proxy?url=encodeURIComponent(url)
        → Vite 代理 → 外部服务器 → 响应
```

### 播放 HLS 视频流
```
VideoPlayer.vue
  → hls.loadSource(m3u8Url)
    → hls.config(xhrSetup) [重写 URL]
      → /api/proxy?url=encodeURIComponent(m3u8Url)
        → Vite 代理 → 流媒体服务器 → 响应
  
  → hls.js 内部请求 .ts 片段
    → xhrSetup 重写为代理 URL
      → Vite 代理 → 流媒体服务器 → 视频数据
```

---

## 错误处理

| 场景 | 处理策略 |
|------|----------|
| 代理连接失败 | 回退到直连（仅生产环境） |
| 目标服务器超时 | 保持现有超时逻辑（30s 默认） |
| HTTP 错误状态 | 保持现有 `!response.ok` 检查 |
| 代理配置错误 | 控制台输出代理状态日志 |

---

## 环境差异

| 环境 | 行为 |
|------|------|
| 开发 (`npm run dev`) | 所有外部请求通过 Vite 代理 |
| 生产 (`npm run build`) | 直连外部 URL（依赖服务器 CORS 支持） |

**注意：** 生产环境如需完全解决 CORS，需部署反向代理（如 Nginx）或使用方案 B/C。

---

## 测试策略

1. **单元测试** - 测试 `toProxyUrl` 函数转换正确性
2. **集成测试** - 验证代理配置能正确转发请求
3. **手动测试** - 启动 `npm run dev`，验证：
   - 从 GitHub 获取 M3U 文件成功
   - HLS 视频流正常播放
   - 浏览器控制台无 CORS 错误

---

## 风险与限制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 仅适用于开发环境 | 生产环境仍有 CORS 问题 | 生产环境需额外部署反向代理 |
| 代理性能开销 | 增加请求延迟 | 开发环境可接受，生产环境直连 |
| 相对路径资源 | .m3u8 中的相对 .ts 路径可能解析错误 | hls.js 自动处理 base URL |
