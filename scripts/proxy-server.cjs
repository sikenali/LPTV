const express = require('express')
const cors = require('cors')
const dns = require('dns').promises
const net = require('net')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const zlib = require('zlib')

const app = express()
const PORT = process.env.PORT || 8080
const LOGO_DIR = path.join(__dirname, '..', 'logos')
  const STREAM_TIMEOUT = 60000
const maxConcurrentStreams = 10
let activeStreams = 0
const pendingStreamRequests = []

// 防止 unhandled rejection 导致进程崩溃
process.on('unhandledRejection', () => {})

if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true })

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || []
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(null, false)
  },
}
app.use(cors(corsOptions))
app.use(express.json())

// ── Logo Proxy ──────────────────────────────────────────────────────────
function generateLogoSvg(name) {
  const colors = ['#3b82f6','#8b5cf6','#ef4444','#10b981','#f59e0b','#ec4899','#06b6d4','#84cc16']
  const color = colors[Math.abs(hashCode(name)) % colors.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="12" fill="${color}" opacity="0.8"/><text x="40" y="44" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="sans-serif">${name.charAt(0).toUpperCase()}</text></svg>`
}
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i); return h }

app.get(['/api/proxy/image', '/proxy/image'], async (req, res) => {
  const imgUrl = req.query.url, name = req.query.name || ''
  if (!imgUrl) return res.status(400).json({ error: 'Missing url' })
  const dir = path.resolve(path.join(__dirname, '..', 'logos'))
  const ext = path.extname(imgUrl) || '.png'
  const fileName = path.basename(imgUrl.replace(/^.*[\\/]/, ''))
  const localPath = path.resolve(dir, fileName)
  if (!localPath.startsWith(dir + path.sep) && localPath !== dir) return res.status(403).json({ error: 'Denied' })
  if (fs.existsSync(localPath)) {
    const ct = ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png'
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400', 'Content-Type': ct })
    return res.send(fs.readFileSync(localPath))
  }
  const hash = crypto.createHash('md5').update(imgUrl).digest('hex')
  const hashPath = path.join(dir, hash + ext)
  if (fs.existsSync(hashPath)) {
    const ct = ext === '.svg' ? 'image/svg+xml' : 'image/png'
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400', 'Content-Type': ct })
    return res.send(fs.readFileSync(hashPath))
  }
  try {
    const p = new URL(imgUrl)
    if (p.protocol !== 'https:' && p.protocol !== 'http:') throw new Error('bad proto')
    const resp = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
    if (!resp.ok) throw new Error('fetch failed')
    const buf = Buffer.from(await resp.arrayBuffer())
    fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(localPath, buf); fs.writeFileSync(hashPath, buf)
    res.set({ 'Access-Control-Allow-Origin': '*', 'Content-Type': resp.headers.get('content-type') || 'image/png', 'Cache-Control': 'public, max-age=86400' })
    res.send(buf)
  } catch {
    if (fs.existsSync(hashPath)) {
      res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400', 'Content-Type': 'image/png' })
      return res.send(fs.readFileSync(hashPath))
    }
    const svg = generateLogoSvg(name)
    res.set({ 'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' })
    res.send(svg)
  }
})

// ── Local Logo 服务 ──────────────────────────────────────────────────────
app.get('/api/proxy/logo/:name', (req, res) => {
  const LOGO_DIR = path.join(__dirname, '..', 'logos')
  const name = req.params.name
  const safeName = path.basename(name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5+\- .]/g, ''))
  const logoPath = path.resolve(LOGO_DIR, safeName)
  if (!logoPath.startsWith(path.resolve(LOGO_DIR) + path.sep)) {
    return res.status(403).end()
  }
  if (fs.existsSync(logoPath)) {
    const ext = path.extname(logoPath).toLowerCase()
    const ct = ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png'
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400', 'Content-Type': ct })
    return res.send(fs.readFileSync(logoPath))
  }
  const fallback = generateLogoSvg(path.basename(name, path.extname(name)))
  res.set({ 'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' })
  res.send(fallback)
})

// ── Stream Proxy（保留给 HlsPlayer 使用）────────────────────────────────
const COMMON_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const REFERER_MAP = { 'm3u.81diangao.com': 'https://m3u.81diangao.com/', 'live-trac': 'https://live-trac.tv/', 'hls': 'https://www.hls.tv/', 'iqilu': 'https://www.iqilu.com/' }

function getSmartReferer(url) {
  try { const host = new URL(url).hostname.toLowerCase()
    for (const [key, referer] of Object.entries(REFERER_MAP)) if (host.includes(key)) return referer
  } catch {}
  return `https://${new URL(url).hostname}/`
}

function resolveUrl(base, relative) {
  if (!base || !relative) return relative
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative
  if (relative.startsWith('//')) { const u = new URL(relative, 'https://'); return `${u.protocol}//${u.host}${u.pathname}${u.search}${u.hash}` }
  if (relative.startsWith('/')) return new URL(relative, base).toString()
  try { return new URL(relative, base).toString() } catch { return relative }
}

function rewriteManifest(text, masterUrl) {
  const lines = text.split('\n'), result = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('#EXT-X-STREAM-INF') || trimmed.startsWith('#EXT-X-MEDIA:')) {
        const next = lines[i + 1]
        if (next && !next.trim().startsWith('#')) {
          const resolved = resolveUrl(masterUrl, next.trim())
          if (resolved.endsWith('.m3u8') || resolved.includes('m3u8')) {
            result.push(trimmed); result.push(`/api/proxy/stream?url=${encodeURIComponent(resolved)}`); i++; continue
          }
        }
      }
      result.push(trimmed); continue
    }
    result.push(`/api/proxy/stream?url=${encodeURIComponent(resolveUrl(masterUrl, trimmed))}`)
  }
  return result.join('\n')
}

// 视频分段 404 时，尝试相邻分段（偏移 ±1~±5），返回第一个可用的 buffer
async function trySegmentFallback(url, signal) {
  try {
    const u = new URL(url)
    const basename = u.pathname.split('/').pop()
    const dir = u.pathname.replace(/\/[^/]+$/, '/')
    const prefix = basename.replace(/\.[^.]+$/, '')
    const ext = basename.slice(prefix.length)
    const numMatch = prefix.match(/(\d+)$/)
    if (!numMatch) return null
    const baseNum = parseInt(numMatch[1], 10)
    const padLen = numMatch[1].length
    const offsets = [1,-1,2,-2,3,-3,4,-4,5,-5]
    for (const off of offsets) {
      if (signal?.aborted) break
      const newNum = baseNum + off
      if (newNum < 0) continue
      const padded = String(newNum).padStart(padLen, '0')
      const candidate = `${u.origin}${dir}${prefix.replace(/\d+$/, padded)}${ext}`
      const r = await fetch(candidate, { signal, headers: { 'User-Agent': COMMON_UA, 'Referer': `https://${u.hostname}/` } })
      if (r.ok) {
        console.log(`[proxy/stream] fallback ${url.slice(-60)} → ${candidate.slice(-50)}`)
        return Buffer.from(await r.arrayBuffer())
      }
    }
  } catch(e) { console.log('[fallback] error:', e.message) }
  return null
}

app.get(['/api/proxy/stream', '/proxy/stream'], async (req, res) => {
  let streamUrl = req.query.url
  if (!streamUrl) return res.status(400).json({ error: 'Missing url' })
  streamUrl = String(streamUrl).trim()
  try {
    const parsed = new URL(streamUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return res.status(400).json({ error: 'Only http/https' })
    const hostname = parsed.hostname.toLowerCase()
    if (await resolvesToPrivateHost(hostname)) return res.status(403).json({ error: 'Internal or unresolved host' })
  } catch { return res.status(400).json({ error: 'Invalid URL' }) }

  const referer = getSmartReferer(streamUrl)
  function setCors() {
    const origin = req.headers.origin
    res.set('Access-Control-Allow-Origin', origin || '*')
    res.set('Access-Control-Expose-Headers', 'Content-Length')
    res.set('Vary', 'Origin')
  }
  function enqueue(cb) {
    if (activeStreams < maxConcurrentStreams) { activeStreams++; cb(() => { activeStreams--; dequeue() }) }
    else { pendingStreamRequests.push(() => { activeStreams++; cb(() => { activeStreams--; dequeue() }) }) }
  }
  function dequeue() {
    while (pendingStreamRequests.length > 0 && activeStreams < maxConcurrentStreams) {
      const next = pendingStreamRequests.shift(); activeStreams++; next(() => { activeStreams--; dequeue() })
    }
  }

  try {
    await new Promise((resolve, reject) => {
      enqueue((done) => {
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), STREAM_TIMEOUT)
        fetch(streamUrl, { headers: { 'User-Agent': COMMON_UA, 'Referer': referer, 'Origin': referer }, signal: ctrl.signal, redirect: 'follow' })
          .then(async resp => {
            clearTimeout(tid)
            // 视频分段 404 不走早期返回，留给下方 fallback 逻辑处理
            if (!resp.ok && !streamUrl.endsWith('.ts')) {
              done(); return resolve(res.status(resp.status).json({ error: 'fetch failed', status: resp.status }))
            }
            const ct = resp.headers.get('content-type') || ''
            // 使用重定向后的最终 URL 作为 base，确保相对路径正确解析
            const finalUrl = resp.url || streamUrl
            if (ct.includes('mpegurl') || ct.includes('x-mpegurl') || streamUrl.endsWith('.m3u8')) {
              const text = await resp.text()
              let rewritten = rewriteManifest(text, finalUrl)
              const ae = req.headers['accept-encoding'] || ''
              const compress = rewritten.length > 1024 && (ae.includes('gzip') || ae.includes('deflate'))
              setCors()
              if (compress) {
                const gz = zlib.gzipSync(Buffer.from(rewritten, 'utf-8'))
                res.set('Content-Encoding', 'gzip'); res.set('Content-Type', 'application/vnd.apple.mpegurl')
                res.set('Content-Length', gz.length.toString()); done(); return resolve(res.send(gz))
              }
              res.set('Content-Type', 'application/vnd.apple.mpegurl'); done(); return resolve(res.send(rewritten))
            } else {
              // 视频分段 404 时自动尝试相邻分段，避免 HLS.js 反复重试坏 segment 导致黑屏闪烁
              if (!resp.ok && streamUrl.endsWith('.ts')) {
                let fb = await trySegmentFallback(streamUrl, ctrl.signal)
                if (fb) { setCors(); res.end(Buffer.from(fb)); done() }
                else { done(); return resolve(res.status(resp.status).json({ error: 'fetch failed', status: resp.status })) }
              } else {
                setCors(); const ab = await resp.arrayBuffer(); res.end(Buffer.from(ab)); done()
              }
            }
          }).catch(err => { clearTimeout(tid); done();
            // 客户端断开或 abort 不视为错误（HLS.js 切换分段时正常行为）
            if (err.name === 'AbortError' || err.message === 'terminated') {
              resolve()
            } else {
              reject(err)
            }
          })
      })
    })
  } catch (err) {
    // 忽略已处理的 AbortError
    if (err.message !== 'terminated' && err.name !== 'AbortError') {
      console.error('[proxy/stream] Error:', err.message)
    }
    if (!res.headersSent) {
      res.status(502).json({ error: 'Proxy stream error', url: streamUrl })
    }
  }
})

app.get('/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }) })

// ── 流状态检测 API ─────────────────────────────────────────────────────
const streamStatusCache = new Map()
const STREAM_STATUS_TTL = 5 * 60 * 1000 // 5 分钟缓存
const STREAM_PROBE_BYTES = 64 * 1024

function isPrivateAddress(address) {
  if (!address) return true
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number)
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 169 && parts[1] === 254 ||
      parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 ||
      parts[0] === 0 || parts[0] >= 224
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase()
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')
  }
  return true
}

async function resolvesToPrivateHost(hostname) {
  if (net.isIP(hostname)) return isPrivateAddress(hostname)
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    return addresses.some(({ address }) => isPrivateAddress(address))
  } catch {
    return true
  }
}

app.get('/api/stream/check', async (req, res) => {
  const rawUrl = req.query.url
  if (!rawUrl || Array.isArray(rawUrl)) return res.status(400).json({ error: 'Missing url' })
  const url = String(rawUrl).trim()

  const cacheKey = url
  const now = Date.now()

  // 检查缓存
  if (streamStatusCache.has(cacheKey)) {
    const cached = streamStatusCache.get(cacheKey)
    if (now - cached.time < STREAM_STATUS_TTL) {
      return res.json(cached.result)
    }
    streamStatusCache.delete(cacheKey)
  }

  try {
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || await resolvesToPrivateHost(parsedUrl.hostname)) {
      const result = { url, status: 'error', latency: null, downloadSpeedKbps: 0, contentType: '', redirects: 0, checkedAt: new Date().toISOString(), reason: 'private_or_invalid_host' }
      streamStatusCache.set(cacheKey, { status: 'error', time: now, result })
      return res.json(result)
    }

    const started = Date.now()
    const headers = { 'User-Agent': COMMON_UA, Range: `bytes=0-${STREAM_PROBE_BYTES - 1}` }
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 5000)

    // 并行执行 HEAD 和 GET，总超时 5s
    const [headResult, getResult] = await Promise.allSettled([
      fetch(url, { method: 'HEAD', signal: ctrl.signal, headers: { 'User-Agent': COMMON_UA } }),
      fetch(url, { signal: ctrl.signal, headers }),
    ])
    clearTimeout(timeout)

    let headResp, resp
    if (headResult.status === 'fulfilled') headResp = headResult.value
    if (getResult.status === 'fulfilled') resp = getResult.value

    if (!resp) {
      const result = { url, status: 'error', latency: null, downloadSpeedKbps: 0, contentType: '', redirects: 0, checkedAt: new Date().toISOString(), reason: 'timeout' }
      streamStatusCache.set(cacheKey, { status: 'error', time: now, result })
      return res.json(result)
    }

    const firstByteAt = Date.now()
    let bytes = 0
    let sample = Buffer.alloc(0)
    const reader = resp.body?.getReader()
    if (reader) {
      while (bytes < STREAM_PROBE_BYTES) {
        const chunk = await reader.read()
        if (chunk.done) break
        if (sample.length < 512) sample = Buffer.concat([sample, Buffer.from(chunk.value).subarray(0, 512 - sample.length)])
        bytes += chunk.value?.byteLength || 0
      }
      await reader.cancel().catch(() => {})
    }
    const elapsed = Math.max((Date.now() - started) / 1000, 0.001)
    const contentType = resp.headers.get('content-type') || headResp?.headers.get('content-type') || ''
    const looksHtml = /text\/html/i.test(contentType) || /^\s*<(?:!doctype|html)/i.test(sample.toString('utf8'))
    const result = {
      url,
      status: (resp.status === 200 || resp.status === 206) && bytes > 0 && !looksHtml ? 'ok' : 'error',
      latency: Number(((firstByteAt - started) / 1000).toFixed(3)),
      downloadSpeedKbps: Number((bytes / elapsed / 1024).toFixed(1)),
      contentType,
      redirects: resp.url && resp.url !== url ? 1 : 0,
      checkedAt: new Date().toISOString(),
      bytes,
    }
    streamStatusCache.set(cacheKey, { status: result.status, time: now, result })
    res.json(result)
  } catch (err) {
    const result = { url, status: 'error', latency: null, downloadSpeedKbps: 0, contentType: '', redirects: 0, checkedAt: new Date().toISOString() }
    streamStatusCache.set(cacheKey, { status: 'error', time: now, result })
    res.json(result)
  }
})

// ── 频道列表 API ─────────────────────────────────────────────────────────
const M3U_PATH = path.join(__dirname, '..', 'channels', 'lptv.m3u8')
// 统一清单的本地 fallback（不再依赖 default*.m3u）
const DEFAULT_M3U_CHAIN = [
  path.join(__dirname, '..', 'channels', 'lptv.m3u'),
]
// 将 GitHub blob URL 转换为 raw URL，便于直接下载
function toRawGithubUrl(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/)
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`
  return url
}

const M3U_REMOTE_URLS = [
  `https://github.com/${process.env.GITHUB_REPO || 'sikenali/LPTV'}/blob/main/channels/lptv.m3u8`,
  `https://raw.githubusercontent.com/${process.env.GITHUB_REPO || 'sikenali/LPTV'}/main/channels/lptv.m3u8`,
  `https://raw.githubusercontent.com/${process.env.GITHUB_REPO || 'sikenali/LPTV'}/main/channels/lptv.m3u`,
].map(toRawGithubUrl)
let m3uCache = null
let m3uCacheTime = 0
let m3uFetchFailed = false

async function fetchRemoteM3u(force = false) {
  if (m3uFetchFailed && !force) return
  for (const url of M3U_REMOTE_URLS) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!resp.ok) continue
      const body = await resp.text()
      const channels = parseM3u(body)
      if (channels.length === 0) continue
      m3uCache = channels
      m3uCacheTime = Date.now()
      m3uFetchFailed = false
      console.log(`[m3u] Remote updated: ${channels.length} channels (${url})`)
      return
    } catch (err) {
      console.warn(`[m3u] Remote fetch failed: ${url} - ${err.message}`)
    }
  }
  m3uFetchFailed = true
}

fetchRemoteM3u()
setInterval(fetchRemoteM3u, 30 * 60 * 1000)

function parseM3u(content) {
  const channels = []
  const lines = content.split('\n')
  let currentChannel = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#EXTINF:')) {
      const nameMatch = trimmed.match(/tvg-name="([^"]*)"/)
      const groupMatch = trimmed.match(/group-title="([^"]*)"/)
      const namePart = trimmed.split(',').pop() || ''
      const chName = nameMatch ? nameMatch[1].trim() : namePart.trim()
      const group = groupMatch ? groupMatch[1] : ''
      if (chName) {
        const existing = channels.find(c => c.name === chName)
        if (existing) {
          if (!existing.urls) existing.urls = []
          if (existing.url && !existing.urls.includes(existing.url)) {
            existing.urls.push(existing.url)
          }
          currentChannel = existing
        } else {
          currentChannel = {
            id: String(channels.length + 1),
            name: chName,
            logo: '',
            group: group,
            url: '',
            urls: undefined,
          }
          channels.push(currentChannel)
        }
      }
    } else if (trimmed.startsWith('http') && currentChannel) {
      if (!currentChannel.urls) {
        currentChannel.url = trimmed
      } else {
        currentChannel.urls.push(trimmed)
      }
      currentChannel = null
    }
  }
  // ── 单源频道自动补多条路由 ──────────────────────────────────────────────
  // 同一频道名若只有一条 URL，从其他来源找备选流补充到 urls 数组
  const nameMap = {}
  channels.forEach((ch, i) => {
    const key = ch.name
    if (!nameMap[key]) nameMap[key] = []
    nameMap[key].push(i)
  })
  channels.forEach(ch => {
    if (!ch.url || !ch.urls || ch.urls.length > 1) return
    const others = nameMap[ch.name] || []
    const candidates = []
    others.forEach(idx => {
      const other = channels[idx]
      if (other.url && other.url !== ch.url) candidates.push(other.url)
      if (other.urls) {
        other.urls.forEach(u => { if (u !== ch.url && !candidates.includes(u)) candidates.push(u) })
      }
    })
    // 去重保留原 url 为首条，补充最多 4 条备选
    const unique = candidates.filter(u => u !== ch.url && u.startsWith('http'))
    if (unique.length > 0) {
      ch.urls = [ch.url, ...unique.slice(0, 4)]
    }
  })
  return channels
}

app.get('/api/m3u', async (req, res) => {
  const shouldRefresh = req.query.refresh === '1'
  const now = Date.now()

  // 缓存命中：非刷新请求且缓存 5 分钟内有效
  if (!shouldRefresh && m3uCache && now - m3uCacheTime < 5 * 60 * 1000) {
    return res.json(m3uCache)
  }

  // 优先远程源（刷新或缓存过期时强制重试一次）
  if (shouldRefresh || !m3uCache || now - m3uCacheTime >= 5 * 60 * 1000) {
    await fetchRemoteM3u(shouldRefresh)
  }

  // 远程成功：用远程清单为主，补充仅存在于本地文件的频道
  if (m3uCache && m3uCache.length > 0) {
    try {
      const localContent = fs.readFileSync(M3U_PATH, 'utf-8')
      const localChannels = parseM3u(localContent)
      const remoteNames = new Set(m3uCache.map(c => c.name))
      const supplements = localChannels.filter(c => !remoteNames.has(c.name))
      if (supplements.length > 0) {
        m3uCache = [...m3uCache, ...supplements]
        console.log(`[m3u] Remote + ${supplements.length} local supplements (${supplements.map(c => c.name).join(', ')})`)
      }
    } catch {}
    m3uCacheTime = now
    return res.json(m3uCache)
  }

  // 远程失败：回退本地文件
  try {
    let fileContent = null
    let usedSource = 'lptv.m3u8'
    try {
      fileContent = fs.readFileSync(M3U_PATH, 'utf-8')
    } catch {
      for (const p of DEFAULT_M3U_CHAIN) {
        try {
          fileContent = fs.readFileSync(p, 'utf-8')
          usedSource = path.basename(p)
          break
        } catch {}
      }
    }
    if (!fileContent) throw new Error('All m3u sources unavailable')
    const channels = parseM3u(fileContent)
    m3uCache = channels
    m3uCacheTime = now
    console.log(`[m3u] using ${usedSource}: ${channels.length} channels`)
    res.json(channels)
  } catch (err) {
    console.error('[m3u] Local file read failed:', err.message)
    if (m3uCache) return res.json(m3uCache)
    res.status(500).json({ error: '读取频道列表失败', channels: [] })
  }
})

app.listen(PORT, () => {
  console.log(`LPTV proxy server running on port ${PORT}`)
  console.log(`[startup] CORS allowed: ${ALLOWED_ORIGINS.join(', ')}`)
})
