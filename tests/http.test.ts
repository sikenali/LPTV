import { describe, it, expect } from 'vitest'
import { isExternalUrl } from '@/services/http'

describe('URL 转换逻辑', () => {
  describe('isExternalUrl', () => {
    it('识别 http 开头的 URL', () => {
      expect(isExternalUrl('http://example.com/file.m3u8')).toBe(true)
    })

    it('识别 https 开头的 URL', () => {
      expect(isExternalUrl('https://example.com/file.m3u8')).toBe(true)
    })

    it('不识别相对路径', () => {
      expect(isExternalUrl('/api/data')).toBe(false)
      expect(isExternalUrl('./file.m3u8')).toBe(false)
      expect(isExternalUrl('../file.m3u8')).toBe(false)
    })
  })
})
