/**
 * 从 fanmingming CDN 并行下载频道台标到本地 logos/ 目录
 * 用法:
 *   npm run fetch-logos          # 智能模式：只下载缺失的
 *   npm run fetch-logos:force    # 强制重新下载所有
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const LOGO_DIR = path.join(__dirname, '..', 'logos')
const M3U_PATH = path.join(__dirname, '..', 'channels', 'lptv.m3u8')
const FANMINGMING_BASE = 'https://raw.githubusercontent.com/fanmingming/live/main/tv'
const CONCURRENCY = 20  // 并发数
const TIMEOUT = 10000

const FORCE = process.argv.includes('--force')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT)
    const file = fs.createWriteStream(dest)
    https.get(url, { timeout: TIMEOUT }, resp => {
      clearTimeout(timer)
      if (resp.statusCode === 301 || resp.statusCode === 302) {
        file.destroy()
        download(resp.headers.location, dest).then(resolve).catch(reject)
        return
      }
      if (resp.statusCode !== 200) {
        file.destroy()
        reject(new Error(`HTTP ${resp.statusCode}`))
        return
      }
      resp.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', err => { file.destroy(); clearTimeout(timer); reject(err) })
  })
}

function safeName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_').trim()
}

// 尝试多种命名变体
async function tryDownload(channelName, dest) {
  const variants = [
    `${FANMINGMING_BASE}/${safeName(channelName)}.png`,
    `${FANMINGMING_BASE}/${safeName(channelName).replace(/[\s\-·]/g, '')}.png`,
    `${FANMINGMING_BASE}/${channelName.replace('CCTV-', 'CCTV')}.png`,
  ]
  for (const url of variants) {
    try { await download(url, dest); return true } catch {}
  }
  return false
}

// 并发控制
async function concurrentMap(items, fn, limit) {
  const results = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function main() {
  ensureDir(LOGO_DIR)

  let m3uContent = ''
  try {
    m3uContent = fs.readFileSync(M3U_PATH, 'utf-8')
  } catch {
    console.log('[fetch-logos] channels/lptv.m3u8 not found locally')
    process.exit(1)
  }

  // 提取频道名称
  const lines = m3uContent.split('\n')
  const channels = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#EXTINF')) {
      const parts = trimmed.split(',')
      if (parts.length >= 2) {
        const name = parts[parts.length - 1].trim()
        if (name && !channels.includes(name)) channels.push(name)
      }
    }
  }

  console.log(`[fetch-logos] Found ${channels.length} unique channels`)

  const existing = new Set(fs.readdirSync(LOGO_DIR).filter(f => f.endsWith('.png')))
  const toDownload = FORCE
    ? channels
    : channels.filter(n => !existing.has(safeName(n) + '.png'))

  console.log(`[fetch-logos] Downloading ${toDownload.length} logos (${existing.size} already exist)`)

  const results = await concurrentMap(toDownload, async (name) => {
    const dest = path.join(LOGO_DIR, safeName(name) + '.png')
    return tryDownload(name, dest)
  }, CONCURRENCY)

  const downloaded = results.filter(Boolean).length
  const failed = toDownload.length - downloaded
  console.log(`[fetch-logos] Done: ${downloaded} downloaded, ${failed} failed`)
  console.log(`[fetch-logos] Total in ${LOGO_DIR}: ${fs.readdirSync(LOGO_DIR).length} files`)
}

main().catch(err => { console.error(err); process.exit(1) })
