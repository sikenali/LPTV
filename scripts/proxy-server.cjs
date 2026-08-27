const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const zlib = require('zlib')

const app = express()
const PORT = process.env.PORT || 3000
const LOGO_DIR = path.join(__dirname, '..', 'logos')
  const STREAM_TIMEOUT = 60000
const maxConcurrentStreams = 10
let activeStreams = 0
const pendingStreamRequests = []

const PRIV_HOSTS = ['localhost','127.','10.','172.16.','172.17.','172.18.','172.19.','172.20.','172.21.','172.22.','172.23.','172.24.','172.25.','172.26.','172.27.','172.28.','172.29.','172.30.','172.31.','192.168.','169.254.']

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

app.get(['/api/proxy/stream', '/proxy/stream'], async (req, res) => {
  let streamUrl = req.query.url
  if (!streamUrl) return res.status(400).json({ error: 'Missing url' })
  streamUrl = String(streamUrl).trim()
  try {
    const parsed = new URL(streamUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return res.status(400).json({ error: 'Only http/https' })
    const hostname = parsed.hostname.toLowerCase()
    if (PRIV_HOSTS.some(p => hostname.startsWith(p) || hostname === 'localhost')) return res.status(403).json({ error: 'Internal IP' })
  } catch { return res.status(400).json({ error: 'Invalid URL' }) }

  const referer = getSmartReferer(streamUrl)
  function setCors() {
    const origin = req.headers.origin
    res.set('Access-Control-Allow-Origin', origin || '*')
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
        fetch(streamUrl, { headers: { 'User-Agent': COMMON_UA, 'Referer': referer, 'Origin': referer }, signal: ctrl.signal })
          .then(async resp => {
            clearTimeout(tid); if (!resp.ok) { done(); return resolve(res.status(resp.status).json({ error: 'fetch failed', status: resp.status })) }
            const ct = resp.headers.get('content-type') || ''
            if (ct.includes('mpegurl') || ct.includes('x-mpegurl') || streamUrl.endsWith('.m3u8')) {
              const text = await resp.text()
              let rewritten = rewriteManifest(text, streamUrl)
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
              setCors(); const ab = await resp.arrayBuffer(); res.end(Buffer.from(ab)); done()
            }
          }).catch(err => { clearTimeout(tid); done(); reject(err) })
      })
    })
  } catch (err) {
    console.error('[proxy/stream] Error:', err.message)
    res.status(502).json({ error: 'Proxy stream error', url: streamUrl })
  }
})

app.get('/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }) })

// ── 流状态检测 API ─────────────────────────────────────────────────────
const streamStatusCache = new Map()
const STREAM_STATUS_TTL = 5 * 60 * 1000 // 5 分钟缓存

app.get('/api/stream/check', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'Missing url' })

  const cacheKey = url
  const now = Date.now()

  // 检查缓存
  if (streamStatusCache.has(cacheKey)) {
    const cached = streamStatusCache.get(cacheKey)
    if (now - cached.time < STREAM_STATUS_TTL) {
      return res.json({ url, status: cached.status })
    }
    streamStatusCache.delete(cacheKey)
  }

  try {
    const parsedUrl = new URL(url)
    // 阻止内网地址
    if (PRIV_HOSTS.some(p => parsedUrl.hostname.startsWith(p) || parsedUrl.hostname === 'localhost')) {
      return res.json({ url, status: 'error' })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const resp = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    clearTimeout(timeout)

    const status = resp.ok ? 'ok' : 'error'
    streamStatusCache.set(cacheKey, { status, time: now })
    res.json({ url, status })
  } catch (err) {
    streamStatusCache.set(cacheKey, { status: 'error', time: now })
    res.json({ url, status: 'error' })
  }
})

// ── 频道列表 API ─────────────────────────────────────────────────────────
const M3U_PATH = path.join(__dirname, '..', 'channels', 'lptv.m3u8')
const M3U_REMOTE_URLS = [
  `https://raw.githubusercontent.com/${process.env.GITHUB_REPO || 'sikenali/LPTV'}/main/channels/lptv.m3u8`,
  `https://raw.githubusercontent.com/${process.env.GITHUB_REPO || 'sikenali/LPTV'}/main/channels/lptv.m3u`,
]
let m3uCache = null
let m3uCacheTime = 0
let m3uFetchFailed = false

async function fetchRemoteM3u() {
  if (m3uFetchFailed) return
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
      const match = trimmed.match(/tvg-name="([^"]*)".*?tvg-logo="([^"]*)".*?group-title="([^"]*)"(?:,)(.*)/)
      if (match) {
        const chName = match[4] || match[1]
        // 查找已有同名频道，复用并追加 URL
        const existing = channels.find(c => c.name === chName)
        if (existing) {
          if (!existing.urls) existing.urls = []
          if (existing.url && !existing.urls.includes(existing.url)) {
            existing.urls.push(existing.url)
          }
          // 新 block：如果当前行是 URL，追加；否则只追加到 urls（兼容旧格式）
          currentChannel = existing
        } else {
          currentChannel = {
            id: String(channels.length + 1),
            name: chName,
            logo: match[2],
            group: match[3],
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
  return channels
}

app.get('/api/m3u', (req, res) => {
  const shouldRefresh = req.query.refresh === '1'
  const now = Date.now()
  if (!shouldRefresh && m3uCache && now - m3uCacheTime < 5 * 60 * 1000) {
    return res.json(m3uCache)
  }
  try {
    const fileContent = fs.readFileSync(M3U_PATH, 'utf-8')
    const channels = parseM3u(fileContent)
    m3uCache = channels
    m3uCacheTime = now
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

