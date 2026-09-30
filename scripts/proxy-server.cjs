/**
 * LPTV Web — Node.js 薄同源代理 (LPK 生产后端)
 *
 * 与 proxy/server.py (aiohttp, 开发用) 保持完全相同的端点契约,
 * 以便两个前端 (Vue 父页 / legacy iframe layer) 在任一后端下行为一致。
 *
 *   GET  /health
 *   GET  /_page                 抓官方页 + 注入 api/state/layer/patch/ui
 *   GET  /proxy-video           代理视频分片 (添加 CORS 头)
 *   GET  /capi/*                透传央视频 capi (约定: /capi/<不含 /api 前缀>)
 *   GET  /api/state             获取状态
 *   POST /api/state             保存状态
 *   POST /api/record/open       开始录制
 *   POST /api/record/append     追加录制数据 (base64)
 *   POST /api/record/close      结束录制
 *   POST /api/shot              保存截图 (base64 PNG)
 *   GET  /api/channels          频道列表 (上游 protobuf → JSON)
 *   GET  /api/epg/{pid}/{ymd}   节目单   (上游 protobuf → JSON)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

// ── 路径配置 ───────────────────────────────────────────────────────

const isLpk = process.env.LZC_APP === '1';
const LPK_ROOT = '/lzcapp/pkg/content';
const ROOT_DIR = isLpk ? LPK_ROOT : path.resolve(__dirname, '..');
const STATIC_PATH = isLpk ? path.join(LPK_ROOT, 'frontend') : path.join(ROOT_DIR, 'static');

// 数据目录: 优先 DATA_DIR (LPK manifest 声明 /lzcapp/var/data), 否则 /tmp, 最后仓库内
function pickDataDir() {
  const cands = [
    process.env.DATA_DIR,
    isLpk ? '/tmp/lptv-data' : null,
    path.join(ROOT_DIR, 'data'),
  ].filter(Boolean);
  for (const d of cands) {
    try {
      fs.mkdirSync(path.join(d, 'records'), { recursive: true });
      fs.mkdirSync(path.join(d, 'shots'), { recursive: true });
      fs.accessSync(d, fs.constants.W_OK);
      return d;
    } catch { /* 试下一个 */ }
  }
  return cands[cands.length - 1];
}

const DATA_DIR = pickDataDir();
const RECORD_PATH = path.join(DATA_DIR, 'records');
const SHOT_PATH = path.join(DATA_DIR, 'shots');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

// ── 常量 ───────────────────────────────────────────────────────────

const CAPI_BASE = 'https://capi.yangshipin.cn';
const OFFICIAL_URL = 'https://www.yangshipin.cn/tv/home';
const CHANNELS_URL = CAPI_BASE + '/api/oms/m/tvchannel/list';
const EPG_URL_TMPL = CAPI_BASE + '/api/yspepg/program/{pid}/{ymd}';

const MAX_BODY_BYTES = 32 * 1024 * 1024;   // 请求体上限 (base64 后)
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;   // 单个 append / 截图裸数据上限
const CHANNELS_TTL = 3600;
const EPG_TTL = 300;
const CAPI_TTL = 300;
const MAX_CACHE_ENTRIES = 256;

const STATE_KEYS = ['favs', 'lastPid', 'resumeLast', 'res', 'volume', 'muted'];

// 官方 API/CSAPI 域名 → 本地代理前缀
const API_DOMAINS = [
  'https://touchsystest.yangshipin.cn',
  'https://appdevteamtest.yangshipin.cn',
  'https://precapi.yangshipin.cn',
  'https://precsapi.yangshipin.cn',
  'https://csapi.yangshipin.cn',
  'https://capi.yangshipin.cn',
  'https://preoms.video.cloud.cctv.com',
];

// ── 状态 (落盘) ────────────────────────────────────────────────────

let _state = {
  favs: [],
  lastPid: '',
  resumeLast: true,
  res: [],
  volume: 100,
  muted: false,
};

const _recorders = {};   // rid -> {channel, fh, start, fname, written}
const _cache = new Map(); // key -> {expires, body, ct}

function stateLoad() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (data && typeof data === 'object') {
        for (const k of STATE_KEYS) if (k in data) _state[k] = data[k];
      }
      console.log(`[state] loaded ${STATE_FILE}`);
    }
  } catch (e) {
    console.warn('[state] load failed:', e.message);
  }
}

function stateSave() {
  try {
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_state), 'utf-8');
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) {
    console.warn('[state] save failed:', e.message);
  }
}

stateLoad();

// ── TTL 缓存 ───────────────────────────────────────────────────────

function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) { _cache.delete(key); return null; }
  return hit;
}

function cachePut(key, body, ct, ttlSec) {
  if (_cache.size > MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of _cache) if (v.expires < now) _cache.delete(k);
  }
  _cache.set(key, { expires: Date.now() + ttlSec * 1000, body, ct });
}

// ── HTTP 请求头 ────────────────────────────────────────────────────

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

// ── 工具 ───────────────────────────────────────────────────────────

function jsonResponse(res, data, status = 200, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
    ...extra,
  });
  res.end(JSON.stringify(data));
}

function textResponse(res, text, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS });
  res.end(text);
}

/** 读请求体, 带体积上限; 回调 (err, obj) */
function readJsonBody(req, cb, maxBytes = MAX_BODY_BYTES) {
  const declared = parseInt(req.headers['content-length'] || '0', 10);
  if (declared && declared > maxBytes) {
    return cb({ status: 413, message: 'payload too large' });
  }
  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on('data', (c) => {
    if (aborted) return;
    size += c.length;
    if (size > maxBytes) {
      aborted = true;
      cb({ status: 413, message: 'payload too large' });
      return;
    }
    chunks.push(c);
  });
  req.on('error', (e) => { if (!aborted) { aborted = true; cb({ status: 400, message: e.message }); } });
  req.on('end', () => {
    if (aborted) return;
    let obj;
    try {
      obj = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    } catch (e) {
      return cb({ status: 400, message: 'invalid JSON' });
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return cb({ status: 400, message: 'JSON object required' });
    }
    cb(null, obj);
  });
}

/** 解 base64 并校验体积; 回调 (err, buffer) */
function readB64(value, cb, maxBytes = MAX_CHUNK_BYTES) {
  if (typeof value !== 'string' || !value) {
    return cb({ status: 400, message: 'missing data' });
  }
  if (value.length * 3 / 4 > maxBytes) {
    return cb({ status: 413, message: 'chunk too large' });
  }
  const buf = Buffer.from(value, 'base64');
  if (buf.length > maxBytes) {
    return cb({ status: 413, message: 'chunk too large' });
  }
  // base64 非法字符会让 Buffer 静默截断, 这里做一次往返校验
  if (buf.toString('base64').replace(/=+$/, '') !== value.replace(/[\r\n\s]/g, '').replace(/=+$/, '')) {
    return cb({ status: 400, message: 'bad base64' });
  }
  cb(null, buf);
}

function proxyFetch(targetUrl, headers = HEADERS, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(targetUrl); } catch (e) { return reject(new Error('bad url')); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return reject(new Error('unsupported protocol'));
    }
    // 修复: 原实现两个分支都是 https, 导致任何 http:// 目标必然失败
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers,
    };
    try {
      const req = lib.request(options, (res_) => {
        const data = [];
        res_.on('data', (chunk) => data.push(chunk));
        res_.on('end', () => resolve({
          status: res_.statusCode,
          headers: res_.headers,
          body: Buffer.concat(data),
        }));
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    } catch (e) { reject(e); }
  });
}

// ── Protobuf 解析 ──────────────────────────────────────────────────
// 与 proxy/epg.py 同源实现, 字段映射与 static/layer.js 的 parseEpg 保持一致

function utf8Str(buf, a, n) {
  if (n <= 0) return '';
  return buf.toString('utf-8', a, a + n);
}

function readVarint(buf, i, end) {
  let v = 0, s = 0, k = 0;
  while (i < end && k < 5) {
    const b = buf[i++];
    v += (b & 0x7f) * Math.pow(2, s);
    s += 7; k++;
    if (!(b & 0x80)) break;
  }
  return [v, i];
}

/** 跳过一个字段, 返回新游标 */
function pbSkip(buf, i, wtype, end) {
  if (wtype === 0) return readVarint(buf, i, end)[1];
  if (wtype === 1) return Math.min(i + 8, end);
  if (wtype === 2) {
    const [len, ni] = readVarint(buf, i, end);
    return Math.min(ni + len, end);
  }
  if (wtype === 5) return Math.min(i + 4, end);
  return i; // wtype 3/4 (group) 本协议不出现
}

function pbReadLen(buf, i, end) {
  const [len, ni] = readVarint(buf, i, end);
  return [buf.slice(ni, Math.min(ni + len, end)), Math.min(ni + len, end)];
}

/** 解析单条 EPG 节目: f1=id f2=name f3=s0 f4=e0 f5=start f6=end f7=dur f9/f10=extra */
function parseEpgEntry(buf, a, b) {
  const p = {};
  let i = a;
  while (i < b) {
    const [tag, ni] = readVarint(buf, i, b);
    i = ni;
    if (tag === 0) break;
    const f = tag >>> 3, wt = tag & 7;
    if (wt === 2) {
      const [len, li] = readVarint(buf, i, b);
      if (li + len > b) break;
      if (f === 1) p.id = utf8Str(buf, li, len);
      else if (f === 2) p.name = utf8Str(buf, li, len);
      else if (f === 5) p.start = utf8Str(buf, li, len);
      else if (f === 6) p.end = utf8Str(buf, li, len);
      else if (f === 9 || f === 10) p.extra = utf8Str(buf, li, len);
      i = li + len;
    } else if (wt === 0) {
      const [v, vi] = readVarint(buf, i, b);
      if (f === 3) p.s0 = v;
      else if (f === 4) p.e0 = v;
      else if (f === 7) p.dur = v;
      i = vi;
    } else {
      i = pbSkip(buf, i, wt, b);
    }
  }
  return p.name ? p : null;
}

/** 解析 EPG protobuf → 节目数组 */
function parseEpg(raw) {
  const programs = [];
  try {
    const n = raw.length;
    let i = 0;
    while (i < n) {
      const [tag, ni] = readVarint(raw, i, n);
      i = ni;
      if (tag === 0) break;
      const wt = tag & 7;
      if (wt === 2) {
        const [len, li] = readVarint(raw, i, n);
        if (li + len > n) break;
        const e = parseEpgEntry(raw, li, li + len);
        if (e) programs.push(e);
        i = li + len;
      } else if (wt === 0) {
        i = readVarint(raw, i, n)[1];
      } else {
        i = pbSkip(raw, i, wt, n);
      }
      if (programs.length >= 200) break;
    }
  } catch { return programs; }
  return programs;
}

/** 解析 tvchannel/list protobuf → [{channelId, name}] */
function parseChannelList(raw) {
  const channels = [];
  try {
    const n = raw.length;
    let i = 0;
    let inner = null;
    while (i < n) {
      const [tag, ni] = readVarint(raw, i, n);
      i = ni;
      if (tag === 0) break;
      const field = tag >>> 3, wt = tag & 7;
      if (wt === 2) {
        const [val, vi] = pbReadLen(raw, i, n);
        if (field === 2) inner = val;
        i = vi;
      } else {
        i = pbSkip(raw, i, wt, n);
      }
    }
    if (!inner) return channels;

    const m = inner.length;
    i = 0;
    while (i < m) {
      const [tag, ni] = readVarint(inner, i, m);
      i = ni;
      if (tag === 0) break;
      const wt = tag & 7;
      if (wt !== 2) { i = pbSkip(inner, i, wt, m); continue; }
      const [val, vi] = pbReadLen(inner, i, m);
      i = vi;
      const ch = {};
      let j = 0;
      const vn = val.length;
      while (j < vn) {
        const [jtag, jni] = readVarint(val, j, vn);
        j = jni;
        if (jtag === 0) break;
        const jf = jtag >>> 3, jwt = jtag & 7;
        if (jwt === 0) {
          const [jv, jvi] = readVarint(val, j, vn);
          ch['f' + jf] = jv; j = jvi;
        } else if (jwt === 2) {
          const [jv, jvi] = pbReadLen(val, j, vn);
          ch['f' + jf] = jv.toString('utf-8'); j = jvi;
        } else {
          j = pbSkip(val, j, jwt, vn);
        }
      }
      const name = ch.f1 || '';
      const pid = ch.f2 || '';
      if (name && pid) channels.push({ channelId: String(pid), name: String(name) });
    }
  } catch { return channels; }
  return channels;
}

/** 频道分类 —— 与 proxy/server.py 的 infer_category 保持一致 */
function inferCategory(name) {
  if (name.startsWith('CGTN')) return 'CGTN';
  if (name.startsWith('CCTV') || name.includes('4K') || name.includes('8K')) return '央视';
  if (name.includes('卫视')) return '卫视';
  if (name.includes('教育')) return '其他';
  return '地方';
}

// ── 页面抓取 + 注入 ─────────────────────────────────────────────────

async function fetchOfficialPage(pid = '') {
  let url = OFFICIAL_URL;
  if (pid) url += (url.includes('?') ? '&' : '?') + 'pid=' + encodeURIComponent(pid);
  const r = await proxyFetch(url);
  if (r.status !== 200) throw new Error('HTTP ' + r.status);
  return r.body.toString('utf-8');
}

function rewriteApiDomains(html) {
  for (const d of API_DOMAINS) html = html.split(d).join('/capi');
  return html;
}

// 注入到官方页首段 <script> 之前, 必须做两件事:
//   1) 覆盖全部 7 个官方 API 域名
//   2) 剥掉紧跟域名后的前导 "/api" —— 路由是 /capi/{path} → CAPI_BASE + "/api/" + {path},
//      不剥会让官方 /api/oms/x 变成 /capi/api/oms/x → /api/api/oms/x
const CAPI_PATCH_JS = `(function(){
var DOMAINS=${JSON.stringify(API_DOMAINS)};
function toLocal(u){
  if(u&&typeof u.url==="string")u=u.url;
  else if(u&&typeof u.href==="string")u=u.href;
  if(typeof u!=="string")return u;
  for(var i=0;i<DOMAINS.length;i++){
    if(u.indexOf(DOMAINS[i])!==0)continue;
    var p=u.slice(DOMAINS[i].length);
    p=p.replace(/^\\/api(?=\\/|$)/,"");
    return "/capi"+p;
  }
  return u;
}
var _f=window.fetch;
window.fetch=function(u,o){var n=toLocal(u);if(typeof n==="string"&&n!==u)u=n;return _f.call(this,u,o);};
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u){var n=toLocal(u);if(typeof n==="string"&&n!==u)u=n;return XO.apply(this,arguments);};
})();`;

function injectScripts(html, cssUrl, jsUrl) {
  const headClose = '</head>';
  const bodyClose = '</body>';
  const cssTag = `\n<link rel="stylesheet" href="${cssUrl}">\n`;
  const capiPatch = `<script>${CAPI_PATCH_JS}</script>\n`;
  const base = jsUrl.slice(0, jsUrl.lastIndexOf('/'));
  // layer.js 依赖 LptvApi / LptvState, 必须先注入 api.js 与 state.js
  // 注: 旧 patch.js 已删除 — 它是独立 IIFE, 引用 layer.js 私有符号全部 ReferenceError
  const jsTag = '\n' + ['api.js', 'state.js', 'layer.js']
    .map((n) => `<script src="${base}/${n}"></script>\n`).join('');

  const firstScript = html.indexOf('<script');
  if (firstScript > 0) html = html.slice(0, firstScript) + capiPatch + html.slice(firstScript);
  else if (html.includes(headClose)) html = html.replace(headClose, capiPatch + headClose, 1);
  else html = capiPatch + html;

  if (html.includes(headClose)) html = html.replace(headClose, cssTag + headClose, 1);
  else html = cssTag + html;

  if (html.includes(bodyClose)) html = html.replace(bodyClose, jsTag + bodyClose, 1);
  else html += jsTag;
  return html;
}

// ── CAPI 透传 ──────────────────────────────────────────────────────

async function handleProxyCapi(restPath) {
  // restPath 是不含 /capi 前缀、不含前导 /api 的路径
  const cacheKey = 'capi:' + restPath;
  const hit = cacheGet(cacheKey);
  if (hit) {
    return { status: 200, headers: { 'Content-Type': hit.ct, ...CORS_HEADERS }, body: hit.body };
  }
  const target = CAPI_BASE + '/api/' + restPath;
  const r = await proxyFetch(target);
  const ct = r.headers['content-type'] || 'application/octet-stream';
  let body = r.body;
  if (ct.includes('json')) {
    try { body = Buffer.from(JSON.stringify(JSON.parse(body.toString('utf-8')))); } catch { /* 原样 */ }
  } else if (r.status === 200) {
    cachePut(cacheKey, body, ct, CAPI_TTL);
  }
  // 必须透传上游 Content-Type, 否则前端无法判断 protobuf/JSON
  return { status: r.status, headers: { 'Content-Type': ct, ...CORS_HEADERS }, body };
}

// ── API: 频道列表 ──────────────────────────────────────────────────

async function handleGetChannels() {
  const hit = cacheGet('channels');
  if (hit) return { status: 200, headers: { 'Content-Type': hit.ct }, body: hit.body };

  const r = await proxyFetch(CHANNELS_URL);
  if (r.status !== 200) {
    return {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: -1, msg: 'upstream HTTP ' + r.status }),
    };
  }
  const ct = r.headers['content-type'] || '';
  let channels = [];

  if (ct.includes('json')) {
    // 上游若改为 JSON, 就地映射到前端约定的结构
    const data = JSON.parse(r.body.toString('utf-8'));
    const list = (data && data.data && (data.data.channelList || data.data.list)) || [];
    for (const c of list) {
      const name = c.channelName || c.name || '';
      if (!name || name.includes('限免') || name.includes('VIP')) continue;
      channels.push({
        channelId: c.channelId || c.pid || '',
        channelName: name, name, category: inferCategory(name),
      });
    }
  } else {
    // 上游是 protobuf —— 原实现直接透传上游 JSON, 前端读 r.data.channelList 得到
    // undefined, 频道列表永远渲染不出来
    for (const c of parseChannelList(r.body)) {
      const name = c.name;
      if (!name || name.includes('限免') || name.includes('VIP')) continue;
      channels.push({
        channelId: c.channelId, channelName: name, name, category: inferCategory(name),
      });
    }
  }

  const body = Buffer.from(JSON.stringify({ code: 0, data: { channelList: channels } }), 'utf-8');
  cachePut('channels', body, 'application/json; charset=utf-8', CHANNELS_TTL);
  console.log(`[channels] ${channels.length} channels (upstream ${ct || 'unknown'})`);
  return { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body };
}

// ── API: EPG ───────────────────────────────────────────────────────

async function handleGetEpg(pid, ymd) {
  if (!/^[0-9A-Za-z_-]{1,32}$/.test(pid || '')) {
    return { status: 400, body: JSON.stringify({ code: -1, msg: 'bad pid' }) };
  }
  if (!/^[0-9]{8}$/.test(ymd || '')) {
    return { status: 400, body: JSON.stringify({ code: -1, msg: 'bad ymd (YYYYMMDD)' }) };
  }
  // 日历合法性: 光看 8 位数字会放过 20261340 这种月份 13 的值
  const ymdNum = Number(ymd);
  const month = Math.floor(ymdNum / 100) % 100;
  const day = ymdNum % 100;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { status: 400, body: JSON.stringify({ code: -1, msg: 'bad ymd (not a real date)' }) };
  }
  const key = `epg:${pid}:${ymd}`;
  const hit = cacheGet(key);
  if (hit) return { status: 200, headers: { 'Content-Type': hit.ct }, body: hit.body };

  const target = EPG_URL_TMPL.replace('{pid}', encodeURIComponent(pid)).replace('{ymd}', ymd);
  const r = await proxyFetch(target);
  if (r.status !== 200) {
    return {
      status: 502,
      body: JSON.stringify({ code: -1, msg: 'upstream HTTP ' + r.status }),
    };
  }
  const ct = r.headers['content-type'] || '';
  let programs;
  if (ct.includes('json')) {
    try {
      const d = JSON.parse(r.body.toString('utf-8'));
      programs = (d && d.data && d.data.programs) || [];
    } catch { programs = []; }
  } else {
    programs = parseEpg(r.body);
  }
  const body = Buffer.from(
    JSON.stringify({ code: 0, data: { pid, ymd, programs } }), 'utf-8');
  cachePut(key, body, 'application/json; charset=utf-8', EPG_TTL);
  return { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body };
}

// ── 静态文件 ───────────────────────────────────────────────────────

const MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

function serveStatic(res, relPath) {
  // 目录穿越防护: resolve 后必须仍在 STATIC_PATH 之内
  const full = path.resolve(STATIC_PATH, '.' + path.sep + (relPath || '').replace(/^[/\\]+/, ''));
  const base = path.resolve(STATIC_PATH);
  if (full !== base && !full.startsWith(base + path.sep)) {
    res.writeHead(403, CORS_HEADERS);
    res.end('Forbidden');
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, CORS_HEADERS);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      ...CORS_HEADERS,
    });
    res.end(data);
  });
}

const STATIC_FILES = new Set([
  '/index.html', '/manifest.json', '/icon.png', '/ui.css',
  '/layer.js', '/api.js', '/state.js',
]);

// ── 路由 ───────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method;

  try {
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        ...CORS_HEADERS,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    // ── 页面 ──
    if (pathname === '/_page') {
      const pid = url.searchParams.get('pid') || '';
      try {
        let html = await fetchOfficialPage(pid);
        html = rewriteApiDomains(html);
        const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
        const host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost')
          .split(',')[0].trim();
        const base = `${proto}://${host}`;
        const result = injectScripts(html, `${base}/ui.css`, `${base}/layer.js`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(result);
      } catch (e) {
        textResponse(res, `<h1>无法连接官方直播页: ${e.message}</h1>` +
          `<p>请确认网络可达 https://www.yangshipin.cn</p>`, 502);
      }
      return;
    }

    // ── 视频代理 ──
    if (pathname === '/proxy-video') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return textResponse(res, 'missing ?url=', 400);
      const r = await proxyFetch(videoUrl, HEADERS, 15000);
      res.writeHead(r.status, {
        'Content-Type': r.headers['content-type'] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=30',
        ...CORS_HEADERS,
      });
      res.end(r.body);
      return;
    }

    // ── CAPI 透传: 必须剥掉 /capi 前缀 ──
    if (pathname === '/capi' || pathname.startsWith('/capi/')) {
      const rest = pathname.slice('/capi'.length).replace(/^\/+/, '');
      const result = await handleProxyCapi(rest);
      res.writeHead(result.status, result.headers || CORS_HEADERS);
      res.end(result.body);
      return;
    }

    // ── API: 状态 ──
    if (pathname === '/api/state') {
      if (method === 'GET') return jsonResponse(res, { ok: true, ..._state });
      if (method === 'POST') {
        return readJsonBody(req, (err, data) => {
          if (err) return jsonResponse(res, { ok: false, error: err.message }, err.status);
          for (const k of STATE_KEYS) if (k in data) _state[k] = data[k];
          stateSave();
          jsonResponse(res, { ok: true });
        });
      }
    }

    // ── API: 录制 ──
    if (pathname === '/api/record/open' && method === 'POST') {
      return readJsonBody(req, (err, data) => {
        if (err) return jsonResponse(res, { ok: false, error: err.message }, err.status);
        const channel = String(data.channel || '直播').slice(0, 40);
        // Date.now() 在同毫秒并发时会撞 id 并泄漏句柄
        const rid = crypto.randomBytes(8).toString('hex');
        const fname = `${rid}.webm`;
        const fpath = path.join(RECORD_PATH, fname);
        let fh;
        try { fh = fs.createWriteStream(fpath); } catch (e) {
          return jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        _recorders[rid] = { channel, fh, start: Date.now(), fname, written: 0 };
        console.log(`[rec] open: ${rid} (${channel}) → ${fpath}`);
        jsonResponse(res, { ok: true, id: rid });
      });
    }

    if (pathname === '/api/record/append' && method === 'POST') {
      return readJsonBody(req, (err, data) => {
        if (err) return jsonResponse(res, { ok: false, error: err.message }, err.status);
        const rec = _recorders[data.id];
        if (!rec) return jsonResponse(res, { ok: false, error: 'rid not found' }, 404);
        readB64(data.data, (b64err, buf) => {
          if (b64err) return jsonResponse(res, { ok: false, error: b64err.message }, b64err.status);
          rec.fh.write(buf);
          rec.written += buf.length;
          jsonResponse(res, { ok: true, size: rec.written });
        });
      });
    }

    if (pathname === '/api/record/close' && method === 'POST') {
      return readJsonBody(req, (err, data) => {
        if (err) return jsonResponse(res, { ok: false, error: err.message }, err.status);
        const rec = _recorders[data.id];
        if (!rec) return jsonResponse(res, { ok: false, error: 'rid not found' }, 404);
        delete _recorders[data.id];
        rec.fh.end(() => {
          const sizeMb = Math.round((rec.written / 1048576) * 10) / 10;
          console.log(`[rec] close: ${data.id} ${rec.fname} (${sizeMb} MB)`);
          jsonResponse(res, { ok: true, path: rec.fname, size_mb: sizeMb });
        });
      });
    }

    // ── API: 截图 ──
    if (pathname === '/api/shot' && method === 'POST') {
      return readJsonBody(req, (err, data) => {
        if (err) return jsonResponse(res, { ok: false, error: err.message }, err.status);
        const channel = String(data.channel || '直播').slice(0, 40);
        readB64(data.data, (b64err, buf) => {
          if (b64err) return jsonResponse(res, { ok: false, error: b64err.message }, b64err.status);
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const safeName = channel.replace(/[^\w\-]/g, '_').slice(0, 20) || 'shot';
          const fname = `${safeName}-${ts}.png`;
          try {
            fs.writeFileSync(path.join(SHOT_PATH, fname), buf);
          } catch (e) {
            return jsonResponse(res, { ok: false, error: e.message }, 500);
          }
          console.log(`[shot] ${fname} (${buf.length} bytes)`);
          jsonResponse(res, { ok: true, name: fname, path: path.join(SHOT_PATH, fname) });
        }, 16 * 1024 * 1024);
      });
    }

    // ── API: 频道 ──
    if (pathname === '/api/channels' && method === 'GET') {
      const result = await handleGetChannels();
      res.writeHead(result.status, result.headers);
      res.end(result.body);
      return;
    }

    // ── API: EPG ──
    // ymd 不在路由层限定位数, 否则 /api/epg/P1/2026 会 404 而不是 400,
    // handleGetEpg 里的格式校验就永远走不到
    const epgM = pathname.match(/^\/api\/epg\/([^/]+)\/([^/]+)$/);
    if (epgM && method === 'GET') {
      const result = await handleGetEpg(epgM[1], epgM[2]);
      res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS });
      res.end(result.body);
      return;
    }

    // ── 静态文件 ──
    if (pathname.startsWith('/assets/')) {
      return serveStatic(res, path.join('assets', pathname.slice('/assets/'.length)));
    }
    if (STATIC_FILES.has(pathname)) {
      return serveStatic(res, pathname.slice(1));
    }
    if (pathname === '/') {
      return serveStatic(res, 'index.html');
    }

    res.writeHead(404, CORS_HEADERS);
    res.end('Not found');
  } catch (e) {
    console.error('[error]', req.method, pathname, '-', e.message);
    if (!res.headersSent) res.writeHead(502, CORS_HEADERS);
    res.end('Upstream error: ' + e.message);
  }
}

// ── 启动 ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || process.env.BACKEND_PORT || '8080', 10);
const HOST = process.env.LZC_APP === '1' ? '0.0.0.0' : '127.0.0.1';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    return jsonResponse(res, { ok: true, uptime: process.uptime() });
  }
  handleRequest(req, res);
});

function shutdown() {
  console.log('[LPTV] shutting down...');
  stateSave();
  Object.values(_recorders).forEach((r) => { try { r.fh.end(); } catch { /* ignore */ } });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// 仅直接运行时才监听端口; 被 require 时导出纯函数供测试
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[LPTV] proxy running on http://${HOST}:${PORT}`);
    console.log(`[LPTV] STATIC_DIR=${STATIC_PATH}`);
    console.log(`[LPTV] DATA_DIR=${DATA_DIR}`);
    console.log(`[LPTV] RECORD_DIR=${RECORD_PATH}`);
    console.log(`[LPTV] SHOT_DIR=${SHOT_PATH}`);
  });

  server.on('error', (err) => {
    console.error('[LPTV] server error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  server,
  parseEpg,
  parseChannelList,
  inferCategory,
  injectScripts,
  rewriteApiDomains,
  handleRequest,
  CAPI_PATCH_JS,
  API_DOMAINS,
  DATA_DIR,
  RECORD_PATH,
  SHOT_PATH,
  STATE_KEYS,
  _state,
  stateSave,
};
