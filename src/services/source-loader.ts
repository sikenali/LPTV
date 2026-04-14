import type { Source } from '@/types/source'
import { parseM3U } from '@/services/m3u-parser'
import { fetchWithRetry } from '@/services/http'
import { getCachedResource, saveResource } from '@/db/resource-cache'
import {
  insertSource,
  getSourceById,
  getAllSources,
  updateSourceStatus,
  updateSourceChannelCount,
  updateSourceLastUpdateAt,
  deleteSource
} from '@/db/queries/sources'
import {
  insertChannels,
  deleteChannelsBySourceId
} from '@/db/queries/channels'

// 默认直播源配置（测试使用 best_sorted.m3u8）
const DEFAULT_SOURCES = [
  {
    id: 'default-source-primary',
    name: '我的直播源',
    url: 'https://raw.githubusercontent.com/zilong7728/Collect-IPTV/refs/heads/main/best_sorted.m3u8',
    type: 'url' as const,
    status: 'parsing' as const,
    channelCount: 0,
    lastUpdateAt: null,
    createdAt: new Date()
  }
]

/**
 * 检查并初始化默认直播源
 * 如果数据库中不存在默认源，则自动导入
 */
export async function initializeDefaultSources(): Promise<void> {
  try {
    const existingSources = getAllSources()

    // 如果数据库中没有任何源，导入默认的 best_sorted.m3u8
    if (existingSources.length === 0) {
      console.log('数据库为空，导入默认直播源...')
      for (const defaultSource of DEFAULT_SOURCES) {
        // 检查源是否已存在（避免重复插入）
        const exists = getSourceById(defaultSource.id)
        if (exists) {
          console.log(`默认源已存在: ${defaultSource.name}`)
          continue
        }
        console.log(`正在导入默认源: ${defaultSource.name}`)
        console.log(`URL: ${defaultSource.url}`)
        await loadSourceData(defaultSource)
      }
    } else {
      console.log(`数据库已有 ${existingSources.length} 个源，跳过默认源导入`)
    }
  } catch (error) {
    console.error('初始化默认直播源失败:', error)
  }
}

/**
 * 加载单个源的数据（优化：下载 -> 缓存到资源目录 -> 解析 -> 播放）
 * 逻辑：
 * 1. 尝试从网络下载。
 * 2. 如果成功，保存到本地资源目录 (IndexedDB)。
 * 3. 解析内容。
 * 4. 如果网络失败，尝试从本地资源目录加载 (离线模式)。
 */
async function loadSourceData(sourceConfig: Omit<Source, 'channelCount' | 'lastUpdateAt'>, fileContent?: string): Promise<void> {
  const source: Source = {
    ...sourceConfig,
    channelCount: 0,
    lastUpdateAt: null,
    status: 'parsing'
  }

  try {
    // 1. 插入源记录到 SQLite
    insertSource(source)
    console.log(`源记录已添加: ${source.name} (${source.id})`)

    let content: string | null = fileContent || null
    let isFromCache = false

    // 2. 如果是本地文件导入，直接使用内容
    if (source.type === 'file' && fileContent) {
      console.log(`使用本地导入文件: ${source.name}`)
      // 保存到资源目录以便后续持久化
      if (content) {
        await saveResource(source.id, content)
        // 同时也保存一份以 URL 为 Key 的缓存，方便播放器直接调用
        await saveResource(`url:${source.url}`, content)
      }
    } 
    // 3. 如果是网络源，尝试下载
    else if (!content) {
      try {
        console.log(`正在下载源文件: ${source.name}...`)
        content = await fetchWithRetry(source.url, {
          retries: 5,
          timeout: 30000,
          baseDelay: 2000
        })
        
        // 核心优化：下载成功后，立即缓存到资源目录 (IndexedDB)
        if (content) {
          // 1. 缓存到 Source ID (用于管理)
          await saveResource(source.id, content)
          // 2. 缓存到 URL Key (用于播放器直接通过 URL 读取本地文件)
          await saveResource(`url:${source.url}`, content)
          console.log(`源文件已缓存到本地资源目录 (ID: ${source.id})`)
        }
      } catch (networkError) {
        console.warn(`网络下载失败: ${networkError}`)
        
        // 降级策略：网络失败时，尝试从本地资源目录加载 (离线播放/解析)
        console.log(`尝试从本地资源目录加载: ${source.name}...`)
        content = await getCachedResource(source.id)
        
        if (content) {
          console.log(`成功加载本地缓存 (离线模式)`)
          isFromCache = true
        } else {
          throw new Error('网络不可用且无本地缓存')
        }
      }
    }

    if (!content) {
      updateSourceStatus(source.id, 'error', '获取失败：无法从网络或本地缓存获取内容')
      console.error(`源获取失败: ${source.name}`)
      return
    }

    // 4. 解析 M3U
    console.log(`正在解析: ${source.name}...`)
    const channels = parseM3U(content, source.id)

    if (channels.length === 0) {
      updateSourceStatus(source.id, 'error', '解析失败：未找到频道数据')
      console.warn(`源解析失败: ${source.name}`)
      return
    }

    // 5. 存入频道数据库
    insertChannels(channels)

    // 6. 更新源状态
    updateSourceStatus(source.id, isFromCache ? 'active' : 'active') // Keep active even if from cache
    updateSourceChannelCount(source.id, channels.length)
    updateSourceLastUpdateAt(source.id, new Date())

    const sourceType = fileContent ? '本地文件' : (isFromCache ? '本地缓存' : '网络')
    console.log(`源处理成功 [${sourceType}]: ${source.name} - ${channels.length} 个频道`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误'
    updateSourceStatus(source.id, 'error', errorMsg)
    console.error(`源处理失败: ${source.name} - ${errorMsg}`)
    throw error
  }
}

/**
 * 重新加载指定的源数据（强制从网络获取并更新缓存）
 */
export async function reloadSource(sourceId: string): Promise<boolean> {
  const source = getSourceById(sourceId)
  if (!source) {
    console.error(`源不存在: ${sourceId}`)
    return false
  }

  // 删除旧数据
  deleteChannelsBySourceId(sourceId)

  // 清除缓存并强制从网络获取
  // clearCache(source.url) // Deprecated in favor of ID-based caching

  // 重新加载
  await loadSourceData(source)

  // 检查是否加载成功
  const updatedSource = getSourceById(sourceId)
  return updatedSource?.status === 'active'
}

/**
 * 从 URL 添加新源（下载 -> 缓存 -> 解析）
 * 用于设置页面的“添加源”功能
 */
export async function addSourceFromUrl(name: string, url: string): Promise<Source | null> {
  const sourceId = `url-source-${Date.now()}`
  const sourceConfig: Omit<Source, 'channelCount' | 'lastUpdateAt'> = {
    id: sourceId,
    name,
    url,
    type: 'url' as const,
    status: 'parsing' as const,
    createdAt: new Date()
  }

  try {
    // loadSourceData handles fetching, caching to IndexedDB, and parsing
    await loadSourceData(sourceConfig)
    return getSourceById(sourceId)
  } catch (error) {
    console.error('添加源失败:', error)
    return null
  }
}

/**
 * 从本地文件内容导入源
 */
export async function importSourceFromFile(name: string, fileContent: string): Promise<boolean> {
  const sourceId = `file-source-${Date.now()}`
  const sourceConfig: Omit<Source, 'channelCount' | 'lastUpdateAt'> = {
    id: sourceId,
    name,
    url: `file://${name}`,
    type: 'file' as const,
    status: 'parsing' as const,
    createdAt: new Date()
  }

  await loadSourceData(sourceConfig, fileContent)
  const updatedSource = getSourceById(sourceId)
  return updatedSource?.status === 'active'
}

/**
 * 删除源及其相关数据
 */
export function removeSource(sourceId: string): void {
  deleteChannelsBySourceId(sourceId)
  deleteSource(sourceId)
  console.log(`源已删除: ${sourceId}`)
}
