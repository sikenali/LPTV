# CEF TV Player — 设计文档

> 日期：2026-09-08
> 状态：待实施

## 1. 目标

在 Linux（懒猫云盒子）上，用 CEF（Chromium Embedded Framework）复现 lptv Android WebView 的完整播放链路：

- 加载远程官方直播网页（yangshipin.cn 等）
- 模拟 Android `assets://` 本地 JS 注入 → 劫持播放
- DOM 识别 `<video>` 标签 → hls.js MSE 解码
- 广告 DOM 屏蔽
- 键盘 + JSON IPC 模拟 TV 遥控器换台
- 原生窗口全屏播放

## 2. 选型决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| 目标平台 | Linux（优先） | 懒猫盒子运行环境 |
| 渲染模式 | 原生窗口（非 windowless） | 全屏播放，无需帧截图 |
| JS 库来源 | 复用 lptv 资源 | `dy-hls.min.js`、`dy-http-util.js`、`CryptoJS` |
| 频道面板 | CEF 内嵌 HTML | 与播放同进程，零延迟 |
| 控制方式 | 键盘 + JSON IPC 双通道 | 兼容本地遥控和外部程序控制 |

## 3. 架构

### 3.1 进程模型

单一 CEF 进程，原生窗口全屏显示。

```
┌─────────────────────────────────────────────┐
│  cef-tv (CEF Native Window)                 │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ channels.html   │  │ yangshipin.cn    │  │
│  │ (频道面板)       │  │ (播放页)          │  │
│  │                 │  │                  │  │
│  │ 列表 + 选中高亮 │  │ <video> + hls.js │  │
│  └─────────────────┘  └──────────────────┘  │
│          ↑              ↑                    │
│     window.LPTV_*  ◄─── JS 注入 API        │
└─────────────────────────────────────────────┘
         ↑
    stdin  ←  JSON IPC (外部程序)
    stdout →  状态上报
```

### 3.2 目录结构

```
cef-framework/
├── CMakeLists.txt
├── src/
│   ├── main.cpp              # CEF初始化 + JSON IPC主循环
│   ├── app.cpp               # CefApp实现
│   ├── browser_handler.h/.cpp  # 浏览器生命周期
│   ├── load_handler.h/.cpp     # JS/CSS注入逻辑
│   ├── render_handler.h/.cpp   # 原生窗口渲染
│   ├── resource_handler.h/.cpp # assets-local://虚拟协议
│   └── logger.h
├── resources/
│   ├── channels.html         # 内嵌频道面板UI
│   ├── channels.json         # 频道列表数据
│   └── js/
│       ├── dy-hls.min.js     # HLS.js（lptv版本）
│       ├── dy-http-util.js   # HttpUtil类
│       ├── crypto-js.min.js  # CryptoJS
│       └── inject/
│           ├── yangshipin.js # 央视频站点劫持脚本
│           └── hebei.js      # 河北卫视API解密脚本
└── scripts/
    └── run.sh                # 启动脚本
```

## 4. 组件设计

### 4.1 resource_handler — assets-local:// 虚拟协议

拦截特定 URL scheme，返回磁盘本地文件内容，模拟 Android `assets://`：

| 请求 URL | 磁盘路径 | MIME Type |
|---|---|---|
| `assets-local://dy-hls.min.js` | `resources/js/dy-hls.min.js` | `application/javascript` |
| `assets-local://dy-http-util.js` | `resources/js/dy-http-util.js` | `application/javascript` |
| `assets-local://crypto-js.min.js` | `resources/js/crypto-js.min.js` | `application/javascript` |
| `assets-local://inject/yangshipin.js` | `resources/js/inject/yangshipin.js` | `application/javascript` |
| `assets-local://inject/hebei.js` | `resources/js/inject/hebei.js` | `application/javascript` |
| `assets-local://channels.html` | `resources/channels.html` | `text/html` |

### 4.2 load_handler — JS/CSS 注入

**注入时机**：`OnLoadEnd` 且为主 frame 时触发。

**注入流程**：
1. 检测 URL 类型（yangshipin.cn / hebei.tv 等）
2. 注入基础库：`<script src='assets-local://dy-hls.min.js'>` 等
3. 注入站点劫持脚本（按 URL 类型选择）
4. 注入广告屏蔽 CSS

**yangshipin.cn 特殊处理**：
- CSS：隐藏 header、sidebar、控制面板，仅保留 `.container`（播放器区域）
- JS：MutationObserver 监听动态插入的广告节点，自动隐藏

### 4.3 browser_handler — 浏览器生命周期

- `on_before_popup`：拦截新窗口，改为在当前帧导航
- `OnFullscreenModeChange`：CEF 检测到页面 `requestFullscreen()` 时，宿主窗口同步全屏
- 窗口大小：默认 1920×1080，支持 `--width` / `--height` 参数

### 4.4 JSON IPC — 外部控制协议

**输入（stdin，一行一 JSON）**：

| cmd | 参数 | 说明 |
|---|---|---|
| `chan` | `index: number` | 按频道列表索引切换 |
| `chan_url` | `url: string` | 直接导航到指定 URL |
| `fs` | `state: bool` | 全屏开关 |
| `panel` | `show: bool` | 频道面板显示/隐藏 |
| `refresh` | — | 强制刷新当前页面 |
| `exit` | — | 退出程序 |
| `volume` | `delta: number` | 音量加减（-10 ~ +10） |

**输出（stdout，事件驱动）**：

| evt | 字段 | 说明 |
|---|---|---|
| `chan_changed` | `name, url, index` | 频道已切换 |
| `error` | `msg, url` | 错误信息 |
| `fullscreen` | `state` | 全屏状态变化 |
| `nav_started` | `url` | 开始导航 |
| `load_failed` | `url, error` | 页面加载失败 |

### 4.5 键盘映射

| 按键 | 动作 |
|---|---|
| ↑ | 上一个频道 |
| ↓ | 下一个频道 |
| ← | 音量 -5 |
| → | 音量 +5 |
| Enter | 确认 / 全屏切换（面板激活时切台） |
| ESC | 隐藏面板 / 退出全屏 |
| F2 | 切换面板显示/隐藏 |
| 0-9 | 输入频道号（300ms 内连续输入） |

## 5. JS 层设计

### 5.1 内置 API：window.LPTV_*

CEF 向页面注入全局 API，供频道面板 JS 调用：

```javascript
// 切换频道
window.LPTV.switchChannel(index) // number → 按索引
window.LPTV.switchChannel(url)   // string → 直接URL

// 全屏控制
window.LPTV.setFullscreen(state: boolean)

// 面板控制
window.LPTV.showPanel()
window.LPTV.hidePanel()

// 获取当前状态
window.LPTV.getChannelInfo() // { name, url, index }
```

### 5.2 站点劫持脚本 — yangshipin.js

职责：
1. 轮询检测 `<video>` 标签出现
2. 读取页面原始 `video.src`（通常为 m3u8）
3. 若为加密源，调用 `HttpUtil` + `CryptoJS` 解密获取真实地址
4. 调用 `playLive(realUrl)` 替换播放源
5. MutationObserver 实时屏蔽广告 DOM

```javascript
// 伪代码
(function() {
  function waitVideo() {
    const video = document.querySelector('video');
    if (!video) { setTimeout(waitVideo, 500); return; }

    // 广告屏蔽
    document.querySelectorAll('.ad, .advert, [class*="ad-"]').forEach(el => el.style.display = 'none');
    const obs = new MutationObserver(ms => {
      ms.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1 && /ad|advert|popup/i.test(n.className)) n.style.display = 'none';
      }));
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // 接管播放
    const origSrc = video.src;
    if (isEncryptedStream(origSrc)) {
      decryptAndPlay(origSrc).then(url => playLive(url));
    } else {
      playLive(origSrc);
    }
  }
  waitVideo();
})();
```

### 5.3 频道面板 — channels.html

单文件 HTML，内嵌 CSS + JS：
- 左侧：频道列表（logo + 名称），滚动显示，选中项高亮
- 右侧：留空（让 CEF 页面占满），面板隐藏时完全不遮挡
- 默认隐藏，F2 呼出
- 通过 `window.LPTV.*` API 与 C++ 层通信

## 6. 频道数据格式 — channels.json

```json
{
  "channels": [
    {
      "id": "cctv1",
      "name": "CCTV-1",
      "logo": "CCTV1.png",
      "url": "https://yangshipin.cn/#/tv/50500001",
      "player": "yangshipin"
    },
    {
      "id": "hebei",
      "name": "河北卫视",
      "logo": "hebei.png",
      "url": "https://www.hebtv.com/",
      "player": "hebei",
      "children": [
        { "name": "河北卫视", "args": { "catalogId": "32557" } }
      ]
    }
  ]
}
```

- `player` 字段决定使用哪个注入脚本（`yangshipin` / `hebei`）
- `children` 支持多源降级（播放失败自动尝试下一个）

## 7. 错误处理

| 场景 | 处理方式 |
|---|---|
| HLS 播放失败（fatal error） | 自动尝试 `children` 下一源；无更多源则输出 `error` 事件 |
| CEF 页面加载失败 | 输出 `{"evt":"load_failed","url":"...","error":"..."}`，等待 IPC 指令 |
| JSON IPC 解析错误 | 忽略无效行，打印警告到 stderr |
| 全屏切换失败 | 降级为窗口模式，不崩溃 |
| CEF 初始化失败 | 输出错误信息到 stderr，退出码 1 |
| 频道列表为空 | 输出提示，等待 IPC 输入 URL |

## 8. 构建与部署

### 8.1 本地构建

```bash
cd cef-framework
mkdir build && cd build
cmake .. -DCEF_ROOT=/path/to/cef_binary
make -j$(nproc)
./cef-tv --channel=cctv1
```

### 8.2 LPK 打包

`lzc/build.sh` 中新增步骤：
1. 编译 `cef-tv` 二进制
2. 复制 `resources/` 目录到 LPK 内容目录
3. 复制 CEF 运行时（`libcef.so` + `cef_client` 等）到 LPK
4. `start.sh` 启动 `./cef-tv`，配置环境变量 `CEF_ROOT` 指向 CEF 运行时路径

### 8.3 启动参数

```
./cef-tv [选项]
  --channel <id>     指定初始频道 ID（默认第一个）
  --url <url>        直接加载指定 URL
  --width <px>       窗口宽度（默认 1920）
  --height <px>      窗口高度（默认 1080）
  --no-panel         启动时不显示频道面板
  --fullscreen       启动时直接进入全屏
```

## 9. 与现有 LPTV 的关系

- `cef-framework/` 作为独立子项目存在于 LPTV 仓库中
- LPK 部署时，`cef-tv` 替代原来的 proxy-server 作为主进程
- LPTV React 前端可作为外部控制面板（通过 JSON IPC）连接到 `cef-tv`
- 频道列表 `channels.json` 与现有 `src/data/iptvChannels.ts` 数据对齐
