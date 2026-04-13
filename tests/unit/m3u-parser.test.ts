import { describe, it, expect } from 'vitest'
import { parseM3U } from '@/services/m3u-parser'

describe('M3U Parser', () => {
  it('should parse standard M3U format', () => {
    const m3uContent = `#EXTM3U
#EXTINF:-1 tvg-id="CCTV1" tvg-name="CCTV1" tvg-logo="http://example.com/logo.png" group-title="央视频道",CCTV-1 综合
http://example.com/live/cctv1.m3u8
#EXTINF:-1 tvg-id="CCTV2" tvg-name="CCTV2" group-title="央视频道",CCTV-2 财经
http://example.com/live/cctv2.m3u8
#EXTINF:-1 group-title="卫视频道",湖南卫视
http://example.com/live/hunan.m3u8`

    const channels = parseM3U(m3uContent, 'test-source-1')

    expect(channels).toHaveLength(3)
    expect(channels[0].name).toBe('CCTV-1 综合')
    expect(channels[0].url).toBe('http://example.com/live/cctv1.m3u8')
    expect(channels[0].groupName).toBe('央视频道')
    expect(channels[0].tvgId).toBe('CCTV1')
    expect(channels[0].logo).toBe('http://example.com/logo.png')
    expect(channels[1].name).toBe('CCTV-2 财经')
    expect(channels[2].groupName).toBe('卫视频道')
  })

  it('should handle missing EXTINF', () => {
    const m3uContent = `#EXTM3U
http://example.com/live/stream.m3u8`

    const channels = parseM3U(m3uContent, 'test-source-2')

    expect(channels).toHaveLength(1)
    expect(channels[0].url).toBe('http://example.com/live/stream.m3u8')
  })

  it('should handle empty lines and comments', () => {
    const m3uContent = `#EXTM3U
# This is a comment

#EXTINF:-1 group-title="测试",测试频道
http://example.com/test.m3u8

`

    const channels = parseM3U(m3uContent, 'test-source-3')

    expect(channels).toHaveLength(1)
    expect(channels[0].name).toBe('测试频道')
  })

  it('should return empty array for non-M3U content', () => {
    const content = 'This is not M3U content'
    const channels = parseM3U(content, 'test-source-4')
    expect(channels).toHaveLength(0)
  })

  it('should generate unique IDs for channels', () => {
    const m3uContent = `#EXTM3U
#EXTINF:-1 group-title="测试",频道1
http://example.com/1.m3u8
#EXTINF:-1 group-title="测试",频道2
http://example.com/2.m3u8`

    const channels = parseM3U(m3uContent, 'test-source-5')

    expect(channels).toHaveLength(2)
    expect(channels[0].id).not.toBe(channels[1].id)
    expect(channels[0].sourceId).toBe('test-source-5')
  })
})
