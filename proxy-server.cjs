const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { M3uParser } = require('m3u-parser-generator')

const app = express()
const PORT = process.env.PORT || 3000
const M3U_URL = 'https://raw.githubusercontent.com/zilong7728/Collect-IPTV/refs/heads/main/best_sorted.m3u8'
const CACHE_TTL = 5 * 60 * 1000
const LOGO_DIR = path.join(__dirname, 'logos')

if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true })

let cache = { data: null, timestamp: 0 }

app.use(cors())
app.use(express.json())

function parseM3U(text) {
  const parser = new M3uParser()
  const playlist = parser.parse(text)
  return (playlist.medias || []).map(m => ({
    id: `${m.attributes?.['group-title'] || '未分类'}-${m.attributes?.['tvg-name'] || m.name}`,
    name: m.name,
    logo: m.attributes?.['tvg-logo'] || '',
    group: m.attributes?.['group-title'] || '未分类',
    url: m.location,
  }))
}

app.get('/api/m3u', async (req, res) => {
  const forceRefresh = req.query.refresh === '1'
  const now = Date.now()

  if (!forceRefresh && cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.json(cache.data)
  }

  try {
    const response = await fetch(M3U_URL)
    if (!response.ok) {
      return res.status(502).json({ error: 'M3U source unavailable', status: response.status })
    }
    const text = await response.text()
    const channels = parseM3U(text)
    cache = { data: channels, timestamp: now }
    res.json(channels)
  } catch (err) {
    if (cache.data) {
      return res.json(cache.data)
    }
    res.status(502).json({ error: 'Failed to fetch M3U source' })
  }
})

function resolveUrl(base, relative) {
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative
  if (relative.startsWith('/')) {
    const u = new URL(base)
    return `${u.protocol}//${u.host}${relative}`
  }
  const lastSlash = base.lastIndexOf('/')
  const dir = lastSlash >= 0 ? base.substring(0, lastSlash + 1) : base + '/'
  return dir + relative
}

app.get('/api/proxy/stream', async (req, res) => {
  const streamUrl = req.query.url
  if (!streamUrl) return res.status(400).json({ error: 'Missing url parameter' })

  try {
    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://iptv345.com/',
      },
    })
    if (!response.ok) return res.status(response.status).json({ error: 'Stream fetch failed' })

    const contentType = response.headers.get('content-type') || ''
    res.set('Access-Control-Allow-Origin', '*')

    if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl') || streamUrl.endsWith('.m3u8')) {
      const text = await response.text()
      const lines = text.split('\n')
      const rewritten = lines.map(line => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return line
        const resolved = resolveUrl(streamUrl, trimmed)
        return `/api/proxy/stream?url=${encodeURIComponent(resolved)}`
      }).join('\n')
      res.set('Content-Type', 'application/vnd.apple.mpegurl')
      res.send(rewritten)
    } else {
      // Use pipe for non-M3U8 content (TS slices, etc.) to avoid memory pressure
      response.body.pipe(res)
      response.body.on('error', () => res.destroy())
      res.on('close', () => response.body.destroy())
      return
    }
  } catch (err) {
    res.status(502).json({ error: 'Proxy stream error' })
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

app.get('/api/proxy/image', async (req, res) => {
  const imgUrl = req.query.url
  const name = req.query.name || ''
  if (!imgUrl) return res.status(400).json({ error: 'Missing url parameter' })

  const hash = crypto.createHash('md5').update(imgUrl).digest('hex')
  const ext = path.extname(new URL(imgUrl).pathname) || '.png'
  const localPath = path.join(LOGO_DIR, hash + ext)

  if (fs.existsSync(localPath)) {
    const contentType = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400', 'Content-Type': contentType })
    return res.send(fs.readFileSync(localPath))
  }

  try {
    const response = await fetch(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('Fetch failed')

    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(localPath, buffer)
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Content-Type': response.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=86400',
    })
    res.send(buffer)
  } catch (err) {
    const svg = generateLogoSvg(name)
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    })
    res.send(svg)
  }
})

app.get('/api/probe', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'Missing url parameter' })

  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://iptv345.com/' },
    })
    res.json({ status: resp.ok ? 'ok' : 'error', code: resp.status })
  } catch (err) {
    res.json({ status: 'error', code: 0 })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`LPTV proxy server running on port ${PORT}`)
})
