# 定时管理功能设计文档

**日期：** 2026-04-13
**状态：** 待实现
**范围：** 定时更新源、历史记录、通知

---

## 问题描述

SettingsView 定时管理页签中所有 UI 仅为壳子，所有按钮弹出"开发中"alert，假数据硬编码，无任何实际功能。

---

## 解决方案

### 架构

```
schedule-manager.ts（核心服务）
  ├── 注册全局定时器（setInterval + 启动检查）
  ├── 执行单个源更新（调用 source-loader.reloadSource）
  ├── 记录历史到 IndexedDB
  └── 发送浏览器通知（Notification API）

schedule-settings.ts（Pinia Store + localStorage）
  ├── 全局设置：enabled/frequency/time/retries/notification
  ├── 每源设置：enabled/frequency/time
  └── 更新历史：最近 50 条

SettingsView.vue
  └── 连接 schedule-settings Store，替换所有假数据
```

### 核心组件

| 组件 | 职责 |
|------|------|
| `schedule-manager.ts` | 定时器注册/触发、源更新执行、历史记录、通知发送 |
| `schedule-settings.ts` | 设置 Store，localStorage 持久化 |
| `SettingsView.vue` | UI 绑定，替换所有假数据为真实交互 |
| `main.ts` | 启动时初始化定时器 |

---

## 详细设计

### 1. 定时设置 Store (`src/stores/schedule-settings.ts`)

```typescript
import { defineStore } from 'pinia'

export type UpdateFrequency = '1h' | '6h' | '12h' | '24h' | '7d'

interface SourceSchedule {
  enabled: boolean
  frequency: UpdateFrequency
  time: string // HH:MM
}

interface ScheduleSettings {
  globalEnabled: boolean
  frequency: UpdateFrequency
  time: string
  retries: number
  notification: boolean
  wifiOnly: boolean
  perSource: Record<string, SourceSchedule>
  history: ScheduleHistoryEntry[]
}

interface ScheduleHistoryEntry {
  id: string
  sourceId: string
  sourceName: string
  timestamp: string
  status: 'success' | 'failed' | 'partial'
  channelCount: number
  message: string
}
```

### 2. 定时管理器 (`src/services/schedule-manager.ts`)

```typescript
import { useScheduleSettingsStore } from '@/stores/schedule-settings'
import { reloadSource } from '@/services/source-loader'
import { getAllSources } from '@/db/queries/sources'

let globalTimerId: number | null = null

export function initScheduleManager() {
  const store = useScheduleSettingsStore()

  // 1. 启动时检查：计算上次更新时间，超过周期则立即更新
  checkAndUpdateOnStartup()

  // 2. 注册全局定时器
  if (store.globalEnabled) {
    registerGlobalTimer()
  }
}

export function destroyScheduleManager() {
  if (globalTimerId !== null) {
    clearInterval(globalTimerId)
    globalTimerId = null
  }
}

async function checkAndUpdateOnStartup() {
  // 检查每个启用定时的源是否超过更新周期
  const sources = getAllSources()
  const store = useScheduleSettingsStore()

  for (const source of sources) {
    const perSource = store.perSource[source.id]
    const frequency = perSource?.enabled ? perSource.frequency : store.frequency
    const lastUpdate = source.lastUpdateAt

    if (shouldUpdate(lastUpdate, frequency)) {
      await executeSourceUpdate(source.id)
    }
  }
}

function registerGlobalTimer() {
  const store = useScheduleSettingsStore()
  const interval = frequencyToMs(store.frequency)

  if (globalTimerId !== null) clearInterval(globalTimerId)
  globalTimerId = window.setInterval(async () => {
    // 检查 WiFi 限制
    if (store.wifiOnly) {
      const isWifi = await checkConnectionType()
      if (!isWifi) return
    }
    await updateAllEnabledSources()
  }, interval)
}

async function executeSourceUpdate(sourceId: string) {
  const store = useScheduleSettingsStore()
  const source = getSourceById(sourceId)
  if (!source) return

  const startTime = new Date().toISOString()
  try {
    const success = await reloadSource(sourceId)
    const updatedSource = getSourceById(sourceId)

    const entry: ScheduleHistoryEntry = {
      id: self.crypto.randomUUID(),
      sourceId,
      sourceName: source.name,
      timestamp: startTime,
      status: success ? 'success' : 'failed',
      channelCount: updatedSource?.channelCount || 0,
      message: success ? `成功更新 ${updatedSource?.channelCount || 0} 个频道` : '更新失败'
    }
    store.addHistory(entry)

    // 发送通知
    if (store.notification) {
      sendNotification(source.name, entry.status, entry.message)
    }
  } catch (error) {
    // 记录失败
  }
}
```

### 3. SettingsView 连接

所有假数据替换为 Store 状态，所有 alert 替换为实际功能调用。

---

## 环境差异

| 环境 | 行为 |
|------|------|
| 浏览器 | 使用 setInterval 定时，页面关闭时定时器销毁 |
| 页面可见性 | 使用 Page Visibility API 暂停/恢复定时器 |
| 网络检测 | Network Information API（仅 Chrome/Edge 支持 WiFi 检测） |
| 通知 | 需要用户授权 Notification 权限 |

---

## 风险与限制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 浏览器不支持 Network Information API | 无法检测 WiFi | wifiOnly 设置在不支持的浏览器中显示禁用提示 |
| 页面关闭后定时器失效 | 无法后台更新 | 启动检查补偿，打开应用时立即检查更新 |
| 通知权限被拒绝 | 用户收不到通知 | 降级为在 UI 上显示更新结果 |
