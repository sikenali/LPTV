const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

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
  const channels = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXTINF:')) continue
    const meta = lines[i]
    const urlLine = lines[i + 1]?.trim()
    if (!urlLine || urlLine.startsWith('#')) continue
    const tvgName = meta.match(/tvg-name="(.*?)"/)?.[1] || ''
    const tvgLogo = meta.match(/tvg-logo="(.*?)"/)?.[1] || ''
    const groupTitle = meta.match(/group-title="(.*?)"/)?.[1] || '未分类'
    const displayName = meta.split(',').pop()?.trim() || tvgName
    channels.push({
      id: `${groupTitle}-${tvgName}`,
      name: displayName,
      logo: tvgLogo,
      group: groupTitle,
      url: urlLine,
    })
  }
  return channels
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
      const buffer = await response.arrayBuffer()
      res.set('Content-Type', contentType || 'video/MP2T')
      res.send(Buffer.from(buffer))
    }
  } catch (err) {
    res.status(502).json({ error: 'Proxy stream error' })
  }
})

app.get('/api/proxy/image', async (req, res) => {
  const imgUrl = req.query.url
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
    res.status(502).json({ error: 'Image proxy error' })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`LPTV proxy server running on port ${PORT}`)
})
