const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const zlib = require('zlib')

const app = express()
const PORT = process.env.PORT || 3000
const LOGO_DIR = path.join(__dirname, '..', 'logos')
const STREAM_TIMEOUT = 30000
const maxConcurrentStreams = 10
let activeStreams = 0
const pendingStreamRequests = []

if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true })

let iptvCache = new Map()
let channelTokenCache = null
let channelTokenCacheTime = 0

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || ['http://localhost:5173', 'http://127.0.0.1:5173']
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (process.env.NODE_ENV !== 'production') return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(null, true)
  },
  credentials: true,
}
app.use(cors(corsOptions))
app.use(express.json())

// ── iptv345.com iframe 播放页代理 ───────────────────────────────────────
const IPTV345_TOKEN = '79e9e4ac43fa67c36a3236b7ae8a2027'

app.get('/api/proxy/iptv/:tid/:id', async (req, res) => {
  const { tid, id } = req.params
  const cacheKey = `iptv_iframe_${tid}_${id}`
  const now = Date.now()

  if (iptvCache.has(cacheKey)) {
    const cached = iptvCache.get(cacheKey)
    if (now - cached.time < 2 * 60 * 1000) {
      return res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
      }).send(cached.data)
    }
    iptvCache.delete(cacheKey)
  }

  const targetUrl = `https://iptv345.com/?act=play&token=${IPTV345_TOKEN}&tid=${tid}&id=${id}`

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return res.status(response.status).send(`Failed: HTTP ${response.status}`)
    }

    // 正确处理响应体（服务器错误标记 Brotli 但实际未压缩）
    const buf = Buffer.from(await response.arrayBuffer())
    let html
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      html = zlib.gunzipSync(buf).toString('utf8')
    } else if (buf[0] === 0x28 && buf[1] === 0xCA) {
      html = zlib.brotliDecompressSync(buf).toString('utf8')
    } else {
      html = buf.toString('utf8')
    }

    // ── 清理广告和无关内容 ──
    html = html.replace(/<script[^>]*src=["'][^"']*alwaysmulticulturallanding[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<script[^>]*src=["']popunder[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<script[^>]*src=["']popup[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<script[^>]*src=["']https:\/\/www\.googletagmanager[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<div id="ad-container"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<script[^>]*data-cfasync[^>]*>[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<script[^>]*>[\s\S]*?cfasync[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<script[^>]*>[\s\S]*?popunder[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<script[^>]*>[\s\S]*?popup[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<div class="headerNfooter"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<li data-role="list-divider">[\s\S]*?<\/li>/gi, '')
    html = html.replace(/<div class="ui-grid-a"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<div data-role="navbar"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<div align="center">[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<center>[\s\S]*?<\/center>/gi, '')
    html = html.replace(/<div id="errorTip"[^>]*>[\s\S]*?<\/div>/gi, '')

    // ── 注入播放器通信脚本 ──
    const injectScript = `<script>
(function() {
  function notifyPlay() {
    var v = document.getElementById('vstPlayer');
    if (v && (v.src || v.currentSrc)) {
      try { window.parent.postMessage({ type: 'iptv:playing' }, '*'); } catch(e) {}
    }
  }
  var t = setInterval(notifyPlay, 2000);
  setTimeout(notifyPlay, 3000);
  setTimeout(notifyPlay, 8000);
  setTimeout(notifyPlay, 20000);
  document.addEventListener('DOMContentLoaded', notifyPlay);
})();
</script>`
    html = html.replace('</head>', injectScript + '</head>')

    // ── 全屏播放器样式 ──
    const customStyle = `<style>
  html, body { margin: 0; padding: 0; background: #000; overflow: hidden; height: 100%; }
  [data-role="page"] { min-height: 100vh; margin: 0; }
  #vstPlayer { width: 100%!important; height: 100vh!important; aspect-ratio: unset!important; }
  video#vstPlayer { width: 100%!important; height: 100%!important; object-fit: contain; }
  .headerNfooter, [data-role="navbar"], .ui-grid-a, #ad-container, #errorTip,
  [data-role="list-divider"] { display: none !important; }
</style>`
    html = html.replace('<head>', '<head>' + customStyle)

    iptvCache.set(cacheKey, { data: html, time: now })
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Cache-Control': 'no-cache',
    })
    res.send(html)
  } catch (err) {
    console.error('[proxy/iptv] Error:', err.message)
    res.status(502).send('IPTV proxy error: ' + err.message)
  }
})

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
    const priv = ['localhost','127.','10.','172.16.','172.17.','172.18.','172.19.','172.20.','172.21.','172.22.','172.23.','172.24.','172.25.','172.26.','172.27.','172.28.','172.29.','172.30.','172.31.','192.168.','169.254.']
    if (priv.some(p => hostname.startsWith(p) || hostname === 'localhost')) return res.status(403).json({ error: 'Internal IP' })
  } catch { return res.status(400).json({ error: 'Invalid URL' }) }

  const referer = getSmartReferer(streamUrl)
  function setCors() {
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*')
    res.set('Access-Control-Allow-Credentials', 'true')
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

// ── Get channel URLs (映射前端 tid/id 到 iptv345.com 播放地址) ──────────
app.get('/api/iptv/urls/:tid/:id', async (req, res) => {
  const { tid, id } = req.params
  try {
    const now = Date.now()
    if (!channelTokenCache || now - channelTokenCacheTime > 10 * 60 * 1000) {
      const resp = await fetch('https://api.2026016.xyz/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      })
      const html = await resp.text()
      const channels = {}
      const re = /href="\?act=play&token=([a-f0-9]+)&id=(\d+)"/g
      let m
      while ((m = re.exec(html)) !== null) {
        channels[m[2]] = m[1]
      }
      channelTokenCache = channels
      channelTokenCacheTime = now
    }

    let apiId = id
    if (tid === 'ws') {
      const wsOffset = parseInt(id) + 26
      apiId = wsOffset.toString()
    }

    const token = channelTokenCache[apiId]
    if (!token) {
      return res.status(404).json({ error: '频道未找到', urls: [] })
    }

    const playUrl = `https://iptv345.com/?act=play&token=${token}&id=${apiId}`
    res.json({ urls: [playUrl] })
  } catch (err) {
    console.error('[iptv/urls] Error:', err.message)
    res.status(502).json({ error: '获取频道地址失败', urls: [] })
  }
})

app.get('/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }) })

app.listen(PORT, () => {
  console.log(`LPTV proxy server running on port ${PORT}`)
  console.log(`[startup] CORS allowed: ${ALLOWED_ORIGINS.join(', ')}`)
})
