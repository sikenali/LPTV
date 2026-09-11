#!/usr/bin/env node
/**
 * 345iptv 频道列表爬虫
 * 抓取央视(ys)和卫视(ws)频道列表，生成 iptvStreams.json
 * 用于 GitHub Actions 每日自动更新
 */

const https = require('https');

const CATEGORIES = [
  { tid: 'ys', name: '央视', limit: 18 },
  { tid: 'ws', name: '卫视', limit: 41 },
];

const BASE_URL = 'https://www.345iptv.com';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseChannels(html, tid, category, limit) {
  const channels = [];
  // Match: <li><a href="?act=play&tid=ys&id=1">CCTV1综合</a></li>
  const regex = /<li><a href="\?act=play&tid=[^"]*&id=(\d+)"[^>]*>([^<]+)<\/a><\/li>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (channels.length >= limit) break;
    const id = match[1];
    const name = match[2].trim();
    if (name && id) {
      channels.push({
        name,
        category,
        site: '345iptv',
        id,
        tid,
        streams: [`${BASE_URL}/?act=play&tid=${tid}&id=${id}`],
      });
    }
  }
  return channels;
}

async function main() {
  console.log('[scraper] fetching channel lists...');
  let allChannels = [];

  for (const cat of CATEGORIES) {
    const url = `${BASE_URL}/?tid=${cat.tid}`;
    console.log(`[scraper] fetching ${cat.name} (${cat.tid})...`);
    try {
      const html = await fetch(url);
      const channels = parseChannels(html, cat.tid, cat.name, cat.limit);
      console.log(`[scraper]   found ${channels.length} channels`);
      allChannels = allChannels.concat(channels);
    } catch (e) {
      console.error(`[scraper]   failed: ${e.message}`);
    }
  }

  if (allChannels.length === 0) {
    console.error('[scraper] ERROR: no channels found');
    process.exit(1);
  }

  const output = {
    scrapedAt: new Date().toISOString(),
    channels: allChannels,
  };

  const fs = require('fs');
  const outPath = process.argv[2] || 'scripts/data/iptvStreams.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[scraper] saved ${allChannels.length} channels to ${outPath}`);
  console.log(`[scraper]   央视: ${allChannels.filter(c => c.category === '央视').length}`);
  console.log(`[scraper]   卫视: ${allChannels.filter(c => c.category === '卫视').length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
