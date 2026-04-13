<script setup lang="ts">
import { ref } from 'vue'
import SourceItem from '@/components/SourceItem.vue'
import type { Source } from '@/types/source'
import {
  RiLink, RiTimerLine, RiPlayCircleLine, RiPaletteLine, RiInformationLine,
  RiFolderLine, RiUploadCloud2Line,
  RiFilmLine, RiTv2Line, RiComputerLine, RiFlashlightLine,
  RiHammerLine
} from '@remixicon/vue'

const activeTab = ref<'source' | 'schedule' | 'player' | 'ui' | 'about'>('source')
const addMethod = ref<'url' | 'file'>('url')
const sourceName = ref('')
const sourceUrl = ref('')

const sources = ref<Source[]>([
  { id: 'source-1', name: '我的直播源', url: 'http://example.com/live.m3u', type: 'url', status: 'active', channelCount: 50, lastUpdateAt: new Date('2026-04-13T10:00:00'), createdAt: new Date('2026-04-10T09:00:00') },
  { id: 'source-2', name: '备用直播源', url: 'http://example.com/backup.m3u', type: 'url', status: 'error', channelCount: 30, lastUpdateAt: new Date('2026-04-12T08:00:00'), createdAt: new Date('2026-04-09T09:00:00') }
])
const activeSourceId = ref('source-1')

const handleAddSource = () => {
  if (sourceUrl.value) {
    const newSource: Source = {
      id: `source-${Date.now()}`,
      name: sourceName.value || sourceUrl.value.split('/').pop() || '未命名',
      url: sourceUrl.value,
      type: addMethod.value,
      status: 'active',
      channelCount: 0,
      lastUpdateAt: null,
      createdAt: new Date()
    }
    sources.value.push(newSource)
    sourceName.value = ''
    sourceUrl.value = ''
  }
}

const handleDelete = (sourceId: string) => {
  sources.value = sources.value.filter(s => s.id !== sourceId)
}

const handleSwitchSource = (sourceId: string) => {
  activeSourceId.value = sourceId
}

const menuItems = [
  { id: 'source' as const, label: '源管理', icon: RiLink },
  { id: 'schedule' as const, label: '定时管理', icon: RiTimerLine },
  { id: 'player' as const, label: '播放设置', icon: RiPlayCircleLine },
  { id: 'ui' as const, label: '界面设置', icon: RiPaletteLine },
  { id: 'about' as const, label: '关于', icon: RiInformationLine }
]

// UI Settings State
const theme = ref<'light' | 'dark' | 'blue' | 'black'>('dark')
const fontSize = ref<'small' | 'medium' | 'large'>('medium')
const accentColor = ref<'blue' | 'purple' | 'orange' | 'green'>('blue')

// Player Settings State
const playerCore = ref<'hls' | 'native'>('hls')
const decodeMode = ref<'soft' | 'hard'>('soft')
const autoplay = ref(true)
const hardwareAccel = ref(true)
const pipMode = ref(false)
const rememberVolume = ref(true)

// Schedule Settings State
const globalScheduleEnabled = ref(true)
const updateFrequency = ref<'1h' | '6h' | '12h' | '24h' | '7d'>('6h')
const updateTime = ref('03:00')
const retryCount = ref('3')
const updateNotification = ref(true)
const autoUpdate = ref(false)
</script>

<template>
  <div class="settings-view">
    <!-- 左侧设置菜单 -->
    <aside class="settings-sidebar">
      <div class="settings-menu">
        <button
          v-for="item in menuItems"
          :key="item.id"
          class="menu-item"
          :class="{ active: activeTab === item.id }"
          @click="activeTab = item.id"
        >
          <component :is="item.icon" class="menu-icon" />
          <span class="menu-label">{{ item.label }}</span>
        </button>
      </div>
    </aside>
    <!-- 右侧设置内容区 -->
    <main class="settings-content">
      <!-- 源管理模块 -->
      <div v-if="activeTab === 'source'" class="source-management">
        <!-- 模块标题 -->
        <div class="module-header">
          <h2 class="module-title">源管理</h2>
          <p class="module-desc">添加和管理你的直播源地址</p>
        </div>
        <!-- 添加源区域 -->
        <div class="add-source-section">
          <h3 class="section-title">添加直播源</h3>
          <p class="section-desc">支持 m3u/m3u8 格式的直播源文件</p>
          <!-- 添加方式选择 -->
          <div class="add-method-tabs">
            <button class="method-tab" :class="{ active: addMethod === 'url' }" @click="addMethod = 'url'">
              <RiLink class="method-icon" />
              <span class="method-label">URL 地址添加</span>
              <span class="method-desc">输入直播源的网络地址</span>
            </button>
            <button class="method-tab" :class="{ active: addMethod === 'file' }" @click="addMethod = 'file'">
              <RiFolderLine class="method-icon" />
              <span class="method-label">本地文件导入</span>
              <span class="method-desc">从本地选择 m3u 文件</span>
            </button>
          </div>
          <!-- URL 输入表单 -->
          <div v-if="addMethod === 'url'" class="url-form">
            <div class="form-group">
              <label class="form-label">源名称</label>
              <input v-model="sourceName" type="text" class="form-input" placeholder="自定义源名称（可选）" />
            </div>
            <div class="form-group">
              <label class="form-label">直播源地址</label>
              <input v-model="sourceUrl" type="text" class="form-input" placeholder="请输入 m3u/m3u8 直播源地址" />
            </div>
            <button class="btn-add-source" @click="handleAddSource">添加源</button>
          </div>
          <div v-else class="file-upload-area">
            <div class="upload-placeholder">
              <RiUploadCloud2Line class="upload-icon" />
              <span class="upload-text">点击或拖拽 m3u/m3u8 文件到此处</span>
            </div>
          </div>
        </div>
        <!-- 已添加源列表 -->
        <div class="source-list-section">
          <div class="source-list-header">
            <h3 class="source-list-title">已添加的源</h3>
            <span class="source-count">共 {{ sources.length }} 个</span>
          </div>
          <div class="source-table">
            <div class="table-header">
              <span class="col-status">状态</span>
              <span class="col-name">源名称</span>
              <span class="col-url">源地址</span>
              <span class="col-channels">频道数</span>
              <span class="col-update">更新时间</span>
              <span class="col-actions">操作</span>
            </div>
            <div class="table-body">
              <SourceItem
                v-for="source in sources"
                :key="source.id"
                :source="source"
                :is-active="source.id === activeSourceId"
                @delete="handleDelete"
                @switch="handleSwitchSource"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- 定时管理模块 -->
      <div v-else-if="activeTab === 'schedule'" class="schedule-management">
        <div class="module-header">
          <h2 class="module-title">定时管理</h2>
          <p class="module-desc">设置直播源自动更新周期</p>
        </div>

        <!-- 全局定时设置卡片 -->
        <div class="settings-section">
          <div class="schedule-global-header">
            <div class="schedule-title-group">
              <h3 class="schedule-card-title">全局更新设置</h3>
              <p class="schedule-card-desc">控制所有直播源的自动更新行为</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="globalScheduleEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="schedule-settings">
            <div class="schedule-setting-row">
              <div class="setting-info">
                <span class="setting-label">更新频率</span>
                <span class="setting-desc">设置自动更新的时间间隔</span>
              </div>
              <div class="frequency-selector">
                <button class="freq-option" :class="{ active: updateFrequency === '1h' }" @click="updateFrequency = '1h'">
                  <span>每小时</span>
                </button>
                <button class="freq-option" :class="{ active: updateFrequency === '6h' }" @click="updateFrequency = '6h'">
                  <span>每 6 小时</span>
                </button>
                <button class="freq-option" :class="{ active: updateFrequency === '12h' }" @click="updateFrequency = '12h'">
                  <span>每 12 小时</span>
                </button>
                <button class="freq-option" :class="{ active: updateFrequency === '24h' }" @click="updateFrequency = '24h'">
                  <span>每天</span>
                </button>
                <button class="freq-option" :class="{ active: updateFrequency === '7d' }" @click="updateFrequency = '7d'">
                  <span>每周</span>
                </button>
              </div>
            </div>

            <div class="schedule-setting-row">
              <div class="setting-info">
                <span class="setting-label">更新时间</span>
                <span class="setting-desc">设置每天自动更新的具体时间</span>
              </div>
              <input type="time" v-model="updateTime" class="time-input" />
            </div>

            <div class="schedule-setting-row">
              <div class="setting-info">
                <span class="setting-label">失败重试</span>
                <span class="setting-desc">更新失败时的自动重试次数</span>
              </div>
              <select v-model="retryCount" class="retry-select">
                <option value="1">1 次</option>
                <option value="2">2 次</option>
                <option value="3">3 次</option>
                <option value="5">5 次</option>
              </select>
            </div>

            <div class="schedule-divider"></div>

            <div class="schedule-toggle-row">
              <label class="toggle-switch">
                <input type="checkbox" v-model="updateNotification" />
                <span class="toggle-slider"></span>
              </label>
              <div class="toggle-info">
                <span class="toggle-label">更新通知</span>
                <span class="toggle-desc">更新完成后发送通知提醒</span>
              </div>
            </div>

            <div class="schedule-toggle-row">
              <label class="toggle-switch">
                <input type="checkbox" v-model="autoUpdate" />
                <span class="toggle-slider"></span>
              </label>
              <div class="toggle-info">
                <span class="toggle-label">自动更新</span>
                <span class="toggle-desc">启用后台自动更新直播源数据</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 单独源定时设置 -->
        <div class="settings-section">
          <div class="source-schedule-header">
            <div class="schedule-title-group">
              <h3 class="schedule-card-title">单独源设置</h3>
              <p class="schedule-card-desc">为每个直播源配置独立的更新规则</p>
            </div>
            <button class="batch-btn">批量操作</button>
          </div>

          <div class="source-schedule-list">
            <div class="source-schedule-item">
              <label class="toggle-switch mini">
                <input type="checkbox" checked />
                <span class="toggle-slider"></span>
              </label>
              <span class="source-name">我的直播源</span>
              <span class="source-freq">每小时</span>
              <span class="source-time">03:00</span>
              <span class="source-status success">
                <span class="status-dot"></span>
                正常
              </span>
              <span class="source-last-update">2026-04-13 10:00</span>
              <button class="update-now-btn">立即更新</button>
            </div>
            <div class="source-schedule-item">
              <label class="toggle-switch mini">
                <input type="checkbox" />
                <span class="toggle-slider"></span>
              </label>
              <span class="source-name">备用直播源</span>
              <span class="source-freq">每 6 小时</span>
              <span class="source-time">--:--</span>
              <span class="source-status error">
                <span class="status-dot"></span>
                异常
              </span>
              <span class="source-last-update">2026-04-12 08:00</span>
              <button class="update-now-btn">立即更新</button>
            </div>
          </div>
        </div>

        <!-- 更新历史记录 -->
        <div class="settings-section">
          <div class="history-header">
            <div class="schedule-title-group">
              <h3 class="schedule-card-title">更新历史</h3>
              <p class="schedule-card-desc">查看最近的更新记录和状态</p>
            </div>
            <button class="clear-history-btn">清空记录</button>
          </div>

          <div class="history-list">
            <div class="history-table-header">
              <span class="col-source">源名称</span>
              <span class="col-time">更新时间</span>
              <span class="col-duration">耗时</span>
              <span class="col-channels">频道数</span>
              <span class="col-detail">详情</span>
              <span class="col-action">操作</span>
            </div>
            <div class="history-item success">
              <span class="col-source">我的直播源</span>
              <span class="col-time">2026-04-13 10:00</span>
              <span class="col-duration">3.2s</span>
              <span class="col-channels">
                <span class="status-dot success"></span>
                50
              </span>
              <span class="col-detail">成功更新 50 个频道</span>
              <button class="view-log-btn">查看日志</button>
            </div>
            <div class="history-item success">
              <span class="col-source">我的直播源</span>
              <span class="col-time">2026-04-13 04:00</span>
              <span class="col-duration">2.8s</span>
              <span class="col-channels">
                <span class="status-dot success"></span>
                50
              </span>
              <span class="col-detail">成功更新 50 个频道</span>
              <button class="view-log-btn">查看日志</button>
            </div>
            <div class="history-item error">
              <span class="col-source">备用直播源</span>
              <span class="col-time">2026-04-12 08:00</span>
              <span class="col-duration">15.3s</span>
              <span class="col-channels">
                <span class="status-dot error"></span>
                0
              </span>
              <span class="col-detail">连接超时，更新失败</span>
              <button class="view-log-btn">查看日志</button>
            </div>
          </div>
        </div>
      </div>
      <!-- 界面设置模块 -->
      <div v-else-if="activeTab === 'ui'" class="ui-management">
        <div class="module-header">
          <h2 class="module-title">界面设置</h2>
          <p class="module-desc">自定义界面外观和交互体验</p>
        </div>

        <!-- 主题选择卡片 -->
        <div class="settings-section">
          <h3 class="section-title">主题选择</h3>
          <div class="theme-grid">
            <button class="theme-card" :class="{ active: theme === 'dark' }" @click="theme = 'dark'">
              <div class="theme-preview">
                <div class="theme-preview-dark">
                  <div class="preview-sidebar-mini"></div>
                  <div class="preview-main-mini">
                    <div class="preview-player-mini"></div>
                  </div>
                </div>
              </div>
              <span class="theme-label">深色模式</span>
              <span class="theme-check" v-if="theme === 'dark'">✓</span>
            </button>
            <button class="theme-card" :class="{ active: theme === 'light' }" @click="theme = 'light'">
              <div class="theme-preview">
                <div class="theme-preview-light">
                  <div class="preview-sidebar-mini light"></div>
                  <div class="preview-main-mini light">
                    <div class="preview-player-mini light"></div>
                  </div>
                </div>
              </div>
              <span class="theme-label">浅色模式</span>
              <span class="theme-check" v-if="theme === 'light'">✓</span>
            </button>
            <button class="theme-card" :class="{ active: theme === 'blue' }" @click="theme = 'blue'">
              <div class="theme-preview">
                <div class="theme-preview-blue">
                  <div class="preview-sidebar-mini blue"></div>
                  <div class="preview-main-mini blue">
                    <div class="preview-player-mini blue"></div>
                  </div>
                </div>
              </div>
              <span class="theme-label">蓝色主题</span>
              <span class="theme-check" v-if="theme === 'blue'">✓</span>
            </button>
            <button class="theme-card" :class="{ active: theme === 'black' }" @click="theme = 'black'">
              <div class="theme-preview">
                <div class="theme-preview-black">
                  <div class="preview-sidebar-mini black"></div>
                  <div class="preview-main-mini black">
                    <div class="preview-player-mini black"></div>
                  </div>
                </div>
              </div>
              <span class="theme-label">纯黑模式</span>
              <span class="theme-check" v-if="theme === 'black'">✓</span>
            </button>
          </div>
        </div>

        <!-- 强调色 -->
        <div class="settings-section">
          <h3 class="section-title">强调色</h3>
          <div class="color-picker-grid">
            <button class="color-swatch" :class="{ active: accentColor === 'blue' }" style="background-color: #3b82f6;" @click="accentColor = 'blue'"></button>
            <button class="color-swatch" :class="{ active: accentColor === 'purple' }" style="background-color: #8b5cf6;" @click="accentColor = 'purple'"></button>
            <button class="color-swatch" :class="{ active: accentColor === 'green' }" style="background-color: #22c55e;" @click="accentColor = 'green'"></button>
            <button class="color-swatch" :class="{ active: accentColor === 'orange' }" style="background-color: #f97316;" @click="accentColor = 'orange'"></button>
          </div>
        </div>

        <!-- 字体大小 -->
        <div class="settings-section">
          <h3 class="section-title">字体大小</h3>
          <div class="option-grid-3">
            <button class="option-card-small" :class="{ active: fontSize === 'small' }" @click="fontSize = 'small'">
              <span class="option-label">小</span>
            </button>
            <button class="option-card-small" :class="{ active: fontSize === 'medium' }" @click="fontSize = 'medium'">
              <span class="option-label">中</span>
            </button>
            <button class="option-card-small" :class="{ active: fontSize === 'large' }" @click="fontSize = 'large'">
              <span class="option-label">大</span>
            </button>
          </div>
        </div>
      </div>
      <!-- 播放设置模块 -->
      <div v-else-if="activeTab === 'player'" class="player-management">
        <div class="module-header">
          <h2 class="module-title">播放设置</h2>
          <p class="module-desc">配置播放器内核、解码方式及播放行为</p>
        </div>

        <!-- 基础播放设置卡片 -->
        <div class="settings-section">
          <h3 class="section-title">基础设置</h3>
          <div class="toggle-list">
            <div class="toggle-item">
              <div class="toggle-info">
                <span class="toggle-label">硬件加速</span>
                <span class="toggle-desc">使用 GPU 加速视频解码</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="hardwareAccel" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="toggle-item">
              <div class="toggle-info">
                <span class="toggle-label">自动播放</span>
                <span class="toggle-desc">打开频道时自动开始播放</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="autoplay" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="toggle-item">
              <div class="toggle-info">
                <span class="toggle-label">画中画模式</span>
                <span class="toggle-desc">切换频道时保持小窗口播放</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="pipMode" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="toggle-item">
              <div class="toggle-info">
                <span class="toggle-label">记住音量</span>
                <span class="toggle-desc">下次打开时恢复上次音量</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="rememberVolume" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 播放器内核 -->
        <div class="settings-section">
          <h3 class="section-title">播放器内核</h3>
          <div class="option-grid-2">
            <button class="option-card" :class="{ active: playerCore === 'hls' }" @click="playerCore = 'hls'">
              <RiFilmLine class="option-icon" />
              <span class="option-label">HLS.js</span>
              <span class="option-desc">推荐，兼容性好</span>
            </button>
            <button class="option-card" :class="{ active: playerCore === 'native' }" @click="playerCore = 'native'">
              <RiTv2Line class="option-icon" />
              <span class="option-label">原生 Video</span>
              <span class="option-desc">轻量，支持 Safari</span>
            </button>
          </div>
        </div>

        <!-- 解码方式 -->
        <div class="settings-section">
          <h3 class="section-title">解码方式</h3>
          <div class="option-grid-2">
            <button class="option-card" :class="{ active: decodeMode === 'soft' }" @click="decodeMode = 'soft'">
              <RiComputerLine class="option-icon" />
              <span class="option-label">软解</span>
              <span class="option-desc">CPU 解码，兼容性强</span>
            </button>
            <button class="option-card" :class="{ active: decodeMode === 'hard' }" @click="decodeMode = 'hard'">
              <RiFlashlightLine class="option-icon" />
              <span class="option-label">硬解</span>
              <span class="option-desc">GPU 加速，性能更好</span>
            </button>
          </div>
        </div>
      </div>
      <!-- 其他设置模块占位 -->
      <div v-else class="placeholder-module">
        <div class="placeholder-content">
          <RiHammerLine class="placeholder-icon" />
          <h3 class="placeholder-title">功能开发中</h3>
          <p class="placeholder-desc">{{ menuItems.find(i => i.id === activeTab)?.label }}功能即将上线</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.settings-view {
  display: flex;
  height: calc(100vh - 80px);
  margin-top: 80px;
}

/* 左侧设置菜单 */
.settings-sidebar {
  width: 280px;
  flex-shrink: 0;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 24px 0;
}

.settings-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  &:hover { background-color: var(--bg-card); color: var(--text-primary); }
  &.active {
    background-color: rgba(59, 130, 246, 0.12);
    color: var(--brand-primary);
  }
  .menu-icon { width: 18px; height: 18px; color: inherit; }
  .menu-label { font-size: 14px; font-weight: 500; }
}

/* 右侧设置内容区 */
.settings-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  background-color: var(--bg-primary);

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

/* 模块标题 */
.module-header { margin-bottom: 14px; }
.module-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 2px; line-height: 1.3; }
.module-desc { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.5; opacity: 0.7; }

/* 添加源区域 */
.add-source-section {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
}

.section-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px; }
.section-desc { font-size: 12px; color: var(--text-secondary); margin: 0 0 12px; opacity: 0.7; }

/* 添加方式选择 */
.add-method-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.method-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  &.active { border-color: var(--brand-primary); background-color: rgba(59, 130, 246, 0.05); color: var(--brand-primary); }
  &:hover:not(.active) { border-color: var(--border-color); color: var(--text-primary); background-color: var(--bg-card); }
  .method-icon { width: 18px; height: 18px; color: inherit; }
  .method-label { font-size: 13px; font-weight: 600; }
  .method-desc { font-size: 11px; opacity: 0.6; }
}

/* URL 表单 */
.url-form { display: flex; flex-direction: column; gap: 10px; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-label { font-size: 12px; font-weight: 500; color: var(--text-primary); }
.form-input {
  padding: 10px 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  transition: all var(--transition-fast);
  &:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); outline: none; }
  &::placeholder { color: var(--text-disabled); }
  &:hover:not(:focus) { border-color: #3d3d50; }
}

.btn-add-source {
  padding: 10px 20px;
  background-color: var(--brand-primary);
  color: white;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  transition: all var(--transition-fast);
  cursor: pointer;
  align-self: flex-start;
  &:hover { background-color: var(--brand-hover); }
  &:active { transform: scale(0.98); }
}

/* 文件上传区域 */
.file-upload-area {
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 28px;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  &:hover { border-color: var(--brand-primary); background-color: rgba(59, 130, 246, 0.02); }
  .upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .upload-icon { width: 36px; height: 36px; opacity: 0.5; color: var(--text-secondary); }
  .upload-text { font-size: 13px; color: var(--text-secondary); }
}

/* 已添加源列表 */
.source-list-section {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--border-color);
}

.source-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.source-list-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
.source-count { font-size: 11px; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 8px; border-radius: 10px; }

.source-table { display: flex; flex-direction: column; gap: 4px; }
.table-header {
  display: flex; align-items: center; padding: 8px 12px;
  background-color: var(--bg-secondary); border-radius: 6px;
  font-size: 11px; color: var(--text-secondary); font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.col-status { width: 60px; text-align: center; }
.col-name { width: 200px; }
.col-url { flex: 1; }
.col-channels { width: 120px; text-align: center; }
.col-update { width: 160px; text-align: center; }
.col-actions { width: 200px; text-align: center; }

/* 定时管理 */
.schedule-management { }
.schedule-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 28px;
  max-width: 640px;
  border: 1px solid var(--border-color);
}
.card-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0 0 20px; }
.form-select {
  padding: 12px 14px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  transition: all var(--transition-fast);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b8fa3' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: calc(100% - 14px) center;
  padding-right: 36px;
  &:hover:not(:focus) { border-color: #3d3d50; }
  &:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); outline: none; }
}
.schedule-info { display: flex; flex-direction: column; gap: 10px; margin: 20px 0; padding: 16px 0; border-top: 1px solid var(--border-color); }
.info-item { display: flex; justify-content: space-between; align-items: center; }
.info-label { font-size: 13px; color: var(--text-secondary); }
.info-value { font-size: 13px; color: var(--text-primary); font-weight: 500; font-variant-numeric: tabular-nums; }
.schedule-actions { display: flex; gap: 10px; margin-top: 20px; }
.btn { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all var(--transition-fast);
  &.btn-primary { background-color: var(--brand-primary); color: white; &:hover { background-color: var(--brand-hover); transform: translateY(-1px); } &:active { transform: translateY(0); } }
  &.btn-secondary { background-color: var(--bg-secondary); color: var(--text-secondary); &:hover { color: var(--text-primary); background-color: #2d2d3d; } }
}

/* 播放设置 */
.option-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0;
  border-bottom: 1px solid var(--border-color);
  &:last-child { border-bottom: none; padding-bottom: 0; }
  &:first-child { padding-top: 0; }
}

.setting-info { display: flex; flex-direction: column; gap: 4px; }
.setting-label { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.setting-desc { font-size: 13px; color: var(--text-secondary); }

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  input { opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    transition: all var(--transition-fast);
    border-radius: 26px;
    &:before {
      position: absolute;
      content: "";
      height: 20px; width: 20px;
      left: 2px; bottom: 2px;
      background-color: #fff;
      transition: all var(--transition-fast);
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  }
  input:checked + .toggle-slider { background-color: var(--brand-primary); border-color: var(--brand-primary); }
  input:checked + .toggle-slider:before { transform: translateX(22px); }
}

.shortcuts-list { display: flex; flex-direction: column; gap: 8px; }
.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  transition: background-color var(--transition-fast);
  &:hover { background-color: #2d2d3d; }
}

.shortcut-action { font-size: 14px; color: var(--text-primary); }
.shortcut-keys { display: flex; gap: 6px; }

.key-badge {
  display: inline-block;
  padding: 4px 10px;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 36px;
  text-align: center;
}

/* 界面设置 */
.settings-section {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 14px;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
}

.option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px 12px;
  border-radius: 10px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  &:hover { border-color: var(--border-color); }
  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.08);
    color: var(--brand-primary);
  }
  .option-icon { width: 22px; height: 22px; color: inherit; }
  .option-label { font-size: 13px; font-weight: 500; }
  .option-desc { font-size: 11px; color: var(--text-secondary); text-align: center; line-height: 1.3; }
}

.color-picker-grid {
  display: flex;
  gap: 14px;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all var(--transition-fast);
  cursor: pointer;
  position: relative;
  outline: none;
  &:hover { transform: scale(1.12); }
  &.active {
    border-color: var(--text-primary);
    transform: scale(1.12);
    &::after {
      content: '✓';
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 14px;
      font-weight: bold;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
  }
}

/* 界面预览 */
.preview-section {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
}

.preview-container {
  display: flex;
  height: 180px;
  background-color: var(--bg-primary);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.preview-sidebar {
  width: 56px;
  background-color: var(--bg-secondary);
  padding: 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid var(--border-color);
}

.preview-sidebar-item {
  height: 6px;
  border-radius: 3px;
  background-color: var(--border-color);
  &.active { background-color: var(--brand-primary); }
}

/* 界面设置 - 主题卡片 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: 2px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  position: relative;
  &:hover { border-color: var(--border-color); }
  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.06);
    color: var(--brand-primary);
  }
}

.theme-preview {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 6px;
  overflow: hidden;
}

.theme-preview-dark,
.theme-preview-light,
.theme-preview-blue,
.theme-preview-black {
  display: flex;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
}

.preview-sidebar-mini {
  width: 25%;
  background-color: #1a1a24;
  border-right: 1px solid #2d2d3d;
  &.light { background-color: #f5f5f5; border-color: #e0e0e0; }
  &.blue { background-color: #1a2a4a; border-color: #2a3a5a; }
  &.black { background-color: #0a0a0a; border-color: #1a1a1a; }
}

.preview-main-mini {
  flex: 1;
  background-color: #0f0f14;
  display: flex;
  flex-direction: column;
  &.light { background-color: #ffffff; }
  &.blue { background-color: #0f1a2e; }
  &.black { background-color: #000000; }
}

.preview-player-mini {
  flex: 1;
  background-color: #000;
  margin: 4px;
  border-radius: 2px;
  &.light { background-color: #e0e0e0; }
  &.blue { background-color: #1a2a4a; }
  &.black { background-color: #0a0a0a; }
}

.theme-label {
  font-size: 12px;
  font-weight: 500;
}

.theme-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--brand-primary);
  color: white;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.option-card-small {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  &:hover { border-color: var(--border-color); }
  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.06);
    color: var(--brand-primary);
  }
  .option-label { font-size: 13px; font-weight: 500; }
}

.option-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

/* 播放设置 - 开关列表 */
.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
  &:last-child { border-bottom: none; padding-bottom: 0; }
  &:first-child { padding-top: 0; }
}

.toggle-info { display: flex; flex-direction: column; gap: 3px; }
.toggle-label { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.toggle-desc { font-size: 12px; color: var(--text-secondary); opacity: 0.7; }

/* 定时管理 */
.schedule-global-header,
.source-schedule-header,
.history-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.schedule-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.schedule-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.schedule-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.7;
  margin: 0;
}

.batch-btn,
.clear-history-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all var(--transition-fast);
  &:hover { color: var(--text-primary); border-color: #3d3d50; }
}

.clear-history-btn {
  color: var(--error);
  &:hover { background-color: rgba(239, 68, 68, 0.1); border-color: var(--error); }
}

.schedule-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.schedule-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.frequency-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.freq-option {
  padding: 8px 16px;
  border-radius: 6px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  &:hover { border-color: var(--border-color); }
  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.06);
    color: var(--brand-primary);
  }
}

.time-input {
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  transition: all var(--transition-fast);
  &:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); outline: none; }
}

.retry-select {
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  &:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); outline: none; }
}

.schedule-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 8px 0;
}

.schedule-toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 单独源定时设置 */
.source-schedule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-schedule-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  font-size: 13px;
}

.source-name { flex: 1; font-weight: 500; color: var(--text-primary); }
.source-freq { color: var(--text-secondary); min-width: 80px; text-align: center; }
.source-time { color: var(--text-secondary); min-width: 60px; text-align: center; font-variant-numeric: tabular-nums; }

.source-status {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  &.success { background-color: rgba(34, 197, 94, 0.12); color: var(--success); }
  &.error { background-color: rgba(239, 68, 68, 0.12); color: var(--error); }
}

.source-last-update { color: var(--text-secondary); min-width: 140px; text-align: center; font-size: 12px; }

.update-now-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background-color: var(--brand-primary);
  color: white;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  &:hover { background-color: var(--brand-hover); }
  &:active { transform: scale(0.95); }
}

/* 更新历史记录 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.history-table-header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 6px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 6px;
  font-size: 13px;
  transition: background-color var(--transition-fast);
  &:hover { background-color: var(--bg-secondary); }
  &.error { background-color: rgba(239, 68, 68, 0.04); }
}

.col-source { flex: 1; font-weight: 500; color: var(--text-primary); }
.col-time { color: var(--text-secondary); min-width: 140px; text-align: center; font-size: 12px; }
.col-duration { color: var(--text-secondary); min-width: 60px; text-align: center; }
.col-channels {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 60px;
  justify-content: center;
}
.col-detail { flex: 2; color: var(--text-secondary); font-size: 12px; }
.col-action { min-width: 80px; text-align: center; }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
  &.success { color: var(--success); }
  &.error { color: var(--error); }
}

.view-log-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all var(--transition-fast);
  &:hover { color: var(--text-primary); border-color: #3d3d50; }
}

/* 占位模块 */
.placeholder-module { display: flex; align-items: center; justify-content: center; height: 400px; }
.placeholder-content { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.placeholder-icon { width: 56px; height: 56px; opacity: 0.4; color: var(--text-secondary); }
.placeholder-title { font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0; }
.placeholder-desc { font-size: 14px; color: var(--text-secondary); margin: 0; }
</style>
