const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const port = process.env.BACKEND_PORT || 8080;

// ── CEF IPC ──────────────────────────────────────────────────────────────────
const CEF_BIN = process.env.LPTV_CEF_BIN || '/lzcapp/pkg/content/scripts/cef-bin';
const CHANNELS_JSON = process.env.LPTV_CHANNELS || path.join(__dirname, 'data', 'iptvStreams.json');

let cefProcess = null;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', cef: cefProcess ? 'running' : 'stopped' });
});

app.get('/api/channel/list', (req, res) => {
  try {
    const data = fs.readFileSync(CHANNELS_JSON, 'utf8');
    res.json(JSON.parse(data).channels || []);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/channel/current', (req, res) => {
  res.json({ channel: req.query.idx || 0 });
});

function startCef() {
  if (cefProcess || !fs.existsSync(CEF_BIN)) return;
  const args = ['--channels', CHANNELS_JSON, '--stdin'];
  cefProcess = spawn(CEF_BIN, args, {
    env: {
      ...process.env,
      LD_LIBRARY_PATH: '/lzcapp/pkg/content/scripts:' + (process.env.LD_LIBRARY_PATH || '')
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  cefProcess.stdout.on('data', (d) => console.log('[cef]', d.toString().trim()));
  cefProcess.stderr.on('data', (d) => console.error('[cef-err]', d.toString().trim()));
  cefProcess.on('close', (code) => { console.log(`[cef] exited ${code}`); cefProcess = null; });
  cefProcess.on('error', (e) => {
    console.error(`[cef] spawn failed: ${e.message}, CEF playback unavailable`);
    cefProcess = null;
  });
  console.log(`[start] cef-bin: ${CEF_BIN}`);
}

app.post('/api/control', (req, res) => {
  if (!cefProcess || !cefProcess.stdin.writable) {
    return res.status(503).json({ error: 'cef not running' });
  }
  cefProcess.stdin.write(JSON.stringify(req.body) + '\n');
  res.json({ sent: true });
});

setTimeout(startCef, 2000);

// ── API: 频道数据 ─────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const CHANNELS_FILE = path.join(DATA_DIR, 'iptvStreams.json');

app.get('/api/channels', (req, res) => {
  try {
    if (!fs.existsSync(CHANNELS_FILE)) {
      return res.status(404).json({ error: 'No channel data found' });
    }
    const data = fs.readFileSync(CHANNELS_FILE, 'utf8');
    res.json(JSON.parse(data).channels || []);
  } catch (e) {
    console.error('[api/channels] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── 345iptv 代理：隐藏所有非视频元素 + 注入同域检测脚本 ────────────────────────
const HIDE_CSS = `
<style>
body * { visibility: hidden !important; display: none !important; }
video, #vstPlayer, .vstPlayer, video * { visibility: visible !important; display: block !important; }
html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #000 !important; }
noscript, link, meta, head, style, script:not([data-lptv]) { display: none !important; }
</style>
`;

const DETECT_SCRIPT = `<script data-lptv>
(function() {
  var check = function() {
    var el = document.getElementById('vstPlayer');
    if (el) {
      window.parent.postMessage({type:'vstPlayerFound', src: el.src}, '*');
    }
  };
  // Poll every 200ms for up to 30s
  var timer = setInterval(check, 200);
  setTimeout(function() { clearInterval(timer); }, 30000);
  // Also watch DOM changes
  var observer = new MutationObserver(function() {
    var el = document.getElementById('vstPlayer');
    if (el) {
      window.parent.postMessage({type:'vstPlayerFound', src: el.src}, '*');
      clearInterval(timer);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
</script>`;

app.get('/proxy/345iptv/:tid/:id', (req, res) => {
  const { tid, id } = req.params;
  const url = `https://www.345iptv.com/?act=play&tid=${tid}&id=${id}`;
  console.log(`[proxy] fetching ${url}`);

  https.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.345iptv.com/'
    }
  }, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      // 移除 CSP
      data = data.replace(/Content-Security-Policy:[^\r\n]*/gi, '');
      data = data.replace(/frame-ancestors[^;]*;?/gi, '');
      data = data.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
      data = data.replace(/<meta[^>]*content=["'][^"']*frame-ancestors[^"']*["'][^>]*>/gi, '');

      // 注入 base href 指向 345iptv，让相对路径资源正确加载
      const baseTag = '<base href="https://www.345iptv.com/">';
      data = data.replace('<head>', '<head>' + baseTag);

      // 注入 CSS 隐藏非视频元素
      data = data.replace('</head>', HIDE_CSS + DETECT_SCRIPT + '</head>');

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(data);
    });
  }).on('error', (e) => {
    console.error(`[proxy/345iptv] error: ${e.message}`);
    res.status(502).send('Failed to fetch channel page');
  });
});

// ── 央视频代理 ────────────────────────────────────────────────────────────────
app.get('/proxy/yangshipin/:pid', (req, res) => {
  const pid = req.params.pid;
  if (!/^\d+$/.test(pid)) {
    return res.status(400).json({ error: 'invalid pid' });
  }
  const targetUrl = `https://yangshipin.cn/tv/home?pid=${pid}`;

  https.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    }
  }, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      data = data.replace(/Content-Security-Policy:[^\r\n]*/gi, '');
      data = data.replace(/frame-ancestors[^;]*;?/gi, '');
      data = data.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
      data = data.replace(/<meta[^>]*content=["'][^"']*frame-ancestors[^"']*["'][^>]*>/gi, '');

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(data);
    });
  }).on('error', (e) => {
    console.error(`[proxy] error: ${e.message}`);
    res.status(502).send('Failed to fetch channel page');
  });
});

// ── 静态文件服务 ──────────────────────────────────────────────────────────────
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use('/lptv-ws', express.static(FRONTEND_DIR));
app.use('/', express.static(FRONTEND_DIR));

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`[proxy] listening on port ${port}`);
});
