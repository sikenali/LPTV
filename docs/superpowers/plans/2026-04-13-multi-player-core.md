# 多播放器内核切换实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 hls.js、native、DPlayer 三个播放器内核的动态切换，并将设置持久化到 localStorage

**架构：** 创建 player-settings Store 持久化用户选择，VideoPlayer 监听设置变化动态初始化对应播放器内核，SettingsView 连接 Store 实现实时切换。

**技术栈：** Vue 3、Pinia、hls.js、DPlayer、TypeScript、localStorage

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/stores/player-settings.ts` | 播放器设置 Store，localStorage 持久化 | 创建 |
| `src/components/VideoPlayer.vue` | 根据设置动态选择播放器内核 | 修改 |
| `src/views/SettingsView.vue` | 连接 player-settings Store | 修改 |

---

### 任务 1：创建播放器设置 Store

**文件：**
- 创建：`src/stores/player-settings.ts`

- [ ] **步骤 1：创建 Store 文件**

```typescript
import { defineStore } from 'pinia'

export type PlayerCore = 'hls' | 'native' | 'dplayer'
export type DecodeMode = 'soft' | 'hard' | 'auto'
export type Quality = 'auto' | '1080p' | '720p' | '480p'

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

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无与 player-settings.ts 相关的类型错误

- [ ] **步骤 3：Commit**

```bash
git add src/stores/player-settings.ts
git commit -m "feat: 创建播放器设置 Store，支持 localStorage 持久化"
```

---

### 任务 2：重构 VideoPlayer 支持动态内核切换

**文件：**
- 修改：`src/components/VideoPlayer.vue`

- [ ] **步骤 1：添加 player-settings Store 导入和监听**

修改 `<script>` 顶部：

```typescript
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Hls from 'hls.js'
import DPlayer from 'dplayer'
import { usePlayerStore } from '@/stores/player'
import { usePlayerSettingsStore, type PlayerCore } from '@/stores/player-settings'
import { isExternalUrl, toProxyUrl } from '@/services/http'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ error: [] }>()
const playerContainer = ref<HTMLElement | null>(null)
let hls: Hls | null = null
let dp: DPlayer | null = null
let recoveryAttempts = 0
const MAX_RECOVERY_ATTEMPTS = 3
const playerStore = usePlayerStore()
const playerSettings = usePlayerSettingsStore()

onMounted(() => { if (playerContainer.value) initPlayer() })
onBeforeUnmount(() => { destroyPlayer() })
watch(() => props.url, () => { destroyPlayer(); if (playerContainer.value) initPlayer() })
// 监听内核设置变化
watch(() => playerSettings.core, () => { destroyPlayer(); if (playerContainer.value) initPlayer() })
```

- [ ] **步骤 2：重构 initPlayer 函数为分发器**

```typescript
function initPlayer() {
  if (!playerContainer.value) return
  playerStore.setLoading(true)
  recoveryAttempts = 0

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

- [ ] **步骤 3：重命名现有 hls.js 逻辑为 initHlsPlayer**

```typescript
function initHlsPlayer() {
  if (!Hls.isSupported()) { initNativePlayer(); return }
  const video = document.createElement('video')
  video.controls = false
  video.autoplay = true
  video.style.width = '100%'
  video.style.height = '100%'
  playerContainer.value!.appendChild(video)

  hls = new Hls({
    maxLoadingDelay: 10,
    maxMaxBufferLength: 30,
    maxBufferLength: 10,
    maxBufferSize: 60 * 1000 * 1000,
    startLevel: -1,
    capLevelToPlayerSize: true,
    enableWorker: true,
    xhrSetup: (xhr, requestUrl) => {
      if (import.meta.env.DEV && isExternalUrl(requestUrl)) {
        xhr.open('GET', toProxyUrl(requestUrl), true)
      }
    }
  })

  hls.loadSource(toProxyUrl(props.url))
  hls.attachMedia(video)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    playerStore.setLoading(false)
    recoveryAttempts = 0
    video.play().catch(() => playerStore.setError('自动播放被阻止，请点击播放按钮'))
  })

  hls.on(Hls.Events.ERROR, (_event, data) => {
    playerStore.setLoading(false)
    if (data.fatal) {
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        recoveryAttempts++
        hls?.startLoad()
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        recoveryAttempts++
        hls?.recoverMediaError()
      } else {
        playerStore.setError('频道暂时不可用，请稍后重试')
        emit('error')
      }
    }
  })

  hls.on(Hls.Events.LEVEL_LOADED, () => { playerStore.setLoading(false); recoveryAttempts = 0 })
  hls.on(Hls.Events.FRAG_LOADED, () => { recoveryAttempts = 0 })

  video.onplay = () => { playerStore.play(props.url); playerStore.setLoading(false) }
  video.onpause = () => playerStore.pause()
  video.onended = () => playerStore.pause()
  video.ontimeupdate = () => {
    if (video.duration && !isNaN(video.duration)) {
      playerStore.setCurrentTime(video.currentTime)
      playerStore.setTotalTime(video.duration)
    }
  }
  video.onvolumechange = () => {
    playerStore.setVolume(video.volume)
    playerStore.setMuted(video.muted)
  }
}
```

- [ ] **步骤 4：添加 initNativePlayer 函数**

```typescript
function initNativePlayer() {
  if (!playerContainer.value) return
  const video = document.createElement('video')
  video.controls = false
  video.autoplay = true
  video.style.width = '100%'
  video.style.height = '100%'
  video.src = toProxyUrl(props.url)
  playerContainer.value.appendChild(video)

  video.onloadeddata = () => playerStore.setLoading(false)
  video.onerror = () => {
    playerStore.setLoading(false)
    playerStore.setError('频道暂时不可用，请稍后重试')
    emit('error')
  }
  video.onplay = () => { playerStore.play(props.url); playerStore.setLoading(false) }
  video.onpause = () => playerStore.pause()
  video.onended = () => playerStore.pause()
  video.ontimeupdate = () => {
    if (video.duration && !isNaN(video.duration)) {
      playerStore.setCurrentTime(video.currentTime)
      playerStore.setTotalTime(video.duration)
    }
  }
  video.onvolumechange = () => {
    playerStore.setVolume(video.volume)
    playerStore.setMuted(video.muted)
  }
}
```

- [ ] **步骤 5：添加 initDPlayer 函数**

```typescript
function initDPlayer() {
  if (!playerContainer.value) return
  playerStore.setLoading(false)

  dp = new DPlayer({
    container: playerContainer.value,
    autoplay: true,
    video: {
      url: props.url,
      type: 'hls',
    },
  })

  dp.on('play', () => playerStore.play(props.url))
  dp.on('pause', () => playerStore.pause())
  dp.on('ended', () => playerStore.pause())
  dp.on('error', () => {
    playerStore.setError('频道暂时不可用，请稍后重试')
    emit('error')
  })
}
```

- [ ] **步骤 6：更新 destroyPlayer 函数**

```typescript
function destroyPlayer() {
  if (hls) { hls.destroy(); hls = null }
  if (dp) { dp.destroy(); dp = null }
  recoveryAttempts = 0
  if (playerContainer.value) {
    while (playerContainer.value.firstChild) playerContainer.value.removeChild(playerContainer.value.firstChild)
  }
}
```

- [ ] **步骤 7：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无与 VideoPlayer.vue 相关的类型错误

- [ ] **步骤 8：Commit**

```bash
git add src/components/VideoPlayer.vue
git commit -m "feat: VideoPlayer 支持动态内核切换，集成 DPlayer"
```

---

### 任务 3：连接 SettingsView 到 player-settings Store

**文件：**
- 修改：`src/views/SettingsView.vue`

- [ ] **步骤 1：导入 player-settings Store**

在 `<script>` 顶部添加：

```typescript
import { usePlayerSettingsStore } from '@/stores/player-settings'

const playerSettings = usePlayerSettingsStore()
```

- [ ] **步骤 2：移除本地 playerCore/decodeMode/quality ref**

删除以下行：
```typescript
const playerCore = ref<'hls' | 'native' | 'dplayer'>('hls')
const decodeMode = ref<'soft' | 'hard' | 'auto'>('hard')
const quality = ref<'auto' | '1080p' | '720p' | '480p'>('1080p')
```

- [ ] **步骤 3：更新模板绑定**

将模板中所有 `playerCore` 替换为 `playerSettings.core`，所有 `@click="playerCore = 'x'"` 替换为 `@click="playerSettings.setCore('x')"`

将 `decodeMode` 替换为 `playerSettings.decodeMode`，`quality` 替换为 `playerSettings.quality`，点击事件改为调用对应 set 方法。

示例（播放器内核部分）：
```vue
<button class="player-option-card" :class="{ active: playerSettings.core === 'hls' }" @click="playerSettings.setCore('hls')">
<button class="player-option-card" :class="{ active: playerSettings.core === 'native' }" @click="playerSettings.setCore('native')">
<button class="player-option-card" :class="{ active: playerSettings.core === 'dplayer' }" @click="playerSettings.setCore('dplayer')">
```

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无与 SettingsView.vue 相关的类型错误

- [ ] **步骤 5：Commit**

```bash
git add src/views/SettingsView.vue
git commit -m "feat: SettingsView 连接 player-settings Store，实现设置持久化"
```

---

### 任务 4：端到端验证

**文件：**
- 无（手动验证）

- [ ] **步骤 1：运行 TypeScript 检查**

运行：`npx vue-tsc --noEmit`
预期：0 错误

- [ ] **步骤 2：运行测试**

运行：`npx vitest run`
预期：18/18 通过

- [ ] **步骤 3：启动开发服务器手动验证**

运行：`npm run dev`
验证步骤：
1. 打开设置页，切换播放器内核（HLS.js / 原生 / DPlayer）
2. 刷新页面，确认内核设置被记住
3. 切换内核后播放视频，确认播放器正确切换
4. 检查控制台无错误

- [ ] **步骤 4：提交最终验证**

```bash
git status
git log -n 4
```

预期：所有 commit 按顺序存在，工作区干净

---

## 自检

### 1. 规格覆盖度

| 规格章节 | 对应任务 | 状态 |
|----------|----------|------|
| player-settings Store | 任务 1 | ✅ 已覆盖 |
| VideoPlayer 动态切换 | 任务 2 | ✅ 已覆盖 |
| DPlayer 集成 | 任务 2 | ✅ 已覆盖 |
| SettingsView 连接 | 任务 3 | ✅ 已覆盖 |
| 持久化 | 任务 1 | ✅ 已覆盖 |

### 2. 占位符扫描

- ✅ 无 "待定"、"TODO" 或未完成章节
- ✅ 所有步骤包含完整代码
- ✅ 无 "类似任务 N" 引用

### 3. 类型一致性

- ✅ `PlayerCore` 类型在 Store 中定义，在 VideoPlayer 中导入使用
- ✅ `playerSettings` 变量名在所有文件中一致
- ✅ 所有函数签名和属性名一致

---

计划已完成并保存到 `docs/superpowers/plans/2026-04-13-multi-player-core.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？
