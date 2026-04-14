<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SourceItem from '@/components/SourceItem.vue'
import ImportSourceModal from '@/components/ImportSourceModal.vue'
import { useSourceStore } from '@/stores/source'
import { usePlayerSettingsStore } from '@/stores/player-settings'
import type { Source } from '@/types/source'
import {
  RiLink, RiTimerLine, RiPlayCircleLine, RiPaletteLine, RiInformationLine,
  RiFolderLine, RiUploadCloud2Line,
  RiFilmLine, RiTv2Line,
  RiCheckLine
} from '@remixicon/vue'
import { switchTheme, switchAccentColor, switchFontSize, getThemeSettings } from '@/services/theme'
import { importSourceFromFile, addSourceFromUrl } from '@/services/source-loader'

const sourceStore = useSourceStore()
const playerSettings = usePlayerSettingsStore()

const activeTab = ref<'source' | 'schedule' | 'player' | 'ui' | 'about'>('source')
const addMethod = ref<'url' | 'file'>('url')
const sourceName = ref('')
const sourceUrl = ref('')
const showImportModal = ref(false)

// UI Settings State - 从 localStorage 加载
const settings = getThemeSettings()
const theme = ref(settings.theme)
const fontSize = ref(settings.fontSize)
const accentColor = ref(settings.accentColor)

const sources = ref<Source[]>([])
const activeSourceId = ref('')

// 加载源列表
async function loadSources() {
  try {
    const { getAllSources } = await import('@/db/queries/sources')
    const allSources = getAllSources()
    sources.value = allSources
    
    // 如果没有活动源，选择第一个
    if (!activeSourceId.value && allSources.length > 0) {
      activeSourceId.value = allSources[0].id
    }
  } catch (error) {
    console.error('加载源列表失败:', error)
  }
}

const handleDelete = async (sourceId: string) => {
  sources.value = sources.value.filter(s => s.id !== sourceId)
  sourceStore.removeSourceLocal(sourceId)
  
  // 如果删除了当前活动源，重置
  if (activeSourceId.value === sourceId) {
    activeSourceId.value = sources.value.length > 0 ? sources.value[0].id : ''
  }
}

const handleSwitchSource = (sourceId: string) => {
  activeSourceId.value = sourceId
  sourceStore.setActiveSource(sourceId)
}

const handleEditSource = (source: Source) => {
  // 打开导入模态框并预填数据
  sourceName.value = source.name
  sourceUrl.value = source.url
  showImportModal.value = true
}

const handleImport = async (data: { name: string; url: string; type: 'url' | 'file' }) => {
  try {
    if (data.type === 'file') {
      // 文件导入：url 字段实际上是文件内容
      console.log(`导入本地文件: ${data.name}`)
      const success = await importSourceFromFile(data.name, data.url)

      if (success) {
        console.log('文件导入成功:', data.name)
        await loadSources()
      } else {
        alert('文件导入失败，请检查文件格式')
      }
    } else {
      // URL 导入：下载 -> 缓存 -> 解析
      console.log(`添加 URL 源: ${data.name} -> ${data.url}`)
      const newSource = await addSourceFromUrl(data.name, data.url)

      if (newSource) {
        console.log('源添加成功:', newSource)
        await loadSources()
        activeSourceId.value = newSource.id
      } else {
        alert('添加源失败，请检查网络或链接')
      }
    }
  } catch (error) {
    console.error('导入错误:', error)
    alert('导入失败: ' + (error instanceof Error ? error.message : '未知错误'))
  }
}

onMounted(() => {
  loadSources()
})

const menuItems = [
  { id: 'source' as const, label: '源管理', icon: RiLink },
  { id: 'schedule' as const, label: '定时管理', icon: RiTimerLine },
  { id: 'player' as const, label: '播放设置', icon: RiPlayCircleLine },
  { id: 'ui' as const, label: '界面设置', icon: RiPaletteLine },
  { id: 'about' as const, label: '关于', icon: RiInformationLine }
]

// UI Settings State - 从 localStorage 加载
const transparentEffect = ref(true)
const borderRadius = ref(12)

// 主题切换处理函数
const handleThemeChange = (newTheme: 'dark' | 'light' | 'blue' | 'black') => {
  theme.value = newTheme
  switchTheme(newTheme)
}

const handleAccentColorChange = (color: string) => {
  accentColor.value = color
  switchAccentColor(color)
}

const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
  fontSize.value = size
  switchFontSize(size)
}

// 定时管理处理函数
const handleBatchOperation = () => {
  alert('批量操作功能开发中...')
}

const handleSourceUpdate = (sourceId: string) => {
  console.log('立即更新源:', sourceId)
  alert('立即更新功能开发中...')
}

const handleClearHistory = () => {
  if (confirm('确定要清空所有更新历史记录吗？')) {
    console.log('清空历史记录')
    alert('清空历史记录功能开发中...')
  }
}

const handleViewLog = (recordId: string) => {
  console.log('查看日志:', recordId)
  alert('查看日志功能开发中...')
}

// Player Settings State
// Player Settings 已从 playerSettings Store 管理
const autoplay = ref(true)
const hardwareAccel = ref(true)
const autoFullscreen = ref(false)
const hideMouse = ref(true)
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
            <button class="btn-add-source" @click="showImportModal = true">添加源</button>
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
                @edit="handleEditSource"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- 定时管理模块 -->
      <div v-else-if="activeTab === 'schedule'" class="schedule-management">
        <!-- 模块标题 -->
        <div class="schedule-module-header">
          <h2 class="schedule-module-title">定时管理</h2>
          <p class="schedule-module-desc">配置直播源自动更新规则，确保频道列表始终保持最新状态</p>
        </div>

        <!-- 全局定时设置卡片 -->
        <div class="schedule-card">
          <!-- 全局自动更新行 -->
          <div class="schedule-card-header">
            <div class="schedule-card-title-group">
              <h3 class="schedule-card-title-text">全局自动更新</h3>
              <p class="schedule-card-title-desc">开启后所有直播源将按照统一设置的周期自动更新</p>
            </div>
            <label class="schedule-toggle">
              <input type="checkbox" v-model="globalScheduleEnabled" />
              <span class="schedule-toggle-slider"></span>
            </label>
          </div>

          <!-- 更新频率 -->
          <div class="schedule-setting-block">
            <span class="schedule-block-label">更新频率</span>
            <div class="schedule-frequency-row">
              <button class="schedule-freq-btn" :class="{ active: updateFrequency === '1h' }" @click="updateFrequency = '1h'">每小时</button>
              <button class="schedule-freq-btn" :class="{ active: updateFrequency === '6h' }" @click="updateFrequency = '6h'">每6小时</button>
              <button class="schedule-freq-btn" :class="{ active: updateFrequency === '24h' }" @click="updateFrequency = '24h'">每天</button>
              <button class="schedule-freq-btn" :class="{ active: updateFrequency === '7d' }" @click="updateFrequency = '7d'">每周</button>
              <button class="schedule-freq-btn" :class="{ active: updateFrequency === '12h' }" @click="updateFrequency = '12h'">自定义</button>
            </div>
          </div>

          <!-- 更新时间 和 重试次数 -->
          <div class="schedule-inline-row">
            <div class="schedule-inline-col">
              <span class="schedule-block-label">更新时间</span>
              <input type="time" v-model="updateTime" class="schedule-input" />
              <span class="schedule-input-hint">设置每天自动更新的具体时间</span>
            </div>
            <div class="schedule-inline-col">
              <span class="schedule-block-label">重试次数</span>
              <input type="number" v-model="retryCount" class="schedule-input" min="0" max="10" />
              <span class="schedule-input-hint">更新失败时的自动重试次数</span>
            </div>
          </div>

          <!-- 更新通知开关行 -->
          <div class="schedule-toggle-row-new">
            <label class="schedule-toggle-mini">
              <input type="checkbox" v-model="updateNotification" />
              <span class="schedule-toggle-mini-slider"></span>
            </label>
            <div class="schedule-toggle-info-new">
              <span class="schedule-toggle-label-new">更新完成后发送通知</span>
              <span class="schedule-toggle-desc-new">直播源更新完成后在屏幕右上角显示通知提示</span>
            </div>
          </div>

          <!-- 仅在WiFi环境下更新开关行 -->
          <div class="schedule-toggle-row-new">
            <label class="schedule-toggle-mini">
              <input type="checkbox" v-model="autoUpdate" />
              <span class="schedule-toggle-mini-slider"></span>
            </label>
            <div class="schedule-toggle-info-new" :class="{ disabled: !autoUpdate }">
              <span class="schedule-toggle-label-new">仅在WiFi环境下更新</span>
              <span class="schedule-toggle-desc-new">开启后将避免使用移动数据流量进行更新</span>
            </div>
          </div>
        </div>

        <!-- 间隔 spacer -->
        <div class="schedule-spacer"></div>

        <!-- 单独源定时设置 -->
        <div class="schedule-source-section">
          <div class="schedule-source-header">
            <div class="schedule-source-title-group">
              <h3 class="schedule-source-title">单独源更新设置</h3>
              <p class="schedule-source-desc">为不同直播源设置独立的更新规则，优先级高于全局设置</p>
            </div>
            <button class="schedule-batch-btn" @click="handleBatchOperation">批量操作</button>
          </div>

          <!-- 源定时设置列表 -->
          <div class="schedule-source-list">
            <!-- 表头 -->
            <div class="schedule-source-table-header">
              <span class="ss-col-enable">启用</span>
              <span class="ss-col-name">源名称</span>
              <span class="ss-col-freq">更新频率</span>
              <span class="ss-col-time">更新时间</span>
              <span class="ss-col-result">上次更新结果</span>
              <span class="ss-col-next">下次更新时间</span>
              <span class="ss-col-action">操作</span>
            </div>
            <!-- 列表内容 -->
            <div class="schedule-source-list-body">
              <!-- 源定时项 - 启用 -->
              <div class="schedule-source-row">
                <div class="ss-col-enable">
                  <label class="ss-toggle">
                    <input type="checkbox" checked />
                    <span class="ss-toggle-slider"></span>
                  </label>
                </div>
                <span class="ss-source-name">国内直播源</span>
                <div class="ss-col-freq">
                  <span class="ss-freq-tag active">每小时</span>
                </div>
                <span class="ss-time-text">整点更新</span>
                <div class="ss-result-success">
                  <span class="ss-status-dot ss-dot-success"></span>
                  <span>成功 (223个频道)</span>
                </div>
                <span class="ss-next-time">今天 11:00</span>
                <div class="ss-col-action">
                  <button class="ss-update-btn" @click="handleSourceUpdate('source-1')">立即更新</button>
                </div>
              </div>
              <!-- 源定时项 - 未启用 -->
              <div class="schedule-source-row">
                <div class="ss-col-enable">
                  <label class="ss-toggle">
                    <input type="checkbox" />
                    <span class="ss-toggle-slider"></span>
                  </label>
                </div>
                <span class="ss-source-name ss-source-disabled">海外频道</span>
                <div class="ss-col-freq">
                  <span class="ss-freq-tag">每天</span>
                </div>
                <span class="ss-time-text ss-time-disabled">09:00</span>
                <div class="ss-result-warning">
                  <span class="ss-status-dot ss-dot-warning"></span>
                  <span>部分失败</span>
                </div>
                <span class="ss-next-time ss-next-disabled">未启用</span>
                <div class="ss-col-action">
                  <button class="ss-update-btn ss-update-disabled">立即更新</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 间隔 spacer -->
        <div class="schedule-spacer"></div>

        <!-- 更新历史记录 -->
        <div class="schedule-history-section">
          <div class="schedule-history-header">
            <div class="schedule-history-title-group">
              <h3 class="schedule-history-title">更新历史记录</h3>
              <p class="schedule-history-desc">查看最近的更新记录和详细日志</p>
            </div>
            <button class="schedule-clear-btn" @click="handleClearHistory">清空记录</button>
          </div>

          <!-- 历史记录列表 -->
          <div class="schedule-history-list">
            <!-- 表头 -->
            <div class="schedule-history-table-header">
              <span class="sh-col-time">更新时间</span>
              <span class="sh-col-source">源名称</span>
              <span class="sh-col-status">状态</span>
              <span class="sh-col-channels">频道数量</span>
              <span class="sh-col-detail">备注</span>
              <span class="sh-col-action">操作</span>
            </div>
            <!-- 列表内容 -->
            <div class="schedule-history-list-body">
              <!-- 历史记录项 - 成功 -->
              <div class="schedule-history-row">
                <span class="sh-time-text">今天 10:30:25</span>
                <span class="sh-source-name">国内直播源</span>
                <div class="sh-status-success">
                  <span class="sh-status-dot sh-dot-success"></span>
                  <span>成功</span>
                </div>
                <span class="sh-channels-count">223</span>
                <span class="sh-detail-text">自动更新完成，新增3个频道，移除2个无效频道</span>
                <div class="sh-col-action">
                  <button class="sh-log-btn" @click="handleViewLog('log-1')">查看日志</button>
                </div>
              </div>
              <!-- 历史记录项 - 成功 -->
              <div class="schedule-history-row">
                <span class="sh-time-text">今天 04:30:12</span>
                <span class="sh-source-name">国内直播源</span>
                <div class="sh-status-success">
                  <span class="sh-status-dot sh-dot-success"></span>
                  <span>成功</span>
                </div>
                <span class="sh-channels-count">222</span>
                <span class="sh-detail-text">自动更新完成，无变化</span>
                <div class="sh-col-action">
                  <button class="sh-log-btn" @click="handleViewLog('log-1')">查看日志</button>
                </div>
              </div>
              <!-- 历史记录项 - 失败 -->
              <div class="schedule-history-row">
                <span class="sh-time-text">昨天 22:30:45</span>
                <span class="sh-source-name">海外频道</span>
                <div class="sh-status-failed">
                  <span class="sh-status-dot sh-dot-failed"></span>
                  <span>失败</span>
                </div>
                <span class="sh-channels-count sh-channels-empty">-</span>
                <span class="sh-detail-text">网络连接超时，已重试3次均失败</span>
                <div class="sh-col-action">
                  <button class="sh-log-btn" @click="handleViewLog('log-1')">查看日志</button>
                </div>
              </div>
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

        <!-- 主题设置卡片 -->
        <div class="theme-settings-card">
          <h3 class="theme-settings-title">主题设置</h3>

          <!-- 主题选择区域 -->
          <div class="theme-section">
            <h4 class="theme-section-title">颜色主题</h4>
            <div class="theme-options-row">
              <!-- 深色主题 - 选中 -->
              <button class="theme-option-card" :class="{ active: theme === 'dark' }" @click="handleThemeChange('dark')">
                <div class="theme-preview-box dark-preview">
                  <div class="preview-top-bar"></div>
                  <div class="preview-sidebar-block"></div>
                  <div class="preview-main-block">
                    <div class="preview-player-block"></div>
                  </div>
                </div>
                <div class="theme-option-info">
                  <span class="theme-option-name">深色主题</span>
                  <span class="theme-check-icon" v-if="theme === 'dark'">
                    <RiCheckLine class="check-icon" />
                  </span>
                  <span class="theme-check-unselected" v-if="theme !== 'dark'"></span>
                </div>
                <span class="theme-option-desc">护眼模式，适合长时间观看</span>
              </button>

              <!-- 蓝色主题 -->
              <button class="theme-option-card" :class="{ active: theme === 'blue' }" @click="handleThemeChange('blue')">
                <div class="theme-preview-box blue-preview">
                  <div class="preview-top-bar"></div>
                  <div class="preview-sidebar-block"></div>
                  <div class="preview-main-block">
                    <div class="preview-player-block"></div>
                  </div>
                </div>
                <div class="theme-option-info">
                  <span class="theme-option-name">蓝色主题</span>
                  <span class="theme-check-unselected" v-if="theme !== 'blue'"></span>
                </div>
                <span class="theme-option-desc">清爽蓝色，视觉效果更佳</span>
              </button>

              <!-- 纯黑主题 -->
              <button class="theme-option-card" :class="{ active: theme === 'black' }" @click="handleThemeChange('black')">
                <div class="theme-preview-box black-preview">
                  <div class="preview-top-bar"></div>
                  <div class="preview-sidebar-block"></div>
                  <div class="preview-main-block">
                    <div class="preview-player-block"></div>
                  </div>
                </div>
                <div class="theme-option-info">
                  <span class="theme-option-name">纯黑主题</span>
                  <span class="theme-check-unselected" v-if="theme !== 'black'"></span>
                </div>
                <span class="theme-option-desc">OLED屏幕专用，更省电</span>
              </button>

              <!-- 浅色主题 -->
              <button class="theme-option-card" :class="{ active: theme === 'light' }" @click="handleThemeChange('light')">
                <div class="theme-preview-box light-preview">
                  <div class="preview-top-bar"></div>
                  <div class="preview-sidebar-block"></div>
                  <div class="preview-main-block">
                    <div class="preview-player-block"></div>
                  </div>
                </div>
                <div class="theme-option-info">
                  <span class="theme-option-name">浅色主题</span>
                  <span class="theme-check-unselected" v-if="theme !== 'light'"></span>
                </div>
                <span class="theme-option-desc">明亮清晰，适合白天使用</span>
              </button>
            </div>
          </div>

          <!-- 主题色选择和字体大小并排 -->
          <div class="theme-row-inline">
            <div class="accent-color-section">
              <h4 class="theme-section-title">主题色</h4>
              <div class="accent-color-container">
                <div class="accent-color-row">
                  <button class="accent-color-dot" :class="{ active: accentColor === 'blue' }" style="background-color: #3b82f6;" @click="handleAccentColorChange('#3b82f6')">
                    <RiCheckLine v-if="accentColor === 'blue'" class="color-check-icon" />
                  </button>
                  <button class="accent-color-dot" :class="{ active: accentColor === 'red' }" style="background-color: #ef4444;" @click="handleAccentColorChange('#ef4444')"></button>
                  <button class="accent-color-dot" :class="{ active: accentColor === 'green' }" style="background-color: #22c55e;" @click="handleAccentColorChange('#22c55e')"></button>
                  <button class="accent-color-dot" :class="{ active: accentColor === 'purple' }" style="background-color: #a855f7;" @click="handleAccentColorChange('#a855f7')"></button>
                  <button class="accent-color-dot" :class="{ active: accentColor === 'orange' }" style="background-color: #f97316;" @click="handleAccentColorChange('#f97316')"></button>
                  <button class="accent-color-dot" :class="{ active: accentColor === 'cyan' }" style="background-color: #06b6d4;" @click="handleAccentColorChange('#06b6d4')"></button>
                  <button class="accent-color-dot" :class="{ active: accentColor === 'pink' }" style="background-color: #ec4899;" @click="handleAccentColorChange('#ec4899')"></button>
                </div>
              </div>
            </div>

            <!-- 字体大小 -->
            <div class="font-size-section">
              <h4 class="theme-section-title">字体大小</h4>
              <div class="font-size-container">
                <div class="option-grid-3">
                <button class="option-card-small" :class="{ active: fontSize === 'small' }" @click="handleFontSizeChange('small')">
                  <span class="option-label">小</span>
                </button>
                <button class="option-card-small" :class="{ active: fontSize === 'medium' }" @click="handleFontSizeChange('medium')">
                  <span class="option-label">中</span>
                </button>
                <button class="option-card-small" :class="{ active: fontSize === 'large' }" @click="handleFontSizeChange('large')">
                  <span class="option-label">大</span>
                </button>
              </div>
              </div>
            </div>
          </div>

          <!-- 透明效果开关 -->
          <div class="setting-toggle-row">
            <div class="setting-toggle-info">
              <span class="setting-toggle-label">透明效果</span>
              <span class="setting-toggle-desc">开启界面元素半透明毛玻璃效果</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="transparentEffect" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- 圆角大小设置 -->
          <div class="setting-slider-row">
            <div class="setting-slider-info">
              <span class="setting-toggle-label">界面圆角大小</span>
              <span class="setting-toggle-desc">调整界面元素的圆角弧度</span>
            </div>
            <div class="setting-slider-value">{{ borderRadius }}px</div>
          </div>
          <div class="slider-container">
            <input type="range" v-model.number="borderRadius" min="0" max="24" class="custom-range" />
          </div>
          <div class="slider-labels">
            <span class="slider-label">0px (直角)</span>
            <span class="slider-label">8px</span>
            <span class="slider-label">16px</span>
            <span class="slider-label">24px (大圆角)</span>
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
        <div class="player-settings-card">
          <h3 class="player-settings-title">基础播放设置</h3>

          <!-- 启动时自动播放 -->
          <div class="setting-toggle-row">
            <div class="setting-toggle-info">
              <span class="setting-toggle-label">启动时自动播放</span>
              <span class="setting-toggle-desc">软件启动后自动播放上次观看的频道</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="autoplay" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- 切换频道时自动全屏 -->
          <div class="setting-toggle-row">
            <div class="setting-toggle-info">
              <span class="setting-toggle-label">切换频道时自动全屏</span>
              <span class="setting-toggle-desc">点击频道后自动进入全屏播放模式</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="autoFullscreen" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- 播放时隐藏鼠标 -->
          <div class="setting-toggle-row">
            <div class="setting-toggle-info">
              <span class="setting-toggle-label">播放时隐藏鼠标</span>
              <span class="setting-toggle-desc">播放状态下5秒无操作自动隐藏鼠标指针</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="hideMouse" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- 硬件加速 -->
          <div class="setting-toggle-row">
            <div class="setting-toggle-info">
              <span class="setting-toggle-label">硬件加速</span>
              <span class="setting-toggle-desc">使用GPU加速解码，降低CPU占用率</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="hardwareAccel" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- 记住音量 -->
          <div class="setting-toggle-row">
            <div class="setting-toggle-info">
              <span class="setting-toggle-label">记住音量</span>
              <span class="setting-toggle-desc">下次打开时恢复上次音量设置</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="rememberVolume" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 播放器内核 -->
        <div class="player-section">
          <h3 class="player-section-title">播放器内核</h3>
          <div class="player-options-row">
            <button class="player-option-card" :class="{ active: playerSettings.core === 'hls' }" @click="playerSettings.setCore('hls')">
              <RiFilmLine class="player-option-icon" />
              <span class="player-option-label">HLS.js</span>
              <span class="player-option-desc">推荐，兼容性好</span>
            </button>
            <button class="player-option-card" :class="{ active: playerSettings.core === 'native' }" @click="playerSettings.setCore('native')">
              <RiTv2Line class="player-option-icon" />
              <span class="player-option-label">原生 Video</span>
              <span class="player-option-desc">轻量，支持 Safari</span>
            </button>
            <button class="player-option-card" :class="{ active: playerSettings.core === 'dplayer' }" @click="playerSettings.setCore('dplayer')">
              <RiPlayCircleLine class="player-option-icon" />
              <span class="player-option-label">DPlayer</span>
              <span class="player-option-desc">功能丰富，体验佳</span>
            </button>
          </div>
        </div>

        <!-- 默认播放画质 -->
        <div class="player-section">
          <h3 class="player-section-title">默认播放画质</h3>
          <div class="quality-options-row">
            <button class="quality-option" :class="{ active: playerSettings.quality === 'auto' }" @click="playerSettings.setQuality('auto')">
              <span class="quality-option-label">自动</span>
            </button>
            <button class="quality-option" :class="{ active: playerSettings.quality === '1080p' }" @click="playerSettings.setQuality('1080p')">
              <span class="quality-option-label">高清 (1080P)</span>
            </button>
            <button class="quality-option" :class="{ active: playerSettings.quality === '720p' }" @click="playerSettings.setQuality('720p')">
              <span class="quality-option-label">标清 (720P)</span>
            </button>
            <button class="quality-option" :class="{ active: playerSettings.quality === '480p' }" @click="playerSettings.setQuality('480p')">
              <span class="quality-option-label">流畅 (480P)</span>
            </button>
          </div>
        </div>

        <!-- 解码方式 -->
        <div class="player-section">
          <h3 class="player-section-title">解码方式</h3>
          <div class="decode-options-row">
            <button class="decode-option" :class="{ active: playerSettings.decodeMode === 'hard' }" @click="playerSettings.setDecodeMode('hard')">
              <span class="decode-option-label">硬解码</span>
            </button>
            <button class="decode-option" :class="{ active: playerSettings.decodeMode === 'soft' }" @click="playerSettings.setDecodeMode('soft')">
              <span class="decode-option-label">软解码</span>
            </button>
            <button class="decode-option" :class="{ active: playerSettings.decodeMode === 'auto' }" @click="playerSettings.setDecodeMode('auto')">
              <span class="decode-option-label">自动选择</span>
            </button>
          </div>
          <p class="decode-hint">如果播放出现卡顿或花屏，请尝试切换到软解码模式</p>
        </div>
      </div>
      <!-- 关于模块 -->
      <div v-else-if="activeTab === 'about'" class="about-module">
        <div class="module-header">
          <h2 class="module-title">关于</h2>
          <p class="module-desc">了解 LPTV 及更多软件信息</p>
        </div>

        <!-- 软件介绍卡片 -->
        <div class="about-card">
          <div class="about-header">
            <div class="app-logo">
              <img src="/logo.svg" alt="LPTV Logo" />
            </div>
            <div class="app-info">
              <h3 class="app-name">LPTV</h3>
              <p class="app-slogan">简洁优雅的本地 IPTV 播放器</p>
            </div>
          </div>

          <div class="about-divider"></div>

          <div class="about-content">
            <div class="about-description">
              <p>LPTV 是一款轻量级本地 IPTV 播放器，支持 M3U/M3U8 直播源导入与播放。</p>
              <p>提供频道管理、收藏、定时更新等实用功能，界面简洁，操作便捷。</p>
            </div>
          </div>

          <div class="about-divider"></div>

          <!-- 版本信息 -->
          <div class="version-info">
            <div class="version-row">
              <span class="version-label">版本号</span>
              <span class="version-value">v1.0.0</span>
            </div>
            <div class="version-row">
              <span class="version-label">构建日期</span>
              <span class="version-value">2026-04-13</span>
            </div>
            <div class="version-row">
              <span class="version-label">播放器内核</span>
              <span class="version-value">HLS.js / DPlayer</span>
            </div>
            <div class="version-row">
              <span class="version-label">数据库引擎</span>
              <span class="version-value">SQL.js (SQLite)</span>
            </div>
          </div>

          <div class="about-divider"></div>

          <!-- 版权信息 -->
          <div class="copyright-section">
            <p class="copyright-text">© 2026 LPTV. All Rights Reserved.</p>
            <p class="license-text">基于 MIT 协议开源</p>
          </div>
        </div>

        <!-- 相关链接卡片 -->
        <div class="about-links-card">
          <h4 class="links-title">相关链接</h4>
          <div class="links-list">
            <a href="https://github.com" target="_blank" class="link-item">
              <span class="link-label">GitHub 仓库</span>
              <span class="link-url">github.com/lptv</span>
            </a>
            <a href="https://github.com/lptv/issues" target="_blank" class="link-item">
              <span class="link-label">问题反馈</span>
              <span class="link-url">提交 Bug 或功能建议</span>
            </a>
          </div>
        </div>
      </div>
    </main>
    <ImportSourceModal :visible="showImportModal" @close="showImportModal = false" @import="handleImport" />
  </div>
</template>

<style scoped lang="scss">
.settings-view {
  display: flex;
  height: calc(100vh - 56px);
  margin-top: 56px;
}

/* 左侧设置菜单 */
.settings-sidebar {
  width: 210px;
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
  border: 1px solid var(--border-color);
}

.col-status { width: 60px; text-align: center; }
.col-name { width: 200px; }
.col-url { flex: 1; }
.col-channels { width: 120px; text-align: center; }
.col-update { width: 160px; text-align: center; }
.col-actions { width: 200px; text-align: center; }

/* 定时管理 */
.schedule-management { }

/* 模块标题 */
.schedule-module-header {
  margin-bottom: 14px;
}

.schedule-module-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 2px;
  line-height: 1.3;
}

.schedule-module-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  opacity: 0.7;
}

/* 全局定时设置卡片 */
.schedule-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border-color);
}

/* 全局自动更新行 */
.schedule-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.schedule-card-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.schedule-card-title-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.schedule-card-title-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* 定时开关 - 56x28px */
.schedule-toggle {
  position: relative;
  display: inline-block;
  width: 56px;
  height: 28px;
  input { opacity: 0; width: 0; height: 0; }
  .schedule-toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(71, 85, 105, 1);
    transition: all var(--transition-fast);
    border-radius: 28px;
    &:before {
      position: absolute;
      content: "";
      height: 20px; width: 20px;
      left: 4px; bottom: 4px;
      background-color: rgba(255, 255, 255, 1);
      transition: all var(--transition-fast);
      border-radius: 9999px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  }
  input:checked + .schedule-toggle-slider { background-color: rgba(59, 130, 246, 1); }
  input:checked + .schedule-toggle-slider:before { transform: translateX(28px); }
}

/* 设置块 */
.schedule-setting-block {
  margin-bottom: 20px;
}

.schedule-block-label {
  display: block;
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

/* 更新频率行 */
.schedule-frequency-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.schedule-freq-btn {
  padding: 12px 20px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: none;
  color: var(--text-primary);
  font-size: 15px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1.2;

  &:hover {
    background-color: rgba(71, 85, 105, 1);
  }

  &.active {
    background-color: rgba(59, 130, 246, 1);
    color: rgba(255, 255, 255, 1);
  }
}

/* 更新时间 和 重试次数 - 并排两列 */
.schedule-inline-row {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
}

.schedule-inline-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.schedule-input {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 16px;
  height: 52px;
  color: var(--text-primary);
  font-size: 16px;
  transition: all var(--transition-fast);
  outline: none;

  &:focus {
    border-color: rgba(59, 130, 246, 1);
  }

  &:hover:not(:focus) {
    border-color: rgba(71, 85, 105, 1);
  }
}

.schedule-input-hint {
  font-size: 12px;
  color: var(--text-disabled);
  line-height: 1.3;
}

/* 更新通知 / WiFi 开关行 */
.schedule-toggle-row-new {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}

.schedule-toggle-mini {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  flex-shrink: 0;
  input { opacity: 0; width: 0; height: 0; }
  .schedule-toggle-mini-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(71, 85, 105, 1);
    transition: all var(--transition-fast);
    border-radius: 24px;
    &:before {
      position: absolute;
      content: "";
      height: 20px; width: 20px;
      left: 2px; bottom: 2px;
      background-color: rgba(255, 255, 255, 1);
      transition: all var(--transition-fast);
      border-radius: 9999px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  }
  input:checked + .schedule-toggle-mini-slider { background-color: rgba(59, 130, 246, 1); }
  input:checked + .schedule-toggle-mini-slider:before { transform: translateX(24px); }
}

.schedule-toggle-info-new {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.disabled {
    .schedule-toggle-label-new {
      color: var(--text-secondary);
    }
  }
}

.schedule-toggle-label-new {
  font-size: 15px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.schedule-toggle-desc-new {
  font-size: 13px;
  color: var(--text-disabled);
  line-height: 1.3;
}

/* 间隔 spacer */
.schedule-spacer {
  height: 24px;
}

/* 单独源定时设置 */
.schedule-source-section {
  background-color: transparent;
  border-radius: 0;
  border: none;
  overflow: visible;
}

.schedule-source-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 0 16px;
}

.schedule-source-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.schedule-source-title {
  font-size: 20px;
  font-weight: 600;
  font-family: 'SourceHanSans-SemiBold', sans-serif;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.schedule-source-desc {
  font-size: 14px;
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.schedule-batch-btn {
  padding: 8px 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: none;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1.2;

  &:hover {
    background-color: rgba(71, 85, 105, 1);
  }
}

/* 源定时设置列表 */
.schedule-source-list {
  border-top: none;
  background-color: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
}

.schedule-source-table-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  background-color: var(--bg-card);
}

.schedule-source-list-body {
  border-top: 1px solid var(--border-color);
}

/* 源列表列宽 */
.ss-col-enable {
  width: 60px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ss-col-name { width: 200px; }
.ss-col-freq { width: 150px; display: flex; align-items: center; justify-content: center; }
.ss-col-time { width: 150px; text-align: center; }
.ss-col-result { width: 180px; }
.ss-col-next { width: 180px; text-align: center; }
.ss-col-action {
  width: 120px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.schedule-source-row {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  height: 64px;
  border-top: 1px solid rgba(51, 65, 85, 0.5);
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: rgba(51, 65, 85, 0.3);
  }
}

/* 源列表 Toggle 开关 */
.ss-toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  input { opacity: 0; width: 0; height: 0; }
  .ss-toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(71, 85, 105, 1);
    transition: all var(--transition-fast);
    border-radius: 24px;
    &:before {
      position: absolute;
      content: "";
      height: 20px; width: 20px;
      left: 2px; bottom: 2px;
      background-color: rgba(255, 255, 255, 1);
      transition: all var(--transition-fast);
      border-radius: 9999px;
    }
  }
  input:checked + .ss-toggle-slider { background-color: rgba(59, 130, 246, 1); }
  input:checked + .ss-toggle-slider:before { transform: translateX(24px); }
}

.ss-source-name {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.ss-source-disabled {
  color: var(--text-secondary);
}

.ss-freq-tag {
  display: inline-block;
  background-color: var(--bg-secondary);
  border-radius: 9999px;
  padding: 4px 12px;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.2;

  &.active {
    background-color: rgba(59, 130, 246, 0.2);
    color: rgba(96, 165, 250, 1);
  }
}

.ss-time-text {
  font-size: 14px;
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
}

.ss-time-disabled {
  color: var(--text-disabled);
}

.ss-result-success {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: rgba(34, 197, 94, 1);
}

.ss-result-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: rgba(249, 115, 22, 1);
}

.ss-status-dot {
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.ss-dot-success {
  background-color: rgba(34, 197, 94, 1);
}

.ss-dot-warning {
  background-color: rgba(249, 115, 22, 1);
}

.ss-next-time {
  font-size: 14px;
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
}

.ss-next-disabled {
  color: var(--text-disabled);
}

.ss-update-btn {
  padding: 6px 12px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: none;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1.2;

  &:hover {
    background-color: rgba(71, 85, 105, 1);
  }

  &:active {
    transform: scale(0.98);
  }
}

.ss-update-disabled {
  color: var(--text-secondary);
  cursor: default;

  &:hover {
    background-color: var(--bg-secondary);
  }
}

/* 更新历史记录 */
.schedule-history-section {
  background-color: transparent;
  border-radius: 0;
  border: none;
  overflow: visible;
}

.schedule-history-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 0 16px;
}

.schedule-history-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.schedule-history-title {
  font-size: 20px;
  font-weight: 600;
  font-family: 'SourceHanSans-SemiBold', sans-serif;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.schedule-history-desc {
  font-size: 14px;
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.schedule-clear-btn {
  padding: 8px 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: none;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1.2;

  &:hover {
    background-color: rgba(71, 85, 105, 1);
  }
}

/* 历史记录列表 */
.schedule-history-list {
  border-top: none;
  background-color: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
}

.schedule-history-table-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  background-color: var(--bg-card);
}

.schedule-history-list-body {
  border-top: 1px solid var(--border-color);
}

/* 历史列表列宽 */
.sh-col-time { width: 180px; }
.sh-col-source { width: 200px; }
.sh-col-status { width: 120px; display: flex; align-items: center; }
.sh-col-channels { width: 120px; text-align: center; }
.sh-col-detail { flex: 1; }
.sh-col-action {
  width: 120px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.schedule-history-row {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  height: 64px;
  border-top: 1px solid rgba(51, 65, 85, 0.5);
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: rgba(51, 65, 85, 0.3);
  }
}

.sh-time-text {
  font-size: 14px;
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
}

.sh-source-name {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.sh-status-success {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: rgba(34, 197, 94, 1);
}

.sh-status-failed {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: rgba(239, 68, 68, 1);
}

.sh-status-dot {
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.sh-dot-success {
  background-color: rgba(34, 197, 94, 1);
}

.sh-dot-failed {
  background-color: rgba(239, 68, 68, 1);
}

.sh-channels-count {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  text-align: center;
}

.sh-channels-empty {
  color: var(--text-secondary);
}

.sh-detail-text {
  font-size: 14px;
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
}

.sh-log-btn {
  padding: 6px 12px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: none;
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1.2;

  &:hover {
    background-color: rgba(71, 85, 105, 1);
  }
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
.ui-management { }

/* 主题设置卡片 */
.theme-settings-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border-color);
}

.theme-settings-title {
  font-size: 20px;
  font-weight: 600;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  margin: 0 0 24px;
}

.theme-section {
  margin-bottom: 24px;
}

.theme-section-title {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  margin: 0 0 16px;
}

.theme-options-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.theme-option-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background-color: transparent;
  border: 0.7px solid rgba(71, 85, 105, 1);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    border-color: var(--text-disabled);
  }

  &.active {
    border: 2px solid rgba(59, 130, 246, 1);
  }
}

.theme-preview-box {
  width: 100%;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

/* 深色主题预览 - 选中状态 */
.dark-preview {
  background-color: rgba(15, 23, 42, 1);

  .preview-top-bar {
    position: absolute;
    left: -0.5px;
    top: 0;
    width: 165px;
    height: 40px;
    background-color: rgba(30, 41, 59, 1);
  }

  .preview-sidebar-block {
    position: absolute;
    left: 9.5px;
    top: 50px;
    width: 71px;
    height: 60px;
    background-color: rgba(30, 41, 59, 1);
    border-radius: 4px;
  }

  .preview-main-block {
    position: absolute;
    left: 67.5px;
    top: 50px;
    width: 91px;
    height: 60px;
    background-color: rgba(30, 41, 59, 0.5);
    border-radius: 4px;
  }

  .preview-player-block {
    display: none;
  }
}

/* 蓝色主题预览 - 未选中状态 */
.blue-preview {
  background-color: rgba(30, 58, 138, 1);

  .preview-top-bar {
    position: absolute;
    left: -0.67px;
    top: 0;
    width: 168px;
    height: 40px;
    background-color: rgba(30, 64, 175, 1);
  }

  .preview-sidebar-block {
    position: absolute;
    left: 9.5px;
    top: 50px;
    width: 71px;
    height: 60px;
    background-color: rgba(30, 64, 175, 1);
    border-radius: 4px;
  }

  .preview-main-block {
    position: absolute;
    left: 67.5px;
    top: 50px;
    width: 91px;
    height: 60px;
    background-color: rgba(30, 64, 175, 0.5);
    border-radius: 4px;
  }

  .preview-player-block {
    display: none;
  }
}

/* 纯黑主题预览 - 未选中状态 */
.black-preview {
  background-color: rgba(0, 0, 0, 1);

  .preview-top-bar {
    position: absolute;
    left: -0.67px;
    top: 0;
    width: 168px;
    height: 40px;
    background-color: rgba(15, 23, 42, 1);
  }

  .preview-sidebar-block {
    position: absolute;
    left: 9.5px;
    top: 50px;
    width: 71px;
    height: 60px;
    background-color: rgba(15, 23, 42, 1);
    border-radius: 4px;
  }

  .preview-main-block {
    position: absolute;
    left: 67.5px;
    top: 50px;
    width: 91px;
    height: 60px;
    background-color: rgba(15, 23, 42, 0.5);
    border-radius: 4px;
  }

  .preview-player-block {
    display: none;
  }
}

/* 浅色主题预览 - 未选中状态 */
.light-preview {
  background-color: rgba(255, 255, 255, 1);

  .preview-top-bar {
    position: absolute;
    left: -0.67px;
    top: 0;
    width: 168px;
    height: 40px;
    background-color: var(--text-primary);
  }

  .preview-sidebar-block {
    position: absolute;
    left: 9.5px;
    top: 50px;
    width: 71px;
    height: 60px;
    background-color: var(--text-primary);
    border-radius: 4px;
  }

  .preview-main-block {
    position: absolute;
    left: 67.5px;
    top: 50px;
    width: 91px;
    height: 60px;
    background-color: rgba(241, 245, 249, 0.5);
    border-radius: 4px;
  }

  .preview-player-block {
    display: none;
  }
}

.theme-option-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.theme-option-name {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.theme-check-icon {
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background-color: rgba(59, 130, 246, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .check-icon {
    width: 16px;
    height: 16px;
    color: rgba(255, 255, 255, 1);
  }
}

.theme-check-unselected {
  width: 21px;
  height: 21px;
  border-radius: 9999px;
  border: 2px solid rgba(100, 116, 139, 1);
  flex-shrink: 0;
}

.theme-option-desc {
  font-size: 13px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  line-height: 1.2;
}

/* 主题色选择 */
.accent-color-section {
  flex: 1;
}

.font-size-section {
  flex: 1;
}

.theme-row-inline {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 24px;
}

/* 主题色容器 */
.accent-color-container {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
}

.accent-color-row {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.accent-color-dot {
  width: 48px;
  height: 48px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &:hover {
    transform: scale(1.1);
  }

  &.active {
    border: 2px solid rgba(255, 255, 255, 1);
    transform: scale(1.1);
  }

  .color-check-icon {
    width: 20px;
    height: 20px;
    color: rgba(255, 255, 255, 1);
  }
}

/* 字体大小容器 */
.font-size-container {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
}

.option-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.option-card-small {
  padding: 10px 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  font-size: 14px;

  &:hover {
    border-color: var(--border-color);
  }

  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.08);
    color: var(--brand-primary);
  }
}

/* 设置开关行 */
.setting-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  gap: 16px;
}

.setting-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-toggle-label {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.setting-toggle-desc {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
}

/* 滑块行 */
.setting-slider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  gap: 16px;
}

.setting-slider-value {
  font-size: 18px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: rgba(96, 165, 250, 1);
}

.slider-container {
  margin-bottom: 12px;
}

.custom-range {
  width: 100%;
  height: 8px;
  border-radius: 9999px;
  background-color: var(--bg-secondary);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 9999px;
    background-color: var(--brand-primary);
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    margin-top: -6px;
    border: 2px solid #fff;
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 9999px;
    background-color: var(--brand-primary);
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--brand-primary) var(--slider-progress, 50%), var(--bg-secondary) var(--slider-progress, 50%));
  }

  &::-moz-range-track {
    height: 8px;
    border-radius: 9999px;
    background-color: var(--bg-secondary);
  }

  &::-moz-range-progress {
    height: 8px;
    border-radius: 9999px;
    background-color: var(--brand-primary);
  }
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-label {
  font-size: 12px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-disabled);
}

/* 播放设置 */
.player-management { }

/* 播放设置卡片 */
.player-settings-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border-color);
}

.player-settings-title {
  font-size: 20px;
  font-weight: 600;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  margin: 0 0 24px;
}

.player-section {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border-color);
  margin-top: 20px;
}

.player-section-title {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  margin: 0 0 16px;
}

/* 播放器内核选项 */
.player-options-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.player-option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  border-radius: 10px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;

  &:hover {
    border-color: var(--border-color);
  }

  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.08);
    color: var(--brand-primary);
  }
}

.player-option-icon {
  width: 28px;
  height: 28px;
  color: inherit;
}

.player-option-label {
  font-size: 15px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.player-option-desc {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

/* 画质选项 */
.quality-options-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.quality-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: none;
  color: var(--text-primary);
  transition: all var(--transition-fast);
  cursor: pointer;
  min-height: 46px;

  &:hover {
    background-color: rgba(71, 85, 105, 1);
  }

  &.active {
    background-color: rgba(59, 130, 246, 1);
    color: rgba(255, 255, 255, 1);
  }
}

.quality-option-label {
  font-size: 15px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  line-height: 1.2;
}

/* 解码方式选项 */
.decode-options-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.decode-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: none;
  color: var(--text-primary);
  transition: all var(--transition-fast);
  cursor: pointer;
  min-height: 46px;

  &:hover {
    background-color: rgba(71, 85, 105, 1);
  }

  &.active {
    background-color: rgba(59, 130, 246, 1);
    color: rgba(255, 255, 255, 1);
  }
}

.decode-option-label {
  font-size: 15px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  line-height: 1.2;
}

.decode-hint {
  font-size: 12px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-disabled);
  margin: 12px 0 0;
  line-height: 1.2;
}

/* 关于模块 */
.about-module { }

.about-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border-color);
}

.about-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  overflow: hidden;

  img {
    width: 48px;
    height: 48px;
  }
}

.app-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-name {
  font-size: 24px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.app-slogan {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.about-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 20px 0;
}

.about-description {
  p {
    font-size: 14px;
    font-family: 'SourceHanSans-Medium', sans-serif;
    color: var(--text-secondary);
    margin: 0 0 8px;
    line-height: 1.6;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

/* 版本信息 */
.version-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.version-label {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
}

.version-value {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

/* 版权信息 */
.copyright-section {
  text-align: center;

  .copyright-text {
    font-size: 13px;
    font-family: 'SourceHanSans-Medium', sans-serif;
    color: var(--text-disabled);
    margin: 0 0 4px;
  }

  .license-text {
    font-size: 12px;
    font-family: 'SourceHanSans-Medium', sans-serif;
    color: var(--text-disabled);
    margin: 0;
  }
}

/* 相关链接卡片 */
.about-links-card {
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border-color);
  margin-top: 20px;
}

.links-title {
  font-size: 16px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  margin: 0 0 16px;
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);

  &:hover {
    background-color: rgba(59, 130, 246, 0.08);

    .link-label {
      color: var(--brand-primary);
    }
  }
}

.link-label {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.link-url {
  font-size: 12px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-disabled);
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
