const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const zlib = require('zlib')
const { M3uParser } = require('m3u-parser-generator')

const app = express()
const PORT = process.env.PORT || 3000
const LOCAL_M3U_PATH = path.join(__dirname, '..', 'local.m3u8')
const M3U_URL = 'https://raw.githubusercontent.com/zilong7728/Collect-IPTV/refs/heads/main/best_sorted.m3u8'
const CACHE_TTL = 4 * 60 * 60 * 1000
const LOGO_DIR = path.join(__dirname, '..', 'logos')
const STREAM_TIMEOUT = 30000
const maxConcurrentStreams = 10
let activeStreams = 0
const pendingStreamRequests = []

if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true })

let cache = { data: null, timestamp: 0 }

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || ['http://localhost:5173']
const corsOptions = {
  origin: (origin, callback) => {
    if (ALLOWED_ORIGINS.includes(origin) || origin === '') {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}
app.use(cors(corsOptions))
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

function deduplicateChannels(channels) {
  const nameMap = new Map()

  for (const channel of channels) {
    const key = channel.name.toLowerCase()
    if (!nameMap.has(key)) {
      nameMap.set(key, channel)
      continue
    }

    const existing = nameMap.get(key)
    const existingPriority = GROUP_PRIORITY.indexOf(existing.group)
    const newPriority = GROUP_PRIORITY.indexOf(channel.group)

    if (newPriority > existingPriority) {
      nameMap.set(key, channel)
    }
  }

  return Array.from(nameMap.values())
}

app.get('/api/m3u', async (req, res) => {
  const forceRefresh = req.query.refresh === '1'
  const shouldValidate = req.query.validate === 'true'
  const now = Date.now()

  if (!forceRefresh && !shouldValidate && cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.json(cache.data)
  }

  try {
    let text
    const useLocal = process.env.USE_LOCAL_M3U === 'true'
    if (useLocal && fs.existsSync(LOCAL_M3U_PATH)) {
      text = fs.readFileSync(LOCAL_M3U_PATH, 'utf-8')
      console.log('[m3u] loaded from local file (USE_LOCAL_M3U=true):', LOCAL_M3U_PATH)
    } else {
      const response = await fetch(M3U_URL)
      if (!response.ok) {
        if (cache.data) {
          return res.json(cache.data)
        }
        return res.status(502).json({ error: 'M3U source unavailable', status: response.status })
      }
      text = await response.text()
      if (!useLocal) {
        console.log('[m3u] loaded from remote:', M3U_URL)
      } else {
        console.log('[m3u] USE_LOCAL_M3U=true but local file missing, loaded from remote:', M3U_URL)
      }
    }
    let channels = parseM3U(text)

    if (shouldValidate) {
      console.log(`[m3u] validating ${channels.length} channels...`)
      const before = channels.length

      channels = await filterValidChannels(channels)
      console.log(`[m3u] validation complete: ${before} -> ${channels.length} valid channels`)

      channels = deduplicateChannels(channels)
      console.log(`[m3u] deduplication complete: ${before} -> ${channels.length} channels after dedup`)
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
const GROUP_PRIORITY = ['央视频道', '卫视频道']
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
  } catch {}
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

app.get('/api/proxy/stream', async (req, res) => {
  let streamUrl = req.query.url
  if (!streamUrl) return res.status(400).json({ error: 'Missing url parameter' })

  streamUrl = String(streamUrl).trim()

  try {
    new URL(streamUrl)
  } catch {
    return res.status(400).json({ error: 'Invalid stream URL' })
  }

  const referer = getSmartReferer(streamUrl)
  const qualityParam = req.query.quality

  function setStreamCORS() {
    res.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0] || '*')
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

          if (isMasterPlaylist) {
            const lines = text.split('\n')
            const variants = []
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i]
              if (line.trim().startsWith('#EXT-X-STREAM-INF')) {
                const urlLine = lines[i + 1]
                if (urlLine && !urlLine.trim().startsWith('#')) {
                  const resolvedUrl = resolveUrl(streamUrl, urlLine.trim())
                  const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/)
                  const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/)
                  variants.push({
                    url: resolvedUrl,
                    bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0,
                    resolution: resolutionMatch ? Math.min(parseInt(resolutionMatch[1]), parseInt(resolutionMatch[2])) : 0,
                    line: urlLine.trim(),
                  })
                }
              }
            }

            let chosenVariant = null
            if (qualityParam) {
              const qMap = { 'high': Infinity, 'low': 0, '4k': 2160, '1080p': 1080, '720p': 720, '480p': 480 }
              const targetRes = typeof qMap[qualityParam.toLowerCase()] !== 'undefined' ? qMap[qualityParam.toLowerCase()] : 0
              if (targetRes > 0) {
                const matched = variants.filter(v => v.resolution === targetRes)
                if (matched.length > 0) chosenVariant = matched.sort((a, b) => b.bandwidth - a.bandwidth)[0]
              } else {
                const matchedBW = variants.filter(v => v.bandwidth.toString() === qualityParam)
                if (matchedBW.length > 0) chosenVariant = matchedBW.sort((a, b) => b.bandwidth - a.bandwidth)[0]
              }
            }
            if (!chosenVariant) {
              chosenVariant = variants.sort((a, b) => b.bandwidth - a.bandwidth)[0]
            }

            if (chosenVariant) {
              finish()
              return resolve(res.redirect(`/api/proxy/stream?url=${encodeURIComponent(chosenVariant.url)}${qualityParam ? '&quality=' + qualityParam : ''}`))
            }
          }

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
          response.body.pipe(res)
          response.body.on('error', () => res.destroy())
          res.on('close', () => { response.body.destroy(); finish() })
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
      headers: { 'User-Agent': COMMON_UA },
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
  const useLocal = process.env.USE_LOCAL_M3U === 'true'
  console.log(`LPTV proxy server running on port ${PORT}`)
  console.log(`[startup] M3U source: ${useLocal && fs.existsSync(LOCAL_M3U_PATH) ? 'local (USE_LOCAL_M3U=true)' : 'remote (always)'}`)
  console.log(`[startup] CORS allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
})
