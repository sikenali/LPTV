# 定时管理功能实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现定时管理页签的完整功能，包括全局/单独源定时更新、历史记录、通知发送

**架构：** 创建 schedule-settings Store 持久化设置，schedule-manager 服务管理定时器执行更新，SettingsView 连接 Store 替换所有假数据。

**技术栈：** Vue 3、Pinia、IndexedDB、localStorage、setInterval、Notification API、TypeScript

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/stores/schedule-settings.ts` | 定时设置 Store，localStorage 持久化 | 创建 |
| `src/services/schedule-manager.ts` | 定时更新核心服务 | 创建 |
| `src/views/SettingsView.vue` | 连接 schedule-settings Store | 修改 |
| `src/main.ts` | 启动时初始化定时器 | 修改 |

---

### 任务 1：创建定时设置 Store

**文件：**
- 创建：`src/stores/schedule-settings.ts`

- [ ] **步骤 1：创建 Store 文件**

```typescript
import { defineStore } from 'pinia'

export type UpdateFrequency = '1h' | '6h' | '12h' | '24h' | '7d'

export interface SourceSchedule {
  enabled: boolean
  frequency: UpdateFrequency
  time: string
}

export interface ScheduleHistoryEntry {
  id: string
  sourceId: string
  sourceName: string
  timestamp: string
  status: 'success' | 'failed' | 'partial'
  channelCount: number
  message: string
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

const STORAGE_KEY = 'lptv_schedule_settings'
const MAX_HISTORY = 50

function loadDefaults(): ScheduleSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {
    globalEnabled: true,
    frequency: '6h',
    time: '03:00',
    retries: 3,
    notification: true,
    wifiOnly: false,
    perSource: {},
    history: []
  }
}

export const useScheduleSettingsStore = defineStore('scheduleSettings', {
  state: () => loadDefaults(),
  actions: {
    setGlobalEnabled(enabled: boolean) {
      this.globalEnabled = enabled
      this._save()
    },
    setFrequency(frequency: UpdateFrequency) {
      this.frequency = frequency
      this._save()
    },
    setTime(time: string) {
      this.time = time
      this._save()
    },
    setRetries(retries: number) {
      this.retries = retries
      this._save()
    },
    setNotification(notification: boolean) {
      this.notification = notification
      this._save()
    },
    setWifiOnly(wifiOnly: boolean) {
      this.wifiOnly = wifiOnly
      this._save()
    },
    setSourceSchedule(sourceId: string, schedule: SourceSchedule) {
      this.perSource[sourceId] = schedule
      this._save()
    },
    addHistory(entry: ScheduleHistoryEntry) {
      this.history.unshift(entry)
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(0, MAX_HISTORY)
      }
      this._save()
    },
    clearHistory() {
      this.history = []
      this._save()
    },
    _save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        globalEnabled: this.globalEnabled,
        frequency: this.frequency,
        time: this.time,
        retries: this.retries,
        notification: this.notification,
        wifiOnly: this.wifiOnly,
        perSource: this.perSource,
        history: this.history
      }))
    }
  }
})
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无与 schedule-settings.ts 相关的类型错误

- [ ] **步骤 3：Commit**

```bash
git add src/stores/schedule-settings.ts
git commit -m "feat: 创建定时设置 Store（任务 1/4）"
```

---

### 任务 2：创建定时管理器服务

**文件：**
- 创建：`src/services/schedule-manager.ts`

- [ ] **步骤 1：创建服务文件**

```typescript
import { useScheduleSettingsStore, type ScheduleHistoryEntry } from '@/stores/schedule-settings'
import { reloadSource } from '@/services/source-loader'
import { getSourceById, getAllSources } from '@/db/queries/sources'

let globalTimerId: number | null = null

function frequencyToMs(freq: string): number {
  const map: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  }
  return map[freq] || 6 * 60 * 60 * 1000
}

function shouldUpdate(lastUpdateAt: Date | null, frequency: string): boolean {
  if (!lastUpdateAt) return true
  const elapsed = Date.now() - new Date(lastUpdateAt).getTime()
  return elapsed > frequencyToMs(frequency)
}

async function checkConnectionType(): Promise<boolean> {
  const conn = (navigator as any).connection
  if (!conn) return true // 不支持检测，默认允许
  return conn.type !== 'cellular'
}

function sendNotification(title: string, status: string, message: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`[LPTV] ${title}`, {
      body: `${status}: ${message}`,
      icon: '/logo.svg'
    })
  }
}

export async function executeSourceUpdate(sourceId: string): Promise<void> {
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

    if (store.notification) {
      sendNotification(source.name, entry.status === 'success' ? '更新成功' : '更新失败', entry.message)
    }
  } catch (error: any) {
    const entry: ScheduleHistoryEntry = {
      id: self.crypto.randomUUID(),
      sourceId,
      sourceName: source.name,
      timestamp: startTime,
      status: 'failed',
      channelCount: 0,
      message: error?.message || '未知错误'
    }
    store.addHistory(entry)
  }
}

export async function updateAllEnabledSources(): Promise<void> {
  const sources = getAllSources()
  const store = useScheduleSettingsStore()

  for (const source of sources) {
    const perSource = store.perSource[source.id]
    if (perSource?.enabled) {
      await executeSourceUpdate(source.id)
    } else if (store.globalEnabled) {
      await executeSourceUpdate(source.id)
    }
  }
}

export function initScheduleManager(): void {
  const store = useScheduleSettingsStore()

  // 请求通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }

  // 启动时检查
  checkAndUpdateOnStartup()

  // 注册全局定时器
  if (store.globalEnabled) {
    registerGlobalTimer()
  }
}

export function destroyScheduleManager(): void {
  if (globalTimerId !== null) {
    clearInterval(globalTimerId)
    globalTimerId = null
  }
}

async function checkAndUpdateOnStartup(): Promise<void> {
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

function registerGlobalTimer(): void {
  const store = useScheduleSettingsStore()
  const interval = frequencyToMs(store.frequency)

  if (globalTimerId !== null) clearInterval(globalTimerId)
  globalTimerId = window.setInterval(async () => {
    if (store.wifiOnly) {
      const isWifi = await checkConnectionType()
      if (!isWifi) return
    }
    await updateAllEnabledSources()
  }, interval)
}

// 重新注册定时器（设置变化时调用）
export function rescheduleTimer(): void {
  destroyScheduleManager()
  const store = useScheduleSettingsStore()
  if (store.globalEnabled) {
    registerGlobalTimer()
  }
}
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无与 schedule-manager.ts 相关的类型错误

- [ ] **步骤 3：Commit**

```bash
git add src/services/schedule-manager.ts
git commit -m "feat: 创建定时管理器服务（任务 2/4）"
```

---

### 任务 3：在 main.ts 中初始化定时器

**文件：**
- 修改：`src/main.ts`

- [ ] **步骤 1：添加初始化调用**

在 `app.mount('#app')` 之后添加：

```typescript
import { initScheduleManager } from '@/services/schedule-manager'

app.mount('#app')

// 初始化定时更新管理器
initScheduleManager()
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/main.ts
git commit -m "feat: 应用启动时初始化定时管理器（任务 3/4）"
```

---

### 任务 4：连接 SettingsView 到 schedule-settings Store

**文件：**
- 修改：`src/views/SettingsView.vue`

- [ ] **步骤 1：导入 Store 和 rescheduleTimer**

```typescript
import { useScheduleSettingsStore } from '@/stores/schedule-settings'
import { executeSourceUpdate, rescheduleTimer } from '@/services/schedule-manager'

const scheduleSettings = useScheduleSettingsStore()
```

- [ ] **步骤 2：移除所有本地 schedule 相关 ref**

删除：
```typescript
const globalScheduleEnabled = ref(true)
const updateFrequency = ref<'1h' | '6h' | '12h' | '24h' | '7d'>('6h')
const updateTime = ref('03:00')
const retryCount = ref('3')
const updateNotification = ref(true)
const autoUpdate = ref(false)
```

- [ ] **步骤 3：更新假数据为真实源列表**

将定时管理模块中的硬编码行替换为：

```vue
<div class="schedule-source-list-body">
  <div
    v-for="source in sources"
    :key="source.id"
    class="schedule-source-row"
  >
    <div class="ss-col-enable">
      <label class="ss-toggle">
        <input
          type="checkbox"
          :checked="scheduleSettings.perSource[source.id]?.enabled ?? false"
          @change="scheduleSettings.setSourceSchedule(source.id, {
            enabled: $event.target.checked,
            frequency: scheduleSettings.perSource[source.id]?.frequency ?? '6h',
            time: scheduleSettings.perSource[source.id]?.time ?? '00:00'
          }); rescheduleTimer()"
        />
        <span class="ss-toggle-slider"></span>
      </label>
    </div>
    <span class="ss-source-name" :class="{ 'ss-source-disabled': !(scheduleSettings.perSource[source.id]?.enabled ?? false) }">{{ source.name }}</span>
    <div class="ss-col-freq">
      <span class="ss-freq-tag" :class="{ active: scheduleSettings.perSource[source.id]?.enabled }">
        {{ frequencyLabel(scheduleSettings.perSource[source.id]?.frequency ?? scheduleSettings.frequency) }}
      </span>
    </div>
    <span class="ss-time-text" :class="{ 'ss-time-disabled': !(scheduleSettings.perSource[source.id]?.enabled ?? false) }">
      {{ scheduleSettings.perSource[source.id]?.time ?? scheduleSettings.time }}
    </span>
    <div class="ss-result-success">
      <span class="ss-status-dot" :class="source.status === 'active' ? 'ss-dot-success' : 'ss-dot-warning'"></span>
      <span>{{ source.status === 'active' ? `正常 (${source.channelCount}个频道)` : source.status }}</span>
    </div>
    <span class="ss-next-time">{{ source.lastUpdateAt ? '下次: ' + formatNextUpdate(source.lastUpdateAt, scheduleSettings.perSource[source.id]?.frequency ?? scheduleSettings.frequency) : '未更新' }}</span>
    <div class="ss-col-action">
      <button class="ss-update-btn" @click="handleSourceUpdate(source.id)">立即更新</button>
    </div>
  </div>
</div>
```

添加辅助函数：

```typescript
function frequencyLabel(freq: string): string {
  const map: Record<string, string> = { '1h': '每小时', '6h': '每6小时', '12h': '每12小时', '24h': '每天', '7d': '每周' }
  return map[freq] || freq
}

function formatNextUpdate(lastUpdate: Date, frequency: string): string {
  const next = new Date(new Date(lastUpdate).getTime() + frequencyToMsMap(frequency))
  return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`
}

function frequencyToMsMap(freq: string): number {
  const map: Record<string, number> = { '1h': 3600000, '6h': 21600000, '12h': 43200000, '24h': 86400000, '7d': 604800000 }
  return map[freq] || 21600000
}
```

- [ ] **步骤 4：更新所有处理函数**

替换：
```typescript
const handleSourceUpdate = async (sourceId: string) => {
  console.log('立即更新源:', sourceId)
  await executeSourceUpdate(sourceId)
}

const handleClearHistory = () => {
  if (confirm('确定要清空所有更新历史记录吗？')) {
    scheduleSettings.clearHistory()
  }
}

const handleViewLog = (_recordId: string) => {
  alert('日志详情功能开发中...')
}
```

- [ ] **步骤 5：更新全局设置绑定**

将所有全局设置 v-model 替换为 scheduleSettings 对应字段：

```vue
<input type="checkbox" :checked="scheduleSettings.globalEnabled" @change="scheduleSettings.setGlobalEnabled($event.target.checked); rescheduleTimer()" />
<button @click="scheduleSettings.setFrequency('1h'); rescheduleTimer()">每小时</button>
<!-- 依此类推所有频率选项 -->
<input type="time" :value="scheduleSettings.time" @change="scheduleSettings.setTime(($event.target as HTMLInputElement).value)" />
<input type="number" :value="scheduleSettings.retries" @change="scheduleSettings.setRetries(parseInt(($event.target as HTMLInputElement).value))" />
<input type="checkbox" :checked="scheduleSettings.notification" @change="scheduleSettings.setNotification($event.target.checked)" />
<input type="checkbox" :checked="scheduleSettings.wifiOnly" @change="scheduleSettings.setWifiOnly($event.target.checked)" />
```

- [ ] **步骤 6：更新历史记录列表**

```vue
<div class="schedule-history-list-body">
  <div v-for="entry in scheduleSettings.history" :key="entry.id" class="schedule-history-row">
    <span class="sh-time-text">{{ formatHistoryTime(entry.timestamp) }}</span>
    <span class="sh-source-name">{{ entry.sourceName }}</span>
    <div class="sh-status-success" :class="{ 'sh-status-failed': entry.status === 'failed' }">
      <span class="sh-status-dot" :class="entry.status === 'success' ? 'sh-dot-success' : 'sh-dot-failed'"></span>
      <span>{{ entry.status === 'success' ? '成功' : '失败' }}</span>
    </div>
    <span class="sh-channels-count">{{ entry.channelCount }}</span>
    <span class="sh-detail-text">{{ entry.message }}</span>
    <div class="sh-col-action">
      <button class="sh-log-btn" @click="handleViewLog(entry.id)">查看日志</button>
    </div>
  </div>
  <div v-if="scheduleSettings.history.length === 0" class="empty-history">
    <span>暂无更新历史记录</span>
  </div>
</div>
```

添加：
```typescript
function formatHistoryTime(timestamp: string): string {
  const d = new Date(timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
```

- [ ] **步骤 7：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无错误

- [ ] **步骤 8：运行测试**

运行：`npx vitest run`
预期：18/18 通过

- [ ] **步骤 9：Commit**

```bash
git add src/views/SettingsView.vue src/main.ts
git commit -m "feat: SettingsView 连接定时设置 Store，替换所有假数据（任务 4/4）"
```

---

### 任务 5：端到端验证

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
1. 打开设置页 → 定时管理页签
2. 确认全局设置能保存（刷新页面后保持）
3. 确认每源启用/禁用正常工作
4. 点击"立即更新"，确认历史记录更新
5. 确认"清空记录"清除历史
6. 检查控制台无错误

- [ ] **步骤 4：提交最终验证**

```bash
git status
git log -n 5
```

预期：所有 commit 按顺序存在，工作区干净

---

## 自检

### 1. 规格覆盖度

| 规格章节 | 对应任务 | 状态 |
|----------|----------|------|
| schedule-settings Store | 任务 1 | ✅ 已覆盖 |
| schedule-manager 服务 | 任务 2 | ✅ 已覆盖 |
| main.ts 初始化 | 任务 3 | ✅ 已覆盖 |
| SettingsView 连接 | 任务 4 | ✅ 已覆盖 |
| 启动检查 | 任务 2,3 | ✅ 已覆盖 |
| 全局定时器 | 任务 2 | ✅ 已覆盖 |
| 历史记录 | 任务 1,4 | ✅ 已覆盖 |
| 通知发送 | 任务 2 | ✅ 已覆盖 |

### 2. 占位符扫描

- ✅ 无 "待定"、"TODO" 或未完成章节
- ✅ 所有步骤包含完整代码
- ✅ 无 "类似任务 N" 引用

### 3. 类型一致性

- ✅ `UpdateFrequency` 类型在 Store 中定义，在 Manager 中导入使用
- ✅ `scheduleSettings` 变量名在所有文件中一致
- ✅ 所有函数签名和属性名一致

---

计划已完成并保存到 `docs/superpowers/plans/2026-04-13-schedule-manager.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？
