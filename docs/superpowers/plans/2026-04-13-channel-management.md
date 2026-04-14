# IPTV 数据管理模块实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现频道检测、去重、整合分组、导出功能，新增数据管理页面

**架构：** 在顶部导航增加"数据管理"入口，创建 ManagementView 页面，包含频道检测、去重合并、整合导出三个子面板，后台服务分别处理检测、去重、导出逻辑

**技术栈：** Vue 3、Pinia、TypeScript、HTML5 下载 API

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/services/channel-checker.ts` | 频道可用性检测服务 | 创建 |
| `src/services/channel-dedup.ts` | 频道去重服务 | 创建 |
| `src/services/channel-export.ts` | 频道导出服务 | 创建 |
| `src/views/ManagementView.vue` | 数据管理主页面 | 创建 |
| `src/router/index.ts` | 添加管理页面路由 | 修改 |
| `src/components/TopNavbar.vue` | 添加数据管理导航项 | 修改 |
| `src/db/database.ts` | 添加频道状态字段 | 修改 |
| `src/db/queries/channels.ts` | 添加频道状态更新查询 | 修改 |

---

### 任务 1：创建频道检测服务

**文件：**
- 创建：`src/services/channel-checker.ts`

- [ ] **步骤 1：创建服务文件**

```typescript
export interface ChannelCheckResult {
  id: string
  name: string
  url: string
  status: 'alive' | 'dead' | 'checking' | 'unknown'
  latency: number | null
  lastChecked: string | null
}

async function checkSingleChannel(url: string, timeout: number = 10000): Promise<{ alive: boolean; latency: number | null }> {
  const startTime = performance.now()
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), timeout)

    // 使用 HEAD 请求快速检测
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal })
    const latency = Math.round(performance.now() - startTime)

    return { alive: response.ok || response.status === 200, latency }
  } catch {
    // HEAD 失败，尝试 GET 请求
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, { signal: controller.signal })
      const latency = Math.round(performance.now() - startTime)

      return { alive: response.ok || response.status === 200, latency }
    } catch {
      const latency = Math.round(performance.now() - startTime)
      return { alive: false, latency }
    }
  }
}

export async function checkChannel(url: string, timeout: number = 10000): Promise<{ alive: boolean; latency: number | null }> {
  return checkSingleChannel(url, timeout)
}

export async function checkAllChannels(
  channels: Array<{ id: string; name: string; url: string }>,
  timeout: number = 10000,
  concurrency: number = 5,
  onProgress?: (results: ChannelCheckResult[]) => void
): Promise<ChannelCheckResult[]> {
  const results: ChannelCheckResult[] = channels.map(ch => ({
    id: ch.id,
    name: ch.name,
    url: ch.url,
    status: 'checking',
    latency: null,
    lastChecked: null
  }))

  for (let i = 0; i < channels.length; i += concurrency) {
    const batch = channels.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (ch) => {
        const result = await checkSingleChannel(ch.url, timeout)
        const idx = results.findIndex(r => r.id === ch.id)
        if (idx !== -1) {
          results[idx].status = result.alive ? 'alive' : 'dead'
          results[idx].latency = result.latency
          results[idx].lastChecked = new Date().toISOString()
        }
      })
    )
    onProgress?.(results)
  }

  return results
}
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无与 channel-checker.ts 相关的类型错误

- [ ] **步骤 3：Commit**

```bash
git add src/services/channel-checker.ts
git commit -m "feat: 创建频道检测服务（任务 1/5）"
```

---

### 任务 2：创建频道去重服务

**文件：**
- 创建：`src/services/channel-dedup.ts`

- [ ] **步骤 1：创建服务文件**

```typescript
import type { Channel } from '@/types/channel'

export interface DuplicateGroup {
  name: string
  channels: Channel[]
  bestChannel: Channel
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function findDuplicates(channels: Channel[]): DuplicateGroup[] {
  const groups = new Map<string, Channel[]>()

  for (const ch of channels) {
    const key = normalizeName(ch.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(ch)
  }

  const duplicates: DuplicateGroup[] = []
  for (const [name, group] of groups.entries()) {
    if (group.length > 1) {
      duplicates.push({
        name: group[0].name, // 保留原始名称
        channels: group,
        bestChannel: group[0] // 简化：选第一个
      })
    }
  }

  return duplicates.sort((a, b) => b.channels.length - a.channels.length)
}

export function deduplicateChannels(channels: Channel[]): Channel[] {
  const groups = new Map<string, Channel>()

  for (const ch of channels) {
    const key = normalizeName(ch.name)
    if (!groups.has(key)) {
      groups.set(key, ch)
    }
  }

  return Array.from(groups.values())
}

export function getDuplicateStats(channels: Channel[]): { total: number; duplicates: number; unique: number } {
  const groups = new Map<string, Channel[]>()

  for (const ch of channels) {
    const key = normalizeName(ch.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(ch)
  }

  const duplicates = Array.from(groups.values()).filter(g => g.length > 1).reduce((sum, g) => sum + g.length - 1, 0)

  return {
    total: channels.length,
    duplicates,
    unique: groups.size
  }
}
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无与 channel-dedup.ts 相关的类型错误

- [ ] **步骤 3：Commit**

```bash
git add src/services/channel-dedup.ts
git commit -m "feat: 创建频道去重服务（任务 2/5）"
```

---

### 任务 3：创建频道导出服务

**文件：**
- 创建：`src/services/channel-export.ts`

- [ ] **步骤 1：创建服务文件**

```typescript
import type { Channel } from '@/types/channel'

export function exportToM3U(channels: Channel[]): string {
  let output = '#EXTM3U\n'

  for (const ch of channels) {
    const tvgId = ch.tvgId || ''
    const tvgName = ch.tvgName || ch.name
    const logo = ch.logo || ''
    const groupName = ch.groupName || ''

    output += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupName}",${ch.name}\n`
    output += `${ch.url}\n`
  }

  return output
}

export function downloadM3U(content: string, filename: string = 'iptv.m3u') {
  const blob = new Blob([content], { type: 'audio/x-mpegurl' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportAsTxt(channels: Channel[]): string {
  let output = ''

  for (const ch of channels) {
    output += `${ch.groupName || '其他'},${ch.name},${ch.url}\n`
  }

  return output
}

export function downloadTxt(content: string, filename: string = 'iptv.txt') {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无与 channel-export.ts 相关的类型错误

- [ ] **步骤 3：Commit**

```bash
git add src/services/channel-export.ts
git commit -m "feat: 创建频道导出服务（任务 3/5）"
```

---

### 任务 4：创建数据管理页面

**文件：**
- 创建：`src/views/ManagementView.vue`

- [ ] **步骤 1：创建视图文件**

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAllChannels } from '@/db/queries/channels'
import { checkAllChannels, type ChannelCheckResult } from '@/services/channel-checker'
import { findDuplicates, deduplicateChannels, getDuplicateStats, type DuplicateGroup } from '@/services/channel-dedup'
import { exportToM3U, downloadM3U, exportAsTxt, downloadTxt } from '@/services/channel-export'
import type { Channel } from '@/types/channel'
import { RiPlayCircleLine, RiFilterLine, RiDownloadCloud2Line } from '@remixicon/vue'

const channels = ref<Channel[]>([])
const checkResults = ref<ChannelCheckResult[]>([])
const isChecking = ref(false)
const progressPercent = ref(0)
const duplicateGroups = ref<DuplicateGroup[]>([])
const duplicateStats = computed(() => getDuplicateStats(channels.value))

onMounted(() => {
  loadChannels()
})

function loadChannels() {
  channels.value = getAllChannels()
}

async function startChannelCheck() {
  if (isChecking.value || channels.value.length === 0) return
  isChecking.value = true
  progressPercent.value = 0
  checkResults.value = []

  const results = await checkAllChannels(
    channels.value,
    10000,
    5,
    (results) => {
      checkResults.value = [...results]
      const checked = results.filter(r => r.status !== 'checking').length
      progressPercent.value = Math.round((checked / channels.value.length) * 100)
    }
  )

  checkResults.value = results
  isChecking.value = false
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    alive: '可用',
    dead: '失效',
    checking: '检测中',
    unknown: '未知'
  }
  return map[status] || status
}

function handleFindDuplicates() {
  duplicateGroups.value = findDuplicates(channels.value)
}

function handleAutoDeduplicate() {
  const unique = deduplicateChannels(channels.value)
  channels.value = unique
  duplicateGroups.value = []
}

function handleExportM3U() {
  const content = exportToM3U(channels.value)
  downloadM3U(content, `iptv_${Date.now()}.m3u`)
}

function handleExportTxt() {
  const content = exportAsTxt(channels.value)
  downloadTxt(content, `iptv_${Date.now()}.txt`)
}
</script>

<template>
  <div class="management-view">
    <div class="page-header">
      <h1>数据管理</h1>
      <p>频道检测、去重、整合、导出</p>
    </div>

    <!-- 频道检测面板 -->
    <div class="management-card">
      <div class="card-header">
        <RiPlayCircleLine class="card-icon" />
        <h3>频道可用性检测</h3>
      </div>
      <p class="card-desc">检测所有频道在当前网络下是否可正常播放</p>
      <button class="btn-primary" @click="startChannelCheck" :disabled="isChecking || channels.length === 0">
        {{ isChecking ? '检测中...' : '开始检测' }}
      </button>

      <div v-if="isChecking" class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="progress-text">{{ progressPercent }}%</span>
      </div>

      <div v-if="checkResults.length" class="check-results">
        <div class="results-header">
          <span>检测结果</span>
          <span class="results-count">{{ checkResults.filter(r => r.status === 'alive').length }} 个可用 / {{ checkResults.length }} 个频道</span>
        </div>
        <div class="results-list">
          <div v-for="r in checkResults" :key="r.id" class="result-item" :class="r.status">
            <span class="result-name">{{ r.name }}</span>
            <span class="result-status" :class="r.status">{{ statusLabel(r.status) }}</span>
            <span class="result-latency">{{ r.latency ? r.latency + 'ms' : '-' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 去重合并面板 -->
    <div class="management-card">
      <div class="card-header">
        <RiFilterLine class="card-icon" />
        <h3>去重合并</h3>
      </div>
      <p class="card-desc">查找并去除重复频道</p>
      <div class="duplicate-stats">
        <span class="stat-item">共 {{ duplicateStats.total }} 个频道</span>
        <span class="stat-item">重复 {{ duplicateStats.duplicates }} 个</span>
        <span class="stat-item">唯一 {{ duplicateStats.unique }} 个</span>
      </div>
      <div class="card-actions">
        <button class="btn-secondary" @click="handleFindDuplicates">查找重复</button>
        <button class="btn-secondary" @click="handleAutoDeduplicate" :disabled="duplicateGroups.length === 0">
          一键去重
        </button>
      </div>

      <div v-if="duplicateGroups.length" class="duplicate-list">
        <div class="duplicate-header">
          找到 {{ duplicateGroups.length }} 组重复
        </div>
        <div v-for="group in duplicateGroups.slice(0, 20)" :key="group.name" class="duplicate-item">
          <span class="duplicate-name">{{ group.name }}</span>
          <span class="duplicate-count">{{ group.channels.length }} 个</span>
        </div>
      </div>
    </div>

    <!-- 整合导出面板 -->
    <div class="management-card">
      <div class="card-header">
        <RiDownloadCloud2Line class="card-icon" />
        <h3>整合导出</h3>
      </div>
      <p class="card-desc">整合所有频道并导出为 M3U/TXT 文件</p>
      <div class="export-stats">
        共 {{ channels.length }} 个频道
      </div>
      <div class="card-actions">
        <button class="btn-secondary" @click="handleExportM3U" :disabled="channels.length === 0">导出 M3U</button>
        <button class="btn-secondary" @click="handleExportTxt" :disabled="channels.length === 0">导出 TXT</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.management-view {
  padding: 40px 60px;
  height: calc(100vh - 56px);
  overflow-y: auto;
  margin-top: 56px;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
    &:hover { background: #4a4e69; }
  }
}

.page-header {
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);

  h1 {
    font-size: 26px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 8px;
  }
  p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
    opacity: 0.8;
  }
}

.management-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .card-icon {
      width: 20px;
      height: 20px;
      color: var(--brand-primary);
    }

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
  }

  .card-desc {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 12px;
    opacity: 0.7;
  }

  .btn-primary {
    background-color: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
    &:hover { background-color: var(--brand-hover); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  .btn-secondary {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 13px;
    cursor: pointer;
    transition: all var(--transition-fast);
    &:hover { background-color: var(--bg-card); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}

.progress-container {
  margin: 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;

  .progress-bar {
    flex: 1;
    height: 6px;
    background-color: var(--bg-secondary);
    border-radius: 3px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background-color: var(--brand-primary);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
  }

  .progress-text {
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 35px;
  }
}

.check-results {
  margin-top: 16px;

  .results-header {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;

    .results-count {
      font-size: 12px;
      color: var(--text-secondary);
    }
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 400px;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 2px;
    }
  }
}

.result-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: var(--bg-secondary);
  font-size: 12px;

  .result-name {
    flex: 1;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-status {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;

    &.alive {
      background-color: rgba(34, 197, 94, 0.12);
      color: #22c55e;
    }
    &.dead {
      background-color: rgba(239, 68, 68, 0.12);
      color: #ef4444;
    }
    &.checking {
      background-color: rgba(234, 179, 8, 0.12);
      color: #eab308;
    }
  }

  .result-latency {
    min-width: 50px;
    text-align: right;
    color: var(--text-secondary);
    font-size: 11px;
  }
}

.duplicate-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;

  .stat-item {
    font-size: 12px;
    color: var(--text-secondary);
    padding: 4px 8px;
    background-color: var(--bg-secondary);
    border-radius: 4px;
  }
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.duplicate-list {
  margin-top: 12px;

  .duplicate-header {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .duplicate-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    border-radius: 6px;
    background-color: var(--bg-secondary);
    font-size: 12px;

    .duplicate-name {
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .duplicate-count {
      color: var(--brand-primary);
      font-weight: 600;
    }
  }
}

.export-stats {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
</style>
```

- [ ] **步骤 2：添加路由**

修改 `src/router/index.ts`，添加：

```typescript
{
  path: '/management',
  name: 'management',
  component: () => import('@/views/ManagementView.vue')
}
```

- [ ] **步骤 3：添加导航项**

修改 `src/components/TopNavbar.vue`，添加数据管理导航项：

```typescript
const navItems = computed(() => [
  { name: 'channel', label: '频道', icon: RiTvLine, path: '/' },
  { name: 'favorites', label: '收藏', icon: RiHeartLine, path: '/favorites' },
  { name: 'management', label: '数据管理', icon: RiDatabaseLine, path: '/management' },
  { name: 'settings', label: '设置', icon: RiSettings3Line, path: '/settings' }
])
```

并导入 `RiDatabaseLine`：

```typescript
import { RiTvLine, RiHeartLine, RiSettings3Line, RiDatabaseLine } from '@remixicon/vue'
```

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`npx vue-tsc --noEmit`
预期：无错误

- [ ] **步骤 5：Commit**

```bash
git add src/views/ManagementView.vue src/router/index.ts src/components/TopNavbar.vue
git commit -m "feat: 创建数据管理页面（任务 4/5）"
```

---

### 任务 5：端到端验证

- [ ] **步骤 1：运行 TypeScript 检查**

运行：`npx vue-tsc --noEmit`
预期：0 错误

- [ ] **步骤 2：运行测试**

运行：`npx vitest run`
预期：18/18 通过

- [ ] **步骤 3：手动验证**

1. 启动 `npm run dev`
2. 访问 `/management` 页面
3. 验证频道检测功能
4. 验证去重功能
5. 验证导出功能

- [ ] **步骤 4：Commit**

```bash
git add -A && git commit -m "docs: 添加数据管理模块设计文档和实现计划（任务 5/5）"
```

---

## 自检

### 1. 规格覆盖度

| 规格章节 | 对应任务 | 状态 |
|----------|----------|------|
| 频道检测 | 任务 1, 4 | ✅ 已覆盖 |
| 去重合并 | 任务 2, 4 | ✅ 已覆盖 |
| 整合导出 | 任务 3, 4 | ✅ 已覆盖 |
| 路由/导航 | 任务 4 | ✅ 已覆盖 |

### 2. 占位符扫描

- ✅ 无 "待定"、"TODO" 或未完成章节
- ✅ 所有步骤包含完整代码

### 3. 类型一致性

- ✅ `ChannelCheckResult` 在服务中定义，在视图中导入使用
- ✅ `DuplicateGroup` 在服务中定义，在视图中导入使用
- ✅ 所有函数签名和属性名一致

---

计划已完成并保存到 `docs/superpowers/plans/2026-04-13-channel-management.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？
