/**
 * LPTV CEF IPC Service
 * 
 * Manages the CEF binary subprocess, provides:
 * - Unix Domain Socket (optional, for external controllers)
 * - WebSocket server (ws://host:8765) for frame streaming + commands
 * - HTTP API for channel control and health checks
 * 
 * Protocol:
 *   WS send:  {"type":"play","channel_id":1,"source":0}
 *   WS send:  {"type":"switch"}           // next source
 *   WS send:  {"type":"stop"}
 *   WS send:  {"type":"quit"}
 *   
 *   WS recv:  {"type":"event","evt":"nav_started",...}
 *   WS recv:  {"type":"event","evt":"frame_paint","w":1280,"h":720,"seq":N}
 *   WS recv:  {"type":"event","evt":"nav_committed",...}
 *   WS recv:  {"type":"event","evt":"error",...}
 *   WS recv:  {"type":"frame","data":"<base64png>","w":1280,"h":720,"seq":N}
 *   WS recv:  {"type":"status","channel":"CCTV1","state":"playing"}
 */

const { spawn, ChildProcess } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const wsModule = require('ws');

// ── Config ───────────────────────────────────────────────────────────────────
const CEF_BIN = process.env.LPTV_CEF_BIN || path.join(__dirname, '..', 'lptv-cef-demo', 'build', 'lptv-cef-demo');
const WS_PORT = parseInt(process.env.LPTV_WS_PORT || '8765', 10);
const HTTP_PORT = parseInt(process.env.LPTV_HTTP_PORT || '8081', 10);
const UDS_PATH = process.env.LPTV_UDS || '/tmp/lptv.sock';
const FRAME_QUEUE_MAX = parseInt(process.env.LPTV_FRAME_QUEUE || '3', 10);

// ── State ────────────────────────────────────────────────────────────────────
let cefProcess = null;
let wsServer = null;
let httpServer = null;
let connectedClients = new Set();
let currentChannel = null;
let frameSeq = 0;
let frameQueue = []; // Ring buffer of recent frames
let eventLog = [];   // Recent events for debugging

// ── CEF Process Management ──────────────────────────────────────────────────

function startCef(channelId = 1, sourceIdx = 0) {
  stopCef();

  const args = ['--channel', String(channelId), '--source', String(sourceIdx), '--stdin'];
  cefProcess = spawn(process.execPath === '/usr/bin/node' ? CEF_BIN : CEF_BIN, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LD_LIBRARY_PATH: path.join(__dirname, '..', 'lptv-cef-demo', 'build') + ':' + (process.env.LD_LIBRARY_PATH || ''),
    },
    detached: false,
  });

  cefProcess.stdout.setEncoding('utf8');
  cefProcess.stderr.setEncoding('utf8');

  cefProcess.stdout.on('data', onCefStdout);
  cefProcess.stderr.on('data', onCefStderr);
  cefProcess.on('exit', onCefExit);
  cefProcess.on('error', onCefError);

  broadcast({ type: 'status', msg: 'cef_started', channel: channelId, source: sourceIdx });
  logEvent('cef_start', { channel: channelId, source: sourceIdx });
}

function stopCef() {
  if (cefProcess) {
    try {
      cefProcess.stdin.write(JSON.stringify({ cmd: 'stop' }) + '\n');
    } catch (_) {}
    setTimeout(() => {
      if (cefProcess && cefProcess.exitCode === null) {
        cefProcess.kill('SIGTERM');
      }
    }, 2000);
    cefProcess = null;
  }
}

function quitCef() {
  if (cefProcess) {
    try {
      cefProcess.stdin.write(JSON.stringify({ cmd: 'quit' }) + '\n');
    } catch (_) {}
    cefProcess = null;
  }
}

function switchLine() {
  if (!cefProcess || cefProcess.exitCode !== null) return;
  // Request next source via stdin
  try {
    cefProcess.stdin.write(JSON.stringify({ cmd: 'switch' }) + '\n');
  } catch (_) {}
}

function onCefStdout(data) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed);
      onCefEvent(evt);
    } catch (e) {
      // Not JSON, ignore
    }
  }
}

function onCefStderr(data) {
  // Log stderr for debugging but don't broadcast
  const msg = data.toString().trim();
  if (msg && !msg.includes('devtools')) {
    logEvent('cef_stderr', { msg: msg.substring(0, 200) });
  }
}

function onCefExit(code) {
  logEvent('cef_exit', { code });
  broadcast({ type: 'status', msg: 'cef_exited', code });
  cefProcess = null;
}

function onCefError(err) {
  logEvent('cef_error', { msg: err.message });
  broadcast({ type: 'status', msg: 'cef_error', error: err.message });
}

function onCefEvent(evt) {
  const type = evt.evt || '';
  
  switch (type) {
    case 'initialized':
      broadcast({ type: 'status', msg: 'cef_ready' });
      break;

    case 'nav_started':
      currentChannel = { id: evt.channel_id, name: evt.channel, source: evt.source };
      broadcast({ type: 'status', channel: evt.channel, state: 'loading' });
      logEvent('nav_started', evt);
      break;

    case 'nav_committed':
      broadcast({ type: 'status', channel: currentChannel?.name, state: 'playing' });
      logEvent('nav_committed', evt);
      break;

    case 'frame_paint':
      frameSeq++;
      const frameEvt = { type: 'frame', seq: frameSeq, w: evt.w, h: evt.h, size: evt.size };
      // Add to queue (ring buffer)
      frameQueue.push(frameEvt);
      if (frameQueue.length > FRAME_QUEUE_MAX) frameQueue.shift();
      // Broadcast to all clients
      broadcast(frameEvt);
      break;

    case 'frame_saved':
      logEvent('frame_saved', evt);
      break;

    case 'error':
      broadcast({ type: 'error', code: evt.reason, msg: evt.msg });
      logEvent('error', evt);
      // Auto-switch line on error
      if (evt.reason === 'no_source' || evt.reason === 'browser_failed') {
        setTimeout(() => switchLine(), 1000);
      }
      break;

    case 'loop_start':
    case 'loop_end':
    case 'shutdown':
      logEvent(type, evt);
      break;

    default:
      logEvent(type, evt);
  }
}

// ── WebSocket Server ─────────────────────────────────────────────────────────

function startWebSocket() {
  wsServer = new wsModule.Server({ port: WS_PORT, host: '127.0.0.1' });

  wsServer.on('connection', (ws) => {
    connectedClients.add(ws);
    logEvent('ws_connect', { clients: connectedClients.size });

    // Send recent frames to new client
    for (const f of frameQueue) {
      ws.send(JSON.stringify(f));
    }

    // Send current status
    ws.send(JSON.stringify({
      type: 'status',
      channel: currentChannel?.name,
      state: cefProcess?.exitCode === null ? 'playing' : 'stopped',
    }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        onWsMessage(ws, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', msg: 'invalid_json' }));
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      logEvent('ws_disconnect', { clients: connectedClients.size });
    });

    ws.on('error', (err) => {
      logEvent('ws_error', { msg: err.message });
      connectedClients.delete(ws);
    });
  });

  wsServer.on('error', (err) => {
    console.error('[ipc] WebSocket server error:', err.message);
  });

  console.log(`[ipc] WebSocket server on ws://127.0.0.1:${WS_PORT}`);
}

function onWsMessage(ws, msg) {
  const { type } = msg;

  switch (type) {
    case 'play': {
      const cid = parseInt(msg.channel_id, 10);
      const src = parseInt(msg.source || 0, 10);
      if (cid >= 1 && cid <= 49) {
        currentChannel = { id: cid, name: msg.name || `channel_${cid}`, source: src };
        startCef(cid, src);
      } else {
        ws.send(JSON.stringify({ type: 'error', msg: 'invalid_channel_id' }));
      }
      break;
    }
    case 'switch':
      switchLine();
      break;
    case 'stop':
      stopCef();
      break;
    case 'quit':
      quitCef();
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', msg: `unknown_command:${type}` }));
  }
}

function broadcast(packet) {
  const raw = JSON.stringify(packet);
  for (const ws of connectedClients) {
    if (ws.readyState === wsModule.OPEN) {
      try { ws.send(raw); } catch (_) {}
    }
  }
}

// ── HTTP Server ──────────────────────────────────────────────────────────────

function startHttp() {
  httpServer = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // GET /health
    if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: cefProcess?.exitCode === null ? 'ok' : 'stopped',
        channel: currentChannel,
        clients: connectedClients.size,
        frames: frameSeq,
        ts: new Date().toISOString(),
      }));
      return;
    }

    // GET /api/channels
    if (url.pathname === '/api/channels' && req.method === 'GET') {
      // Return channel list from channels.h data (embedded)
      const channels = [
        { id: 1, name: 'CCTV1 综合', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv1/' },
        { id: 2, name: 'CCTV2 财经', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv2/' },
        { id: 3, name: 'CCTV3 综艺', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv3/' },
        { id: 4, name: 'CCTV4 中文国际', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv4/' },
        { id: 5, name: 'CCTV5 体育', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv5/' },
        { id: 6, name: 'CCTV5+ 体育赛事', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv5plus/' },
        { id: 7, name: 'CCTV6 电影', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv6/' },
        { id: 8, name: 'CCTV7 国防军事', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv7/' },
        { id: 9, name: 'CCTV8 电视剧', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv8/' },
        { id: 10, name: 'CCTV9 纪录', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctvjilu/' },
        { id: 11, name: 'CCTV10 科教', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv10/' },
        { id: 12, name: 'CCTV11 戏曲', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv11/' },
        { id: 13, name: 'CCTV12 社会与法', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv12/' },
        { id: 14, name: 'CCTV13 新闻', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv13/' },
        { id: 15, name: 'CCTV14 少儿', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctvchild/' },
        { id: 16, name: 'CCTV15 音乐', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv15/' },
        { id: 17, name: 'CCTV16 奥林匹克', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv16/' },
        { id: 18, name: 'CCTV17 农业农村', category: '央视频道', source: 'cctv', url: 'https://tv.cctv.com/live/cctv17/' },
        { id: 19, name: '湖南卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002475' },
        { id: 20, name: '江苏卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002521' },
        { id: 21, name: '东方卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002483' },
        { id: 22, name: '浙江卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002520' },
        { id: 23, name: '北京卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002309' },
        { id: 24, name: '深圳卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002481' },
        { id: 25, name: '广东卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002485' },
        { id: 26, name: '安徽卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002532' },
        { id: 27, name: '东南卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002484' },
        { id: 28, name: '河北卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002493' },
        { id: 29, name: '黑龙江卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002498' },
        { id: 30, name: '湖北卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002508' },
        { id: 31, name: '江西卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002503' },
        { id: 32, name: '辽宁卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002505' },
        { id: 33, name: '海南卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002506' },
        { id: 34, name: '山东卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002513' },
        { id: 35, name: '四川卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002516' },
        { id: 36, name: '天津卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600152137' },
        { id: 37, name: '重庆卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002531' },
        { id: 38, name: '贵州卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002490' },
        { id: 39, name: '吉林卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190405' },
        { id: 40, name: '广西卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002509' },
        { id: 41, name: '河南卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002525' },
        { id: 42, name: '甘肃卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190408' },
        { id: 43, name: '青海卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190406' },
        { id: 44, name: '云南卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190402' },
        { id: 45, name: '内蒙古卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190401' },
        { id: 46, name: '山西卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190407' },
        { id: 47, name: '陕西卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190400' },
        { id: 48, name: '新疆卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600152138' },
        { id: 49, name: '西藏卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190403' },
        { id: 50, name: '宁夏卫视', category: '卫视频道', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190737' },
      ];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(channels));
      return;
    }

    // POST /api/play — play a channel
    if (url.pathname === '/api/play' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const msg = JSON.parse(body);
          const cid = parseInt(msg.channel_id, 10);
          const src = parseInt(msg.source || 0, 10);
          if (cid >= 1 && cid <= 50) {
            currentChannel = { id: cid, source: src };
            startCef(cid, src);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'invalid_channel_id' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
      return;
    }

    // POST /api/switch — switch to next source
    if (url.pathname === '/api/switch' && req.method === 'POST') {
      switchLine();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // POST /api/stop
    if (url.pathname === '/api/stop' && req.method === 'POST') {
      stopCef();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`[ipc] HTTP API on http://127.0.0.1:${HTTP_PORT}`);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function logEvent(evt, data) {
  const entry = { ts: new Date().toISOString(), evt, ...data };
  eventLog.push(entry);
  if (eventLog.length > 200) eventLog.shift();
  // Also write to stderr for debugging
  process.stderr.write(JSON.stringify(entry) + '\n');
}

// ── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown() {
  console.log('[ipc] shutting down...');
  quitCef();
  if (wsServer) wsServer.close();
  if (httpServer) httpServer.close();
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`[ipc] LPTV CEF IPC Service starting`);
  console.log(`[ipc] CEF binary: ${CEF_BIN}`);
  console.log(`[ipc] WS port: ${WS_PORT}, HTTP port: ${HTTP_PORT}`);

  // Check CEF binary exists
  if (!fs.existsSync(CEF_BIN)) {
    console.error(`[ipc] ERROR: CEF binary not found: ${CEF_BIN}`);
    console.error('[ipc] Build it first: cd lptv-cef-demo && mkdir -p build && cd build && cmake .. && cmake --build .');
    process.exit(1);
  }

  startHttp();
  startWebSocket();

  // Auto-start with channel 1 if no clients connect in 3s
  setTimeout(() => {
    if (connectedClients.size === 0 && (!cefProcess || cefProcess.exitCode !== null)) {
      console.log('[ipc] No clients connected, starting CCTV1...');
      startCef(1, 0);
    }
  }, 3000);
}

main();
