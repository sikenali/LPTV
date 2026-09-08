/**
 * 从 WanXiang IPTV.m3u 提取三网1~5 的央视+卫视频道
 * 生成 channels/default.m3u（合并去重）+ 各网络独立文件
 * 同名频道多 URL 自动合并，proxy-server 可自动切换
 */
const https = require('https');

const IPTV_M3U_URL = 'https://gh-proxy.org/https://raw.githubusercontent.com/AudiHub/WanXiang-Release/main/IPTV.m3u';
const OUTPUT_DIR = 'channels';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

function sanitizeChannelName(name) {
  return name.trim()
    .replace(/^🔥\[三网\d+\]/, '')
    .replace(/[·\-]$/, '')
    .replace(/\s+/g, ' ');
}

function normalizeChannelName(name) {
  return name
    .toLowerCase()
    .replace(/[\s\-\··]/g, '')
    .replace(/央视频道/g, '')
    .replace(/卫视/g, 'ws')
    .replace(/cgtn/g, 'cgtn')
    .replace(/cetv/g, 'cetv')
    .replace(/chc/g, 'chc');
}

function extractFromRaw(raw) {
  const lines = raw.split('\n');
  const entries = [];
  let currentExtinf = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const namePart = line.split(',').pop() || '';
      currentExtinf = {
        groupTitle: groupMatch ? groupMatch[1] : '',
        tvgName: tvgNameMatch ? tvgNameMatch[1] : namePart,
        tvgLogo: tvgLogoMatch ? tvgLogoMatch[1] : '',
        rawName: namePart.trim(),
      };
    } else if (line.startsWith('http') && currentExtinf) {
      const group = currentExtinf.groupTitle;
      if (/三网[1-5]/.test(group)) {
        const chName = sanitizeChannelName(currentExtinf.rawName);
        entries.push({
          name: chName,
          normName: normalizeChannelName(chName),
          url: line,
          logo: currentExtinf.tvgLogo,
          group: '央视频道',
          network: group.match(/三网(\d)/)?.[1] || '?',
        });
      }
      currentExtinf = null;
    }
  }
  return entries;
}

function mergeEntries(entries) {
  const merged = new Map();
  for (const entry of entries) {
    const key = entry.normName;
    if (!merged.has(key)) {
      merged.set(key, { ...entry, urls: [entry.url], firstLogo: entry.logo, network: entry.network, networks: [entry.network] });
    } else {
      const existing = merged.get(key);
      if (!existing.urls.includes(entry.url)) {
        existing.urls.push(entry.url);
      }
      if (!existing.networks.includes(entry.network)) {
        existing.networks.push(entry.network);
      }
    }
  }
  return merged;
}

function sortByNetworkOrder(sorted) {
  const networkOrder = ['1', '2', '3', '4', '5'];
  return sorted.sort((a, b) => {
    const na = networkOrder.indexOf(a.network);
    const nb = networkOrder.indexOf(b.network);
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

function writeM3u(outputPath, items, sourceLabel) {
  const fs = require('fs');
  let output = '#EXTM3U\n';
  output += `# Generated-Time: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} CST\n`;
  output += `# Source: WanXiang-Release ${sourceLabel}\n`;
  output += `# Channel-Count: ${items.length}\n`;
  for (const item of items) {
    const logoAttr = item.firstLogo ? `tvg-logo="${item.firstLogo}"` : '';
    output += `#EXTINF:-1 group-title="${item.group}" tvg-name="${item.name}" ${logoAttr},${item.name}\n`;
    output += `${item.urls[0]}\n`;
    for (let i = 1; i < item.urls.length; i++) {
      output += `#EXTINF:-1 group-title="${item.group}" tvg-name="${item.name}",${item.name}\n`;
      output += `${item.urls[i]}\n`;
    }
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`  ${outputPath}: ${items.length} channels`);
}

async function main() {
  console.log('Fetching WanXiang IPTV.m3u...');
  const raw = await fetchText(IPTV_M3U_URL);

  const ALL_NETWORKS = ['1', '2', '3', '4', '5'];
  const allEntries = [];
  const networkEntries = {};

  for (const net of ALL_NETWORKS) {
    const entries = extractFromRaw(raw).filter(e => e.network === net);
    networkEntries[net] = entries;
    allEntries.push(...entries);
    console.log(`  三网${net}: ${entries.length} channels`);
  }

  const merged = mergeEntries(allEntries);
  const sorted = sortByNetworkOrder([...merged.values()]);

  writeM3u(`${OUTPUT_DIR}/default.m3u`, sorted, '三网1~5 合并');

  for (const net of ALL_NETWORKS) {
    const netMerged = mergeEntries(networkEntries[net]);
    const netSorted = sortByNetworkOrder([...netMerged.values()]);
    writeM3u(`${OUTPUT_DIR}/default-${net}.m3u`, netSorted, `三网${net}`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
