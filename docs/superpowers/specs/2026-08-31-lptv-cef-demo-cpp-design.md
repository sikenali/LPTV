# LPTV CEF Demo — OSR 单二进制 C++ 实现

**日期**: 2026-08-31  
**状态**: 待实现  
**目标平台**: Linux x86_64 裸机（后续迁移至 LPK service）  
**范围**: 仅 C++ CEF 部分，不含 Node.js IPC 层

---

## 1. 概述

在 Linux x86_64 机器上，用**单 C++ 二进制**驱动 CEF OSR（离屏渲染），加载电视直播频道播放页，通过帧推送验证 OSR 能力与多源切换。暂不引入 Node.js IPC，所有命令/事件通过 `stderr`/stdin 输出供调试。验证通过后，再补充 Node.js 胶水层并迁移进 LPK。

**播放源优先级链（每个频道最多 4 路）**：

| 优先级 | 来源 | 域名 | 备注 |
|--------|------|------|------|
| 1 | 央视官网 | `tv.cctv.com/live/xxx` | 官方，iframe 嵌套友好 |
| 2 | 央视频 | `yangshipin.cn/tv/home?pid=xxx` | 官方，已加 Mobile UA 规避外跳 |
| 3 | 789iptv | `789iptv.com/?act=play&token=...&tid=...&id=...` | 第三方聚合（token 待获取，预留接口） |
| 4 | 345iptv | `345iptv.com/?act=play&token=...&tid=...&id=...` | 第三方聚合，兜底（token 待获取，预留接口） |

**当前不做的事**：
- 不做 Node.js TypeScript IPC（后续阶段）
- 不做 React/前端 UI（复用已有 lptv/ 目录）
- 不做 Unix Socket / WebSocket（验证阶段用 `stderr` 日志代替）
- 不做 DOM 广告清理（仅验证渲染框架）

---

## 2. 架构

```
┌──────────────────────────────────────────────────────────┐
│  Linux x86_64                                           │
│                                                          │
│  lptv-cef-demo/                                          │
│  ├── CMakeLists.txt                                     │
│  ├── third_party/libcef/                                │
│  │   └── (预编译 CEF 包，解压自 cef-builds.spotify.com) │
│  └── src/                                               │
│      ├── main.cpp       # CefSettings + CefExecuteProcess │
│      ├── app.cpp        # CefApp：scheme注册、导航监听    │
│      ├── handler.cpp    # CefRenderHandler：OnPaint      │
│      └── channels.h     # 34 频道硬编码数据              │
│                                                          │
│  ┌─────────────────────┐                               │
│  │  lptv-cef-demo binary │  OSR 渲染 → stderr 日志帧信息  │
│  └─────────────────────┘                               │
└──────────────────────────────────────────────────────────┘
```

**调试输出格式**（每行一行 JSON，方便 grep）：
```json
{"evt":"nav_started","url":"https://tv.cctv.com/live/cctv1/"}
{"evt":"nav_committed","url":"https://tv.cctv.com/live/cctv1/","w":1280,"h":720}
{"evt":"frame_paint","w":1280,"h":720,"size":3686400}
{"evt":"switch_line","from":0,"to":1,"url":"https://www.yangshipin.cn/tv/home?pid=600001859"}
```

---

## 3. CEF 二进制

### 3.1 预编译包获取

从 https://cef-builds.spotify.com/ 下载 **Linux x86_64 Minimal** 版本（Chrome 120，匹配 Mobile UA）：

```bash
# 下载（具体文件名以最新为准）
wget -O /tmp/cef_linux_minimal.tar.bz2 \
  "https://cef-builds.spotify.com/builds/cef-120.0.6096.90-linux64-minimal.tar.bz2"

# 解压
mkdir -p lptv-cef-demo/third_party/libcef
tar -xjf /tmp/cef_linux_minimal.tar.bz2 -C lptv-cef-demo/third_party/libcef --strip-components=1
```

包含文件：
- `libcef.so` — CEF 动态库
- `include/` — CEF C API 头文件
- `cefclient` — 参考示例（不编译）

### 3.2 编译参数

```cpp
CefSettings settings;
settings.windowless_rendering_enabled = true;  // OSR
settings.remote_debugging_port = 0;
settings.no_sandbox = true;                    // Linux root 环境必要
settings.single_process = true;                // Demo 阶段单进程
CefString(&settings.user_agent) = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
CefInitialize(settings, app);
```

### 3.3 自定义 Scheme `lptv://`

仅做路由解析，不做 JS 注入（避免跨域隔离问题）。

```
lptv://play?id=1&t=ys          → 取 channels[0].sources[0].url
lptv://play?id=1&t=ws&idx=2    → 取 channels[31].sources[2].url
```

Scheme handler 解析 URL，发 `nav_started` 事件，然后调用 `CefBrowserHost::LoadURL()` 跳转到真实 HTTPS URL。

### 3.4 OSR 帧输出

```cpp
class RenderHandler : public CefRenderHandler {
  void OnPaint(CefRefPtr<CefBrowser> browser,
               PaintElementType type,
               const RectList& dirtyRects,
               const void* buffer,
               int width, int height) override {
    // 只处理 ENTIRE_WINDOW 类型，采样整帧
    // 打印 frame_paint JSON 到 stderr
    // 注：demo 阶段不保存帧，仅打印元数据 + 首帧完整像素 dump
  }
};
```

**帧策略**：
- 不强制定时推送（节省带宽和 CPU）
- 只在首次 `OnPaint` 后持续推帧（表明渲染管线正常）
- 打印 `frame_paint` 日志，首帧额外保存 PNG 到 `/tmp/lptv-first-frame.png` 用于人工验证

---

## 4. 频道数据（C++ 硬编码）

从 `src/data/iptvChannels.ts` 提取为 C++ `struct`，34 个频道 × 最多 4 个 source。

```cpp
struct Source {
  int priority;
  std::string domain;  // "cctv"|"ysp"|"789"|"345"
  std::string url;
};

struct Channel {
  int id;
  std::string name;
  std::string category;
  std::vector<Source> sources;
};

constexpr Channel kChannels[] = {
  // CCTV 1-17
  {1,  "CCTV1 综合",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv1/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001859"},
    {3, "789",   ""},
    {4, "345",   ""},
  }},
  // ... 18-34: CCTV2-17 + 卫视 1-32（格式相同，789/345 留空占位）
};
```

**789/345 token 说明**：当前项目中未找到有效的 789iptv/345iptv token，本次 C++ 实现仅硬编码 priority 1（cctv）和 priority 2（ysp）的 URL。priority 3/4 的 URL 字段留空字符串占位，`--source 2/3` 时打印 `"error":"source_not_configured"` 并退出，待后续补充 token 后再启用。

### 4.1 数据源说明

| 源 | 说明 |
|----|------|
| cctv URL | 从 `iptvChannels.ts` 的 `url` 字段直接提取 |
| ysp URL | 从 `backupUrl` 字段（cctv 频道）或 `url` 字段（ysp 频道）提取 |
| 789/345 URL | **暂未配置**，C++ 代码中留空占位，`--source 2` 以上参数触发 error 事件后退出 |

---

## 5. C++ 代码结构

### 5.1 文件职责

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/main.cpp` | ~40 | `main()` 入口，解析命令行参数，初始化 CEF |
| `src/app.cpp` | ~80 | `MyApp` 类：scheme handler 注册、`OnBeforeCommandLineProcessing`、导航事件监听 |
| `src/handler.cpp` | ~60 | `MyRenderHandler` 类：`OnPaint`、`GetViewRect`、`GetScreenInfo` |
| `src/channels.h` | ~120 | 34 频道 + 136 条 source URL 的 constexpr 数组 |
| `src/logger.h` | ~20 | 统一 JSON 日志输出到 stderr |

### 5.2 命令行用法

```bash
# 播放指定频道（默认源）
./lptv-cef-demo --channel 1

# 播放指定频道 + 指定源索引（0=首选，1=备选，2=第三，3=兜底）
./lptv-cef-demo --channel 1 --source 1

# 循环播放多个频道（演示切换）
./lptv-cef-demo --channel 1 --loop --interval 10

# 退出
# Ctrl+C → 正常退出，打印统计信息
```

### 5.3 状态机

```
IDLE → LOADING → PLAYING → ERROR
                    ↓          ↓
                 PLAYING   → NEXT_SOURCE → LOADING
                          (最多 3 次重试)
```

- `LOADING`：导航中，不推送帧
- `PLAYING`：`OnPaint` 开始触发，输出 `frame_paint`
- `ERROR`：导航超时（30s 无 `frame_paint`），触发 `switch_line`

---

## 6. 验收标准

- [ ] 编译通过（CMake + g++ 14）
- [ ] `./lptv-cef-demo --channel 1` 启动后加载央视官网，stderr 输出 `nav_committed` 日志
- [ ] `OnPaint` 被调用，stderr 持续输出 `frame_paint`
- [ ] `/tmp/lptv-first-frame.png` 生成且可正常显示（有人物/画面）
- [ ] `--channel 1 --source 1` 切换到央视频道后正常渲染
- [ ] `--channel 1 --source 2`（789 未配置）打印 `source_not_configured` 错误日志并安全退出，不崩溃
- [ ] `--channel 1 --loop --interval 5` 循环切换时不崩溃、无内存泄漏
- [ ] 全部 34 个频道 ID（1-17 + 18-49）均可正常以 source=0 或 source=1 导航

---

## 7. 构建系统

```cmake
cmake_minimum_required(VERSION 3.20)
project(lptv-cef-demo)

set(CMAKE_CXX_STANDARD 17)

# 包含 CEF 头文件
include_directories(${CMAKE_SOURCE_DIR}/third_party/libcef/include)

# 链接 libcef
link_directories(${CMAKE_SOURCE_DIR}/third_party/libcef)

add_executable(lptv-cef-demo
  src/main.cpp
  src/app.cpp
  src/handler.cpp
  src/channels.h
  src/logger.h
)

target_link_libraries(lptv-cef-demo cef)

# 运行时找 libcef.so
set_target_properties(lptv-cef-demo PROPERTIES
  BUILD_RPATH "${CMAKE_SOURCE_DIR}/third_party/libcef"
  INSTALL_RPATH "${CMAKE_SOURCE_DIR}/third_party/libcef"
)
```

---

## 8. 后续迁移路径（Node.js 阶段，不在本次范围）

当前二进制验证完成后，下一步：

1. 保留 C++ 二进制，新增 Node.js IPC 层（Unix Socket）
2. C++ 将帧改为通过 UDS 发给 Node
3. Node 做四源探测、DOM 清理、广告拦截
4. 前端 TV 界面（`lptv/`）连接 WebSocket 接收帧

**C++ 层零改动**，只需增加帧转发接口。
