import { describe, it, expect, beforeEach } from 'vitest'
import { initDatabase, resetDatabase, setWasmUrl } from '@/db/database'
import * as sourcesQueries from '@/db/queries/sources'
import * as channelsQueries from '@/db/queries/channels'
import * as favoritesQueries from '@/db/queries/favorites'
import type { Source } from '@/types/source'
import type { Channel } from '@/types/channel'
import { fileURLToPath } from 'url'
import path from 'path'

// Set WASM URL for Node.js test environment
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
setWasmUrl(path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'))

describe('Database Queries', () => {
  beforeEach(async () => {
    resetDatabase()
    await initDatabase()
  })

  describe('sources queries', () => {
    it('should insert and retrieve a source', () => {
      const source: Source = {
        id: 'test-source-1',
        name: '测试源',
        url: 'http://example.com/live.m3u',
        type: 'url',
        status: 'active',
        channelCount: 10,
        lastUpdateAt: new Date('2026-04-13T10:00:00Z'),
        createdAt: new Date('2026-04-13T09:00:00Z')
      }

      sourcesQueries.insertSource(source)
      const result = sourcesQueries.getSourceById('test-source-1')

      expect(result).not.toBeNull()
      expect(result!.name).toBe('测试源')
      expect(result!.url).toBe('http://example.com/live.m3u')
    })

    it('should return null for non-existent source', () => {
      const result = sourcesQueries.getSourceById('non-existent')
      expect(result).toBeNull()
    })

    it('should update source status', () => {
      const source: Source = {
        id: 'test-source-2',
        name: '测试源2',
        url: 'http://example.com/test.m3u',
        type: 'url',
        status: 'parsing',
        channelCount: 0,
        lastUpdateAt: null,
        createdAt: new Date()
      }

      sourcesQueries.insertSource(source)
      sourcesQueries.updateSourceStatus('test-source-2', 'active')
      const result = sourcesQueries.getSourceById('test-source-2')

      expect(result!.status).toBe('active')
    })

    it('should delete a source', () => {
      const source: Source = {
        id: 'test-source-3',
        name: '测试源3',
        url: 'http://example.com/test3.m3u',
        type: 'url',
        status: 'active',
        channelCount: 5,
        lastUpdateAt: null,
        createdAt: new Date()
      }

      sourcesQueries.insertSource(source)
      sourcesQueries.deleteSource('test-source-3')
      const result = sourcesQueries.getSourceById('test-source-3')

      expect(result).toBeNull()
    })
  })

  describe('channels queries', () => {
    beforeEach(() => {
      const source: Source = {
        id: 'test-source-channels',
        name: '测试源',
        url: 'http://example.com/test.m3u',
        type: 'url',
        status: 'active',
        channelCount: 3,
        lastUpdateAt: null,
        createdAt: new Date()
      }
      sourcesQueries.insertSource(source)
    })

    it('should insert and retrieve channels', () => {
      const channels: Channel[] = [
        {
          id: 'ch-1',
          name: 'CCTV-1',
          url: 'http://example.com/cctv1.m3u8',
          groupId: 'g1',
          groupName: '央视频道',
          sourceId: 'test-source-channels',
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'ch-2',
          name: 'CCTV-2',
          url: 'http://example.com/cctv2.m3u8',
          groupId: 'g1',
          groupName: '央视频道',
          sourceId: 'test-source-channels',
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      channelsQueries.insertChannels(channels)
      const result = channelsQueries.getChannelsBySourceId('test-source-channels')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('CCTV-1')
      expect(result[1].name).toBe('CCTV-2')
    })

    it('should group channels by group name', () => {
      const channels: Channel[] = [
        {
          id: 'ch-3',
          name: 'CCTV-1',
          url: 'http://example.com/cctv1.m3u8',
          groupId: 'g1',
          groupName: '央视频道',
          sourceId: 'test-source-channels',
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'ch-4',
          name: '湖南卫视',
          url: 'http://example.com/hunan.m3u8',
          groupId: 'g2',
          groupName: '卫视频道',
          sourceId: 'test-source-channels',
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      channelsQueries.insertChannels(channels)
      const groups = channelsQueries.getChannelsGroupedByGroup('test-source-channels')

      expect(groups['央视频道']).toHaveLength(1)
      expect(groups['卫视频道']).toHaveLength(1)
    })
  })

  describe('favorites queries', () => {
    beforeEach(() => {
      const source: Source = {
        id: 'test-source-fav',
        name: '测试源',
        url: 'http://example.com/test.m3u',
        type: 'url',
        status: 'active',
        channelCount: 1,
        lastUpdateAt: null,
        createdAt: new Date()
      }
      sourcesQueries.insertSource(source)

      const channel: Channel = {
        id: 'ch-fav-1',
        name: 'CCTV-1',
        url: 'http://example.com/cctv1.m3u8',
        groupId: 'g1',
        groupName: '央视频道',
        sourceId: 'test-source-fav',
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      channelsQueries.insertChannels([channel])
    })

    it('should add and check favorite', () => {
      favoritesQueries.insertFavorite('ch-fav-1')
      const isFav = favoritesQueries.isFavorite('ch-fav-1')
      expect(isFav).toBe(true)
    })

    it('should return false for non-favorite channel', () => {
      const isFav = favoritesQueries.isFavorite('ch-non-existent')
      expect(isFav).toBe(false)
    })

    it('should remove favorite', () => {
      favoritesQueries.insertFavorite('ch-fav-1')
      favoritesQueries.removeFavorite('ch-fav-1')
      const isFav = favoritesQueries.isFavorite('ch-fav-1')
      expect(isFav).toBe(false)
    })

    it('should get all favorite channel ids', () => {
      favoritesQueries.insertFavorite('ch-fav-1')
      const favIds = favoritesQueries.getAllFavoriteChannelIds()
      expect(favIds).toContain('ch-fav-1')
    })
  })
})
