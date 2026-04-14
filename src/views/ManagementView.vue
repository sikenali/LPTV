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
