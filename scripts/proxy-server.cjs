const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000
const LOGO_DIR = path.join(__dirname, '..', 'logos')

if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true })

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || ['http://localhost:5173', 'http://127.0.0.1:5173']

const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}
app.use(cors(corsOptions))
app.use(express.json())

// ── Logo 代理 ─────────────────────────────────────────────────────────────
function generateLogoSvg(name) {
  const colors = ['#3b82f6','#8b5cf6','#ef4444','#10b981','#f59e0b','#ec4899','#06b6d4','#84cc16']
  const color = colors[Math.abs(hashCode(name)) % colors.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="12" fill="${color}" opacity="0.8"/><text x="40" y="44" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="sans-serif">${name.charAt(0).toUpperCase()}</text></svg>`
}
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i); return h }

app.get('/api/proxy/logo/:name', (req, res) => {
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

// ── API: 获取所有频道列表 ────────────────────────────────────────────────
app.get('/api/channels', (req, res) => {
  try {
    const channelsFile = path.join(__dirname, '..', 'src', 'data', 'iptvChannels.ts')
    if (!fs.existsSync(channelsFile)) {
      return res.json([])
    }
    const content = fs.readFileSync(channelsFile, 'utf8')
    const channelRegex = /\{\s*id:\s*'([^']*)',\s*name:\s*'([^']+)',\s*category:\s*'([^']+)',\s*currentProgram:\s*'([^']*)',\s*tid:\s*'([^']*)',\s*source:\s*'([^']*)',\s*url:\s*'([^']*)'(?:,\s*backupUrl:\s*'([^']*)')?\s*\}/g
    const channels = []
    let m
    while ((m = channelRegex.exec(content)) !== null) {
      channels.push({
        id: m[1],
        name: m[2],
        category: m[3],
        currentProgram: m[4],
        tid: m[5],
        source: m[6],
        url: m[7],
        backupUrl: m[8] || undefined,
      })
    }
    res.json(channels)
  } catch (e) {
    res.json([])
  }
})

// ── API: 央视官网直播页可播性探测 ─────────────────────────────────────────
// 仅允许 tv.cctv.com, 防止任意 URL SSRF。判断依据: HTTP 200 + 页面含播放器标记。
app.get('/api/check', async (req, res) => {
  const url = req.query.url
  try {
    const u = new URL(String(url || ''))
    if (u.hostname !== 'tv.cctv.com') {
      return res.status(403).json({ ok: false, reason: 'host_not_allowed' })
    }
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://tv.cctv.com/',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) {
      return res.json({ ok: false, status: resp.status, reason: 'http_' + resp.status })
    }
    const html = await resp.text()
    const hasPlayer = /liveplayer|#player|<video|videoReady|player_/.test(html)
    res.json({ ok: hasPlayer, status: resp.status, host: u.host, hasPlayer })
  } catch (e) {
    res.json({ ok: false, reason: 'err', message: e.message })
  }
})

// ── API: 健康检查 ──────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    source: 'official-page-navigation',
  })
})

app.listen(PORT, () => {
  console.log(`LPTV server running on port ${PORT} (official-page-navigation proxy)`)
})
