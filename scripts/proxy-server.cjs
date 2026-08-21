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
    // 移除所有 script 标签
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // 移除外部广告脚本（双重保险）
    html = html.replace(/<script[^>]*src=["'][^"']*(?:alwaysmulticulturallanding|popunder|popup|n6wxm|cdn-cgi|51\.la|gtag)[^"']*["'][^>]*><\/script>/gi, '')
    html = html.replace(/<div id="ad-container"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<div class="headerNfooter"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<div data-role="navbar"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<div align="center">[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<center>[\s\S]*?<\/center>/gi, '')
    html = html.replace(/<div id="errorTip"[^>]*>[\s\S]*?<\/div>/gi, '')
    // 移除所有 listview / li / select / button / a 链接
    html = html.replace(/<ul[^>]*data-role=["']listview["'][^>]*>[\s\S]*?<\/ul>/gi, '')
    html = html.replace(/<li[^>]*>[\s\S]*?<\/li>/gi, '')
    html = html.replace(/<select[^>]*>[\s\S]*?<\/select>/gi, '')
    html = html.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
    html = html.replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '')
    html = html.replace(/<div class="ui-grid-a"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<div class="ui-select"[^>]*>[\s\S]*?<\/div>/gi, '')
    html = html.replace(/<div class="ui-btn[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // 移除广告域名 favicon / 下载提示
    html = html.replace(/<link[^>]*href=["']https:\/\/d\.2026016\.xyz[^"']*[^>]*>/gi, '')
    html = html.replace(/<a[^>]*href=["']https:\/\/d\.2026016\.xyz[^>]*>[\s\S]*?<\/a>/gi, '')
    // 移除 jQuery CSS（不需要）
    html = html.replace(/<link[^>]*href=["'][^"']*jquerymobile[^"']*["'][^>]*>/gi, '')
    // 移除底部版权
    html = html.replace(/<div data-role="footer"[^>]*>[\s\S]*?<\/div>/gi, '')

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

    // ── 全屏播放器样式：仅保留 video，隐藏所有 UI ──
    const customStyle = `<style>
  html, body { margin: 0; padding: 0; background: #000; overflow: hidden; height: 100%; }
  [data-role="page"] { min-height: 100vh; margin: 0; }
  #vstPlayer { width: 100%!important; height: 100vh!important; aspect-ratio: unset!important; }
  video#vstPlayer { width: 100%!important; height: 100%!important; object-fit: contain; }
  .headerNfooter, [data-role="navbar"], .ui-grid-a, #ad-container, #errorTip,
  [data-role="list-divider"], [data-role="listview"], .ui-listview,
  select#playURL, .ui-select, .ui-btn, button, a[href],
  script, .ui-link, center, div[align] { display: none !important; }
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

// ── iptv345 播放页 URL 解密（动态解析页面中的加密脚本）──────────────────
/** base64 decode（含 +/= 填充，兼容 -/_ URL-safe） */
function decodeBase64(input) {
  let str = String(input).replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return Buffer.from(str, 'base64').toString('utf8')
}

/** hacew: 原页面 base64 decode 函数 */
function hacew(str) {
  if (!str) return str
  str += ''
  const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  let i = 0, ac = 0, dec = '', tmp_arr = []
  do {
    const h1 = keyStr.indexOf(str.charAt(i++))
    const h2 = keyStr.indexOf(str.charAt(i++))
    const h3 = keyStr.indexOf(str.charAt(i++))
    const h4 = keyStr.indexOf(str.charAt(i++))
    const bits = h1 << 18 | h2 << 12 | h3 << 6 | h4
    const a1 = bits >> 16 & 0xff
    const a2 = bits >> 8 & 0xff
    const a3 = bits & 0xff
    if (h3 == 64) { tmp_arr[ac++] = String.fromCharCode(a1) }
    else if (h4 == 64) { tmp_arr[ac++] = String.fromCharCode(a1, a2) }
    else { tmp_arr[ac++] = String.fromCharCode(a1, a2, a3) }
  } while (i < str.length)
  return tmp_arr.join('')
}

/** 从页面 HTML 中提取加密变量 */
function extractEncryptVars(html) {
  // 匹配 var xxx = ""; var yyy ="...";var zzz = ""; var www ="..."; xxx = yyy; ... = zzz;
  // 模式1: var name = ""; var raw ="...拼接..."; var name2 = ""; var raw2 ="...拼接..."; name = raw; ... = raw2;
  const varPattern = /var\s+(\w+)\s*=\s*""\s*;\s*var\s+(\w+)\s*=\s*([^;]+);var\s+(\w+)\s*=\s*""\s*;\s*var\s+(\w+)\s*=\s*([^;]+);(?:\s*\w+\s*=\s*\w+\s*;){2,}/
  const m = html.match(varPattern)
  if (m) {
    const keyRaw = m[3].replace(/;$/, '').trim()
    const tokenRaw = m[5].replace(/;$/, '').trim()
    // 解析拼接表达式（如 "abc"+"def".split("").reverse().join("")+...）
    const evalKey = `(${keyRaw})`
    const evalToken = `(${tokenRaw})`
    try {
      const keyVal = eval(evalKey)
      const tokenVal = eval(evalToken)
      // 找 token 替换值（lzusq = "..." 或类似）
      const tokenReplace = html.match(/;\s*(\w+)\s*=\s*"([a-f0-9]{32})"\s*;/)
      const oldToken = tokenReplace ? tokenReplace[2] : ''
      // 找 XOR 后缀（key + "..."）
      const suffixMatch = html.match(/key\s*=\s*key\s*\+\s*"([a-f0-9]+)"/)
      const suffix = suffixMatch ? suffixMatch[1] : ''
      return { key: keyVal, token: tokenVal, oldToken, suffix }
    } catch (e) { /* fallback */ }
  }
  return null
}

let encryptVars = null

/** 解密单个 URL */
function decryptUrl(enc, vars) {
  if (!vars) return enc
  let led = enc.split('').reverse().join('')
  // bihpe/vawbl 等价于 hacew → xor with key+suffix → hacew
  const decoded = hacew(led)
  const fullKey = vars.key + vars.suffix
  let code = ''
  for (let i = 0; i < decoded.length; i++) {
    code += String.fromCharCode(decoded.charCodeAt(i) ^ fullKey.charCodeAt(i % fullKey.length))
  }
  led = hacew(code)
  if (vars.oldToken) led = led.replace('token=' + vars.oldToken, 'token=' + vars.token)
  led = led.replace(vars.key, '')
  return led.trim()
}

// ── IPTV Info API（结构化数据：明码URL + EPG + 线路列表）─────────────────
app.get('/api/iptv/info/:tid/:id', async (req, res) => {
  const { tid, id } = req.params
  const cacheKey = `iptv_info_${tid}_${id}`
  const now = Date.now()

  if (iptvCache.has(cacheKey)) {
    const cached = iptvCache.get(cacheKey)
    if (now - cached.time < 5 * 60 * 1000) {
      return res.json(cached.data)
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

    if (!response.ok) return res.status(response.status).json({ error: `HTTP ${response.status}` })

    let buf = Buffer.from(await response.arrayBuffer())
    let html
    if (buf[0] === 0x1f && buf[1] === 0x8b) html = zlib.gunzipSync(buf).toString('utf8')
    else if (buf[0] === 0x28 && buf[1] === 0xCA) html = zlib.brotliDecompressSync(buf).toString('utf8')
    else html = buf.toString('utf8')

    // ── 提取线路标签（URL 解密不稳定，仅返回标签）─────────────────────
    const lines = []
    const lineRegex = /<option\s+value="([^"]+)"[^>]*>([^<]+)<\/option>/g
    let m
    while ((m = lineRegex.exec(html)) !== null) {
      const label = m[2].trim()
      if (label) lines.push({ label })
    }

    // ── 提取 EPG ──
    const epg = []
    const epgLiRegex = /<li[^>]*>(?:<div[^>]*><div[^>]*><a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a><\/div><\/div>)?(?:<span[^>]*>([^<]*)<\/span>)?(?:<span[^>]*class="ui-li-count[^"]*"[^>]*>([^<]*)<\/span>)?<\/li>/gi
    // Simpler: just grab visible text from li elements in #myEpg
    const epgSection = html.match(/<ul[^>]*id=["']myEpg["'][^>]*>([\s\S]*?)<\/ul>/i)
    if (epgSection) {
      const liBlocks = epgSection[1].match(/<li[^>]*>[\s\S]*?<\/li>/gi) || []
      for (const li of liBlocks) {
        const timeMatch = li.match(/>(\d{2}:\d{2})\s/)
        // 提取完整标题：去掉所有标签后取文本，再清理多余空白
        const rawText = li.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const titleMatch = rawText.match(/^\d{2}:\d{2}\s+(.+)$/)
        const countMatch = li.match(/ui-li-count[^>]*>([^<]+)<\/span>/)
        const hrefMatch = li.match(/href="([^"]*)"/)
        if (timeMatch && titleMatch) {
          // 从标题中去掉"直播中"/"回看"等标签文字
          let title = titleMatch[1].trim()
          if (countMatch) title = title.replace(countMatch[1], '').trim()
          epg.push({
            time: timeMatch[1],
            title,
            isLive: countMatch && countMatch[1] === '直播中',
            isLookback: countMatch && countMatch[1] === '回看',
            lookbackUrl: hrefMatch ? hrefMatch[1] : null,
          })
        }
      }
    }

    // ── 提取日期导航 ──
    const dateLinks = []
    const navbarMatch = html.match(/<div\s+data-role=["']navbar["'][^>]*>[\s\S]*?<\/div>/i)
    if (navbarMatch) {
      const btnRegex = /<a[^>]*href="([^"]*)"[^>]*>\s*<span[^>]*>(\d{4}-\d{2}-\d{2})<\/span>/g
      let bm
      while ((bm = btnRegex.exec(navbarMatch[0])) !== null) {
        dateLinks.push({ date: bm[2], url: bm[1] })
      }
    }

    // 频道名称从 channel data 推断
    const allChannels = [...cctvChannelsProxy, ...wsChannelsProxy]
    const ch = allChannels.find(c => c.tid === tid && c.id === id)
    const channelName = ch?.name || `${tid}-${id}`

    const info = {
      channelName,
      tid,
      id,
      lines,
      epg,
      dateLinks,
    }

    iptvCache.set(cacheKey, { data: info, time: now })
    res.json(info)
  } catch (err) {
    console.error('[proxy/iptv/info] Error:', err.message)
    res.status(502).json({ error: '获取频道信息失败', message: err.message })
  }
})

// 本地频道名映射（用于 info API）
const cctvChannelsProxy = [
  { id: '1', name: 'CCTV1 综合', tid: 'ys' }, { id: '2', name: 'CCTV2 财经', tid: 'ys' },
  { id: '3', name: 'CCTV3 综艺', tid: 'ys' }, { id: '4', name: 'CCTV4 中文国际', tid: 'ys' },
  { id: '5', name: 'CCTV5 体育', tid: 'ys' }, { id: '6', name: 'CCTV5+ 体育赛事', tid: 'ys' },
  { id: '7', name: 'CCTV6 电影', tid: 'ys' }, { id: '8', name: 'CCTV7 国防军事', tid: 'ys' },
  { id: '9', name: 'CCTV8 电视剧', tid: 'ys' }, { id: '10', name: 'CCTV9 纪录', tid: 'ys' },
  { id: '11', name: 'CCTV10 科教', tid: 'ys' }, { id: '12', name: 'CCTV11 戏曲', tid: 'ys' },
  { id: '13', name: 'CCTV12 社会与法', tid: 'ys' }, { id: '14', name: 'CCTV13 新闻', tid: 'ys' },
  { id: '15', name: 'CCTV14 少儿', tid: 'ys' }, { id: '16', name: 'CCTV15 音乐', tid: 'ys' },
  { id: '17', name: 'CCTV16 奥林匹克', tid: 'ys' }, { id: '18', name: 'CCTV17 农业农村', tid: 'ys' },
  { id: '19', name: 'CCTV4K 高清', tid: 'ys' }, { id: '20', name: 'CCTV8K 高清', tid: 'ys' },
  { id: '21', name: 'CCTV4 欧洲 HD', tid: 'ys' }, { id: '22', name: 'CCTV4 美洲 HD', tid: 'ys' },
  { id: '23', name: 'CGTN', tid: 'ys' }, { id: '24', name: 'CGTN 纪录', tid: 'ys' },
  { id: '25', name: 'CCTV 阿拉伯语', tid: 'ys' }, { id: '26', name: 'CCTV 法语', tid: 'ys' },
  { id: '27', name: 'CCTV 西班牙语', tid: 'ys' }, { id: '28', name: 'CCTV 俄语', tid: 'ys' },
  { id: '29', name: 'CETV-1', tid: 'ys' }, { id: '30', name: 'CETV-2', tid: 'ys' },
  { id: '31', name: 'CETV-3', tid: 'ys' }, { id: '32', name: 'CETV-4', tid: 'ys' },
  { id: '33', name: 'CCTV 兵器科技', tid: 'ys' }, { id: '34', name: 'CCTV 怀旧剧场', tid: 'ys' },
  { id: '35', name: 'CCTV 第一剧场', tid: 'ys' }, { id: '36', name: 'CCTV 风云剧场', tid: 'ys' },
  { id: '37', name: 'CCTV 风云音乐', tid: 'ys' }, { id: '38', name: 'CCTV 风云足球', tid: 'ys' },
  { id: '39', name: 'CCTV 世界地理', tid: 'ys' }, { id: '40', name: 'CCTV 文化精品', tid: 'ys' },
  { id: '41', name: 'CCTV 央视台球', tid: 'ys' }, { id: '42', name: 'CCTV 高尔夫网球', tid: 'ys' },
  { id: '43', name: 'CCTV 女性时尚', tid: 'ys' },
]
const wsChannelsProxy = [
  { id: '1', name: '湖南卫视', tid: 'ws' }, { id: '2', name: '江苏卫视', tid: 'ws' },
  { id: '3', name: '浙江卫视', tid: 'ws' }, { id: '4', name: '东方卫视', tid: 'ws' },
  { id: '5', name: '北京卫视', tid: 'ws' }, { id: '6', name: '深圳卫视', tid: 'ws' },
  { id: '7', name: '广东卫视', tid: 'ws' }, { id: '8', name: '安徽卫视', tid: 'ws' },
  { id: '9', name: '东南卫视', tid: 'ws' }, { id: '10', name: '河北卫视', tid: 'ws' },
  { id: '11', name: '黑龙江卫视', tid: 'ws' }, { id: '12', name: '湖北卫视', tid: 'ws' },
  { id: '13', name: '江西卫视', tid: 'ws' }, { id: '14', name: '辽宁卫视', tid: 'ws' },
  { id: '15', name: '海南卫视', tid: 'ws' }, { id: '16', name: '山东卫视', tid: 'ws' },
  { id: '17', name: '四川卫视', tid: 'ws' }, { id: '18', name: '天津卫视', tid: 'ws' },
  { id: '19', name: '重庆卫视', tid: 'ws' }, { id: '20', name: '贵州卫视', tid: 'ws' },
  { id: '21', name: '吉林卫视', tid: 'ws' }, { id: '22', name: '广西卫视', tid: 'ws' },
  { id: '23', name: '河南卫视', tid: 'ws' }, { id: '24', name: '甘肃卫视', tid: 'ws' },
  { id: '25', name: '青海卫视', tid: 'ws' }, { id: '26', name: '云南卫视', tid: 'ws' },
  { id: '27', name: '内蒙古卫视', tid: 'ws' }, { id: '28', name: '山西卫视', tid: 'ws' },
  { id: '29', name: '陕西卫视', tid: 'ws' }, { id: '30', name: '兵团卫视', tid: 'ws' },
  { id: '31', name: '新疆卫视', tid: 'ws' }, { id: '32', name: '西藏卫视', tid: 'ws' },
  { id: '33', name: '宁夏卫视', tid: 'ws' }, { id: '34', name: '延边卫视', tid: 'ws' },
  { id: '35', name: '康巴卫视', tid: 'ws' }, { id: '36', name: '大湾区卫视', tid: 'ws' },
  { id: '37', name: '广东珠江频道', tid: 'ws' }, { id: '38', name: '厦门卫视', tid: 'ws' },
  { id: '39', name: '安多卫视', tid: 'ws' }, { id: '40', name: '农林卫视', tid: 'ws' },
  { id: '41', name: '三沙卫视', tid: 'ws' },
]

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
