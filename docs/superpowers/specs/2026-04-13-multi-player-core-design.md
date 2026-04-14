# 多播放器内核切换设计文档

**日期：** 2026-04-13
**状态：** 待实现
**范围：** 播放器内核动态切换与设置持久化

---

## 问题描述

SettingsView 中存在播放器内核（hls/native/dplayer）和解码方式 UI，但仅为视觉壳子，未连接到实际播放逻辑。当前 VideoPlayer 硬编码使用 hls.js，不支持用户切换。

---

## 解决方案

### 架构概述

创建播放器设置 Store 持久化用户选择，VideoPlayer 根据设置动态选择播放器内核适配器。三个适配器实现统一接口，支持自动降级。

```
用户设置 → playerSettings Store → VideoPlayer 选择适配器 → 播放
                                      ↓ 失败
                                 自动降级到下一个可用内核
```

### 核心组件

| 组件 | 职责 |
|------|------|
| `player-settings.ts` | 播放器设置 Store，localStorage 持久化 |
| `VideoPlayer.vue` | 根据设置动态选择并初始化播放器内核 |
| `SettingsView.vue` | 连接 playerSettings Store，实时更新 |

---

## 详细设计

### 1. 播放器设置 Store (`src/stores/player-settings.ts`)

```ts
import { defineStore } from 'pinia'

type PlayerCore = 'hls' | 'native' | 'dplayer'
type DecodeMode = 'soft' | 'hard' | 'auto'
type Quality = 'auto' | '1080p' | '720p' | '480p'

const STORAGE_KEY = 'lptv_player_settings'

function loadDefaults(): { core: PlayerCore; decodeMode: DecodeMode; quality: Quality } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { core: 'hls', decodeMode: 'auto', quality: 'auto' }
}

export const usePlayerSettingsStore = defineStore('playerSettings', {
  state: () => loadDefaults(),
  actions: {
    setCore(core: PlayerCore) {
      this.core = core
      this._save()
    },
    setDecodeMode(decodeMode: DecodeMode) {
      this.decodeMode = decodeMode
      this._save()
    },
    setQuality(quality: Quality) {
      this.quality = quality
      this._save()
    },
    _save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        core: this.core,
        decodeMode: this.decodeMode,
        quality: this.quality
      }))
    }
  }
})
```

### 2. VideoPlayer 动态选择内核

VideoPlayer 监听 `playerSettingsStore.core` 变化，动态初始化对应播放器：

```ts
import { usePlayerSettingsStore } from '@/stores/player-settings'
import DPlayer from 'dplayer'

const playerSettings = usePlayerSettingsStore()

watch(() => playerSettings.core, () => {
  destroyPlayer()
  if (playerContainer.value) initPlayer()
})

function initPlayer() {
  const core = playerSettings.core
  switch (core) {
    case 'hls':
      initHlsPlayer()
      break
    case 'native':
      initNativePlayer()
      break
    case 'dplayer':
      initDPlayer()
      break
    default:
      initHlsPlayer()
  }
}
```

### 3. 三个播放器实现

#### HLS.js（当前逻辑提取）

```ts
function initHlsPlayer() {
  if (!Hls.isSupported()) { initNativePlayer(); return }
  // ... 现有 hls.js 逻辑，包含错误恢复策略
}
```

#### 原生 Video（Safari/iOS 回退）

```ts
function initNativePlayer() {
  const video = document.createElement('video')
  video.controls = false
  video.autoplay = true
  video.src = props.url
  // ... 事件绑定
}
```

#### DPlayer

```ts
let dp: DPlayer | null = null

function initDPlayer() {
  if (!playerContainer.value) return
  dp = new DPlayer({
    container: playerContainer.value,
    autoplay: true,
    video: { url: props.url, type: 'hls' },
    // 不使用弹幕等额外功能，保持轻量
  })

  dp.on('play', () => playerStore.play(props.url))
  dp.on('pause', () => playerStore.pause())
  dp.on('error', () => {
    playerStore.setError('频道暂时不可用')
    emit('error')
  })
}
```

### 4. SettingsView 连接 Store

```ts
import { usePlayerSettingsStore } from '@/stores/player-settings'

const playerSettings = usePlayerSettingsStore()

// 模板中直接绑定
// <button :class="{ active: playerSettings.core === 'hls' }"
//         @click="playerSettings.setCore('hls')">
```

### 5. 自动降级策略

```ts
function initPlayer() {
  const cores: PlayerCore[] = [playerSettings.core, 'hls', 'native']
  const uniqueCores = [...new Set(cores)]

  for (const core of uniqueCores) {
    try {
      switch (core) {
        case 'hls': initHlsPlayer(); return
        case 'native': initNativePlayer(); return
        case 'dplayer': initDPlayer(); return
      }
    } catch (e) {
      console.warn(`播放器 ${core} 初始化失败:`, e)
    }
  }
  playerStore.setError('无法初始化任何播放器')
  emit('error')
}
```

---

## 环境差异

| 环境 | 行为 |
|------|------|
| 所有环境 | DPlayer 需要额外加载，检查是否可用 |
| Safari | 原生 HLS 作为备选 |
| 不支持 HLS 的浏览器 | 降级到 native 或 DPlayer |

---

## 风险与限制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| DPlayer 体积较大（~200KB） | 增加 bundle 大小 | 已通过 manualChunks 分离，按需加载 |
| DPlayer 对 HLS 支持依赖 hls.js | 实际仍依赖 hls.js | DPlayer 内部使用 hls.js，提供统一 UI |
| 内核切换时播放器重建 | 短暂黑屏 | 显示 loading 状态过渡 |
