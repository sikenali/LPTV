# 播放器界面还原说明

## 概述

根据 Calicat 设计图，成功还原了两个主要界面：
1. **播放界面** (`PlayerView.vue`) - 完整的视频播放器界面
2. **无信号界面** (`NoSignalView.vue`) - 经典电视无信号测试卡界面

## 组件说明

### 1. PlayerView.vue - 播放界面

**文件位置**: `src/components/PlayerView.vue`

**功能特性**:
- ✅ 播放信息栏（频道Logo、频道名称、描述、收藏/全屏按钮）
- ✅ 视频播放窗口（支持自定义插槽）
- ✅ 播放控制栏
  - 进度条（带滑块）
  - 播放/暂停、上一个/下一个频道按钮
  - 时间显示
  - 音量控制
  - 节目单、画质选择按钮
- ✅ 节目预告栏
  - 今日节目列表
  - 正在播放标记
  - 日期显示

**Props 接口**:
```typescript
interface Props {
  channelName: string          // 频道名称
  channelDesc: string          // 频道描述
  logoText?: string            // Logo文字
  isFavorite?: boolean         // 是否收藏
  currentTime?: string         // 当前时间
  totalTime?: string           // 总时间
  progress?: number            // 进度百分比
  volume?: number              // 音量百分比
  programs?: ProgramItem[]     // 节目列表
}
```

**设计还原精度**:
- 完全按照设计图的尺寸、颜色、间距还原
- 使用 RemixIcon 图标库
- 采用深色主题配色
- 支持响应式布局

### 2. NoSignalView.vue - 无信号界面

**文件位置**: `src/components/NoSignalView.vue`

**功能特性**:
- ✅ 经典电视测试卡图案
  - 圆形测试卡边框
  - 顶部白色区域（含黑色标记块）
  - 黑白灰条纹
  - 彩色条（黄、青、绿、紫、红、蓝）
  - 黑色网格
  - 竖线测试图案（粗线、细线）
  - 灰度条
  - 底部黄/白色区域
- ✅ 两侧彩色竖条装饰
- ✅ 底部提示栏（"当前频道无信号"）
- ✅ 附加信息区域
  - 信号检查提示
  - 预计恢复时间

**Props 接口**:
```typescript
interface Props {
  message?: string        // 主提示文字
  checkMessage?: string   // 检查提示文字
  estimatedTime?: string  // 预计恢复时间
}
```

**设计还原精度**:
- 精确还原 SMPTE 测试卡图案
- 使用纯 CSS 实现所有视觉效果
- 严格按照设计图的色彩和布局

## 集成说明

### 在 ChannelView.vue 中使用

```vue
<template>
  <!-- 有信号时显示播放器 -->
  <PlayerView
    v-if="currentChannel && hasSignal"
    :channel-name="currentChannel.name"
    :channel-desc="`${currentChannel.groupName} · 正在播放`"
    :logo-text="currentChannel.name.split('-')[0]?.trim() || 'TV'"
    :is-favorite="currentChannel.isFavorite"
    @toggle-favorite="handleToggleFavorite(currentChannel)"
    @toggle-play="togglePlay"
    @prev-channel="prevChannel"
    @next-channel="nextChannel"
    @fullscreen="toggleFullscreen"
  >
    <template #player>
      <VideoPlayer :url="currentChannel.url" />
    </template>
  </PlayerView>

  <!-- 无信号时显示无信号界面 -->
  <NoSignalView
    v-else-if="currentChannel && !hasSignal"
    message="当前频道无信号"
    check-message="请检查信号源连接或切换至其他频道"
    estimated-time="预计信号恢复时间：08:00 - 09:30"
  />

  <!-- 未选择频道时显示空状态 -->
  <EmptyState v-else ... />
</template>
```

## 技术栈

- **框架**: Vue 3 + TypeScript
- **样式**: SCSS (Scoped)
- **图标**: @remixicon/vue
- **构建工具**: Vite

## 色彩规范

### 播放器界面
- 背景色: `rgba(15, 15, 20, 1)` (主背景)
- 卡片色: `rgba(30, 41, 59, 0.8)` (控制栏)
- 品牌色: `rgba(59, 130, 246, 1)` (进度条、按钮)
- 文字色: `rgba(248, 250, 252, 1)` (主文字)
- 辅助色: `rgba(148, 163, 184, 1)` (次要文字)

### 无信号界面
- 背景灰: `rgba(128, 128, 128, 1)`
- 测试卡白: `rgba(255, 255, 255, 1)`
- 测试卡黑: `rgba(0, 0, 0, 1)`
- 彩色条: 标准 SMPTE 色彩

## 字体规范

- 主字体: SourceHanSans (思源黑体)
  - Regular: 常规文本
  - Medium: 中等权重
  - SemiBold: 半粗体
  - Bold: 粗体
- 图标字体: remixicon

## 构建验证

项目已成功构建，无 TypeScript 错误：
```bash
npm run build
```

输出：
- ✅ TypeScript 类型检查通过
- ✅ Vite 构建成功
- ✅ 无编译错误
- ✅ 资源正确压缩

## 后续优化建议

1. **交互增强**
   - 进度条拖拽功能
   - 音量条点击调节
   - 键盘快捷键支持

2. **性能优化**
   - 测试卡图案使用 Canvas 渲染
   - 节目列表虚拟化滚动

3. **功能扩展**
   - 真实的信号检测逻辑
   - 节目单数据接入
   - 全屏模式实现

## 设计图源

- 播放界面: https://www.calicat.cn/design/2027295427009261568?node-id=d9aab529-4584-459d-8cfb-807d2c46be34
- 无信号界面: https://www.calicat.cn/design/2027295427009261568?node-id=9fb4fa64-15a7-46a7-93dd-04c7735e6037
