# LPTV 电视直播播放器 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 构建一个现代简洁的电视直播播放类 Web 应用，支持频道浏览、收藏管理和直播源配置

**架构：** 采用 Vue 3 + TypeScript + Vite 单页应用架构，Pinia 状态管理，SQLite (sql.js) 本地存储，DPlayer + Hls.js 视频播放。整体分为顶部导航栏、左侧功能菜单/列表区、右侧主内容区三大区域。

**技术栈：** Vue 3, TypeScript, Vite, Pinia, Vue Router, DPlayer, Hls.js, sql.js, SCSS, Vitest

---

## 文件结构

### 新增文件清单

**配置与入口：**
- `package.json` - 项目依赖配置
- `vite.config.ts` - Vite 构建配置
- `tsconfig.json` - TypeScript 配置
- `index.html` - HTML 入口
- `src/main.ts` - 应用入口
- `src/App.vue` - 根组件

**类型定义：**
- `src/types/channel.d.ts` - 频道类型定义
- `src/types/source.d.ts` - 直播源类型定义
- `src/types/player.d.ts` - 播放器类型定义

**数据库层：**
- `src/db/database.ts` - SQLite 数据库初始化
- `src/db/queries/sources.ts` - 直播源 CRUD 操作
- `src/db/queries/channels.ts` - 频道 CRUD 操作
- `src/db/queries/favorites.ts` - 收藏 CRUD 操作
- `src/db/queries/updateRules.ts` - 更新规则 CRUD 操作

**服务层：**
- `src/services/m3u-parser.ts` - M3U/M3U8 解析服务
- `src/services/http.ts` - HTTP 请求封装
- `src/services/scheduler.ts` - 定时更新调度器

**状态管理：**
- `src/stores/channel.ts` - 频道状态管理
- `src/stores/favorite.ts` - 收藏状态管理
- `src/stores/source.ts` - 直播源状态管理
- `src/stores/player.ts` - 播放器状态管理

**组件：**
- `src/components/TopNavbar.vue` - 顶部导航栏
- `src/components/ChannelGroup.vue` - 频道分组（折叠/展开）
- `src/components/ChannelItem.vue` - 频道列表项
- `src/components/VideoPlayer.vue` - 视频播放器封装
- `src/components/FavoriteCard.vue` - 收藏卡片
- `src/components/SourceItem.vue` - 源列表项
- `src/components/EmptyState.vue` - 空白占位提示
- `src/components/ImportSourceModal.vue` - 导入源弹窗

**视图：**
- `src/views/ChannelView.vue` - 频道界面
- `src/views/FavoriteView.vue` - 收藏界面
- `src/views/SettingsView.vue` - 设置界面

**样式：**
- `src/styles/variables.scss` - 设计变量
- `src/styles/global.scss` - 全局样式重置

**静态资源：**
- `public/logo.svg` - 品牌 Logo

**测试：**
- `tests/unit/m3u-parser.test.ts` - M3U 解析单元测试
- `tests/unit/http.test.ts` - HTTP 服务单元测试
- `tests/unit/db-queries.test.ts` - 数据库查询单元测试
- `tests/unit/stores.test.ts` - 状态管理单元测试
- `tests/components/ChannelGroup.test.ts` - 频道分组组件测试
- `tests/components/FavoriteCard.test.ts` - 收藏卡片组件测试
- `vitest.config.ts` - Vitest 配置

---

## 任务 1：项目初始化

**文件：**
- 创建：`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- 创建：`src/main.ts`, `src/App.vue`
- 创建：`vitest.config.ts`

- [ ] **步骤 1：创建 package.json**

```json
{
  "name": "lptv",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.0",
    "sql.js": "^1.10.0",
    "dplayer": "^1.27.0",
    "hls.js": "^1.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.1.0",
    "vue-tsc": "^1.8.0",
    "typescript": "^5.3.0",
    "sass": "^1.70.0",
    "vitest": "^1.3.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^24.0.0",
    "@types/sql.js": "^1.4.9"
  }
}
```

- [ ] **步骤 2：运行 npm install 安装依赖**

```bash
npm install
```

预期：所有依赖安装成功，无报错

- [ ] **步骤 3：创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'dplayer': ['dplayer', 'hls.js']
        }
      }
    }
  }
})
```

- [ ] **步骤 4：创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **步骤 5：创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **步骤 6：创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LPTV - 电视直播播放器</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **步骤 7：创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
})
```

- [ ] **步骤 8：创建 src/main.ts**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/global.scss'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **步骤 9：创建 src/router/index.ts**

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import ChannelView from '@/views/ChannelView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'channel',
      component: ChannelView
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: () => import('@/views/FavoriteView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    }
  ]
})

export default router
```

- [ ] **步骤 10：创建 src/App.vue**

```vue
<script setup lang="ts">
import TopNavbar from '@/components/TopNavbar.vue'
</script>

<template>
  <div class="app">
    <TopNavbar />
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>
</template>

<style scoped lang="scss">
.app {
  min-height: 100vh;
  background-color: var(--bg-primary);
}

.app-main {
  padding-top: 60px;
  height: 100vh;
  overflow: hidden;
}
</style>
```

- [ ] **步骤 11：运行 TypeScript 检查确认无报错**

```bash
npx vue-tsc --noEmit
```

预期：PASS，类型检查通过，无报错

- [ ] **步骤 12：Commit**

```bash
git add package.json vite.config.ts tsconfig.json tsconfig.node.json index.html vitest.config.ts src/main.ts src/router/index.ts src/App.vue
git commit -m "feat: 初始化项目脚手架"
```

---

## 任务 2：类型定义

**文件：**
- 创建：`src/types/channel.d.ts`
- 创建：`src/types/source.d.ts`
- 创建：`src/types/player.d.ts`

- [ ] **步骤 1：创建 src/types/channel.d.ts**

```typescript
export interface Channel {
  id: string
  name: string
  url: string
  groupId: string
  groupName: string
  logo?: string
  tvgId?: string
  tvgName?: string
  isFavorite: boolean
  sourceId: string
  createdAt: Date
  updatedAt: Date
}

export interface ChannelGroup {
  id: string
  name: string
  channels: Channel[]
  isExpanded: boolean
}
```

- [ ] **步骤 2：创建 src/types/source.d.ts**

```typescript
export type SourceType = 'url' | 'file'
export type SourceStatus = 'active' | 'error' | 'parsing'
export type IntervalUnit = 'minute' | 'hour' | 'day' | 'week'

export interface Source {
  id: string
  name: string
  url: string
  type: SourceType
  status: SourceStatus
  channelCount: number
  lastUpdateAt: Date | null
  lastError?: string
  createdAt: Date
}

export interface UpdateRule {
  id: string
  sourceId: string
  interval: number
  intervalUnit: IntervalUnit
  nextUpdateAt: Date
  enabled: boolean
}
```

- [ ] **步骤 3：创建 src/types/player.d.ts**

```typescript
export interface PlayerState {
  isPlaying: boolean
  currentUrl: string | null
  error: string | null
  volume: number
  muted: boolean
  loading: boolean
}
```

- [ ] **步骤 4：运行 TypeScript 检查确认无报错**

```bash
npx vue-tsc --noEmit
```

预期：PASS，类型定义无报错

- [ ] **步骤 5：Commit**

```bash
git add src/types/channel.d.ts src/types/source.d.ts src/types/player.d.ts
git commit -m "feat: 添加类型定义"
```

---

## 任务 3：数据库层

**文件：**
- 创建：`src/db/database.ts`
- 创建：`src/db/queries/sources.ts`
- 创建：`src/db/queries/channels.ts`
- 创建：`src/db/queries/favorites.ts`
- 创建：`src/db/queries/updateRules.ts`
- 测试：`tests/unit/db-queries.test.ts`

- [ ] **步骤 1：编写数据库初始化代码 src/db/database.ts**

```typescript
import initSqlJs, { type Database } from 'sql.js'

let db: Database | null = null

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('url', 'file')),
    status TEXT NOT NULL DEFAULT 'parsing',
    channel_count INTEGER DEFAULT 0,
    last_update_at DATETIME,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    logo TEXT,
    tvg_id TEXT,
    tvg_name TEXT,
    source_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_channels_group ON channels(group_id);
  CREATE INDEX IF NOT EXISTS idx_channels_source ON channels(source_id);

  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL UNIQUE,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_favorites_channel ON favorites(channel_id);

  CREATE TABLE IF NOT EXISTS update_rules (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL UNIQUE,
    interval INTEGER NOT NULL,
    interval_unit TEXT NOT NULL CHECK(interval_unit IN ('minute', 'hour', 'day', 'week')),
    next_update_at DATETIME NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  );
`

export async function initDatabase(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`
  })

  db = new SQL.Database()
  db.run(SCHEMA_SQL)

  return db
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}
```

- [ ] **步骤 2：编写源查询操作 src/db/queries/sources.ts**

```typescript
import { getDatabase } from '@/db/database'
import type { Source, SourceStatus } from '@/types/source'

export function insertSource(source: Source): void {
  const db = getDatabase()
  db.run(
    `INSERT INTO sources (id, name, url, type, status, channel_count, last_update_at, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      source.id,
      source.name,
      source.url,
      source.type,
      source.status,
      source.channelCount,
      source.lastUpdateAt?.toISOString() ?? null,
      source.lastError ?? null,
      source.createdAt.toISOString()
    ]
  )
}

export function updateSourceStatus(id: string, status: SourceStatus, lastError?: string): void {
  const db = getDatabase()
  db.run(
    `UPDATE sources SET status = ?, last_error = ? WHERE id = ?`,
    [status, lastError ?? null, id]
  )
}

export function updateSourceChannelCount(id: string, count: number): void {
  const db = getDatabase()
  db.run(
    `UPDATE sources SET channel_count = ? WHERE id = ?`,
    [count, id]
  )
}

export function updateSourceLastUpdateAt(id: string, date: Date): void {
  const db = getDatabase()
  db.run(
    `UPDATE sources SET last_update_at = ? WHERE id = ?`,
    [date.toISOString(), id]
  )
}

export function getAllSources(): Source[] {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM sources ORDER BY created_at DESC')

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    return {
      id: obj.id as string,
      name: obj.name as string,
      url: obj.url as string,
      type: obj.type as 'url' | 'file',
      status: obj.status as SourceStatus,
      channelCount: obj.channel_count as number,
      lastUpdateAt: obj.last_update_at ? new Date(obj.last_update_at as string) : null,
      lastError: obj.last_error as string | undefined,
      createdAt: new Date(obj.created_at as string)
    }
  })
}

export function getSourceById(id: string): Source | null {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM sources WHERE id = ?', [id])

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))

  return {
    id: obj.id as string,
    name: obj.name as string,
    url: obj.url as string,
    type: obj.type as 'url' | 'file',
    status: obj.status as SourceStatus,
    channelCount: obj.channel_count as number,
    lastUpdateAt: obj.last_update_at ? new Date(obj.last_update_at as string) : null,
    lastError: obj.last_error as string | undefined,
    createdAt: new Date(obj.created_at as string)
  }
}

export function deleteSource(id: string): void {
  const db = getDatabase()
  db.run('DELETE FROM sources WHERE id = ?', [id])
}
```

- [ ] **步骤 3：编写频道查询操作 src/db/queries/channels.ts**

```typescript
import { getDatabase } from '@/db/database'
import type { Channel } from '@/types/channel'

export function insertChannels(channels: Channel[]): void {
  const db = getDatabase()
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO channels 
     (id, name, url, group_id, group_name, logo, tvg_id, tvg_name, source_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  for (const ch of channels) {
    stmt.run([
      ch.id,
      ch.name,
      ch.url,
      ch.groupId,
      ch.groupName,
      ch.logo ?? null,
      ch.tvgId ?? null,
      ch.tvgName ?? null,
      ch.sourceId,
      ch.createdAt.toISOString(),
      ch.updatedAt.toISOString()
    ])
  }

  stmt.free()
}

export function getChannelsBySourceId(sourceId: string): Channel[] {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM channels WHERE source_id = ? ORDER BY group_id, name', [sourceId])

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  return mapResultToChannels(result[0])
}

export function getChannelsGroupedByGroup(sourceId: string): Record<string, Channel[]> {
  const channels = getChannelsBySourceId(sourceId)
  const groups: Record<string, Channel[]> = {}

  for (const ch of channels) {
    if (!groups[ch.groupName]) {
      groups[ch.groupName] = []
    }
    groups[ch.groupName].push(ch)
  }

  return groups
}

export function getChannelById(id: string): Channel | null {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM channels WHERE id = ?', [id])

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  return mapResultToChannel(result[0].columns, result[0].values[0])
}

export function deleteChannelsBySourceId(sourceId: string): void {
  const db = getDatabase()
  db.run('DELETE FROM channels WHERE source_id = ?', [sourceId])
}

function mapResultToChannels(result: { columns: string[]; values: any[][] }): Channel[] {
  return result.values.map(row => mapResultToChannel(result.columns, row))
}

function mapResultToChannel(columns: string[], row: any[]): Channel {
  const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  return {
    id: obj.id as string,
    name: obj.name as string,
    url: obj.url as string,
    groupId: obj.group_id as string,
    groupName: obj.group_name as string,
    logo: obj.logo as string | undefined,
    tvgId: obj.tvg_id as string | undefined,
    tvgName: obj.tvg_name as string | undefined,
    isFavorite: false,
    sourceId: obj.source_id as string,
    createdAt: new Date(obj.created_at as string),
    updatedAt: new Date(obj.updated_at as string)
  }
}
```

- [ ] **步骤 4：编写收藏查询操作 src/db/queries/favorites.ts**

```typescript
import { getDatabase } from '@/db/database'

export function insertFavorite(channelId: string): void {
  const db = getDatabase()
  db.run('INSERT OR IGNORE INTO favorites (id, channel_id, added_at) VALUES (?, ?, ?)', [
    `fav_${channelId}`,
    channelId,
    new Date().toISOString()
  ])
}

export function removeFavorite(channelId: string): void {
  const db = getDatabase()
  db.run('DELETE FROM favorites WHERE channel_id = ?', [channelId])
}

export function getAllFavoriteChannelIds(): string[] {
  const db = getDatabase()
  const result = db.exec('SELECT channel_id FROM favorites ORDER BY added_at DESC')

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  return result[0].values.map(row => row[0] as string)
}

export function isFavorite(channelId: string): boolean {
  const db = getDatabase()
  const result = db.exec('SELECT 1 FROM favorites WHERE channel_id = ?', [channelId])
  return result.length > 0 && result[0].values.length > 0
}
```

- [ ] **步骤 5：编写更新规则查询操作 src/db/queries/updateRules.ts**

```typescript
import { getDatabase } from '@/db/database'
import type { UpdateRule, IntervalUnit } from '@/types/source'

export function insertUpdateRule(rule: UpdateRule): void {
  const db = getDatabase()
  db.run(
    `INSERT OR REPLACE INTO update_rules 
     (id, source_id, interval, interval_unit, next_update_at, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      rule.id,
      rule.sourceId,
      rule.interval,
      rule.intervalUnit,
      rule.nextUpdateAt.toISOString(),
      rule.enabled ? 1 : 0
    ]
  )
}

export function getUpdateRuleBySourceId(sourceId: string): UpdateRule | null {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM update_rules WHERE source_id = ?', [sourceId])

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))

  return {
    id: obj.id as string,
    sourceId: obj.source_id as string,
    interval: obj.interval as number,
    intervalUnit: obj.interval_unit as IntervalUnit,
    nextUpdateAt: new Date(obj.next_update_at as string),
    enabled: (obj.enabled as number) === 1
  }
}

export function getAllEnabledUpdateRules(): UpdateRule[] {
  const db = getDatabase()
  const result = db.exec('SELECT * FROM update_rules WHERE enabled = 1')

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    return {
      id: obj.id as string,
      sourceId: obj.source_id as string,
      interval: obj.interval as number,
      intervalUnit: obj.interval_unit as IntervalUnit,
      nextUpdateAt: new Date(obj.next_update_at as string),
      enabled: (obj.enabled as number) === 1
    }
  })
}

export function updateRuleNextUpdateAt(sourceId: string, date: Date): void {
  const db = getDatabase()
  db.run('UPDATE update_rules SET next_update_at = ? WHERE source_id = ?', [
    date.toISOString(),
    sourceId
  ])
}

export function deleteUpdateRule(sourceId: string): void {
  const db = getDatabase()
  db.run('DELETE FROM update_rules WHERE source_id = ?', [sourceId])
}
```

- [ ] **步骤 6：编写数据库查询测试 tests/unit/db-queries.test.ts**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { initDatabase } from '@/db/database'
import * as sourcesQueries from '@/db/queries/sources'
import * as channelsQueries from '@/db/queries/channels'
import * as favoritesQueries from '@/db/queries/favorites'
import type { Source } from '@/types/source'
import type { Channel } from '@/types/channel'

describe('Database Queries', () => {
  beforeEach(async () => {
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
```

- [ ] **步骤 7：运行测试验证失败**

```bash
npm run test:run -- tests/unit/db-queries.test.ts
```

预期：部分测试可能失败（如果数据库初始化有问题），检查报错

- [ ] **步骤 8：运行测试验证通过**

```bash
npm run test:run -- tests/unit/db-queries.test.ts
```

预期：所有测试 PASS

- [ ] **步骤 9：Commit**

```bash
git add src/db/ src/types/ tests/unit/db-queries.test.ts
git commit -m "feat: 实现数据库层和查询操作"
```

---

## 任务 4：M3U 解析服务

**文件：**
- 创建：`src/services/m3u-parser.ts`
- 测试：`tests/unit/m3u-parser.test.ts`

- [ ] **步骤 1：编写失败的测试 tests/unit/m3u-parser.test.ts**

```typescript
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
    expect(channels[0].name).toContain('stream.m3u8')
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npm run test:run -- tests/unit/m3u-parser.test.ts
```

预期：FAIL，报错 "parseM3U not defined" 或模块不存在

- [ ] **步骤 3：实现 M3U 解析服务 src/services/m3u-parser.ts**

```typescript
import type { Channel } from '@/types/channel'

interface ExtInfo {
  duration: number
  tvgId?: string
  tvgName?: string
  tvgLogo?: string
  groupTitle?: string
  name: string
}

export function parseM3U(content: string, sourceId: string): Channel[] {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

  if (!lines[0]?.startsWith('#EXTM3U')) {
    return []
  }

  const channels: Channel[] = []
  let currentExtInfo: ExtInfo | null = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('#EXTINF:')) {
      currentExtInfo = parseExtInfo(line)
    } else if (line.startsWith('#')) {
      continue
    } else if (currentExtInfo) {
      const channel = createChannel(currentExtInfo, line, sourceId)
      channels.push(channel)
      currentExtInfo = null
    } else if (!line.startsWith('#')) {
      const channel = createChannelFromUrl(line, sourceId)
      channels.push(channel)
    }
  }

  return channels
}

function parseExtInfo(line: string): ExtInfo {
  const match = line.match(/^#EXTINF:(-?\d+)\s*(.*),(.*)$/)
  if (!match) {
    return { duration: -1, name: 'Unknown' }
  }

  const duration = parseInt(match[1], 10)
  const attributes = match[2]
  const name = match[3].trim()

  const tvgIdMatch = attributes.match(/tvg-id="([^"]*)"/)
  const tvgNameMatch = attributes.match(/tvg-name="([^"]*)"/)
  const tvgLogoMatch = attributes.match(/tvg-logo="([^"]*)"/)
  const groupTitleMatch = attributes.match(/group-title="([^"]*)"/)

  return {
    duration,
    tvgId: tvgIdMatch?.[1],
    tvgName: tvgNameMatch?.[1],
    tvgLogo: tvgLogoMatch?.[1],
    groupTitle: groupTitleMatch?.[1] || '未分组',
    name: name || 'Unknown'
  }
}

function createChannel(extInfo: ExtInfo, url: string, sourceId: string): Channel {
  const now = new Date()
  const groupId = extInfo.groupTitle || '未分组'

  return {
    id: `ch_${sourceId}_${Buffer.from(url).toString('base64').substring(0, 16)}`,
    name: extInfo.name,
    url,
    groupId,
    groupName: extInfo.groupTitle || '未分组',
    logo: extInfo.tvgLogo,
    tvgId: extInfo.tvgId,
    tvgName: extInfo.tvgName,
    isFavorite: false,
    sourceId,
    createdAt: now,
    updatedAt: now
  }
}

function createChannelFromUrl(url: string, sourceId: string): Channel {
  const now = new Date()
  const name = url.split('/').pop() || url

  return {
    id: `ch_${sourceId}_${Buffer.from(url).toString('base64').substring(0, 16)}`,
    name,
    url,
    groupId: '未分组',
    groupName: '未分组',
    isFavorite: false,
    sourceId,
    createdAt: now,
    updatedAt: now
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
npm run test:run -- tests/unit/m3u-parser.test.ts
```

预期：所有测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/services/m3u-parser.ts tests/unit/m3u-parser.test.ts
git commit -m "feat: 实现 M3U 解析服务"
```

---

## 任务 5：HTTP 服务

**文件：**
- 创建：`src/services/http.ts`
- 测试：`tests/unit/http.test.ts`

- [ ] **步骤 1：编写失败的测试 tests/unit/http.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry } from '@/services/http'

describe('HTTP Service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should fetch successfully on first try', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('#EXTM3U\ntest content')
    })

    const result = await fetchWithRetry('http://example.com/test.m3u')
    expect(result).toBe('#EXTM3U\ntest content')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed on second try', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('success')
      })

    const promise = fetchWithRetry('http://example.com/test.m3u', { retries: 1 })

    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(result).toBe('success')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should throw after max retries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(fetchWithRetry('http://example.com/test.m3u', { retries: 2, baseDelay: 10 }))
      .rejects.toThrow('Network error')

    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('should timeout after specified duration', async () => {
    global.fetch = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ ok: true, text: () => Promise.resolve('slow') }), 5000))
    )

    await expect(fetchWithRetry('http://example.com/slow.m3u', { timeout: 100 }))
      .rejects.toThrow('请求超时')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npm run test:run -- tests/unit/http.test.ts
```

预期：FAIL，模块不存在

- [ ] **步骤 3：实现 HTTP 服务 src/services/http.ts**

```typescript
interface FetchOptions {
  retries?: number
  timeout?: number
  baseDelay?: number
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const {
    retries = 3,
    timeout = 30000,
    baseDelay = 1000
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.text()
    } catch (error: any) {
      lastError = error

      if (error.name === 'AbortError') {
        throw new Error('请求超时')
      }

      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError ?? new Error('Unknown error')
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
npm run test:run -- tests/unit/http.test.ts
```

预期：所有测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/services/http.ts tests/unit/http.test.ts
git commit -m "feat: 实现 HTTP 请求服务"
```

---

## 任务 6：全局样式

**文件：**
- 创建：`src/styles/variables.scss`
- 创建：`src/styles/global.scss`

- [ ] **步骤 1：创建 src/styles/variables.scss**

```scss
:root {
  // 背景色
  --bg-primary: #141414;
  --bg-secondary: #1f1f1f;
  --bg-card: #2a2a2a;

  // 边框
  --border-color: #333333;

  // 文字
  --text-primary: #ffffff;
  --text-secondary: #999999;
  --text-disabled: #666666;

  // 品牌色
  --brand-primary: #3b82f6;
  --brand-hover: #60a5fa;

  // 状态色
  --favorite: #ef4444;
  --success: #22c55e;
  --error: #ef4444;
  --warning: #eab308;

  // 字号
  --font-size-title: 20px;
  --font-size-subtitle: 16px;
  --font-size-body: 14px;
  --font-size-caption: 12px;

  // 圆角
  --radius-sm: 6px;
  --radius-md: 8px;

  // 阴影
  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-modal: 0 8px 32px rgba(0, 0, 0, 0.4);

  // 过渡
  --transition-fast: 200ms ease;
  --transition-normal: 300ms ease;

  // 间距
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
}
```

- [ ] **步骤 2：创建 src/styles/global.scss**

```scss
@import './variables.scss';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: var(--font-size-body);
  color: var(--text-primary);
  background-color: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100%;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;

  &:hover {
    background: #555;
  }
}

button {
  cursor: pointer;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: inherit;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

input {
  font-family: inherit;
  outline: none;
}
```

- [ ] **步骤 3：运行 TypeScript 检查确认无报错**

```bash
npx vue-tsc --noEmit
```

预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/styles/variables.scss src/styles/global.scss
git commit -m "feat: 添加全局样式和设计变量"
```

---

## 任务 7：状态管理 (Pinia Stores)

**文件：**
- 创建：`src/stores/channel.ts`
- 创建：`src/stores/favorite.ts`
- 创建：`src/stores/source.ts`
- 创建：`src/stores/player.ts`
- 测试：`tests/unit/stores.test.ts`

- [ ] **步骤 1：编写失败的测试 tests/unit/stores.test.ts**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFavoriteStore } from '@/stores/favorite'

describe('Pinia Stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('favoriteStore', () => {
    it('should initialize with empty favorites', () => {
      const store = useFavoriteStore()
      expect(store.favorites).toEqual([])
      expect(store.loading).toBe(false)
    })

    it('should add favorite', () => {
      const store = useFavoriteStore()
      const channel = { id: 'ch-1', name: 'CCTV-1', isFavorite: false } as any

      store.addFavoriteLocal(channel)
      expect(store.favorites).toHaveLength(1)
      expect(store.favorites[0].id).toBe('ch-1')
    })

    it('should remove favorite', () => {
      const store = useFavoriteStore()
      const channel = { id: 'ch-1', name: 'CCTV-1', isFavorite: true } as any

      store.addFavoriteLocal(channel)
      store.removeFavoriteLocal('ch-1')
      expect(store.favorites).toHaveLength(0)
    })

    it('should check if channel is favorite', () => {
      const store = useFavoriteStore()
      const channel = { id: 'ch-1', name: 'CCTV-1', isFavorite: false } as any

      expect(store.isFavorite('ch-1')).toBe(false)
      store.addFavoriteLocal(channel)
      expect(store.isFavorite('ch-1')).toBe(true)
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npm run test:run -- tests/unit/stores.test.ts
```

预期：FAIL，模块不存在

- [ ] **步骤 3：实现 favorite store src/stores/favorite.ts**

```typescript
import { defineStore } from 'pinia'
import type { Channel } from '@/types/channel'
import * as favoritesQueries from '@/db/queries/favorites'

export const useFavoriteStore = defineStore('favorite', {
  state: () => ({
    favorites: [] as Channel[],
    loading: false
  }),

  actions: {
    addFavoriteLocal(channel: Channel) {
      if (this.isFavorite(channel.id)) return
      this.favorites.push(channel)
    },

    removeFavoriteLocal(channelId: string) {
      this.favorites = this.favorites.filter(ch => ch.id !== channelId)
    },

    isFavorite(channelId: string): boolean {
      return favoritesQueries.isFavorite(channelId)
    },

    setFavorites(channels: Channel[]) {
      this.favorites = channels
    },

    setLoading(loading: boolean) {
      this.loading = loading
    }
  }
})
```

- [ ] **步骤 4：实现 channel store src/stores/channel.ts**

```typescript
import { defineStore } from 'pinia'
import type { Channel, ChannelGroup } from '@/types/channel'

export const useChannelStore = defineStore('channel', {
  state: () => ({
    groups: [] as ChannelGroup[],
    expandedGroups: new Set<string>(),
    currentChannel: null as Channel | null,
    loading: false
  }),

  actions: {
    setGroups(groups: ChannelGroup[]) {
      this.groups = groups
      this.expandedGroups = new Set()
    },

    toggleGroup(groupId: string) {
      if (this.expandedGroups.has(groupId)) {
        this.expandedGroups.delete(groupId)
      } else {
        this.expandedGroups.add(groupId)
      }
    },

    selectChannel(channel: Channel) {
      this.currentChannel = channel
    },

    setLoading(loading: boolean) {
      this.loading = loading
    }
  }
})
```

- [ ] **步骤 5：实现 source store src/stores/source.ts**

```typescript
import { defineStore } from 'pinia'
import type { Source, UpdateRule } from '@/types/source'

export const useSourceStore = defineStore('source', {
  state: () => ({
    sources: [] as Source[],
    activeSourceId: null as string | null,
    updateRules: new Map<string, UpdateRule>(),
    lastUpdateTime: null as Date | null
  }),

  actions: {
    setSources(sources: Source[]) {
      this.sources = sources
    },

    addSourceLocal(source: Source) {
      this.sources.push(source)
    },

    removeSourceLocal(sourceId: string) {
      this.sources = this.sources.filter(s => s.id !== sourceId)
    },

    setActiveSource(sourceId: string) {
      this.activeSourceId = sourceId
    },

    setUpdateRule(rule: UpdateRule) {
      this.updateRules.set(rule.sourceId, rule)
    }
  }
})
```

- [ ] **步骤 6：实现 player store src/stores/player.ts**

```typescript
import { defineStore } from 'pinia'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    isPlaying: false,
    currentUrl: null as string | null,
    error: null as string | null,
    volume: 1,
    muted: false,
    loading: false
  }),

  actions: {
    play(url: string) {
      this.currentUrl = url
      this.isPlaying = true
      this.error = null
    },

    pause() {
      this.isPlaying = false
    },

    setVolume(vol: number) {
      this.volume = Math.max(0, Math.min(1, vol))
    },

    toggleMute() {
      this.muted = !this.muted
    },

    setError(msg: string | null) {
      this.error = msg
    },

    setLoading(loading: boolean) {
      this.loading = loading
    },

    reset() {
      this.isPlaying = false
      this.currentUrl = null
      this.error = null
      this.loading = false
    }
  }
})
```

- [ ] **步骤 7：运行测试验证通过**

```bash
npm run test:run -- tests/unit/stores.test.ts
```

预期：所有测试 PASS

- [ ] **步骤 8：Commit**

```bash
git add src/stores/ tests/unit/stores.test.ts
git commit -m "feat: 实现 Pinia 状态管理"
```

---

## 任务 8：核心组件

**文件：**
- 创建：`src/components/TopNavbar.vue`
- 创建：`src/components/EmptyState.vue`
- 创建：`src/components/VideoPlayer.vue`
- 创建：`public/logo.svg`

- [ ] **步骤 1：创建 public/logo.svg**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect x="2" y="6" width="28" height="18" rx="2" stroke="#3b82f6" stroke-width="2"/>
  <line x1="10" y1="28" x2="22" y2="28" stroke="#3b82f6" stroke-width="2"/>
  <line x1="16" y1="24" x2="16" y2="28" stroke="#3b82f6" stroke-width="2"/>
  <polygon points="13,11 13,19 21,15" fill="#3b82f6"/>
</svg>
```

- [ ] **步骤 2：创建 src/components/TopNavbar.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const navItems = computed(() => [
  { name: 'channel', label: '频道', icon: '📺', path: '/' },
  { name: 'favorites', label: '收藏', icon: '❤️', path: '/favorites' },
  { name: 'settings', label: '设置', icon: '⚙️', path: '/settings' }
])

const isActive = (name: string) => route.name === name

const navigate = (path: string) => {
  router.push(path)
}
</script>

<template>
  <nav class="top-navbar">
    <div class="navbar-brand">
      <img src="/logo.svg" alt="LPTV Logo" class="logo" />
      <span class="brand-text">LPTV</span>
    </div>
    <div class="navbar-nav">
      <button
        v-for="item in navItems"
        :key="item.name"
        class="nav-item"
        :class="{ active: isActive(item.name) }"
        @click="navigate(item.path)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.top-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-xl);
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  z-index: 1000;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);

  .logo {
    width: 32px;
    height: 32px;
  }

  .brand-text {
    font-size: var(--font-size-title);
    font-weight: bold;
    color: var(--text-primary);
  }
}

.navbar-nav {
  display: flex;
  gap: var(--spacing-xl);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--spacing-xs) var(--spacing-md);
  background: transparent;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
  position: relative;

  &:hover {
    color: var(--text-primary);
  }

  &.active {
    color: var(--brand-primary);

    &::after {
      content: '';
      position: absolute;
      bottom: -12px;
      left: 0;
      right: 0;
      height: 2px;
      background-color: var(--brand-primary);
    }
  }

  .nav-icon {
    font-size: 20px;
  }

  .nav-label {
    font-size: var(--font-size-caption);
  }
}
</style>
```

- [ ] **步骤 3：创建 src/components/EmptyState.vue**

```vue
<script setup lang="ts">
interface Props {
  icon?: string
  title: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  icon: '📺'
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="description" class="empty-description">{{ description }}</div>
    <slot></slot>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl) * 4;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  color: var(--border-color);
  margin-bottom: var(--spacing-lg);
}

.empty-title {
  font-size: var(--font-size-subtitle);
  color: var(--text-disabled);
  margin-bottom: var(--spacing-sm);
}

.empty-description {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}
</style>
```

- [ ] **步骤 4：创建 src/components/VideoPlayer.vue**

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import DPlayer from 'dplayer'
import Hls from 'hls.js'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{
  url: string
}>()

const playerContainer = ref<HTMLElement | null>(null)
let player: DPlayer | null = null
let hls: Hls | null = null

const playerStore = usePlayerStore()

onMounted(() => {
  if (playerContainer.value) {
    initPlayer()
  }
})

onBeforeUnmount(() => {
  destroyPlayer()
})

watch(() => props.url, (newUrl) => {
  if (newUrl) {
    switchSource(newUrl)
  }
})

function initPlayer() {
  player = new DPlayer({
    container: playerContainer.value,
    autoplay: true,
    theme: '#3b82f6',
    video: {
      url: props.url,
      type: 'customHls',
      customType: {
        customHls: (video: HTMLVideoElement) => {
          if (Hls.isSupported()) {
            hls = new Hls()
            hls.loadSource(video.src)
            hls.attachMedia(video)
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                playerStore.setError('频道暂时不可用，请稍后重试')
              }
            })
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = props.url
          }
        }
      }
    }
  })

  player.on('play', () => playerStore.play(props.url))
  player.on('pause', () => playerStore.pause())
  player.on('error', () => playerStore.setError('播放出错'))
}

function switchSource(url: string) {
  destroyPlayer()
  if (playerContainer.value) {
    playerStore.setLoading(true)
    initPlayer()
  }
}

function destroyPlayer() {
  if (hls) {
    hls.destroy()
    hls = null
  }
  if (player) {
    player.destroy()
    player = null
  }
}
</script>

<template>
  <div ref="playerContainer" class="video-player"></div>
</template>

<style scoped lang="scss">
.video-player {
  width: 100%;
  height: 100%;
  background-color: #000;

  :deep(.dplayer) {
    height: 100%;
  }
}
</style>
```

- [ ] **步骤 5：运行 TypeScript 检查确认无报错**

```bash
npx vue-tsc --noEmit
```

预期：可能有 DPlayer/Hls 类型警告，可忽略

- [ ] **步骤 6：Commit**

```bash
git add public/logo.svg src/components/TopNavbar.vue src/components/EmptyState.vue src/components/VideoPlayer.vue
git commit -m "feat: 实现核心组件"
```

---

## 任务 9：频道列表组件

**文件：**
- 创建：`src/components/ChannelGroup.vue`
- 创建：`src/components/ChannelItem.vue`
- 测试：`tests/components/ChannelGroup.test.ts`

- [ ] **步骤 1：编写失败的测试 tests/components/ChannelGroup.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChannelGroup from '@/components/ChannelGroup.vue'

describe('ChannelGroup Component', () => {
  const mockChannels = [
    { id: 'ch-1', name: 'CCTV-1', url: 'http://test.com/1.m3u8', isFavorite: false },
    { id: 'ch-2', name: 'CCTV-2', url: 'http://test.com/2.m3u8', isFavorite: true }
  ]

  it('should render collapsed by default', () => {
    const wrapper = mount(ChannelGroup, {
      props: {
        groupName: '央视频道',
        channelCount: 2,
        channels: mockChannels,
        isExpanded: false,
        currentChannelId: null
      }
    })

    expect(wrapper.text()).toContain('央视频道')
    expect(wrapper.text()).toContain('(2)')
    expect(wrapper.findAllComponents({ name: 'ChannelItem' })).toHaveLength(0)
  })

  it('should expand on click', async () => {
    const wrapper = mount(ChannelGroup, {
      props: {
        groupName: '央视频道',
        channelCount: 2,
        channels: mockChannels,
        isExpanded: false,
        currentChannelId: null
      }
    })

    await wrapper.find('.group-header').trigger('click')
    expect(wrapper.emitted('toggle')).toBeTruthy()
  })

  it('should show channels when expanded', () => {
    const wrapper = mount(ChannelGroup, {
      props: {
        groupName: '央视频道',
        channelCount: 2,
        channels: mockChannels,
        isExpanded: true,
        currentChannelId: null
      }
    })

    expect(wrapper.findAllComponents({ name: 'ChannelItem' })).toHaveLength(2)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npm run test:run -- tests/components/ChannelGroup.test.ts
```

预期：FAIL，组件不存在

- [ ] **步骤 3：创建 src/components/ChannelItem.vue**

```vue
<script setup lang="ts">
import type { Channel } from '@/types/channel'

interface Props {
  channel: Channel
  isActive: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  select: [channel: Channel]
  toggleFavorite: [channel: Channel]
}>()

const isFavorite = (channel: Channel) => channel.isFavorite
</script>

<template>
  <div
    class="channel-item"
    :class="{ active: isActive }"
    @click="emit('select', channel)"
  >
    <span class="channel-name">{{ channel.name }}</span>
    <button
      class="favorite-btn"
      @click.stop="emit('toggleFavorite', channel)"
    >
      {{ isFavorite(channel) ? '❤️' : '🤍' }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.channel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: #333333;
  }

  &.active {
    background-color: var(--bg-card);
    border-left: 3px solid var(--brand-primary);
  }

  .channel-name {
    font-size: var(--font-size-body);
    color: var(--text-primary);
  }

  .favorite-btn {
    background: transparent;
    padding: var(--spacing-xs);
    font-size: 16px;
    transition: transform var(--transition-fast);

    &:hover {
      transform: scale(1.2);
    }
  }
}
</style>
```

- [ ] **步骤 4：创建 src/components/ChannelGroup.vue**

```vue
<script setup lang="ts">
import type { Channel } from '@/types/channel'
import ChannelItem from './ChannelItem.vue'

interface Props {
  groupName: string
  channelCount: number
  channels: Channel[]
  isExpanded: boolean
  currentChannelId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  select: [channel: Channel]
  toggleFavorite: [channel: Channel]
}>()
</script>

<template>
  <div class="channel-group">
    <div class="group-header" @click="emit('toggle')">
      <span class="group-arrow">{{ isExpanded ? '▼' : '▶' }}</span>
      <span class="group-name">{{ groupName }}</span>
      <span class="group-count">({{ channelCount }})</span>
    </div>
    <transition name="expand">
      <div v-if="isExpanded" class="group-content">
        <ChannelItem
          v-for="channel in channels"
          :key="channel.id"
          :channel="channel"
          :is-active="channel.id === currentChannelId"
          @select="(ch) => emit('select', ch)"
          @toggle-favorite="(ch) => emit('toggleFavorite', ch)"
        />
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.channel-group {
  border-bottom: 1px solid var(--border-color);
}

.group-header {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--bg-card);
  }

  .group-arrow {
    margin-right: var(--spacing-sm);
    font-size: var(--font-size-caption);
    color: var(--text-secondary);
  }

  .group-name {
    font-size: var(--font-size-subtitle);
    font-weight: 600;
    color: var(--text-primary);
  }

  .group-count {
    margin-left: var(--spacing-sm);
    font-size: var(--font-size-caption);
    color: var(--text-secondary);
  }
}

.group-content {
  overflow: hidden;
}

.expand-enter-active,
.expand-leave-active {
  transition: max-height var(--transition-normal);
  max-height: 500px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
}
</style>
```

- [ ] **步骤 5：运行测试验证通过**

```bash
npm run test:run -- tests/components/ChannelGroup.test.ts
```

预期：所有测试 PASS

- [ ] **步骤 6：Commit**

```bash
git add src/components/ChannelGroup.vue src/components/ChannelItem.vue tests/components/ChannelGroup.test.ts
git commit -m "feat: 实现频道列表组件"
```

---

## 任务 10：频道界面

**文件：**
- 创建：`src/views/ChannelView.vue`

- [ ] **步骤 1：创建 src/views/ChannelView.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import ChannelGroup from '@/components/ChannelGroup.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useChannelStore } from '@/stores/channel'
import { useFavoriteStore } from '@/stores/favorite'
import type { Channel } from '@/types/channel'

const channelStore = useChannelStore()
const favoriteStore = useFavoriteStore()

const demoGroups = ref([
  {
    id: 'g1',
    name: '央视频道',
    channels: [
      { id: 'ch1', name: 'CCTV-1 综合', url: 'http://example.com/cctv1.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
      { id: 'ch2', name: 'CCTV-2 财经', url: 'http://example.com/cctv2.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
      { id: 'ch3', name: 'CCTV-5 体育', url: 'http://example.com/cctv5.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
    ]
  },
  {
    id: 'g2',
    name: '卫视频道',
    channels: [
      { id: 'ch4', name: '湖南卫视', url: 'http://example.com/hunan.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
      { id: 'ch5', name: '东方卫视', url: 'http://example.com/dongfang.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
    ]
  },
  {
    id: 'g3',
    name: '地方频道',
    channels: [
      { id: 'ch6', name: '北京卫视', url: 'http://example.com/beijing.m3u8', groupId: 'g3', groupName: '地方频道', isFavorite: false, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
    ]
  }
])

const currentChannel = ref<Channel | null>(null)

const isGroupExpanded = (groupId: string) => channelStore.expandedGroups.has(groupId)

const handleToggleGroup = (groupId: string) => {
  channelStore.toggleGroup(groupId)
}

const handleSelectChannel = (channel: Channel) => {
  currentChannel.value = channel
  channelStore.selectChannel(channel)
}

const handleToggleFavorite = (channel: Channel) => {
  channel.isFavorite = !channel.isFavorite
  if (channel.isFavorite) {
    favoriteStore.addFavoriteLocal(channel)
  } else {
    favoriteStore.removeFavoriteLocal(channel.id)
  }
}
</script>

<template>
  <div class="channel-view">
    <aside class="channel-sidebar">
      <ChannelGroup
        v-for="group in demoGroups"
        :key="group.id"
        :group-name="group.name"
        :channel-count="group.channels.length"
        :channels="group.channels"
        :is-expanded="isGroupExpanded(group.id)"
        :current-channel-id="currentChannel?.id ?? null"
        @toggle="handleToggleGroup(group.id)"
        @select="handleSelectChannel"
        @toggle-favorite="handleToggleFavorite"
      />
    </aside>
    <main class="channel-main">
      <template v-if="currentChannel">
        <div class="player-wrapper">
          <VideoPlayer :url="currentChannel.url" />
        </div>
        <div class="player-info">
          <span class="current-channel">当前频道：{{ currentChannel.name }}</span>
          <button
            class="favorite-button"
            @click="handleToggleFavorite(currentChannel)"
          >
            {{ currentChannel.isFavorite ? '❤️ 已收藏' : '🤍 收藏' }}
          </button>
        </div>
      </template>
      <EmptyState
        v-else
        icon="📺"
        title="选择一个频道开始观看"
        description="从左侧频道列表中选择一个频道"
      />
    </main>
  </div>
</template>

<style scoped lang="scss">
.channel-view {
  display: flex;
  height: calc(100vh - 60px);
}

.channel-sidebar {
  width: 280px;
  flex-shrink: 0;
  background-color: var(--bg-secondary);
  overflow-y: auto;
}

.channel-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  overflow: hidden;
}

.player-wrapper {
  flex: 1;
  background-color: #000;
}

.player-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--bg-secondary);

  .current-channel {
    font-size: var(--font-size-body);
    color: var(--text-primary);
  }
}

.favorite-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-card);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--brand-primary);
  }
}
</style>
```

- [ ] **步骤 2：运行 TypeScript 检查确认无报错**

```bash
npx vue-tsc --noEmit
```

预期：PASS

- [ ] **步骤 3：运行开发服务器验证界面**

```bash
npm run dev
```

预期：开发服务器启动成功，访问 http://localhost:5173 可见频道界面

- [ ] **步骤 4：Commit**

```bash
git add src/views/ChannelView.vue
git commit -m "feat: 实现频道界面"
```

---

## 任务 11：收藏界面

**文件：**
- 创建：`src/components/FavoriteCard.vue`
- 创建：`src/views/FavoriteView.vue`
- 测试：`tests/components/FavoriteCard.test.ts`

- [ ] **步骤 1：编写失败的测试 tests/components/FavoriteCard.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FavoriteCard from '@/components/FavoriteCard.vue'

describe('FavoriteCard Component', () => {
  it('should render channel name', () => {
    const wrapper = mount(FavoriteCard, {
      props: {
        channel: { id: 'ch-1', name: 'CCTV-1', url: 'http://test.com' } as any
      }
    })

    expect(wrapper.text()).toContain('CCTV-1')
  })

  it('should emit remove on favorite click', async () => {
    const wrapper = mount(FavoriteCard, {
      props: {
        channel: { id: 'ch-1', name: 'CCTV-1', url: 'http://test.com' } as any
      }
    })

    await wrapper.find('.favorite-icon').trigger('click')
    expect(wrapper.emitted('remove')).toBeTruthy()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npm run test:run -- tests/components/FavoriteCard.test.ts
```

预期：FAIL

- [ ] **步骤 3：创建 src/components/FavoriteCard.vue**

```vue
<script setup lang="ts">
import type { Channel } from '@/types/channel'

defineProps<{
  channel: Channel
}>()

const emit = defineEmits<{
  remove: [channelId: string]
  play: [channel: Channel]
}>()
</script>

<template>
  <div class="favorite-card" @click="emit('play', channel)">
    <div class="card-content">
      <div class="channel-name">{{ channel.name }}</div>
      <button class="favorite-icon" @click.stop="emit('remove', channel.id)">
        ❤️
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.favorite-card {
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
  }

  .card-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .channel-name {
    font-size: var(--font-size-subtitle);
    font-weight: 600;
    color: var(--text-primary);
  }

  .favorite-icon {
    background: transparent;
    font-size: 20px;
    padding: var(--spacing-xs);
    transition: transform var(--transition-fast);

    &:hover {
      transform: scale(1.2);
    }
  }
}
</style>
```

- [ ] **步骤 4：创建 src/views/FavoriteView.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import FavoriteCard from '@/components/FavoriteCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useRouter } from 'vue-router'
import type { Channel } from '@/types/channel'

const router = useRouter()

const favorites = ref<Channel[]>([
  { id: 'ch1', name: 'CCTV-1 综合', url: 'http://example.com/cctv1.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch2', name: 'CCTV-2 财经', url: 'http://example.com/cctv2.m3u8', groupId: 'g1', groupName: '央视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch4', name: '湖南卫视', url: 'http://example.com/hunan.m3u8', groupId: 'g2', groupName: '卫视频道', isFavorite: true, sourceId: 'demo', createdAt: new Date(), updatedAt: new Date() }
])

const handleRemove = (channelId: string) => {
  favorites.value = favorites.value.filter(ch => ch.id !== channelId)
}

const handlePlay = (channel: Channel) => {
  router.push({ path: '/', query: { channel: channel.id } })
}
</script>

<template>
  <div class="favorite-view">
    <EmptyState
      v-if="favorites.length === 0"
      icon="❤️"
      title="还没有收藏任何频道"
      description="前往频道页添加你的收藏吧"
    />
    <div v-else class="favorites-grid">
      <FavoriteCard
        v-for="channel in favorites"
        :key="channel.id"
        :channel="channel"
        @remove="handleRemove"
        @play="handlePlay"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.favorite-view {
  padding: var(--spacing-xl);
  height: 100%;
  overflow-y: auto;
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--spacing-lg);
}
</style>
```

- [ ] **步骤 5：运行测试验证通过**

```bash
npm run test:run -- tests/components/FavoriteCard.test.ts
```

预期：所有测试 PASS

- [ ] **步骤 6：Commit**

```bash
git add src/components/FavoriteCard.vue src/views/FavoriteView.vue tests/components/FavoriteCard.test.ts
git commit -m "feat: 实现收藏界面"
```

---

## 任务 12：设置界面

**文件：**
- 创建：`src/components/SourceItem.vue`
- 创建：`src/components/ImportSourceModal.vue`
- 创建：`src/views/SettingsView.vue`

- [ ] **步骤 1：创建 src/components/SourceItem.vue**

```vue
<script setup lang="ts">
import type { Source } from '@/types/source'

defineProps<{
  source: Source
}>()

const emit = defineEmits<{
  use: [sourceId: string]
  edit: [source: Source]
  delete: [sourceId: string]
}>()

const statusMap = {
  active: { label: '正常', class: 'status-active' },
  error: { label: '异常', class: 'status-error' },
  parsing: { label: '解析中', class: 'status-parsing' }
}
</script>

<template>
  <div class="source-item">
    <div class="source-header">
      <span class="source-name">{{ source.name }}</span>
      <span class="source-status" :class="statusMap[source.status].class">
        {{ statusMap[source.status].label }}
      </span>
    </div>
    <div class="source-url">{{ source.url }}</div>
    <div class="source-footer">
      <span class="source-update-time">
        更新: {{ source.lastUpdateAt?.toLocaleString() ?? '未更新' }}
      </span>
      <div class="source-actions">
        <button class="btn btn-primary" @click="emit('use', source.id)">使用此源</button>
        <button class="btn btn-secondary" @click="emit('edit', source)">编辑</button>
        <button class="btn btn-danger" @click="emit('delete', source.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.source-item {
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
}

.source-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);

  .source-name {
    font-size: var(--font-size-subtitle);
    font-weight: 600;
    color: var(--text-primary);
  }
}

.source-status {
  font-size: var(--font-size-caption);
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);

  &.status-active {
    color: var(--success);
  }

  &.status-error {
    color: var(--error);
  }

  &.status-parsing {
    color: var(--warning);
  }
}

.source-url {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-md);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .source-update-time {
    font-size: var(--font-size-caption);
    color: var(--text-secondary);
  }
}

.source-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-caption);
  transition: background-color var(--transition-fast);

  &.btn-primary {
    background-color: var(--brand-primary);
    color: white;

    &:hover {
      background-color: var(--brand-hover);
    }
  }

  &.btn-secondary {
    background-color: var(--bg-secondary);
    color: var(--text-secondary);

    &:hover {
      color: var(--text-primary);
    }
  }

  &.btn-danger {
    background: transparent;
    color: var(--error);

    &:hover {
      background-color: rgba(239, 68, 68, 0.1);
    }
  }
}
</style>
```

- [ ] **步骤 2：创建 src/components/ImportSourceModal.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  import: [data: { name: string; url: string; type: 'url' | 'file' }]
}>()

const activeTab = ref<'url' | 'file'>('url')
const sourceName = ref('')
const sourceUrl = ref('')
const selectedFile = ref<File | null>(null)

const isVisible = computed(() => props.visible)

const handleClose = () => {
  emit('close')
  resetForm()
}

const handleImport = () => {
  if (activeTab.value === 'url' && sourceUrl.value) {
    emit('import', {
      name: sourceName.value || sourceUrl.value.split('/').pop() || '未命名',
      url: sourceUrl.value,
      type: 'url'
    })
    handleClose()
  }
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    selectedFile.value = target.files[0]
    sourceName.value = selectedFile.value.name.replace(/\.(m3u|m3u8)$/, '')
  }
}

const resetForm = () => {
  sourceName.value = ''
  sourceUrl.value = ''
  selectedFile.value = null
  activeTab.value = 'url'
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isVisible" class="modal-overlay" @click.self="handleClose">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">导入直播源</h3>
          <button class="modal-close" @click="handleClose">×</button>
        </div>
        <div class="modal-tabs">
          <button
            class="tab"
            :class="{ active: activeTab === 'url' }"
            @click="activeTab = 'url'"
          >
            URL 地址
          </button>
          <button
            class="tab"
            :class="{ active: activeTab === 'file' }"
            @click="activeTab = 'file'"
          >
            本地文件
          </button>
        </div>
        <div class="modal-body">
          <div v-if="activeTab === 'url'" class="tab-content">
            <div class="form-group">
              <label>源名称（可选）</label>
              <input
                v-model="sourceName"
                type="text"
                placeholder="请输入源名称，默认使用文件名"
              />
            </div>
            <div class="form-group">
              <label>直播源地址</label>
              <input
                v-model="sourceUrl"
                type="text"
                placeholder="请输入 m3u/m3u8 地址"
              />
            </div>
          </div>
          <div v-else class="tab-content">
            <div class="file-drop">
              <input
                type="file"
                accept=".m3u,.m3u8"
                @change="handleFileSelect"
                class="file-input"
              />
              <div class="file-drop-content">
                <div class="file-icon">📁</div>
                <div class="file-text">拖拽文件到此处 或 点击选择</div>
                <div class="file-hint">.m3u, .m3u8</div>
              </div>
              <div v-if="selectedFile" class="selected-file">
                已选择: {{ selectedFile.name }}
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose">取消</button>
          <button class="btn btn-primary" @click="handleImport">导入</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal {
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  width: 500px;
  max-width: 90vw;
  box-shadow: var(--shadow-modal);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);

  .modal-title {
    font-size: var(--font-size-subtitle);
    font-weight: 600;
  }

  .modal-close {
    background: transparent;
    font-size: 24px;
    color: var(--text-secondary);

    &:hover {
      color: var(--text-primary);
    }
  }
}

.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);

  .tab {
    flex: 1;
    padding: var(--spacing-md);
    background: transparent;
    color: var(--text-secondary);
    transition: color var(--transition-fast);

    &.active {
      color: var(--brand-primary);
      border-bottom: 2px solid var(--brand-primary);
    }
  }
}

.modal-body {
  padding: var(--spacing-lg);
}

.form-group {
  margin-bottom: var(--spacing-md);

  label {
    display: block;
    font-size: var(--font-size-caption);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  input {
    width: 100%;
    padding: var(--spacing-md);
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-primary);

    &:focus {
      border-color: var(--brand-primary);
    }
  }
}

.file-drop {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-xl);
  text-align: center;
  position: relative;

  .file-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .file-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-md);
  }

  .file-text {
    font-size: var(--font-size-body);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
  }

  .file-hint {
    font-size: var(--font-size-caption);
    color: var(--text-disabled);
  }

  .selected-file {
    margin-top: var(--spacing-md);
    font-size: var(--font-size-caption);
    color: var(--success);
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--border-color);

  .btn {
    padding: var(--spacing-md) var(--spacing-xl);
    border-radius: var(--radius-sm);

    &.btn-primary {
      background-color: var(--brand-primary);
      color: white;

      &:hover {
        background-color: var(--brand-hover);
      }
    }

    &.btn-secondary {
      background-color: var(--bg-secondary);
      color: var(--text-secondary);

      &:hover {
        color: var(--text-primary);
      }
    }
  }
}
</style>
```

- [ ] **步骤 3：创建 src/views/SettingsView.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import SourceItem from '@/components/SourceItem.vue'
import ImportSourceModal from '@/components/ImportSourceModal.vue'
import type { Source } from '@/types/source'

const activeTab = ref<'source' | 'schedule'>('source')
const showImportModal = ref(false)

const sources = ref<Source[]>([
  {
    id: 'source-1',
    name: '我的直播源',
    url: 'http://example.com/live.m3u',
    type: 'url',
    status: 'active',
    channelCount: 50,
    lastUpdateAt: new Date('2026-04-13T10:00:00'),
    createdAt: new Date('2026-04-10T09:00:00')
  }
])

const updateInterval = ref('6')

const handleImport = (data: { name: string; url: string; type: 'url' | 'file' }) => {
  const newSource: Source = {
    id: `source-${Date.now()}`,
    name: data.name,
    url: data.url,
    type: data.type,
    status: 'parsing',
    channelCount: 0,
    lastUpdateAt: null,
    createdAt: new Date()
  }
  sources.value.push(newSource)
}

const handleDelete = (sourceId: string) => {
  sources.value = sources.value.filter(s => s.id !== sourceId)
}
</script>

<template>
  <div class="settings-view">
    <aside class="settings-sidebar">
      <button
        class="menu-item"
        :class="{ active: activeTab === 'source' }"
        @click="activeTab = 'source'"
      >
        源管理
      </button>
      <button
        class="menu-item"
        :class="{ active: activeTab === 'schedule' }"
        @click="activeTab = 'schedule'"
      >
        定时更新
      </button>
    </aside>
    <main class="settings-main">
      <div v-if="activeTab === 'source'" class="source-panel">
        <button class="btn-add" @click="showImportModal = true">+ 导入源</button>
        <SourceItem
          v-for="source in sources"
          :key="source.id"
          :source="source"
          @delete="handleDelete"
        />
      </div>
      <div v-else class="schedule-panel">
        <div class="schedule-card">
          <h3 class="schedule-title">全局更新设置</h3>
          <div class="form-group">
            <label>更新周期</label>
            <select v-model="updateInterval" class="select">
              <option value="1">每 1 小时</option>
              <option value="6">每 6 小时</option>
              <option value="24">每天</option>
              <option value="168">每周</option>
            </select>
          </div>
          <div class="schedule-info">
            <div>下次自动更新: 2026-04-13 16:00</div>
            <div>上次更新: 2026-04-13 10:00</div>
          </div>
          <div class="schedule-actions">
            <button class="btn btn-secondary">立即更新</button>
            <button class="btn btn-primary">保存设置</button>
          </div>
        </div>
      </div>
    </main>
    <ImportSourceModal
      :visible="showImportModal"
      @close="showImportModal = false"
      @import="handleImport"
    />
  </div>
</template>

<style scoped lang="scss">
.settings-view {
  display: flex;
  height: 100%;
}

.settings-sidebar {
  width: 200px;
  background-color: var(--bg-secondary);
  padding: var(--spacing-md) 0;
}

.menu-item {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  background: transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  position: relative;

  &:hover {
    background-color: var(--bg-card);
  }

  &.active {
    background-color: var(--bg-card);
    color: var(--brand-primary);
    border-left: 3px solid var(--brand-primary);
  }
}

.settings-main {
  flex: 1;
  padding: var(--spacing-xl);
  overflow-y: auto;
}

.btn-add {
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--brand-primary);
  color: white;
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-lg);

  &:hover {
    background-color: var(--brand-hover);
  }
}

.schedule-card {
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--spacing-xl);
}

.schedule-title {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  margin-bottom: var(--spacing-lg);
}

.form-group {
  margin-bottom: var(--spacing-lg);

  label {
    display: block;
    font-size: var(--font-size-caption);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }
}

.select {
  width: 100%;
  padding: var(--spacing-md);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
}

.schedule-info {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-lg);

  div {
    margin-bottom: var(--spacing-xs);
  }
}

.schedule-actions {
  display: flex;
  gap: var(--spacing-md);

  .btn {
    padding: var(--spacing-md) var(--spacing-xl);
    border-radius: var(--radius-sm);

    &.btn-primary {
      background-color: var(--brand-primary);
      color: white;

      &:hover {
        background-color: var(--brand-hover);
      }
    }

    &.btn-secondary {
      background-color: var(--bg-secondary);
      color: var(--text-secondary);

      &:hover {
        color: var(--text-primary);
      }
    }
  }
}
</style>
```

- [ ] **步骤 4：运行 TypeScript 检查确认无报错**

```bash
npx vue-tsc --noEmit
```

预期：PASS

- [ ] **步骤 5：运行开发服务器验证所有页面**

```bash
npm run dev
```

预期：开发服务器启动，导航可切换页面

- [ ] **步骤 6：Commit**

```bash
git add src/components/SourceItem.vue src/components/ImportSourceModal.vue src/views/SettingsView.vue
git commit -m "feat: 实现设置界面"
```

---

## 任务 13：定时更新调度器

**文件：**
- 创建：`src/services/scheduler.ts`

- [ ] **步骤 1：创建 src/services/scheduler.ts**

```typescript
import type { UpdateRule, IntervalUnit } from '@/types/source'
import * as updateRulesQueries from '@/db/queries/updateRules'

type TaskCallback = (sourceId: string) => Promise<void>

class Scheduler {
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private callback: TaskCallback | null = null

  setCallback(callback: TaskCallback) {
    this.callback = callback
  }

  scheduleRule(rule: UpdateRule) {
    this.cancelRule(rule.sourceId)

    const intervalMs = this.toMilliseconds(rule.interval, rule.intervalUnit)
    const delay = Math.max(0, rule.nextUpdateAt.getTime() - Date.now())

    const timer = setTimeout(() => {
      this.executeRule(rule.sourceId)
      const nextTime = new Date(Date.now() + intervalMs)
      updateRulesQueries.updateRuleNextUpdateAt(rule.sourceId, nextTime)

      if (rule.enabled) {
        this.scheduleRule({ ...rule, nextUpdateAt: nextTime })
      }
    }, delay)

    this.timers.set(rule.sourceId, timer)
  }

  cancelRule(sourceId: string) {
    const timer = this.timers.get(sourceId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(sourceId)
    }
  }

  startAll(rules: UpdateRule[]) {
    for (const rule of rules) {
      if (rule.enabled) {
        this.scheduleRule(rule)
      }
    }
  }

  stopAll() {
    for (const [sourceId] of this.timers) {
      this.cancelRule(sourceId)
    }
  }

  private async executeRule(sourceId: string) {
    if (this.callback) {
      try {
        await this.callback(sourceId)
      } catch (error) {
        console.error(`Scheduler: Failed to update source ${sourceId}:`, error)
      }
    }
  }

  private toMilliseconds(interval: number, unit: IntervalUnit): number {
    switch (unit) {
      case 'minute':
        return interval * 60 * 1000
      case 'hour':
        return interval * 60 * 60 * 1000
      case 'day':
        return interval * 24 * 60 * 60 * 1000
      case 'week':
        return interval * 7 * 24 * 60 * 60 * 1000
    }
  }
}

export const scheduler = new Scheduler()
```

- [ ] **步骤 2：Commit**

```bash
git add src/services/scheduler.ts
git commit -m "feat: 实现定时更新调度器"
```

---

## 任务 14：构建验证与最终测试

- [ ] **步骤 1：运行完整测试套件**

```bash
npm run test:run
```

预期：所有测试 PASS

- [ ] **步骤 2：运行构建命令**

```bash
npm run build
```

预期：构建成功，无报错

- [ ] **步骤 3：运行 TypeScript 检查**

```bash
npx vue-tsc --noEmit
```

预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add .
git commit -m "feat: 完成 LPTV 基础功能实现"
```

---

*计划结束*
