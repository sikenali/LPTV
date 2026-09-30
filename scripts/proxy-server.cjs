/**
 * LPTV Web — Node.js 薄同源代理 (LPK 后端)
 *
 * 替代原 Python aiohttp 版本，提供相同的 API 端点：
 *   GET  /_page        抓官方页 + 注入 layer.js/patch.js/ui.css
 *   GET  /proxy-video  代理视频分片 (添加 CORS 头)
 *   GET  /capi/*       透传央视频 capi
 *   GET  /api/state    获取状态
 *   POST /api/state    保存状态
 *   POST /api/record/open|append|close
 *   POST /api/shot     保存截图
 *   GET  /api/channels 频道列表
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// ── 路径配置 ───────────────────────────────────────────────────────

const ROOT_DIR = (process.env.LZC_APP === "1" || process.env.LPK_MODE) ? path.resolve(__dirname) : path.resolve(__dirname, "..");
const STATIC_DIR = path.join(ROOT_DIR, 'static');
const RECORD_DIR = path.join(ROOT_DIR, 'records');
const SHOT_DIR = path.join(ROOT_DIR, 'shots');

// LPK 部署路径
const LPK_ROOT = '/lzcapp/pkg/content';
const LPK_STATIC = path.join(LPK_ROOT, 'frontend');
const LPK_RECORDS = path.join(LPK_ROOT, 'records');
const LPK_SHOTS = path.join(LPK_ROOT, 'shots');

// 根据部署环境选择路径
const isLpk = process.env.LZC_APP === '1';
const BASE_DIR = isLpk ? LPK_ROOT : ROOT_DIR;
const STATIC_PATH = isLpk ? LPK_STATIC : STATIC_DIR;
const RECORD_PATH = isLpk ? LPK_RECORDS : RECORD_DIR;
const SHOT_PATH = isLpk ? LPK_SHOTS : SHOT_DIR;

// 确保目录存在 (使用 /tmp 作为 fallback，避免 LPK 容器内权限问题)
const DATA_DIR = process.env.LZC_APP === '1' ? '/tmp/lptv-data' : RECORD_PATH;
[DATA_DIR, path.join(DATA_DIR, 'records'), path.join(DATA_DIR, 'shots')].forEach(d => {
  try { fs.mkdirSync(d, { recursive: true }); } catch {}
});
const RECORD_PATH_LOCAL = path.join(DATA_DIR, 'records');
const SHOT_PATH_LOCAL = path.join(DATA_DIR, 'shots');

// ── 内存状态 ───────────────────────────────────────────────────────

let _state = {
  favs: [],
  lastPid: '',
  resumeLast: true,
  res: [],
};

const _recorders = {}; // rid -> {channel, fh, start, fname}

// ── HTTP 请求头 ─────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.yangshipin.cn/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
};

// ── 工具函数 ───────────────────────────────────────────────────────

function jsonResponse(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
  });
  res.end(body);
}

function textResponse(res, text, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(text);
}

function proxyFetch(targetUrl, headers = HEADERS) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const lib = url.protocol === 'https:' ? https : https;
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers,
    };
    try {
      const req = lib.request(options, (res_) => {
        let data = [];
        res_.on('data', chunk => data.push(chunk));
        res_.on('end', () => resolve({ status: res_.statusCode, headers: res_.headers, body: Buffer.concat(data) }));
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    } catch (e) { reject(e); }
  });
}

// ── 页面抓取 + 注入 ─────────────────────────────────────────────────

async function fetchOfficialPage(pid = '') {
  let url = 'https://www.yangshipin.cn/tv/home';
  if (pid) url += (url.includes('?') ? '&' : '?') + 'pid=' + pid;
  const r = await proxyFetch(url);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return r.body.toString('utf-8');
}

function injectScripts(html, cssUrl, jsUrl) {
  const cssTag = `\n<link rel="stylesheet" href="${cssUrl}">\n`;
  const jsTag = `\n<script src="${jsUrl}"></script>\n<script src="${jsUrl.replace('layer.js', 'patch.js')}"></script>\n`;
  const headClose = '</head>';
  const bodyClose = '</body>';
  if (html.includes(headClose)) html = html.replace(headClose, cssTag + headClose, 1);
  else html = cssTag + html;
  if (html.includes(bodyClose)) html = html.replace(bodyClose, jsTag + bodyClose, 1);
  else html += jsTag;
  return html;
}

// ── 视频分片代理 ───────────────────────────────────────────────────

async function handleProxyVideo(reqUrl) {
  const r = await proxyFetch(reqUrl);
  return {
    status: r.status,
    headers: {
      'Content-Type': r.headers['content-type'] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=30',
      ...CORS_HEADERS,
    },
    body: r.body,
  };
}

// ── CAPI 透传 ──────────────────────────────────────────────────────

async function handleProxyCapi(path_) {
  const target = 'https://capi.yangshipin.cn' + path_;
  const r = await proxyFetch(target);
  const ct = r.headers['content-type'] || 'application/octet-stream';
  let body = r.body;
  if (ct.includes('json')) {
    try {
      body = Buffer.from(JSON.stringify(JSON.parse(body.toString('utf-8'))));
    } catch {}
  }
  return { status: r.status, headers: CORS_HEADERS, body };
}

// ── API: 状态 ──────────────────────────────────────────────────────

function handleGetState(res) {
  return jsonResponse(res, { ok: true, ..._state });
}

function handleSetState(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      for (const key of ['favs', 'lastPid', 'resumeLast', 'res']) {
        if (key in data) _state[key] = data[key];
      }
      jsonResponse(res, { ok: true });
    } catch (e) {
      jsonResponse(res, { ok: false, error: e.message }, 400);
    }
  });
}

// ── API: 录制 ──────────────────────────────────────────────────────

function handleRecOpen(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const channel = data.channel || '直播';
      const rid = String(Date.now());
      const fpath = path.join(RECORD_PATH_LOCAL, `${rid}.webm`);
      const fh = fs.createWriteStream(fpath);
      _recorders[rid] = { channel, fh, start: Date.now(), fname: `${rid}.webm` };
      console.log(`[rec] open: ${rid} → ${fpath}`);
      jsonResponse(res, { ok: true, id: rid });
    } catch (e) {
      jsonResponse(res, { ok: false, error: e.message }, 500);
    }
  });
}

function handleRecAppend(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const rec = _recorders[data.id];
      if (!rec) return jsonResponse(res, { ok: false, error: 'rid not found' }, 404);
      const buf = Buffer.from(data.data, 'base64');
      rec.fh.write(buf);
      jsonResponse(res, { ok: true, size: buf.length });
    } catch (e) {
      jsonResponse(res, { ok: false, error: e.message }, 500);
    }
  });
}

function handleRecClose(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const rec = _recorders[data.id];
      if (!rec) return jsonResponse(res, { ok: false, error: 'rid not found' }, 404);
      rec.fh.end();
      delete _recorders[data.id];
      jsonResponse(res, { ok: true, path: rec.fname });
    } catch (e) {
      jsonResponse(res, { ok: false, error: e.message }, 500);
    }
  });
}

// ── API: 截图 ──────────────────────────────────────────────────────

function handleShotSave(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const channel = data.channel || '直播';
      const buf = Buffer.from(data.data, 'base64');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeName = channel.replace(/[^\w\-]/g, '_').slice(0, 20);
      const fname = `${safeName}-${ts}.png`;
      fs.writeFileSync(path.join(SHOT_PATH_LOCAL, fname), buf);
      console.log(`[shot] ${fname} (${buf.length} bytes)`);
      jsonResponse(res, { ok: true, name: fname });
    } catch (e) {
      jsonResponse(res, { ok: false, error: e.message }, 500);
    }
  });
}

// ── API: 频道列表 ──────────────────────────────────────────────────

async function handleGetChannels() {
  try {
    const urls = [
      'https://capi.yangshipin.cn/api/pc/live/channelList',
      'https://capi.yangshipin.cn/api/pc/live/v2/channelList',
    ];
    for (const url of urls) {
      try {
        const r = await proxyFetch(url);
        const data = JSON.parse(r.body.toString('utf-8'));
        if (data.code === 0 || data.iretcode === 0) {
          return { status: 200, body: JSON.stringify(data), headers: CORS_HEADERS };
        }
      } catch {}
    }
    return { status: 200, body: JSON.stringify({ code: -1, msg: 'not available' }), headers: CORS_HEADERS };
  } catch (e) {
    return { status: 502, body: JSON.stringify({ code: -1, msg: e.message }), headers: CORS_HEADERS };
  }
}

// ── 静态文件服务 ────────────────────────────────────────────────────

function serveStatic(req, res, filePath) {
  const fullPath = path.join(STATIC_PATH, filePath);
  if (!fullPath.startsWith(STATIC_PATH)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      ...CORS_HEADERS,
    });
    res.end(data);
  });
}

// ── 路由处理 ────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // ── 页面 ──
    if (pathname === '/_page') {
      const pid = url.searchParams.get('pid') || '';
      try {
        const html = await fetchOfficialPage(pid);
        const proxyBase = `http://${req.headers.host}`;
        const result = injectScripts(html, `${proxyBase}/ui.css`, `${proxyBase}/layer.js`);
        textResponse(res, result);
      } catch (e) {
        textResponse(res, `<h1>无法连接: ${e.message}</h1>`, 502);
      }
      return;
    }

    // ── 视频代理 ──
    if (pathname === '/proxy-video') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) {
        res.writeHead(400);
        res.end('missing ?url=');
        return;
      }
      const result = await handleProxyVideo(videoUrl);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
      return;
    }

    // ── CAPI 透传 ──
    if (pathname.startsWith('/capi/')) {
      const result = await handleProxyCapi(pathname);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
      return;
    }

    // ── API: 状态 ──
    if (pathname === '/api/state') {
      if (method === 'GET') { handleGetState(res); return; }
      if (method === 'POST') { handleSetState(req, res); return; }
    }

    // ── API: 录制 ──
    if (pathname === '/api/record/open') { handleRecOpen(req, res); return; }
    if (pathname === '/api/record/append') { handleRecAppend(req, res); return; }
    if (pathname === '/api/record/close') { handleRecClose(req, res); return; }

    // ── API: 截图 ──
    if (pathname === '/api/shot') { handleShotSave(req, res); return; }

    // ── API: 频道 ──
    if (pathname === '/api/channels') {
      if (method === 'GET') {
        const result = await handleGetChannels();
        res.writeHead(result.status, result.headers);
        res.end(result.body);
        return;
      }
    }

    // ── 静态文件 ──
    if (pathname.startsWith('/static/') || pathname.startsWith('/assets/') ||
        pathname === '/layer.js' || pathname === '/patch.js' ||
        pathname === '/ui.css' || pathname === '/api.js' || pathname === '/state.js' ||
        pathname === '/index.html' || pathname === '/manifest.json' || pathname === '/icon.png') {
      const filePath = pathname.startsWith('/static/') ? pathname.slice(8) :
                       pathname.startsWith('/assets/') ? path.join('assets', pathname.slice(8)) : pathname.slice(1);
      serveStatic(req, res, filePath);
      return;
    }

    // 404
    res.writeHead(404);
    res.end('Not found');

  } catch (e) {
    console.error('[error]', e.message);
    res.writeHead(500);
    res.end('Internal error');
  }
}

// ── 健康检查 ────────────────────────────────────────────────────────

function handleHealth(req, res) {
  jsonResponse(res, { ok: true, uptime: process.uptime() });
}

// ── 启动 ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || process.env.BACKEND_PORT || '8080', 10);

const server = http.createServer((req, res) => {
  // 健康检查
  if (req.url === '/health') {
    handleHealth(req, res);
    return;
  }
  handleRequest(req, res);
});

const HOST = process.env.LZC_APP === '1' ? '0.0.0.0' : '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`[LPTV] proxy running on http://${HOST}:${PORT}`);
  console.log(`[LPTV] STATIC_DIR=${STATIC_PATH}`);
  console.log(`[LPTV] RECORD_DIR=${RECORD_PATH_LOCAL}`);
  console.log(`[LPTV] SHOT_DIR=${SHOT_PATH_LOCAL}`);
});

server.on('error', err => {
  console.error('[LPTV] server error:', err.message);
  process.exit(1);
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('[LPTV] shutting down...');
  Object.values(_recorders).forEach(r => { try { r.fh.end(); } catch {} });
  server.close(() => process.exit(0));
});
