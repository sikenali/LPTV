import type { Channel } from '@/types/channel'

export function exportToM3U(channels: Channel[]): string {
  let output = '#EXTM3U\n'

  for (const ch of channels) {
    const tvgId = ch.tvgId || ''
    const tvgName = ch.tvgName || ch.name
    const logo = ch.logo || ''
    const groupName = ch.groupName || ''

    output += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupName}",${ch.name}\n`
    output += `${ch.url}\n`
  }

  return output
}

export function downloadM3U(content: string, filename: string = 'iptv.m3u') {
  const blob = new Blob([content], { type: 'audio/x-mpegurl' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportAsTxt(channels: Channel[]): string {
  let output = ''

  for (const ch of channels) {
    output += `${ch.groupName || '其他'},${ch.name},${ch.url}\n`
  }

  return output
}

export function downloadTxt(content: string, filename: string = 'iptv.txt') {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
