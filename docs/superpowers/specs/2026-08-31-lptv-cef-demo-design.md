# LPTV CEF Demo — OSR 离屏渲染视频直播

**日期**: 2026-08-31  
**状态**: 待实现  
**目标平台**: Linux x86_64（后续迁移至 LPK service）

---

## 1. 概述

在 Linux x86_64 机器上，用自建 CEF 二进制 + Node.js TypeScript IPC 桥，实现电视直播频道的 iframe 内嵌播放。验证 OSR 帧输出、Blob/MSE 播放检测、双源互备切换、DOM 广告清理等核心能力后，再迁移进 LPK service。

**当前不做的事**：
- 不做 React/前端 UI（复用已有 lptv/ 目录的 TV 导航界面即可）
- 不做 Android/TV 端集成（仅验证 Linux 单机）
- 不做 WebSocket 消费者侧（Node 起服务，调试用 curl/ws 工具即可）

---

## 2. 架构

```
┌─────────────────────────────────────────────────────────────┐
│  Linux x86_64                                              │
│                                                             │
│  ┌──────────────────────┐         Unix Socket              │
│  │  Node App            │◄────────────────────►  CEF 进程  │
│  │  (TypeScript)        │   /tmp/lptv.sock               │  (OSR)
│  │                      │                                │
│  │  - 频道管理          │   WebSocket TCP (127.0.0.1:8765)│
│  │  - 双源探测          │─────────────────────────► 消费者 │
│  │  - DOM 清理调度       │     ws://127.0.0.1:8765        │
│  │  - 帧缓冲 & 推送      │                                │
│  └──────────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

**双通道 IPC**：
- **控制信令**：Unix Domain Socket（JSON 报文，小体积，适合命令/事件）
- **媒体帧**：TCP WebSocket（PNG base64，大体积，大小帧分离）

---

## 3. CEF 进程

### 3.1 编译目标

自建 CEF 二进制，C++ 部分约 200 行，职责：
- 注册 `lptv://` 自定义 scheme handler
- OSR 离屏渲染（禁用 headless 模式）
- 监听导航完成事件，注入监控 JS
- 捕获 OnPaint 帧，通过 Unix Socket 转发给 Node

### 3.2 启动参数

```
--windowless-rendering          # OSR 模式（禁用 --headless）
--disable-web-security          # 允许跨域加载外部播放页
--disable-features=IsolateOrigins,site-per-process
--remote-debugging-port=0       # 关闭 DevTools 调试端口（不安全）
--single-process                # 单进程模式，减少 IPC 开销（demo 阶段）
```

### 3.3 C++ 关键设置

```cpp
CefSettings settings;
settings.windowless_rendering_enabled = true;  // OSR，非 headless
settings.remote_debugging_port = 0;
settings.no_sandbox = true;  // Linux root 环境必要
CefInitialize(settings, app);
```

### 3.4 自定义 Scheme `lptv://`

**职责边界**：
- **只做**：路由解析 → 跳转到外部真实 URL；配置 CSP 策略
- **不做**：在 scheme handler 响应里注入 JS（跨域隔离会失效）

**路由映射**：
```
lptv://play?id=1&t=ys           → https://www.789iptv.com/?act=play&token=xxx&tid=ys&id=1
lptv://play?id=1&t=ws&primary=0 → https://www.345iptv.com/?act=play&token=xxx&tid=ws&id=1
```

**JS 注入时机**：
- 监听 `OnNavigationCommitted` 事件
- 导航到目标 frame 完成后，调用 `frame->ExecuteJavaScript(js, frame->GetURL(), 0)`
- 注入脚本内容：监控 `<video>` 事件、iframe 数量变化、Blob URL 生成

### 3.5 OSR 帧输出

```cpp
void MyRenderHandler::OnPaint(CefRefPtr<CefBrowser> browser,
                               PaintElementType type,
                               const RectList& dirtyRects,
                               const void* buffer,   // RGBA pointer
                               int width, int height) {
    // 采样/压缩后通过 UDS 发给 Node
    send_frame_to_node(buffer, width, height, dirtyRects);
}
```

**帧策略**（demo 阶段）：
- 不做强制定时推送（节省带宽）
- 只在播放状态变化时推送：`playing` → 推首帧，`error` → 推错误帧
- 帧格式：PNG 编码（base64），分辨率 1280×720 采样

---

## 4. Node.js 应用（TypeScript）

### 4.1 目录结构

```
lptv-cef-demo/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts              # 入口：启动 CEF + 接管进程
│   ├── ipc/
│   │   ├── uds-server.ts    # Unix Socket 控制信令服务器
│   │   └── commands.ts      # 命令/事件类型定义
│   ├── channels/
│   │   ├── data.ts          # 频道列表（硬编码，双源备用）
│   │   └── probe.ts         # 双源可用性探测
│   ├── player/
│   │   ├── manager.ts       # 播放管理器：状态机、线路切换
│   │   └── monitor.ts       # 监控脚本生成与注入逻辑
│   ├── frame/
│   │   ├── capture.ts       # 帧接收 & PNG 编码
│   │   └── ws-server.ts     # WebSocket 帧推送服务
│   └── cleanup/
│       └── ad-cleaner.ts    # DOM 广告清理调度
└── scripts/
    └── start-cef.sh          # CEF 进程启动脚本
```

### 4.2 Unix Socket 协议

**路径**：`/tmp/lptv.sock`  
**启动时必须先 `unlink` 清除旧套接字**

#### Node → CEF 命令

| 命令 | 参数 | 说明 |
|------|------|------|
| `play` | `{ id: number, source?: 'primary'|'backup' }` | 播放指定频道 |
| `stop` | — | 停止播放，清空页面 |
| `switch_line` | — | 切换到下一条备用线路（最多 3 条） |
| `dom_cleanup` | — | 执行广告 DOM 清理脚本 |
| `set_frame_rate` | `{ fps: number }` | 设置帧推送模式（0=按需，1=定时 N fps） |

#### CEF → Node 事件

| 事件 | 字段 | 说明 |
|------|------|------|
| `play_success` | `{ url, frame_w, frame_h }` | 播放页加载成功，开始渲染 |
| `play_fail` | `{ reason: 'timeout'|'http_error'|'no_video' }` | 播放失败，触发自动切线 |
| `frame_ready` | `{ seq, w, h, size }` | 帧已发送确认 |
| `dom_cleared` | `{ removed_count }` | 广告 DOM 清理结果 |
| `process_alive` | — | CEF 心跳（每 5s） |

### 4.3 WebSocket 帧服务

**地址**：`ws://127.0.0.1:8765`  
**连接者**：调试工具、未来 TV/Android 端

#### 帧消息格式

```json
{ "type": "frame", "seq": 42, "w": 1280, "h": 720, "data": "<base64 png>" }
{ "type": "status",  "channel": "CCTV1", "state": "playing" }
{ "type": "error",   "code": "NO_VIDEO", "msg": "无视频流" }
```

#### 帧推送策略

- **按需模式**（默认）：状态变化时推送（playing/error/切换）
- **定时模式**：`set_frame_rate` 命令切换，按 fps 推送关键帧

---

## 5. 频道数据与双源互备

### 5.1 数据结构

每个频道绑定两个源，**token 和 id 完全相同，仅域名不同**：

```typescript
interface IChannel {
  id: number;
  name: string;
  category: '央视频道' | '卫视频道';
  primary: { tid: string; id: number; token: string };  // 789iptv
  backup:  { tid: string; id: number; token: string };  // 345iptv（与 primary 的 token/id 完全相同，仅域名不同）
}
```

### 5.2 可用性探测

启动时并行探测两个源：

```typescript
async function probeSource(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return resp.ok;
  } catch { return false; }
}
```

- 两源都可用 → 默认用 primary
- primary 不可用 → 自动切 backup
- 播放中 primary 失败 → 切 backup 并重试

### 5.3 频道列表来源

频道数据从 `src/data/iptvChannels.ts` 读取（现有项目文件），运行时转换为内部格式。不需要每次启动重新抓取。

---

## 6. 监控脚本注入逻辑

导航完成后，向目标 frame 注入以下 JS：

```javascript
(function() {
  // 1. 监听 video 事件
  document.addEventListener('playing', () => sendToNode({evt:'video_playing'}));
  document.addEventListener('error',   (e) => sendToNode({evt:'video_error', code: e.target.error?.code}));
  document.addEventListener('waiting', () => sendToNode({evt:'video_waiting'}));

  // 2. 检测 Blob/MSE URL 生成
  const origCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(obj) {
    const url = origCreateObjectURL(obj);
    sendToNode({evt:'blob_created', url});
    return url;
  };

  // 3. iframe 清理检测（定时轮询）
  setInterval(() => {
    const ifs = document.querySelectorAll('iframe').length;
    if (ifs === 0) sendToNode({evt:'ads_cleared'});
  }, 2000);
})();
```

通过 `frame->ExecuteJavaScript()` 注入，作用于目标 https frame 上下文（非 lptv:// 上下文）。

---

## 7. DOM 广告清理

**时机**：
- 导航完成后 3s 执行第一次
- 检测到 iframe 数量 > 0 时触发清理
- 每次频道切换时执行

**清理规则**（CSS 选择器黑名单）：
```css
iframe, .ad-container, [class*="ad"], [id*="ad"], 
[class*="banner"], [class*="popup"], video + div  /* 视频外的覆盖层 */
```

---

## 8. 错误处理与自动恢复

| 错误场景 | 处理策略 |
|----------|----------|
| CEF 进程崩溃 | Node 检测心跳超时（10s），自动重启 CEF |
| 播放超时（5s 无 playing 事件）| 触发 `switch_line`，最多 3 条线路 |
| 所有线路均失败 | WebSocket 推 `error` 帧，停止帧推送 |
| DOM 清理后仍无法播放 | 重新导航（清空 cache），重试一次 |

---

## 9. LPK 迁移路径（后续）

当前 demo 完成后，迁移到 LPK 只需改动：

1. **UDS 路径**：`/tmp/lptv.sock` → `/lzcapp/var/run/lptv.sock`（持久化目录）
2. **CEF 进程**：从独立进程改为容器内 service，通过 `services:` 声明
3. **WebSocket 端口**：127.0.0.1:8765 → lzcapp 内部路由转发
4. **启动脚本**：纳入 `lzc-build.sh` 的 `backend_launch_command` 或 setup_script

Node 业务逻辑层 **零改动**。

---

## 10. 验收标准

- [ ] CEF 以 OSR 模式启动，`OnPaint` 回调正常触发
- [ ] 点击频道列表 → CEF 加载 789iptv 播放页 → 播放成功 → WebSocket 推送首帧
- [ ] 主源失败 → 自动切换到备用源（345iptv）→ 播放恢复
- [ ] 播放页广告 iframe 被清理（数量归零）
- [ ] 频道切换流畅，无内存泄漏
- [ ] CEF 崩溃后 Node 自动重启并恢复播放状态
