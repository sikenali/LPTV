const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

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

// ── CEF IPC 代理路由 ───────────────────────────────────────────────────────
// 将 /lptv-api/* 转发到 node-ipc HTTP API (127.0.0.1:8081)
// 将 /lptv-ws 升级为 WebSocket 到 node-ipc WS (127.0.0.1:8765)
const IPC_HTTP_PORT = parseInt(process.env.LPTV_HTTP_PORT || '8081', 10)
const IPC_WS_PORT = parseInt(process.env.LPTV_WS_PORT || '8765', 10)

// HTTP proxy for /lptv-api/*
app.all('/lptv-api/*', (req, res) => {
  const targetPath = req.path.replace(/^\/lptv-api/, '')
  const target = `http://127.0.0.1:${IPC_HTTP_PORT}${targetPath}`
  
  const options = {
    hostname: '127.0.0.1',
    port: IPC_HTTP_PORT,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${IPC_HTTP_PORT}` },
  }

  const proxyReq = require('http').request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })
  proxyReq.on('error', (e) => {
    console.error('[proxy] IPC HTTP error:', e.message)
    res.status(502).json({ error: 'ipc_unavailable' })
  })
  if (req.body) proxyReq.write(JSON.stringify(req.body))
  proxyReq.end()
})

// WebSocket proxy for /lptv-ws
const WebSocket = require('ws')
const wss = new WebSocket.Server({ noServer: true })

app.get('/lptv-ws', (req, res) => {
  // Upgrade handled by server.on('upgrade')
  res.writeHead(426)
  res.end('Upgrade required')
})

// ── 健康检查 ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    source: 'official-page-navigation',
    ipc: { http: IPC_HTTP_PORT, ws: IPC_WS_PORT },
  })
})

// ── 启动 node-ipc 子进程 ───────────────────────────────────────────────────
let ipcProcess = null

function startIpc() {
  const ipcScript = path.join(__dirname, 'node-ipc.cjs')
  if (!fs.existsSync(ipcScript)) {
    console.log('[server] node-ipc.cjs not found, CEF IPC disabled')
    return
  }

  ipcProcess = spawn(process.execPath, [ipcScript], {
    env: {
      ...process.env,
      LPTV_HTTP_PORT: String(IPC_HTTP_PORT),
      LPTV_WS_PORT: String(IPC_WS_PORT),
      LPTV_CEF_BIN: path.join(__dirname, '..', 'lptv-cef-demo', 'build', 'lptv-cef-demo'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  ipcProcess.stdout.on('data', (d) => process.stdout.write(d))
  ipcProcess.stderr.on('data', (d) => process.stderr.write(d))
  ipcProcess.on('exit', (code) => {
    console.log(`[server] node-ipc exited with code ${code}`)
    ipcProcess = null
  })
  ipcProcess.on('error', (err) => {
    console.error('[server] node-ipc failed to start:', err.message)
  })

  console.log(`[server] node-ipc started (HTTP:${IPC_HTTP_PORT}, WS:${IPC_WS_PORT})`)
}

// ── WebSocket upgrade ─────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`LPTV server running on port ${PORT}`)
  console.log(`  CEF IPC HTTP: http://127.0.0.1:${IPC_HTTP_PORT}`)
  console.log(`  CEF IPC WS:   ws://127.0.0.1:${IPC_WS_PORT}`)
  console.log(`  Frontend:     http://localhost:${PORT}`)
})

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/lptv-ws') { socket.destroy(); return }
  
  // Connect to node-ipc WebSocket
  const ws = new WebSocket(`ws://127.0.0.1:${IPC_WS_PORT}/`)
  
  ws.on('open', () => {
    console.log('[server] upstream WS connected')
    // Upgrade our client connection
    wss.handleUpgrade(req, socket, head, (client) => {
      wss.emit('connection', client, req)
    })
  })

  ws.on('message', (data) => {
    if (socket.readyState === 1) socket.send(data)
  })

  ws.on('close', () => {
    if (socket.readyState === 1) socket.close()
  })

  ws.on('error', (err) => {
    console.error('[server] upstream WS error:', err.message)
    socket.destroy()
  })

  socket.on('close', () => ws.close())
})

// ── 启动 IPC 服务 ──────────────────────────────────────────────────────────
startIpc()

// ── Graceful shutdown ──────────────────────────────────────────────────────
function shutdown() {
  console.log('[server] shutting down...')
  if (ipcProcess) ipcProcess.kill('SIGTERM')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
