# LPTV 电视直播播放器 - 设计文档

> 版本: 1.0  
> 日期: 2026-04-13  
> 状态: 待实现

## 1. 项目概述

LPTV 是一款现代简洁的电视直播播放类 Web 应用，支持频道浏览、收藏管理和直播源配置。采用深色主题，布局规整清晰，适配电脑端/电视端交互。

### 核心功能
- 自动解析 m3u/m3u8 直播源，按类型分组展示频道
- 频道收藏与快速访问
- 直播源导入（URL/本地文件）与定时自动更新
- 流畅的视频播放体验

### 技术栈
- **前端框架**: Vue 3 + TypeScript + Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **视频播放**: DPlayer + Hls.js
- **数据存储**: SQLite (sql.js)
- **样式**: SCSS + CSS 变量
- **打包**: 优先 Web 应用，可扩展为 Electron 桌面应用

---

## 2. 整体架构

```
LPTV/
├── src/
│   ├── main.ts                 # 应用入口
│   ├── App.vue                 # 根组件（三栏布局框架）
│   ├── views/                  # 页面视图
│   │   ├── ChannelView.vue     # 频道界面（默认首页）
│   │   ├── FavoriteView.vue    # 收藏界面
│   │   └── SettingsView.vue    # 设置界面
│   ├── components/             # 公共组件
│   │   ├── TopNavbar.vue       # 顶部导航栏
│   │   ├── ChannelGroup.vue    # 频道分组（折叠/展开）
│   │   ├── ChannelItem.vue     # 频道列表项
│   │   ├── VideoPlayer.vue     # 视频播放器封装
│   │   ├── FavoriteCard.vue    # 收藏卡片
│   │   ├── SourceItem.vue      # 源列表项
│   │   └── EmptyState.vue      # 空白占位提示
│   ├── stores/                 # Pinia 状态管理
│   │   ├── channel.ts          # 频道数据、分组、切换
│   │   ├── favorite.ts         # 收藏管理
│   │   ├── source.ts           # 直播源管理、解析、更新
│   │   └── player.ts           # 播放器状态
│   ├── db/                     # SQLite 数据库
│   │   ├── database.ts         # 数据库初始化
│   │   ├── models/             # 数据模型定义
│   │   └── queries/            # 查询操作封装
│   ├── services/               # 业务逻辑服务
│   │   ├── m3u-parser.ts       # m3u/m3u8 解析服务
│   │   ├── scheduler.ts        # 定时更新调度器
│   │   └── http.ts             # HTTP 请求封装
│   ├── styles/                 # 全局样式
│   │   ├── variables.scss      # 设计变量（颜色、字号等）
│   │   └── global.scss         # 全局样式重置
│   └── types/                  # TypeScript 类型定义
│       ├── channel.d.ts
│       ├── source.d.ts
│       └── player.d.ts
├── public/                     # 静态资源
│   └── logo.svg
└── package.json
```

---

## 3. 界面布局

### 3.1 整体布局

```
┌─────────────────────────────────────────────────────┐
│  顶部导航栏 (固定高度 60px)                           │
│  [Logo LPTV]                    [频道] [收藏] [设置]  │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  左侧边栏     │          主内容区                     │
│  (可变宽度)   │        (自适应剩余空间)                │
│              │                                      │
│  • 频道分组   │    • 频道页 → 播放器 + 右侧频道列表     │
│  • 收藏列表   │    • 收藏页 → 卡片网格布局             │
│  • 设置菜单   │    • 设置页 → 列表式配置项              │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### 3.2 色彩方案（深色主题）

| 元素 | 颜色 | 用途 |
|------|------|------|
| 背景主色 | `#141414` | 页面主背景 |
| 背景次色 | `#1f1f1f` | 面板/侧边栏背景 |
| 卡片/面板 | `#2a2a2a` | 卡片、弹窗、下拉菜单 |
| 边框/分割线 | `#333333` | 边框、分隔线 |
| 主要文字 | `#ffffff` | 标题、重要信息 |
| 次要文字 | `#999999` | 描述、提示文字 |
| 品牌主色 | `#3b82f6` | Logo、按钮、高亮 |
| 高亮/选中 | `#60a5fa` | 选中态、悬停态 |
| 收藏爱心 | `#ef4444` | 收藏图标（实心/空心切换） |
| 成功 | `#22c55e` | 操作成功提示 |
| 错误 | `#ef4444` | 错误提示 |

### 3.3 排版规范

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| 标题 | 20px | bold | Logo、页面标题 |
| 副标题 | 16px | semibold | 分组标题、卡片标题 |
| 正文 | 14px | normal | 列表项、描述文字 |
| 辅助 | 12px | normal | 时间戳、状态标签 |

---

## 4. 页面设计

### 4.1 顶部导航栏 (`TopNavbar.vue`)

- **高度**: 60px，固定顶部
- **左侧**: Logo SVG (32×32) + "LPTV" 文字（20px, bold, 白色）
- **右侧**: 三个导航按钮，上图标下文字布局
  - 图标尺寸: 24×24，线性风格，简约设计
  - 间距: 按钮间距 24px
  - 未选中态: 图标 `#999`，文字 `#999`
  - 选中态: 图标 `#3b82f6`，文字 `#3b82f6`，底部 2px 蓝色下划线
  - 切换动画: 颜色过渡 200ms ease

### 4.2 频道界面 (`ChannelView.vue`)

**布局结构:**
```
┌──────────────┬──────────────────────────────────────┐
│ 频道列表      │ 视频播放区                            │
│ (280px 固定)  │ (自适应宽度)                          │
│              │                                      │
│ ▼ 央视频道(12)│  ┌──────────────────────────────┐    │
│   ├─ CCTV-1 ❤️│  │                              │    │
│   ├─ CCTV-2 ♡ │  │      DPlayer 播放器           │    │
│   └─ CCTV-5 ♡ │  │      16:9 比例               │    │
│ ▶ 卫视频道(8)  │  │                              │    │
│ ▶ 地方频道(15) │  └──────────────────────────────┘    │
│ ▶ 其他频道(5)  │  当前频道：CCTV-1    [♡ 收藏]        │
└──────────────┴──────────────────────────────────────┘
```

**频道列表区:**
- 宽度: 280px，固定
- 背景: `#1f1f1f`
- 滚动: 垂直滚动，自定义滚动条样式（窄条，hover 显示）
- 分组项 结构:
  - 标题栏: 左侧箭头图标 (▶/▼) + 分组名 + 括号内频道数量
  - 点击切换折叠/展开，箭头旋转 90° 动画
  - hover 背景: `#2a2a2a`
- 频道项 结构:
  - 左侧: 频道名称（14px，白色）
  - 右侧: 爱心收藏图标（空心 ♡ / 实心 ❤️）
  - hover 背景: `#333333`
  - 当前播放频道: 左侧蓝色竖线标记 + 背景高亮 `#2a2a2a`
- 折叠动画: CSS `max-height` 过渡 300ms ease

**视频播放区:**
- 播放器容器: 16:9 比例，黑色背景 `#000`，占满可用高度
- 播放器: DPlayer 实例，自定义主题色 `#3b82f6`
- 播放信息栏:
  - 左侧: "当前频道：XXX"（14px）
  - 右侧: 收藏按钮（爱心图标 + "收藏"文字）
  - 背景: `#1f1f1f`，padding 12px

### 4.3 收藏界面 (`FavoriteView.vue`)

**空白状态:**
```
┌──────────────────────────────────────┐
│                                      │
│            [❤️ 64×64]                 │
│        还没有收藏任何频道              │
│      前往频道页添加你的收藏吧          │
│                                      │
└──────────────────────────────────────┘
```
- 居中显示，flex 布局，垂直居中
- 图标: 64×64，颜色 `#333`
- 主文字: "还没有收藏任何频道"（16px，`#666`）
- 辅助文字: "前往频道页添加你的收藏吧"（14px，`#999`）

**卡片网格布局（已收藏）:**
- 网格: CSS Grid，`grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`
- 卡片间距: 16px
- 卡片设计:
  - 圆角: 8px
  - 背景: `#2a2a2a`
  - padding: 16px
  - hover: 阴影提升 `box-shadow: 0 4px 12px rgba(0,0,0,0.3)`，transform `translateY(-2px)`
  - 内容: 频道名称（16px，白色）+ 底部爱心图标（右侧对齐）
- 删除交互: 点击爱心 → 卡片缩小淡出动画（300ms）→ 从列表移除

### 4.4 设置界面 (`SettingsView.vue`)

**布局结构:**
```
┌────────────┬──────────────────────────────────────┐
│ 子菜单      │ 内容区                                │
│ (200px)    │                                      │
│ • 源管理    │  ┌──────────────────────────────┐    │
│ • 定时更新  │  │ [+ 导入源] 按钮               │    │
│            │  └──────────────────────────────┘    │
│            │  ┌──────────────────────────────┐    │
│            │  │ 我的直播源                    │    │
│            │  │ http://example.com/live.m3u  │    │
│            │  │ 状态: ✅ 正常  更新: 10:00    │    │
│            │  │ [使用此源] [编辑] [删除]      │    │
│            │  └──────────────────────────────┘    │
└────────────┴──────────────────────────────────────┘
```

**子菜单:**
- 宽度: 200px
- 背景: `#1f1f1f`
- 菜单项: padding 12px 16px，hover `#2a2a2a`
- 选中态: 左侧 3px 蓝色竖线，背景 `#2a2a2a`，文字 `#3b82f6`

**源管理模块:**
- 导入源按钮: 蓝色主按钮（`#3b82f6` 背景，白色文字），圆角 6px
- 源列表项:
  - 卡片样式: 背景 `#2a2a2a`，圆角 8px，padding 16px
  - 顶部: 源名称（16px，白色）
  - 中部: URL 地址（12px，`#999`，单行截断）
  - 底部: 状态标签 + 更新时间 + 操作按钮
  - 状态标签: ✅ 正常（绿色）/ ❌ 异常（红色）/ ⏳ 解析中（黄色）
  - 操作按钮: "使用此源"（主按钮）、"编辑"（次按钮）、"删除"（危险按钮，红色文字）

**导入源弹窗:**
- 标题: "导入直播源"
- Tab 切换: "URL 地址" / "本地文件"
- Tab 1 - URL 输入:
  - 输入框: 全宽，placeholder "请输入 m3u/m3u8 地址"
  - 源名称输入: 可选，默认使用文件名
  - 底部按钮: [取消] [导入并解析]
- Tab 2 - 本地文件:
  - 拖拽区域: 虚线边框，文字 "拖拽文件到此处 或 点击选择"
  - 支持格式: .m3u, .m3u8
  - 选择后显示文件名 + 大小
  - 底部按钮: [取消] [导入]

**定时更新模块:**
- 全局设置区:
  - 标签: "更新周期"
  - 下拉选择器: 选项 [每 1 小时] [每 6 小时] [每天] [每周] [自定义]
  - 快捷按钮: 单选按钮组样式，点击即选中
- 自定义时间选择器（选择"自定义"时展开）:
  - 数字输入 + 单位选择（分钟/小时/天）
- 状态显示:
  - "下次自动更新: 2026-04-13 16:00"
  - "上次更新: 2026-04-13 10:00"
- 操作按钮: [立即更新] [保存设置]

---

## 5. 数据模型

### 5.1 频道 (Channel)

```typescript
interface Channel {
  id: string              // UUID
  name: string            // 频道名称，如 "CCTV-1"
  url: string             // 播放地址
  groupId: string         // 所属分组 ID
  groupName: string       // 分组名称，如 "央视频道"
  logo?: string           // 频道 Logo URL（可选）
  tvgId?: string          // EPG ID
  tvgName?: string        // EPG 名称
  isFavorite: boolean     // 是否已收藏
  sourceId: string        // 来源源 ID
  createdAt: Date
  updatedAt: Date
}
```

### 5.2 直播源 (Source)

```typescript
interface Source {
  id: string              // UUID
  name: string            // 源名称
  url: string             // 源地址（URL 或本地路径）
  type: 'url' | 'file'    // 类型
  status: 'active' | 'error' | 'parsing' // 状态
  channelCount: number    // 频道数量
  lastUpdateAt: Date | null // 最后更新时间
  lastError?: string      // 最后错误信息
  createdAt: Date
}
```

### 5.3 更新规则 (UpdateRule)

```typescript
interface UpdateRule {
  id: string
  sourceId: string        // 关联源 ID
  interval: number        // 间隔时间（分钟）
  intervalUnit: 'minute' | 'hour' | 'day' | 'week'
  nextUpdateAt: Date      // 下次更新时间
  enabled: boolean        // 是否启用
}
```

### 5.4 收藏 (Favorite)

```typescript
interface Favorite {
  id: string
  channelId: string       // 频道 ID
  addedAt: Date           // 添加时间
}
```

---

## 6. 状态管理 (Pinia Stores)

### 6.1 channelStore

```typescript
interface ChannelState {
  groups: ChannelGroup[]      // 频道分组列表
  expandedGroups: Set<string> // 已展开的分组 ID
  currentChannel: Channel | null // 当前播放频道
  loading: boolean            // 加载状态
}

interface ChannelGroup {
  id: string
  name: string
  channels: Channel[]
  isExpanded: boolean
}

// Actions
- loadChannels(sourceId: string): Promise<void>
- toggleGroup(groupId: string): void
- selectChannel(channel: Channel): void
- updateChannelList(channels: Channel[]): void
- searchChannels(keyword: string): Channel[]
```

### 6.2 favoriteStore

```typescript
interface FavoriteState {
  favorites: Channel[]  // 已收藏频道列表
  loading: boolean
}

// Actions
- loadFavorites(): Promise<void>
- addFavorite(channel: Channel): Promise<void>
- removeFavorite(channelId: string): Promise<void>
- isFavorite(channelId: string): boolean
- toggleFavorite(channel: Channel): Promise<void>
```

### 6.3 sourceStore

```typescript
interface SourceState {
  sources: Source[]          // 已添加的源列表
  activeSourceId: string | null // 当前使用的源 ID
  updateRules: Map<string, UpdateRule> // 源更新规则
  lastUpdateTime: Date | null
}

// Actions
- addSource(source: Source): Promise<void>
- removeSource(sourceId: string): Promise<void>
- switchSource(sourceId: string): Promise<void>
- updateSource(sourceId: string): Promise<void>
- setUpdateRule(rule: UpdateRule): Promise<void>
- triggerImmediateUpdate(sourceId: string): Promise<void>
```

### 6.4 playerStore

```typescript
interface PlayerState {
  isPlaying: boolean
  currentUrl: string | null
  error: string | null
  volume: number        // 0-1
  muted: boolean
  loading: boolean
}

// Actions
- play(url: string): void
- pause(): void
- setVolume(vol: number): void
- toggleMute(): void
- setError(msg: string | null): void
- reset(): void
```

---

## 7. 核心服务

### 7.1 M3U 解析服务 (`m3u-parser.ts`)

**功能:**
- 解析标准 m3u/m3u8 格式
- 提取 `#EXTINF` 标签信息（tvg-id, tvg-name, tvg-logo, group-title）
- 提取频道名称和播放 URL
- 按 group-title 自动分组

**解析流程:**
```
原始文本 → 按行分割 → 识别 #EXTINF 行 → 提取元数据 → 
关联下一行 URL → 构建 Channel 对象 → 按分组聚合 → 返回结果
```

**容错处理:**
- 忽略空行和注释行
- 处理缺少 `#EXTINF` 的情况（使用 URL 作为频道名）
- 处理编码问题（UTF-8, GBK 自动检测）

### 7.2 定时更新调度器 (`scheduler.ts`)

**功能:**
- 根据 UpdateRule 配置周期触发更新
- 使用 `setInterval` + 时间校准
- 支持立即触发手动更新
- 记录更新历史和下次更新时间

**调度策略:**
```
1. 应用启动时加载所有 enabled 规则
2. 计算每个规则的 nextUpdateAt
3. 设置定时器到最近的 nextUpdateAt
4. 触发更新 → 解析源 → 对比频道变化 → 更新数据库 → 通知 Store
5. 更新 nextUpdateAt → 重新设置定时器
```

### 7.3 HTTP 服务 (`http.ts`)

**功能:**
- 封装 fetch 请求
- 自动重试（最多 3 次，指数退避）
- 超时控制（默认 30 秒）
- 统一错误处理

---

## 8. 数据库设计 (SQLite)

### 8.1 表结构

**sources 表:**
```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('url', 'file')),
  status TEXT NOT NULL DEFAULT 'parsing',
  channel_count INTEGER DEFAULT 0,
  last_update_at DATETIME,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**channels 表:**
```sql
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  logo TEXT,
  tvg_id TEXT,
  tvg_name TEXT,
  source_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX idx_channels_group ON channels(group_id);
CREATE INDEX idx_channels_source ON channels(source_id);
```

**favorites 表:**
```sql
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE INDEX idx_favorites_channel ON favorites(channel_id);
```

**update_rules 表:**
```sql
CREATE TABLE update_rules (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  interval INTEGER NOT NULL,
  interval_unit TEXT NOT NULL CHECK(interval_unit IN ('minute', 'hour', 'day', 'week')),
  next_update_at DATETIME NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);
```

---

## 9. 错误处理策略

| 场景 | 处理方式 |
|------|----------|
| 直播源 URL 无效 | 弹窗提示"源地址无法访问，请检查后重试"，保留用户输入 |
| M3U 解析失败 | 显示错误详情（如格式错误、编码问题），提供重试选项 |
| 播放流加载失败 | 播放器内显示"频道暂时不可用，请稍后重试"，提供切换其他频道快捷入口 |
| SQLite 写入失败 | 静默重试 3 次，仍失败则提示"数据存储异常，请刷新页面" |
| 定时更新失败 | 记录错误日志，下次周期重试，设置页显示最近失败时间 |
| 网络断开 | 顶部显示全局提示条"网络连接已断开"，恢复后自动重连 |

**全局错误边界:**
- Vue 内置 `errorCaptured` 钩子捕获组件级错误
- 未捕获错误统一处理，显示友好错误页，不暴露技术细节

---

## 10. 关键交互细节

### 10.1 频道切换流畅性
- 点击频道 → 立即显示 loading 骨架屏 → 播放器加载 → 成功播放/失败提示
- 目标切换延迟 < 500ms（不含网络加载）
- 播放器切换时销毁旧实例，避免内存泄漏

### 10.2 收藏操作即时反馈
- 点击爱心 → 图标立即切换（乐观更新）→ 后台异步写数据库
- 收藏界面删除 → 卡片缩小淡出动画（300ms）→ 从列表移除
- 网络请求失败时回滚状态，提示用户

### 10.3 分组折叠/展开
- 点击分组标题 → 箭头旋转 90° + 列表平滑展开/收起
- CSS `max-height` 过渡动画，避免重排
- 默认所有分组折叠，用户手动展开

### 10.4 播放器状态保持
- 切换导航页面再返回 → 播放器继续播放（通过 Vue `keep-alive` 缓存）
- 切换频道 → 销毁旧播放器实例，创建新实例
- 页面刷新/刷新浏览器 → 播放状态不保持（Web 限制）

---

## 11. 测试策略

| 测试类型 | 覆盖范围 | 工具 |
|----------|----------|------|
| 单元测试 | M3U Parser 解析逻辑、SQLite CRUD 操作、工具函数 | Vitest |
| 组件测试 | 频道列表展开/折叠、收藏添加/删除、设置表单验证 | Vitest + @vue/test-utils |
| E2E 测试 | 完整流程：导入源 → 解析频道 → 切换播放 → 收藏频道 | Playwright |
| 集成测试 | 源导入 → 数据库写入 → 频道界面更新全链路 | Vitest |

**核心测试用例:**
1. **M3U 解析**: 标准格式、异常格式、空文件、大文件（1000+ 频道）、编码问题
2. **频道切换**: 正常加载、URL 无效、播放失败降级、快速连续切换
3. **收藏管理**: 增删查、重复添加处理、空状态显示、乐观更新回滚
4. **定时更新**: 周期触发、手动触发、冲突处理、失败重试
5. **源管理**: URL 导入、文件导入、解析失败、源切换

---

## 12. 性能优化

- **虚拟滚动**: 频道列表超过 100 项时启用虚拟滚动
- **懒加载**: 播放器组件懒加载，减少首屏体积
- **缓存策略**: 频道数据缓存，避免重复解析
- **防抖节流**: 搜索输入防抖（300ms）、滚动事件节流
- **分包加载**: Vue Router 路由懒加载，按页面分包
- **数据库优化**: 频道列表查询使用索引，避免全表扫描

---

## 13. 后续扩展

### Electron 桌面化
- 使用 Electron 包装 Web 应用
- 本地文件访问支持（直接读取本地 m3u 文件）
- 系统托盘图标，后台播放
- 开机自启动选项
- 全局快捷键（播放/暂停、音量控制）

### 功能扩展
- EPG 节目单支持
- 频道搜索/过滤
- 播放历史记录
- 多源自动切换（主源失败时切换备用源）
- 导出收藏/源配置

---

*文档结束*
