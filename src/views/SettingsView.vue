<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SourceItem from '@/components/SourceItem.vue'
import ImportSourceModal from '@/components/ImportSourceModal.vue'
import { useSourceStore } from '@/stores/source'
import { usePlayerSettingsStore } from '@/stores/player-settings'
import { useScheduleSettingsStore } from '@/stores/schedule-settings'
import type { Source } from '@/types/source'
import {
  RiLink, RiTimerLine, RiPlayCircleLine, RiPaletteLine, RiInformationLine,
  RiCloudLine,
  RiFilmLine, RiTv2Line, RiTvLine, RiCpuLine, RiBrushLine,
  RiSettings3Line, RiShieldCheckLine, RiFileCodeLine,
  RiCheckLine
} from '@remixicon/vue'
import { switchTheme, switchAccentColor, switchFontSize, getThemeSettings } from '@/services/theme'
import { importSourceFromFile, addSourceFromUrl } from '@/services/source-loader'
import { executeSourceUpdate, rescheduleTimer } from '@/services/schedule-manager'

const sourceStore = useSourceStore()
const playerSettings = usePlayerSettingsStore()
const scheduleSettings = useScheduleSettingsStore()

const activeTab = ref<'source' | 'schedule' | 'player' | 'ui' | 'about'>('source')
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

// 远程导入状态
const isFetchingRemote = ref(false)
const remoteProgressPercent = ref(0)
const remoteUrlInput = ref('')
const importResult = ref<{ success: boolean; message: string } | null>(null)

// 从 URL 远程导入并添加到源列表
async function handleRemoteImportFromUrl() {
  const url = remoteUrlInput.value.trim()
  if (!url || isFetchingRemote.value) return

  isFetchingRemote.value = true
  remoteProgressPercent.value = 0
  importResult.value = null

  try {
    // 模拟进度
    const progressInterval = setInterval(() => {
      if (remoteProgressPercent.value < 90) {
        remoteProgressPercent.value += 10
      }
    }, 200)

    // 使用 addSourceFromUrl 直接添加源（内部会处理下载、缓存、解析）
    const sourceName = url.includes('/') ? url.split('/').pop()?.split('?')[0] || 'remote-source' : 'remote-source'
    const newSource = await addSourceFromUrl(sourceName, url)

    clearInterval(progressInterval)
    remoteProgressPercent.value = 100

    if (newSource) {
      importResult.value = {
        success: true,
        message: `成功导入 ${newSource.channelCount} 个频道`
      }
      remoteUrlInput.value = ''
      // 刷新源列表
      await loadSources()
    } else {
      importResult.value = {
        success: false,
        message: '导入失败，请检查URL是否正确'
      }
    }
  } catch (error) {
    console.error('远程导入失败:', error)
    importResult.value = {
      success: false,
      message: '导入失败: ' + (error instanceof Error ? error.message : '未知错误')
    }
  } finally {
    // 3秒后清除结果提示
    setTimeout(() => {
      importResult.value = null
    }, 5000)
    isFetchingRemote.value = false
  }
}

// 定时管理处理函数
const handleSourceUpdate = async (sourceId: string) => {
  console.log('立即更新源:', sourceId)
  await executeSourceUpdate(sourceId)
}

// Player Settings 已从 playerSettings Store 管理

// 辅助函数：处理 checkbox 变化
const onCheckboxChange = (setter: (val: boolean) => void) => (e: Event) => {
  setter((e.target as HTMLInputElement).checked)
}
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
        <div class="module-header">
          <h2 class="module-title">源管理</h2>
          <p class="module-desc">添加和管理你的直播源地址</p>
        </div>

        <div class="settings-form-grid">
          <!-- 远程导入卡片 -->
          <div class="settings-card source-remote-card">
            <div class="card-header">
              <div class="card-icon remote-icon">
                <RiCloudLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">远程导入</h3>
            </div>
            <div class="card-content">
              <div class="setting-row remote-input-row">
                <div class="setting-label-group">
                  <label class="setting-label">直播源地址</label>
                  <p class="setting-desc">输入 m3u/m3u8 远程直播源地址，自动抓取并添加到源列表</p>
                </div>
                <div class="remote-input-actions">
                  <input
                    v-model="remoteUrlInput"
                    type="text"
                    class="remote-url-input"
                    placeholder="请输入 m3u/m3u8 地址"
                    @keyup.enter="handleRemoteImportFromUrl"
                  />
                  <button class="btn-add-url" @click="handleRemoteImportFromUrl" :disabled="!remoteUrlInput.trim() || isFetchingRemote">
                    {{ isFetchingRemote ? '导入中...' : '导入' }}
                  </button>
                </div>
              </div>

              <div v-if="isFetchingRemote" class="progress-container">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: remoteProgressPercent + '%' }"></div>
                </div>
                <span class="progress-text">{{ remoteProgressPercent }}%</span>
              </div>

              <div v-if="importResult" class="import-result" :class="{ success: importResult.success, error: !importResult.success }">
                <span class="result-icon">{{ importResult.success ? '✓' : '✗' }}</span>
                <span class="result-text">{{ importResult.message }}</span>
              </div>
            </div>
          </div>

          <!-- 添加源区域 - 2个卡片并排 -->
          <div class="settings-card source-url-card">
            <div class="card-header">
              <div class="card-icon url-icon">
                <RiLink class="card-icon-svg" />
              </div>
              <h3 class="card-title">添加URL地址</h3>
            </div>
            <div class="card-content">
              <button class="add-url-btn" @click="showImportModal = true">
                <RiLink class="add-btn-icon" />
                <span>输入直播源的网络地址</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 源列表管理 -->
        <div class="source-list-section">
          <div class="source-list-header">
            <h3 class="source-list-title">源列表管理</h3>
            <span class="source-count">共 {{ sources.length }} 个</span>
          </div>
          <div class="source-table">
            <div class="table-header">
              <span class="col-status">状态</span>
              <span class="col-name">源名称</span>
              <span class="col-url">源地址</span>
              <span class="col-channels">频道数</span>
              <span class="col-schedule">更新设置</span>
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
                @update="handleSourceUpdate"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- 定时管理模块 -->
      <div v-else-if="activeTab === 'schedule'" class="schedule-management">
        <div class="module-header">
          <h2 class="module-title">定时管理</h2>
          <p class="module-desc">配置直播源自动更新规则，确保频道列表始终保持最新状态</p>
        </div>

        <div class="settings-form-grid">
          <!-- 更新控制卡片 -->
          <div class="settings-card schedule-control-card">
            <div class="card-header">
              <div class="card-icon schedule-icon">
                <RiTimerLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">更新控制</h3>
            </div>
            <div class="card-content">
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">全局自动更新</label>
                  <p class="setting-desc">开启后所有直播源将按照统一设置的周期自动更新</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" :checked="scheduleSettings.globalEnabled" @change="onCheckboxChange((v) => { scheduleSettings.setGlobalEnabled(v); rescheduleTimer() })" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">更新频率</label>
                  <p class="setting-desc">设置自动更新的时间间隔</p>
                </div>
              </div>
              <div class="schedule-frequency-row">
                <button class="schedule-freq-btn" :class="{ active: scheduleSettings.frequency === '1h' }" @click="scheduleSettings.setFrequency('1h'); rescheduleTimer()">
                  <span class="freq-label">每小时</span>
                </button>
                <button class="schedule-freq-btn" :class="{ active: scheduleSettings.frequency === '6h' }" @click="scheduleSettings.setFrequency('6h'); rescheduleTimer()">
                  <span class="freq-label">每6小时</span>
                </button>
                <button class="schedule-freq-btn" :class="{ active: scheduleSettings.frequency === '12h' }" @click="scheduleSettings.setFrequency('12h'); rescheduleTimer()">
                  <span class="freq-label">每12小时</span>
                </button>
                <button class="schedule-freq-btn" :class="{ active: scheduleSettings.frequency === '24h' }" @click="scheduleSettings.setFrequency('24h'); rescheduleTimer()">
                  <span class="freq-label">每天</span>
                </button>
                <button class="schedule-freq-btn" :class="{ active: scheduleSettings.frequency === '7d' }" @click="scheduleSettings.setFrequency('7d'); rescheduleTimer()">
                  <span class="freq-label">每周</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 更新设置卡片 -->
          <div class="settings-card schedule-settings-card">
            <div class="card-header">
              <div class="card-icon settings-icon">
                <RiSettings3Line class="card-icon-svg" />
              </div>
              <h3 class="card-title">更新设置</h3>
            </div>
            <div class="card-content">
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">更新时间</label>
                  <p class="setting-desc">设置每天自动更新的具体时间</p>
                </div>
                <input type="time" :value="scheduleSettings.time" @change="scheduleSettings.setTime(($event.target as HTMLInputElement).value)" class="schedule-input-time" />
              </div>
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">重试次数</label>
                  <p class="setting-desc">更新失败时的自动重试次数</p>
                </div>
                <input type="number" :value="scheduleSettings.retries" @change="scheduleSettings.setRetries(parseInt(($event.target as HTMLInputElement).value))" class="schedule-input-number" min="0" max="10" />
              </div>
            </div>
          </div>

          <!-- 高级选项卡片 -->
          <div class="settings-card schedule-advanced-card">
            <div class="card-header">
              <div class="card-icon advanced-icon">
                <RiShieldCheckLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">高级选项</h3>
            </div>
            <div class="card-content">
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">更新通知</label>
                  <p class="setting-desc">直播源更新完成后在屏幕右上角显示通知提示</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" :checked="scheduleSettings.notification" @change="onCheckboxChange(scheduleSettings.setNotification)" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">仅在WiFi环境下更新</label>
                  <p class="setting-desc">开启后将避免使用移动数据流量进行更新</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" :checked="scheduleSettings.wifiOnly" @change="onCheckboxChange(scheduleSettings.setWifiOnly)" />
                  <span class="toggle-slider"></span>
                </label>
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

        <div class="settings-form-grid">
          <!-- 颜色主题卡片 -->
          <div class="settings-card ui-theme-card">
            <div class="card-header">
              <div class="card-icon theme-icon">
                <RiPaletteLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">颜色主题</h3>
            </div>
            <div class="card-content">
              <div class="theme-options-grid">
                <label class="theme-option" :class="{ active: theme === 'dark' }">
                  <input type="radio" name="theme" :checked="theme === 'dark'" @change="handleThemeChange('dark')" />
                  <div class="theme-preview-box dark-preview">
                    <div class="preview-top-bar"></div>
                    <div class="preview-sidebar-block"></div>
                    <div class="preview-main-block"></div>
                  </div>
                  <div class="theme-option-info">
                    <span class="theme-option-name">深色主题</span>
                    <span class="theme-radio-indicator"><span class="radio-box-inner"></span></span>
                  </div>
                </label>
                <label class="theme-option" :class="{ active: theme === 'blue' }">
                  <input type="radio" name="theme" :checked="theme === 'blue'" @change="handleThemeChange('blue')" />
                  <div class="theme-preview-box blue-preview">
                    <div class="preview-top-bar"></div>
                    <div class="preview-sidebar-block"></div>
                    <div class="preview-main-block"></div>
                  </div>
                  <div class="theme-option-info">
                    <span class="theme-option-name">蓝色主题</span>
                    <span class="theme-radio-indicator"><span class="radio-box-inner"></span></span>
                  </div>
                </label>
                <label class="theme-option" :class="{ active: theme === 'black' }">
                  <input type="radio" name="theme" :checked="theme === 'black'" @change="handleThemeChange('black')" />
                  <div class="theme-preview-box black-preview">
                    <div class="preview-top-bar"></div>
                    <div class="preview-sidebar-block"></div>
                    <div class="preview-main-block"></div>
                  </div>
                  <div class="theme-option-info">
                    <span class="theme-option-name">纯黑主题</span>
                    <span class="theme-radio-indicator"><span class="radio-box-inner"></span></span>
                  </div>
                </label>
                <label class="theme-option" :class="{ active: theme === 'light' }">
                  <input type="radio" name="theme" :checked="theme === 'light'" @change="handleThemeChange('light')" />
                  <div class="theme-preview-box light-preview">
                    <div class="preview-top-bar"></div>
                    <div class="preview-sidebar-block"></div>
                    <div class="preview-main-block"></div>
                  </div>
                  <div class="theme-option-info">
                    <span class="theme-option-name">浅色主题</span>
                    <span class="theme-radio-indicator"><span class="radio-box-inner"></span></span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- 界面样式卡片 -->
          <div class="settings-card ui-style-card">
            <div class="card-header">
              <div class="card-icon style-icon">
                <RiBrushLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">界面样式</h3>
            </div>
            <div class="card-content">
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">主题色</label>
                  <p class="setting-desc">选择应用的主题强调色</p>
                </div>
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
              <div class="setting-row font-size-row">
                <div class="setting-label-group">
                  <label class="setting-label">字体大小</label>
                  <p class="setting-desc">选择应用的字体大小</p>
                </div>
                <div class="font-size-options">
                  <div class="radio-group radio-group-horizontal">
                    <label class="radio-box-item" :class="{ active: fontSize === 'small' }">
                      <input type="radio" name="font-size" :checked="fontSize === 'small'" @change="handleFontSizeChange('small')" />
                      <span class="radio-box"><span class="radio-box-inner"></span></span>
                      <span class="radio-box-label">小</span>
                    </label>
                    <label class="radio-box-item" :class="{ active: fontSize === 'medium' }">
                      <input type="radio" name="font-size" :checked="fontSize === 'medium'" @change="handleFontSizeChange('medium')" />
                      <span class="radio-box"><span class="radio-box-inner"></span></span>
                      <span class="radio-box-label">中</span>
                    </label>
                    <label class="radio-box-item" :class="{ active: fontSize === 'large' }">
                      <input type="radio" name="font-size" :checked="fontSize === 'large'" @change="handleFontSizeChange('large')" />
                      <span class="radio-box"><span class="radio-box-inner"></span></span>
                      <span class="radio-box-label">大</span>
                    </label>
                  </div>
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">透明效果</label>
                  <p class="setting-desc">开启界面元素半透明毛玻璃效果</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="transparentEffect" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">圆角弧度</label>
                  <p class="setting-desc">调整界面元素的圆角弧度</p>
                </div>
                <div class="slider-control">
                  <span class="slider-value">{{ borderRadius }}px</span>
                  <div class="slider-container">
                    <input type="range" v-model.number="borderRadius" min="0" max="24" class="custom-range" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 播放设置模块 -->
      <div v-else-if="activeTab === 'player'" class="player-management">
        <div class="module-header">
          <h2 class="module-title">播放设置</h2>
          <p class="module-desc">配置播放器内核、解码方式及播放行为</p>
        </div>

        <div class="settings-form-grid">
          <!-- 播放行为设置卡片 -->
          <div class="settings-card">
            <div class="card-header">
              <div class="card-icon play-icon">
                <RiPlayCircleLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">播放行为</h3>
            </div>
            <div class="card-content">
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">启动时自动播放</label>
                  <p class="setting-desc">软件启动后自动播放上次观看的频道</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" :checked="playerSettings.autoplay" @change="onCheckboxChange(playerSettings.setAutoplay)" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">切换频道时自动全屏</label>
                  <p class="setting-desc">点击频道后自动进入全屏播放模式</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" :checked="playerSettings.autoFullscreen" @change="onCheckboxChange(playerSettings.setAutoFullscreen)" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">播放时隐藏鼠标</label>
                  <p class="setting-desc">播放状态下5秒无操作自动隐藏鼠标指针</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" :checked="playerSettings.hideMouse" @change="onCheckboxChange(playerSettings.setHideMouse)" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <div class="setting-label-group">
                  <label class="setting-label">记住音量</label>
                  <p class="setting-desc">下次打开时恢复上次音量设置</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" :checked="playerSettings.rememberVolume" @change="onCheckboxChange(playerSettings.setRememberVolume)" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <!-- 播放器内核卡片 -->
          <div class="settings-card">
            <div class="card-header">
              <div class="card-icon core-icon">
                <RiFilmLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">播放器内核</h3>
            </div>
            <div class="card-content">
              <div class="radio-group">
                <label class="radio-box-item" :class="{ active: playerSettings.core === 'hls' }">
                  <input type="radio" name="player-core" :checked="playerSettings.core === 'hls'" @change="playerSettings.setCore('hls')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <RiFilmLine class="radio-box-icon" />
                  <div class="radio-box-text">
                    <span class="radio-box-label">HLS.js</span>
                    <span class="radio-box-desc">推荐，兼容性好</span>
                  </div>
                </label>
                <label class="radio-box-item" :class="{ active: playerSettings.core === 'native' }">
                  <input type="radio" name="player-core" :checked="playerSettings.core === 'native'" @change="playerSettings.setCore('native')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <RiTv2Line class="radio-box-icon" />
                  <div class="radio-box-text">
                    <span class="radio-box-label">原生 Video</span>
                    <span class="radio-box-desc">轻量，支持 Safari</span>
                  </div>
                </label>
                <label class="radio-box-item" :class="{ active: playerSettings.core === 'dplayer' }">
                  <input type="radio" name="player-core" :checked="playerSettings.core === 'dplayer'" @change="playerSettings.setCore('dplayer')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <RiPlayCircleLine class="radio-box-icon" />
                  <div class="radio-box-text">
                    <span class="radio-box-label">DPlayer</span>
                    <span class="radio-box-desc">功能丰富，体验佳</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- 画质设置卡片 -->
          <div class="settings-card">
            <div class="card-header">
              <div class="card-icon quality-icon">
                <RiTvLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">默认播放画质</h3>
            </div>
            <div class="card-content">
              <div class="radio-group radio-group-2col">
                <label class="radio-box-item" :class="{ active: playerSettings.quality === 'auto' }">
                  <input type="radio" name="player-quality" :checked="playerSettings.quality === 'auto'" @change="playerSettings.setQuality('auto')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <span class="radio-box-label">自动</span>
                </label>
                <label class="radio-box-item" :class="{ active: playerSettings.quality === '1080p' }">
                  <input type="radio" name="player-quality" :checked="playerSettings.quality === '1080p'" @change="playerSettings.setQuality('1080p')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <span class="radio-box-label">高清 (1080P)</span>
                </label>
                <label class="radio-box-item" :class="{ active: playerSettings.quality === '720p' }">
                  <input type="radio" name="player-quality" :checked="playerSettings.quality === '720p'" @change="playerSettings.setQuality('720p')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <span class="radio-box-label">标清 (720P)</span>
                </label>
                <label class="radio-box-item" :class="{ active: playerSettings.quality === '480p' }">
                  <input type="radio" name="player-quality" :checked="playerSettings.quality === '480p'" @change="playerSettings.setQuality('480p')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <span class="radio-box-label">流畅 (480P)</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 解码方式卡片 -->
          <div class="settings-card">
            <div class="card-header">
              <div class="card-icon decode-icon">
                <RiCpuLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">解码方式</h3>
            </div>
            <div class="card-content">
              <div class="radio-group">
                <label class="radio-box-item" :class="{ active: playerSettings.decodeMode === 'hard' }">
                  <input type="radio" name="player-decode" :checked="playerSettings.decodeMode === 'hard'" @change="playerSettings.setDecodeMode('hard')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <span class="radio-box-label">硬解码</span>
                </label>
                <label class="radio-box-item" :class="{ active: playerSettings.decodeMode === 'soft' }">
                  <input type="radio" name="player-decode" :checked="playerSettings.decodeMode === 'soft'" @change="playerSettings.setDecodeMode('soft')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <span class="radio-box-label">软解码</span>
                </label>
                <label class="radio-box-item" :class="{ active: playerSettings.decodeMode === 'auto' }">
                  <input type="radio" name="player-decode" :checked="playerSettings.decodeMode === 'auto'" @change="playerSettings.setDecodeMode('auto')" />
                  <span class="radio-box"><span class="radio-box-inner"></span></span>
                  <span class="radio-box-label">自动选择</span>
                </label>
              </div>
              <p class="card-hint">如果播放出现卡顿或花屏，请尝试切换到软解码模式</p>
            </div>
          </div>
        </div>
      </div>
      <!-- 关于模块 -->
      <div v-else-if="activeTab === 'about'" class="about-module">
        <div class="module-header">
          <h2 class="module-title">关于</h2>
          <p class="module-desc">了解 LPTV 及更多软件信息</p>
        </div>

        <div class="settings-form-grid">
          <!-- 软件介绍卡片 -->
          <div class="settings-card about-intro-card">
            <div class="card-header">
              <div class="card-icon about-icon">
                <RiInformationLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">软件介绍</h3>
            </div>
            <div class="card-content">
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
            </div>
          </div>

          <!-- 版本信息卡片 -->
          <div class="settings-card about-version-card">
            <div class="card-header">
              <div class="card-icon version-icon">
                <RiFileCodeLine class="card-icon-svg" />
              </div>
              <h3 class="card-title">版本信息</h3>
            </div>
            <div class="card-content">
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
              <div class="copyright-section">
                <p class="copyright-text">© 2026 LPTV. All Rights Reserved.</p>
                <p class="license-text">基于 MIT 协议开源</p>
              </div>
            </div>
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

/* 远程导入面板 */
.remote-import-card {
  background-color: var(--bg-card);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 14px;
  border: 1px solid var(--border-color);

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;

    .card-icon {
      width: 18px;
      height: 18px;
      color: var(--brand-primary);
    }

    h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
  }

  .card-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin: 0 0 10px;
    opacity: 0.7;
  }

  // 手动输入URL区域
  .remote-url-input-group {
    display: flex;
    gap: 8px;

    .remote-url-input {
      flex: 1;
      padding: 9px 12px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 12px;
      transition: all var(--transition-fast);
      &:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); outline: none; }
      &::placeholder { color: var(--text-disabled); }
      &:hover:not(:focus) { border-color: #3d3d50; }
    }

    .btn-add-url {
      padding: 9px 14px;
      background-color: var(--brand-primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      &:hover:not(:disabled) { background-color: var(--brand-hover); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  }

  /* 导入结果提示 */
  .import-result {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;

    &.success {
      background-color: rgba(34, 197, 94, 0.1);
      color: var(--success);

      .result-icon {
        color: var(--success);
      }
    }

    &.error {
      background-color: rgba(239, 68, 68, 0.1);
      color: var(--error);

      .result-icon {
        color: var(--error);
      }
    }
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
.add-method-tabs { display: flex; gap: 12px; margin-bottom: 16px; }
.method-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 16px;
  border-radius: 10px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  min-height: 100px;
  &.active { border-color: var(--brand-primary); background-color: rgba(59, 130, 246, 0.05); color: var(--brand-primary); }
  &:hover:not(.active) { border-color: var(--border-color); color: var(--text-primary); background-color: var(--bg-card); }
  .method-icon { width: 24px; height: 24px; color: inherit; }
  .method-label { font-size: 13px; font-weight: 600; }
  .method-desc { font-size: 11px; opacity: 0.6; }
}

/* URL 按钮特殊样式 */
.method-tab-url {
  &:hover { border-color: var(--brand-primary); color: var(--brand-primary); background-color: rgba(59, 130, 246, 0.03); }
}

/* 文件导入按钮样式 - 类似拖拽区域 */
.method-tab-file {
  border: 2px dashed var(--border-color);
  background-color: var(--bg-secondary);
  &:hover { border-color: var(--brand-primary); background-color: rgba(59, 130, 246, 0.03); color: var(--brand-primary); }
  &.dragging { border-color: var(--brand-primary); background-color: rgba(59, 130, 246, 0.08); color: var(--brand-primary); }
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

.file-input-hidden {
  display: none;
}

/* 源列表管理 */
.source-list-section {
  background-color: var(--bg-card);
  border-radius: 10px;
  padding: 16px;
  border: 1px solid var(--border-color);
  margin-top: 16px;
  grid-column: 1 / -1;
}

.source-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.source-list-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
.source-count { font-size: 11px; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 8px; border-radius: 10px; }

/* 全宽卡片 */
.full-width-card {
  grid-column: 1 / -1;
}

/* 远程导入输入行 */
.remote-input-row {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.remote-input-actions {
  display: flex;
  gap: 8px;
}

.remote-url-input {
  flex: 1;
  padding: 12px 14px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  transition: all var(--transition-fast);

  &:focus {
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    outline: none;
  }

  &::placeholder {
    color: var(--text-disabled);
  }
}

.btn-add-url {
  padding: 12px 20px;
  background-color: var(--brand-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;

  &:hover:not(:disabled) {
    background-color: var(--brand-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* 进度条 */
.progress-container {
  margin-top: 12px;
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
    min-width: 36px;
    text-align: right;
  }
}

/* 导入结果 */
.import-result {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;

  &.success {
    background-color: rgba(34, 197, 94, 0.1);
    color: var(--success);
  }

  &.error {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--error);
  }
}

.schedule-icon {
  background-color: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

/* 源管理卡片图标 */
.remote-icon {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--brand-primary);
}

.url-icon {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--brand-primary);
}

.file-icon {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

/* 添加URL按钮 */
.add-url-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: 1.5px dashed var(--border-color);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;

  &:hover {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.03);
  }
}

.add-btn-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.settings-icon {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--brand-primary);
}

.advanced-icon {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

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

/* 更新频率按钮行 */
.schedule-frequency-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 4px;
}

.schedule-freq-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;

  &:hover {
    border-color: var(--border-color);
  }

  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.06);
    color: var(--brand-primary);
  }
}

/* 时间输入框 */
.schedule-input-time {
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  transition: all var(--transition-fast);
  min-width: 120px;

  &:focus {
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    outline: none;
  }
}

/* 数字输入框 */
.schedule-input-number {
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  transition: all var(--transition-fast);
  width: 80px;
  text-align: center;

  &:focus {
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    outline: none;
  }
}

/* 关于模块 */
.about-module { }

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
  input:checked + .ss-toggle-slider { background-color: var(--brand-primary); }
  input:checked + .ss-toggle-slider:before { transform: translateX(24px); }
}

.ss-source-name {
  font-size: var(--font-size-subtitle);
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
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.2;

  &.active {
    background-color: rgba(59, 130, 246, 0.2);
    color: var(--brand-primary);
  }
}

.ss-time-text {
  font-size: var(--font-size-body);
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
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--success);
}

.ss-result-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--warning);
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
  font-size: var(--font-size-body);
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
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Medium', sans-serif;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1.2;

  &:hover {
    background-color: var(--bg-card);
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
  font-size: var(--font-size-title);
  font-weight: 600;
  font-family: 'SourceHanSans-SemiBold', sans-serif;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.schedule-history-desc {
  font-size: var(--font-size-body);
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
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Medium', sans-serif;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1.2;

  &:hover {
    background-color: var(--bg-card);
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
  font-size: var(--font-size-body);
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
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
}

.sh-source-name {
  font-size: var(--font-size-subtitle);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

.sh-status-success {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--success);
}

.sh-status-failed {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--error);
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
  font-size: var(--font-size-subtitle);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  text-align: center;
}

.sh-channels-empty {
  color: var(--text-secondary);
}

.sh-detail-text {
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Regular', sans-serif;
  color: var(--text-secondary);
}

.sh-log-btn {
  padding: 6px 12px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: none;
  font-size: var(--font-size-body);
  font-family: 'SourceHanSans-Medium', sans-serif;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1.2;

  &:hover {
    background-color: var(--bg-card);
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
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  input { opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: #4a4a5a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all var(--transition-fast);
    border-radius: 24px;
    &:before {
      position: absolute;
      content: "";
      height: 18px; width: 18px;
      left: 2px; bottom: 2px;
      background-color: #fff;
      transition: all var(--transition-fast);
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
  }
  input:checked + .toggle-slider { background-color: var(--brand-primary); border-color: var(--brand-primary); }
  input:checked + .toggle-slider:before { transform: translateX(18px); }
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

/* 颜色主题选项网格 */
.theme-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);

  input[type="radio"] {
    display: none;
  }

  &:hover {
    border-color: var(--border-color);
  }

  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.06);
  }
}

.theme-option-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.theme-option-name {
  font-size: 12px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
}

/* 卡片图标颜色 */
.theme-icon {
  background-color: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.style-icon {
  background-color: rgba(236, 72, 153, 0.15);
  color: #ec4899;
}

/* 字体大小3列 */
.radio-group-3col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

/* 字体大小水平排列 */
.font-size-row {
  align-items: center;
}

.font-size-options {
  display: flex;
}

.radio-group-horizontal {
  display: flex;
  gap: 10px;
}

.radio-group-horizontal .radio-box-item {
  min-width: 60px;
  justify-content: center;
}

/* 滑块控件 */
.slider-control {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 120px;
}

.slider-value {
  font-size: 13px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--brand-primary);
}

/* 主题预览框 */
.theme-preview-box {
  width: 100%;
  height: 56px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

/* 深色主题预览 */
.dark-preview {
  background-color: rgba(15, 23, 42, 1);
  .preview-top-bar {
    position: absolute;
    left: -0.5px;
    top: 0;
    width: 82px;
    height: 20px;
    background-color: rgba(30, 41, 59, 1);
  }
  .preview-sidebar-block {
    position: absolute;
    left: 5px;
    top: 25px;
    width: 35px;
    height: 30px;
    background-color: rgba(30, 41, 59, 1);
    border-radius: 2px;
  }
  .preview-main-block {
    position: absolute;
    left: 34px;
    top: 25px;
    width: 45px;
    height: 30px;
    background-color: rgba(30, 41, 59, 0.5);
    border-radius: 2px;
  }
}

/* 蓝色主题预览 */
.blue-preview {
  background-color: rgba(30, 58, 138, 1);
  .preview-top-bar {
    position: absolute;
    left: -0.67px;
    top: 0;
    width: 84px;
    height: 20px;
    background-color: rgba(30, 64, 175, 1);
  }
  .preview-sidebar-block {
    position: absolute;
    left: 5px;
    top: 25px;
    width: 35px;
    height: 30px;
    background-color: rgba(30, 64, 175, 1);
    border-radius: 2px;
  }
  .preview-main-block {
    position: absolute;
    left: 34px;
    top: 25px;
    width: 45px;
    height: 30px;
    background-color: rgba(30, 64, 175, 0.5);
    border-radius: 2px;
  }
}

/* 纯黑主题预览 */
.black-preview {
  background-color: rgba(0, 0, 0, 1);
  .preview-top-bar {
    position: absolute;
    left: -0.67px;
    top: 0;
    width: 84px;
    height: 20px;
    background-color: rgba(15, 23, 42, 1);
  }
  .preview-sidebar-block {
    position: absolute;
    left: 5px;
    top: 25px;
    width: 35px;
    height: 30px;
    background-color: rgba(15, 23, 42, 1);
    border-radius: 2px;
  }
  .preview-main-block {
    position: absolute;
    left: 34px;
    top: 25px;
    width: 45px;
    height: 30px;
    background-color: rgba(15, 23, 42, 0.5);
    border-radius: 2px;
  }
}

/* 浅色主题预览 */
.light-preview {
  background-color: rgba(255, 255, 255, 1);
  .preview-top-bar {
    position: absolute;
    left: -0.67px;
    top: 0;
    width: 84px;
    height: 20px;
    background-color: var(--text-primary);
  }
  .preview-sidebar-block {
    position: absolute;
    left: 5px;
    top: 25px;
    width: 35px;
    height: 30px;
    background-color: var(--text-primary);
    border-radius: 2px;
  }
  .preview-main-block {
    position: absolute;
    left: 34px;
    top: 25px;
    width: 45px;
    height: 30px;
    background-color: rgba(241, 245, 249, 0.5);
    border-radius: 2px;
  }
}

/* 主题单选指示器 */
.theme-radio-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);

  .radio-box-inner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: transparent;
    transition: all var(--transition-fast);
  }

  .theme-option.active & {
    border-color: var(--brand-primary);
    background-color: var(--brand-primary);

    .radio-box-inner {
      background-color: white;
    }
  }
}

/* 主题色容器 */
.accent-color-container {
  background-color: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  display: flex;
}

.accent-color-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.accent-color-dot {
  width: 28px;
  height: 28px;
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
    width: 12px;
    height: 12px;
    color: rgba(255, 255, 255, 1);
  }
}

/* 并排设置行 */
.inline-settings-row {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.inline-setting {
  flex: 1;
  min-width: 0;
}

/* 紧凑设置行 */
.compact-settings-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 0;
  min-height: 40px;
}

.compact-setting {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.compact-divider {
  width: 1px;
  height: 24px;
  background-color: var(--border-color);
  flex-shrink: 0;
}

.compact-title {
  font-size: 11px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  margin: 0 !important;
  line-height: 1;
  font-weight: 500;
}

/* 字体大小容器 */
.font-size-container {
  background-color: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  display: flex;
}

.option-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.option-card-small {
  padding: 8px 12px;
  border-radius: 6px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
  font-size: 13px;

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
  padding: 8px 0;
  gap: 12px;
  min-height: 40px;
}

.setting-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-toggle-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-toggle-desc {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
}

/* 滑块行 */
.setting-slider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  gap: 12px;
  min-height: 40px;
}

.setting-slider-value {
  font-size: 15px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: rgba(96, 165, 250, 1);
}

.slider-container {
  margin-bottom: 6px;
}

.custom-range {
  width: 100%;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--bg-secondary);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    background-color: var(--brand-primary);
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    margin-top: -5px;
    border: 2px solid #fff;
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    background-color: var(--brand-primary);
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--brand-primary) var(--slider-progress, 50%), var(--bg-secondary) var(--slider-progress, 50%));
  }

  &::-moz-range-track {
    height: 6px;
    border-radius: 9999px;
    background-color: var(--bg-secondary);
  }

  &::-moz-range-progress {
    height: 6px;
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
  font-size: 10px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-disabled);
}

/* 播放设置 */
.player-management { }

/* 设置表单网格布局 */
.settings-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* 设置卡片 */
.settings-card {
  background-color: var(--bg-card);
  border-radius: 10px;
  padding: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.card-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon-svg {
  width: 18px;
  height: 18px;
}

.play-icon {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--brand-primary);
}

.core-icon {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

.quality-icon {
  background-color: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.decode-icon {
  background-color: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.card-title {
  font-size: 14px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  margin: 0;
  font-weight: 600;
}

/* 卡片内容 */
.card-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 设置行 */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  gap: 12px;
  min-height: 40px;
}

.setting-label-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
  line-height: 1.3;
}

/* 单选按钮组 */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-group-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.radio-box-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;

  input[type="radio"] {
    display: none;
  }

  &:hover {
    border-color: var(--border-color);
    background-color: rgba(255, 255, 255, 0.02);
  }

  &.active {
    border-color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.06);
    color: var(--text-primary);
  }
}

.radio-box {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);

  .radio-box-inner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: transparent;
    transition: all var(--transition-fast);
  }

  .radio-box-item.active & {
    border-color: var(--brand-primary);
    background-color: var(--brand-primary);

    .radio-box-inner {
      background-color: white;
    }
  }
}

.radio-box-icon {
  width: 16px;
  height: 16px;
  color: inherit;
  flex-shrink: 0;
}

.radio-box-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.radio-box-label {
  font-size: 13px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
}

.radio-box-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 卡片提示 */
.card-hint {
  font-size: 11px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-disabled);
  margin: 8px 0 0;
  line-height: 1.3;
}

.player-section {
  background-color: var(--bg-card);
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  margin-top: 14px;
}

.player-section-title {
  font-size: 13px;
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: var(--text-secondary);
  margin: 0 0 10px;
}

/* 关于模块 */
.about-module { }

/* 关于模块卡片图标 */
.about-icon {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--brand-primary);
}

.version-icon {
  background-color: rgba(168, 85, 247, 0.15);
  color: #a855f7;
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

/* 移动端响应式 */
@media (max-width: 768px) {
  .settings-view {
    flex-direction: column;
  }

  .settings-sidebar {
    position: sticky;
    top: 56px;
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    padding: 8px 0;
    flex-shrink: 0;
  }

  .settings-menu {
    flex-direction: row;
    overflow-x: auto;
    gap: 4px;
    padding: 0 8px;

    &::-webkit-scrollbar {
      display: none;
    }
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .menu-item {
    white-space: nowrap;
    padding: 8px 14px;
    min-width: fit-content;
    flex-shrink: 0;
  }

  .settings-content {
    padding: 16px;
  }

  .settings-form-grid {
    grid-template-columns: 1fr;
  }

  /* 源管理表格允许横向滚动 */
  .source-table {
    overflow-x: auto;
  }

  /* 更新频率按钮在窄屏下换行 */
  .schedule-frequency-row {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
