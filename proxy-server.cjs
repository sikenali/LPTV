const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3000
const M3U_URL = 'https://raw.githubusercontent.com/zilong7728/Collect-IPTV/refs/heads/main/best_sorted.m3u8'
const CACHE_TTL = 5 * 60 * 1000

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`LPTV proxy server running on port ${PORT}`)
})
