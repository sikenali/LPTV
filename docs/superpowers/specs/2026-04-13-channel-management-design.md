# IPTV 数据管理模块设计文档

**日期：** 2026-04-13
**状态：** 待实现
**范围：** 频道检测、去重、整合分组、导出

---

## 背景

根据 `iptv.txt` 总结的思路，IPTV 整合遵循以下流程：

```
寻找源 → 校验源 → 清洗源（去重） → 整合发布
```

当前项目已有源添加/导入/切换/删除功能，但缺少：
1. 频道可用性检测（校验源）
2. 去重合并（清洗源）
3. 智能分组整合（整合）
4. 集中管理界面

---

## 解决方案

### 架构概述

在顶部导航栏增加「数据管理」入口，创建独立的管理页面，提供频道检测、去重、分组整合、导出功能。

```
顶部导航
├── 频道
├── 收藏
├── 数据管理（新增）
└── 设置

数据管理页面
├── 频道检测面板
│   ├── 开始检测按钮
│   ├── 检测进度条
│   └── 结果列表（频道名/状态/延迟）
├── 去重合并面板
│   ├── 重复统计
│   └── 一键去重按钮
└── 整合发布面板
    ├── 分组预览
    └── 导出 M3U 按钮
```

### 核心组件

| 组件 | 职责 |
|------|------|
| `ManagementView.vue` | 数据管理主页面，三个子面板 |
| `channel-checker.ts` | 频道可用性检测服务 |
| `channel-dedup.ts` | 频道去重服务 |
| `channel-export.ts` | 频道导出服务 |

---

## 详细设计

### 1. 频道可用性检测（`channel-checker.ts`）

**检测逻辑：**
```typescript
export interface ChannelStatus {
  id: string
  name: string
  url: string
  status: 'alive' | 'dead' | 'checking' | 'unknown'
  latency: number | null
  lastChecked: string | null
}

export async function checkChannel(url: string, timeout: number = 10000): Promise<{alive: boolean, latency: number | null}> {
  const startTime = performance.now()
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), timeout)

    // 对于 HLS 流，检查 m3u8 文件是否可访问
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal })
    const latency = Math.round(performance.now() - startTime)

    return { alive: response.ok, latency }
  } catch {
    const latency = Math.round(performance.now() - startTime)
    return { alive: false, latency }
  }
}

export async function checkAllChannels(channels: Channel[], onProgress?: (status: ChannelStatus[]) => void): Promise<ChannelStatus[]> {
  // 并发检测，默认 5 个并发
  const results: ChannelStatus[] = []
  for (const channel of channels) {
    results.push({ id: channel.id, name: channel.name, url: channel.url, status: 'checking', latency: null, lastChecked: null })
  }

  // 分批并发检测
  const concurrency = 5
  for (let i = 0; i < channels.length; i += concurrency) {
    const batch = channels.slice(i, i + concurrency)
    await Promise.all(batch.map(async (ch) => {
      const result = await checkChannel(ch.url)
      const status = results.find(r => r.id === ch.id)
      if (status) {
        status.status = result.alive ? 'alive' : 'dead'
        status.latency = result.latency
        status.lastChecked = new Date().toISOString()
      }
    }))
    onProgress?.(results)
  }

  return results
}
```

**结果存储：**
- 在 `channels` 表中添加 `status TEXT DEFAULT 'unknown'` 和 `latency INTEGER DEFAULT NULL` 和 `last_checked DATETIME` 字段
- 或使用单独的 `channel_status` 表

### 2. 去重合并（`channel-dedup.ts`）

**去重规则：**
1. 按频道名称匹配（忽略大小写、前后空格）
2. 按 URL 精确匹配
3. 保留延迟最低/最新的源
4. 支持手动选择保留哪个

```typescript
export interface DuplicateGroup {
  name: string
  channels: Channel[]
  bestChannel: Channel
}

export function findDuplicates(channels: Channel[]): DuplicateGroup[] {
  const groups = new Map<string, Channel[]>()

  for (const ch of channels) {
    const key = ch.name.toLowerCase().trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(ch)
  }

  const duplicates: DuplicateGroup[] = []
  for (const [name, group] of groups.entries()) {
    if (group.length > 1) {
      duplicates.push({
        name,
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
    const key = ch.name.toLowerCase().trim()
    if (!groups.has(key)) {
      groups.set(key, ch)
    }
  }

  return Array.from(groups.values())
}
```

### 3. 整合导出（`channel-export.ts`）

**M3U 导出：**
```typescript
export function exportToM3U(channels: Channel[]): string {
  let output = '#EXTM3U\n'

  for (const ch of channels) {
    output += `#EXTINF:-1 tvg-id="${ch.tvgId || ''}" tvg-name="${ch.name}" tvg-logo="${ch.logo || ''}" group-title="${ch.groupName}",${ch.name}\n`
    output += `${ch.url}\n`
  }

  return output
}

export function downloadM3U(content: string, filename: string) {
  const blob = new Blob([content], { type: 'audio/x-mpegurl' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### 4. 管理界面（`ManagementView.vue`）

**页面结构：**
```vue
<template>
  <div class="management-view">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>数据管理</h1>
      <p>频道检测、去重、整合、导出</p>
    </div>

    <!-- 频道检测面板 -->
    <div class="management-card">
      <h3>频道可用性检测</h3>
      <p>检测所有频道在当前网络下是否可正常播放</p>
      <button @click="startChannelCheck" :disabled="isChecking">
        {{ isChecking ? '检测中...' : '开始检测' }}
      </button>
      <div v-if="isChecking" class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div v-if="checkResults.length" class="check-results">
        <div v-for="r in checkResults" :key="r.id" class="result-item">
          <span class="result-name">{{ r.name }}</span>
          <span class="result-status" :class="r.status">{{ statusLabel(r.status) }}</span>
          <span class="result-latency">{{ r.latency ? r.latency + 'ms' : '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 去重合并面板 -->
    <div class="management-card">
      <h3>去重合并</h3>
      <p>查找并去除重复频道</p>
      <button @click="findDuplicates">查找重复</button>
      <div v-if="duplicateGroups.length" class="duplicate-info">
        找到 {{ duplicateGroups.length }} 组重复，共 {{ totalDuplicates }} 个频道
        <button @click="autoDeduplicate">一键去重</button>
      </div>
    </div>

    <!-- 整合导出面板 -->
    <div class="management-card">
      <h3>整合导出</h3>
      <p>整合所有频道并导出为 M3U 文件</p>
      <button @click="exportM3U">导出 M3U</button>
      <div class="export-stats">
        共 {{ channels.length }} 个频道，{{ groups.length }} 个分组
      </div>
    </div>
  </div>
</template>
```

---

## 数据库变更

```sql
ALTER TABLE channels ADD COLUMN status TEXT DEFAULT 'unknown';
ALTER TABLE channels ADD COLUMN latency INTEGER DEFAULT NULL;
ALTER TABLE channels ADD COLUMN last_checked DATETIME;
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
```

---

## 环境差异

| 环境 | 行为 |
|------|------|
| 开发 | 并发数降低（3），便于调试 |
| 生产 | 并发 5，超时 10s |

---

## 风险与限制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| CORS 阻止检测请求 | 无法检测某些频道 | 使用 Vite 代理，或标记为"未知" |
| HLS 流需要较长时间才能判断 | 检测耗时长 | HEAD 请求快速检测，降低超时时间 |
| 大量频道导致页面卡顿 | 检测 1000+ 频道 | 分批处理，使用 Web Worker |
