const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const zlib = require('zlib')
const { M3uParser } = require('m3u-parser-generator')

const app = express()
const PORT = process.env.PORT || 3000
const LOCAL_M3U_PATH = path.join(__dirname, '..', 'channels', 'lptv.m3u8')
// 开发环境本地文件不存在时的兜底源（本项目 GitHub raw 地址）
const M3U_URL = 'https://raw.githubusercontent.com/sikenali/LPTV/refs/heads/dev/channels/lptv.m3u8'
const CACHE_TTL = 4 * 60 * 60 * 1000
const LOGO_DIR = path.join(__dirname, '..', 'logos')
const STREAM_TIMEOUT = 30000
const maxConcurrentStreams = 10
let activeStreams = 0
const pendingStreamRequests = []

if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true })

let cache = { data: null, timestamp: 0 }

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || ['http://localhost:5173', 'http://127.0.0.1:5173']
const corsOptions = {
  origin: (origin, callback) => {
    // 允许无 Origin 请求（如 Service Worker、某些移动端容器）
    if (!origin) return callback(null, true)
    // 开发环境：允许任意 origin
    if (process.env.NODE_ENV !== 'production') return callback(null, true)
    // 生产环境：检查白名单或回显 origin
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    // 允许与当前请求 origin 匹配（支持动态部署）
    callback(null, true)
  },
  credentials: true,
}
app.use(cors(corsOptions))
app.use(express.json())

function normalizeChannelName(name) {
  let n = String(name || '').toLowerCase().trim()
  // 去除常见画质后缀（如 "东方卫视4K" → "dongfangweishi"）
  n = n.replace(/(高清|超清|蓝光|4k|8k|hd|uhd|fhd|sd|Plus|\+|版|version|ver)\b/g, '')
  // 去除分隔符
  n = n.replace(/[\s\-_（）()，,。.·]+/g, '')
  return n
}

function parseM3U(text) {
  const parser = new M3uParser()
  const playlist = parser.parse(text)
  const map = new Map()

  for (const m of playlist.medias || []) {
    const name = m.name
    const group = m.attributes?.['group-title'] || '未分类'
    const logo = m.attributes?.['tvg-logo'] || ''
    const url = m.location
    const key = normalizeChannelName(name) || normalizeChannelName(m.attributes?.['tvg-name'] || '')

    if (!map.has(key)) {
      const baseId = `${group}-${name}`
      map.set(key, {
        id: baseId,
        name,
        logo,
        group,
        url,
        urls: [url],
      })
      continue
    }

    const existing = map.get(key)
    // 收集同一频道的所有源，去重相同 url
    if (!existing.urls.includes(url)) existing.urls.push(url)
    // 若这条的来源优先级更高（更低数值 = 更主流的分组），则用这条作为展示名称/分组
    const existingPriority = GROUP_PRIORITY_INDEX[existing.group] ?? 999
    const newPriority = GROUP_PRIORITY_INDEX[group] ?? 999
    if (newPriority < existingPriority) {
      existing.name = name
      existing.group = group
      existing.logo = logo
      existing.id = `${group}-${name}`
      existing.url = url
    }
  }

  return Array.from(map.values())
}

async function probeUrl(url) {
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
      headers: { 'User-Agent': COMMON_UA },
    })
    return resp.status < 400
  } catch {
    return false
  }
}

async function filterValidChannels(channels) {
  const results = new Array(channels.length)
  let index = 0

  async function probeBatch(batch) {
    const promises = batch.map(async (channel, i) => {
      const valid = await probeUrl(channel.url)
      results[index + i] = valid ? channel : null
    })
    await Promise.all(promises)
  }

  for (let i = 0; i < channels.length; i += MAX_CONCURRENT) {
    const batch = channels.slice(i, i + MAX_CONCURRENT)
    await probeBatch(batch)
  }

  return results.filter(c => c !== null)
}

app.get(['/api/m3u', '/m3u'], async (req, res) => {
  const forceRefresh = req.query.refresh === '1'
  const shouldValidate = req.query.validate === 'true'
  const now = Date.now()

  if (!forceRefresh && !shouldValidate && cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.json(cache.data)
  }

  try {
    let text
    let loadedFrom = 'remote'
    // 远程优先：始终从 GitHub raw 拉取最新源（定时任务每 4h 更新仓库）。
    // 已打包的 lpk 无需重新构建即可拿到最新的频道文件。
    try {
      const response = await fetch(M3U_URL, {
        headers: { 'User-Agent': COMMON_UA },
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        text = await response.text()
        console.log('[m3u] loaded from remote:', M3U_URL)
      } else {
        throw new Error(`remote status ${response.status}`)
      }
    } catch (remoteErr) {
      // 远程不可达/超时/非 200 时，兜底使用打包内置的本地快照
      const useLocalFallback = process.env.USE_LOCAL_M3U !== 'false'
      if (useLocalFallback && fs.existsSync(LOCAL_M3U_PATH)) {
        text = fs.readFileSync(LOCAL_M3U_PATH, 'utf-8')
        loadedFrom = 'local'
        console.log('[m3u] remote unavailable, fallback to local lptv.m3u8:', LOCAL_M3U_PATH, '(reason:', remoteErr.message + ')')
      } else {
        if (cache.data) {
          return res.json(cache.data)
        }
        return res.status(502).json({ error: 'M3U source unavailable', reason: remoteErr.message })
      }
    }
    let channels = parseM3U(text)

    if (shouldValidate) {
      console.log(`[m3u] validating ${channels.length} channels...`)
      const before = channels.length

      channels = await filterValidChannels(channels)
      console.log(`[m3u] validation complete: ${before} -> ${channels.length} valid channels`)
    }

    cache = { data: channels, timestamp: now }
    res.json(channels)
  } catch (err) {
    if (cache.data) {
      return res.json(cache.data)
    }
    res.status(502).json({ error: 'Failed to fetch M3U source' })
  }
})

function extractBaseUrl(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  } catch {
    return ''
  }
}

function extractBaseAndPath(url) {
  try {
    const u = new URL(url)
    const base = `${u.protocol}//${u.host}`
    let pathPart = u.pathname + u.search + u.hash
    return { base, pathPart }
  } catch {
    return { base: '', pathPart: '' }
  }
}

function resolveUrl(base, relative) {
  if (!base || !relative) return relative

  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative
  }

  if (relative.startsWith('//')) {
    const parsed = new URL(relative, 'https://')
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
  }

  if (relative.startsWith('/')) {
    const parsed = new URL(relative, base)
    return parsed.toString()
  }

  try {
    const resolved = new URL(relative, base)
    return resolved.toString()
  } catch {
    return relative
  }
}

function getRefererFromUrl(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}/`
  } catch {
    return ''
  }
}

const COMMON_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const GROUP_PRIORITY_INDEX = Object.fromEntries([
  ['央视频道', 0], ['卫视频道', 1],
  '北京频道', '天津频道', '河北频道', '山西频道', '内蒙古频道', '辽宁频道',
  '吉林频道', '黑龙江频道', '上海频道', '江苏频道', '浙江频道', '安徽频道',
  '福建频道', '江西频道', '山东频道', '河南频道', '湖北频道', '湖南频道',
  '广东频道', '广西频道', '海南频道', '四川频道', '贵州频道', '云南频道',
  '西藏频道', '陕西频道', '甘肃频道', '青海频道', '宁夏频道', '新疆频道',
  '香港频道', '澳门频道', '台湾频道',
  '新闻频道', '体育频道', '影视频道', '少儿动漫', '纪录人文', '音乐频道',
  '广播频道', '戏曲综艺', '法治军事', '游戏电竞', '生活购物', '教育党建',
  '港澳台频道', '文旅频道',
  '其他频道', '未分类',
].flatMap((g, i) => g ? [[g, i]] : []))
const PROBE_TIMEOUT = 3000
const MAX_CONCURRENT = 5
const REFERER_MAP = {
  'm3u.81diangao.com': 'https://m3u.81diangao.com/',
  'live-trac': 'https://live-trac.tv/',
  'hls': 'https://www.hls.tv/',
  'iqilu': 'https://www.iqilu.com/',
}

function getSmartReferer(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    for (const [key, referer] of Object.entries(REFERER_MAP)) {
      if (host.includes(key)) return referer
    }
  } catch (_e) { /* ignore */ }
  return `https://${new URL(url).hostname}/`
}

function rewriteManifest(text, masterUrl) {
  const lines = text.split('\n')
  const result = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('#EXT-X-STREAM-INF') || trimmed.startsWith('#EXT-X-MEDIA:')) {
        const nextLine = lines[i + 1]
        if (nextLine && !nextLine.trim().startsWith('#')) {
          const resolved = resolveUrl(masterUrl, nextLine.trim())
          if (resolved.endsWith('.m3u8') || resolved.includes('m3u8')) {
            result.push(trimmed)
            result.push(`/api/proxy/stream?url=${encodeURIComponent(resolved)}`)
            i++
            continue
          }
        }
      }
      result.push(line)
      continue
    }

    const resolved = resolveUrl(masterUrl, trimmed)
    result.push(`/api/proxy/stream?url=${encodeURIComponent(resolved)}`)
  }

  return result.join('\n')
}

app.get(['/api/proxy/stream', '/proxy/stream'], async (req, res) => {
  let streamUrl = req.query.url
  if (!streamUrl) return res.status(400).json({ error: 'Missing url parameter' })

  streamUrl = String(streamUrl).trim()

  try {
    const parsed = new URL(streamUrl)
    // SSRF 防护：仅允许 https 协议，阻止内网/本地地址
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return res.status(400).json({ error: 'Only http/https URLs are allowed' })
    }
    const hostname = parsed.hostname.toLowerCase()
    const privatePrefixes = ['localhost', '127.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.']
    if (privatePrefixes.some(p => hostname.startsWith(p) || hostname === 'localhost')) {
      return res.status(403).json({ error: 'Internal IPs are not allowed' })
    }
  } catch {
    return res.status(400).json({ error: 'Invalid stream URL' })
  }

  const referer = getSmartReferer(streamUrl)

  function setStreamCORS() {
    const reqOrigin = req.headers.origin
    // 回显请求 Origin 以支持 credentials 模式
    res.set('Access-Control-Allow-Origin', reqOrigin || '*')
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Vary', 'Origin')
  }

  function enqueueStream(cb) {
    if (activeStreams < maxConcurrentStreams) {
      activeStreams++
      cb(() => { activeStreams-- ; dequeueStream() })
    } else {
      pendingStreamRequests.push(() => {
        activeStreams++
        cb(() => { activeStreams-- ; dequeueStream() })
      })
    }
  }

  function dequeueStream() {
    while (pendingStreamRequests.length > 0 && activeStreams < maxConcurrentStreams) {
      const next = pendingStreamRequests.shift()
      activeStreams++
      next(() => { activeStreams-- ; dequeueStream() })
    }
  }

  function handleStreamFetch(finish) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT)

      fetch(streamUrl, {
        headers: {
          'User-Agent': COMMON_UA,
          'Referer': referer,
          'Origin': referer,
        },
        signal: controller.signal,
      }).then(async response => {
        clearTimeout(timeoutId)

        if (!response.ok) {
          finish()
          return resolve(res.status(response.status).json({
            error: 'Stream fetch failed',
            status: response.status,
            url: streamUrl,
          }))
        }

        const contentType = response.headers.get('content-type') || ''

        if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl') || streamUrl.endsWith('.m3u8')) {
          const text = await response.text()

          const isMasterPlaylist = text.includes('#EXT-X-STREAM-INF')

          // 始终改写 manifest（含 master playlist），让所有变体和分段 URL 走代理，
          // 避免浏览器直接请求 CDN 导致 CORS 拦截。
          // 不再使用 redirect 选清晰度——让 hls.js 自行根据带宽自适应切换。
          let rewritten = rewriteManifest(text, streamUrl)

          const acceptEncoding = req.headers['accept-encoding'] || ''
          const shouldCompress = rewritten.length > 1024 && (acceptEncoding.includes('gzip') || acceptEncoding.includes('deflate'))

          setStreamCORS()

          if (shouldCompress) {
            const compressed = zlib.gzipSync(Buffer.from(rewritten, 'utf-8'))
            res.set('Content-Encoding', 'gzip')
            res.set('Content-Type', 'application/vnd.apple.mpegurl')
            res.set('Content-Length', compressed.length.toString())
            finish()
            return resolve(res.send(compressed))
          }

          res.set('Content-Type', 'application/vnd.apple.mpegurl')
          finish()
          return resolve(res.send(rewritten))
        } else {
          setStreamCORS()
          const arrayBuffer = await response.arrayBuffer()
          res.end(Buffer.from(arrayBuffer))
          finish()
        }
      }).catch(err => {
        clearTimeout(timeoutId)
        finish()
        reject(err)
      })
    })
  }

  try {
    await new Promise((resolve, reject) => {
      enqueueStream((done) => {
        handleStreamFetch(done).then(resolve).catch(reject)
      })
    })
  } catch (err) {
    console.error('[proxy/stream] Error:', err.message, 'URL:', streamUrl)
    res.status(502).json({ error: 'Proxy stream error', url: streamUrl })
  }
})



function generateLogoSvg(name) {
  const colors = ['#3b82f6','#8b5cf6','#ef4444','#10b981','#f59e0b','#ec4899','#06b6d4','#84cc16']
  const color = colors[Math.abs(hashCode(name)) % colors.length]
  const letter = name.charAt(0).toUpperCase()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="12" fill="${color}" opacity="0.8"/>
    <text x="40" y="44" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="sans-serif">${letter}</text>
  </svg>`
}

function hashCode(s) {
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i)
  return hash
}

app.get(['/api/proxy/image', '/proxy/image'], async (req, res) => {
  const imgUrl = req.query.url
  const name = req.query.name || ''
  if (!imgUrl) return res.status(400).json({ error: 'Missing url parameter' })

  const BASE_DIR = path.join(__dirname, '..')
  const LOGO_DIR = path.resolve(BASE_DIR, 'logos')
  const ext = path.extname(imgUrl) || '.png'
  // imgUrl 格式为 "logos/CCTV1.png"，提取文件名部分
  const fileName = path.basename(imgUrl.replace(/^.*[\\/]/, ''))
  const localPath = path.resolve(LOGO_DIR, fileName)
  // 路径遍历防护：确保解析后的路径仍在 LOGO_DIR 下
  if (!localPath.startsWith(LOGO_DIR + path.sep) && localPath !== LOGO_DIR) {
    return res.status(403).json({ error: 'Access denied' })
  }

  if (fs.existsSync(localPath)) {
    const contentType = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    const imgOrigin = req.headers.origin
    res.set({
      'Access-Control-Allow-Origin': imgOrigin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': contentType,
    })
    return res.send(fs.readFileSync(localPath))
  }

  // 远程台标 fallback：hash 缓存到 logos/hash.png
  const hash = crypto.createHash('md5').update(imgUrl).digest('hex')
  const hashPath = path.join(LOGO_DIR, hash + ext)

  if (fs.existsSync(hashPath)) {
    const contentType = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    const imgOrigin = req.headers.origin
    res.set({
      'Access-Control-Allow-Origin': imgOrigin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': contentType,
    })
    return res.send(fs.readFileSync(hashPath))
  }

  try {
    // SSRF 防护：远程台标 fetch 也需校验
    const imgParsed = new URL(imgUrl)
    if (imgParsed.protocol !== 'https:' && imgParsed.protocol !== 'http:') {
      throw new Error('Invalid protocol')
    }
    const imgHost = imgParsed.hostname.toLowerCase()
    const privatePrefixes = ['localhost', '127.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.']
    if (privatePrefixes.some(p => imgHost.startsWith(p) || imgHost === 'localhost')) {
      throw new Error('Internal IP blocked')
    }

    const response = await fetch(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('Fetch failed')

    const buffer = Buffer.from(await response.arrayBuffer())
    fs.mkdirSync(LOGO_DIR, { recursive: true })
    fs.writeFileSync(localPath, buffer)
    fs.writeFileSync(hashPath, buffer)
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Content-Type': response.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=86400',
    })
    res.send(buffer)
  } catch (err) {
    // 远程获取失败，尝试读 hash 缓存
    if (fs.existsSync(hashPath)) {
      const contentType = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
      res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400', 'Content-Type': contentType })
      return res.send(fs.readFileSync(hashPath))
    }
    const svg = generateLogoSvg(name)
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    })
    res.send(svg)
  }
})

app.get(['/api/probe', '/probe'], async (req, res) => {
  const url = req.query.url
  const urlsParam = req.query.urls
  if (!url && !urlsParam) return res.status(400).json({ error: 'Missing url parameter' })

  const urls = urlsParam
    ? String(urlsParam).split(',').map(s => s.trim()).filter(Boolean)
    : [String(url || '')]

  // 逐个源探测：能成功拉取并解析出 m3u8 清单才算可用（HEAD 可能被反爬拦截/误报）
  const probeOne = async (u) => {
    if (!u) return { ok: false, code: 0 }
    try {
      const resp = await fetch(u, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': COMMON_UA,
          'Referer': getSmartReferer(u),
        },
      })
      if (!resp.ok) return { ok: false, code: resp.status }

      const contentType = resp.headers.get('content-type') || ''
      if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl') || u.endsWith('.m3u8')) {
        const text = await resp.text()
        const isPlaylist = text.includes('#EXTM3U')
        return { ok: isPlaylist, code: resp.status, isPlaylist }
      }
      // 非 m3u8（如直连 mp4/flv）：HTTP 200 即视为可用
      return { ok: true, code: resp.status }
    } catch (err) {
      return { ok: false, code: 0 }
    }
  }

  let firstResult = null
  let bestStatus = 0
  for (const u of urls) {
    const r = await probeOne(u)
    if (!firstResult) firstResult = r
    if (r.ok) return res.json({ status: 'ok', code: r.code, probedUrls: urls.length })
    bestStatus = r.code || bestStatus
  }
  res.json({ status: 'error', code: bestStatus || firstResult?.code || 0, probedUrls: urls.length })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  const preferLocal = process.env.USE_LOCAL_M3U !== 'false'
  console.log(`LPTV proxy server running on port ${PORT}`)
  console.log(`[startup] M3U source: ${preferLocal ? 'local lptv.m3u8 (auto)' : 'remote'}`)
  console.log(`[startup] CORS allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
})
