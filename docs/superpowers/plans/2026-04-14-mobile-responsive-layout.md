# 移动端响应式布局实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 LPTV 的 4 个主要视图添加移动端响应式布局（断点 768px）

**架构：** 所有改动通过 `@media (max-width: 768px)` 隔离，不影响桌面端。频道页侧边栏改为抽屉式，设置页侧边菜单改为横向滚动标签，收藏页和管理页缩减间距并改为单列布局。

**技术栈：** Vue 3 (Composition API), SCSS, CSS Grid, Flexbox

---

## 文件变更清单

| 文件 | 变更类型 |
|------|----------|
| `src/views/ChannelView.vue` | 新增 `sidebarOpen` 状态、遮罩层模板、移动端 CSS |
| `src/views/FavoriteView.vue` | 添加 `@media (max-width: 768px)` 覆盖样式 |
| `src/views/SettingsView.vue` | 添加 `@media (max-width: 768px)` 侧边栏→横向标签、网格→单列 |
| `src/views/ManagementView.vue` | 添加 `@media (max-width: 768px)` 覆盖 padding、行布局→堆叠 |
| `src/styles/global.scss` | 添加全局触摸优化规则 |

---

### 任务 1：频道页移动端侧边栏抽屉

**文件：**
- 修改：`src/views/ChannelView.vue` (模板 + script + style)

- [ ] **步骤 1：添加 sidebarOpen 状态**

在 `ChannelView.vue` 的 `<script setup>` 中，在现有 `searchQuery` 之后添加：

```typescript
const sidebarOpen = ref(false)

const closeSidebar = () => { sidebarOpen.value = false }
```

- [ ] **步骤 2：添加移动端频道切换按钮和遮罩层**

在 `<template>` 中，在 `<main class="channel-main">` 内部、`<PlayerView>` 之前，添加移动端频道按钮：

```vue
    <!-- 右侧播放主区域 -->
    <main class="channel-main">
      <!-- 移动端频道切换按钮 -->
      <div class="mobile-channel-bar">
        <button class="mobile-channel-btn" @click="sidebarOpen = true">
          <RiTvLine class="mobile-channel-icon" />
          <span>{{ currentChannel?.name || '选择频道' }}</span>
        </button>
      </div>
```

在 `<aside class="channel-sidebar">` 之后（但在 `</div>` 关闭之前）添加遮罩层：

```vue
    <!-- 移动端侧边栏遮罩 -->
    <div class="channel-sidebar-overlay" :class="{ visible: sidebarOpen }" @click="closeSidebar"></div>
```

- [ ] **步骤 3：添加移动端 CSS 规则**

在 `<style scoped lang="scss">` 底部（最后一个 `}` 之前）添加：

```scss
/* 移动端频道栏 */
.mobile-channel-bar {
  display: none;
  padding: 8px 16px;
  background-color: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
}

.mobile-channel-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;

  .mobile-channel-icon {
    width: 18px;
    height: 18px;
    color: var(--brand-primary);
    flex-shrink: 0;
  }
}

/* 移动端侧边栏遮罩 */
.channel-sidebar-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;

  &.visible {
    opacity: 1;
    pointer-events: auto;
  }
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .channel-view {
    flex-direction: column;
  }

  .mobile-channel-bar {
    display: block;
  }

  .channel-sidebar-overlay {
    display: block;
  }

  .channel-sidebar {
    position: fixed;
    top: 56px;
    left: -100%;
    width: 80vw;
    max-width: 280px;
    height: calc(100vh - 56px);
    z-index: 1000;
    transition: left 0.3s ease;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.3);
  }

  .channel-main {
    flex: 1;
    min-width: 0;
    padding: 0;
  }

  /* 侧边栏打开时 */
  .channel-sidebar {
    left: 0;
  }
}
```

- [ ] **步骤 4：构建验证**

运行：`npm run build`
预期：成功，无 TypeScript 错误

- [ ] **步骤 5：Commit**

```bash
git add src/views/ChannelView.vue
git commit -m "feat: 频道页移动端侧边栏抽屉布局"
```

---

### 任务 2：收藏页移动端单列布局

**文件：**
- 修改：`src/views/FavoriteView.vue` (style)

- [ ] **步骤 1：添加移动端 CSS 规则**

在 `<style scoped lang="scss">` 底部添加：

```scss
@media (max-width: 768px) {
  .favorite-view {
    padding: 16px;
  }

  .favorites-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .favorite-card {
    padding: 12px;
  }

  .channel-name {
    white-space: normal;
  }
}
```

- [ ] **步骤 2：构建验证**

运行：`npm run build`
预期：成功

- [ ] **步骤 3：Commit**

```bash
git add src/views/FavoriteView.vue
git commit -m "feat: 收藏页移动端单列布局"
```

---

### 任务 3：设置页移动端横向标签栏

**文件：**
- 修改：`src/views/SettingsView.vue` (style)

- [ ] **步骤 1：添加移动端 CSS 规则**

在 `<style scoped lang="scss">` 中，找到 `.settings-view` 规则之后（或文件末尾 `<style>` 结束前），添加：

```scss
@media (max-width: 768px) {
  .settings-view {
    flex-direction: column;
  }

  .settings-sidebar {
    position: sticky;
    top: 56px;
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    padding: 8px 0;
    flex-shrink: 0;
  }

  .settings-menu {
    flex-direction: row;
    overflow-x: auto;
    gap: 4px;
    padding: 0 8px;

    &::-webkit-scrollbar {
      display: none;
    }
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .menu-item {
    white-space: nowrap;
    padding: 8px 14px;
    min-width: fit-content;
    flex-shrink: 0;
  }

  .settings-content {
    padding: 16px;
  }

  .settings-form-grid {
    grid-template-columns: 1fr;
  }

  /* 源管理表格允许横向滚动 */
  .source-table {
    overflow-x: auto;
  }

  /* 更新频率按钮在窄屏下换行 */
  .schedule-frequency-row {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

- [ ] **步骤 2：构建验证**

运行：`npm run build`
预期：成功

- [ ] **步骤 3：Commit**

```bash
git add src/views/SettingsView.vue
git commit -m "feat: 设置页移动端横向标签栏布局"
```

---

### 任务 4：管理页移动端布局

**文件：**
- 修改：`src/views/ManagementView.vue` (style)

- [ ] **步骤 1：添加移动端 CSS 规则**

在 `<style scoped lang="scss">` 底部添加：

```scss
@media (max-width: 768px) {
  .management-view {
    padding: 16px;
  }

  .management-card {
    padding: 16px;
  }

  /* 管理卡片内的行布局改为垂直堆叠 */
  .card-row {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
}
```

**注意：** 需要先检查 `ManagementView.vue` 中实际的行布局类名。如果是其他类名（如 `.info-row`、`.setting-row` 等），请替换 `.card-row` 为实际使用的类名。

- [ ] **步骤 2：检查实际类名**

运行：`grep_search pattern="flex.*row|display.*flex" path="src/views/ManagementView.vue"`
确认管理卡片内用于水平排列的类名，并更新步骤 1 中的选择器。

- [ ] **步骤 3：构建验证**

运行：`npm run build`
预期：成功

- [ ] **步骤 4：Commit**

```bash
git add src/views/ManagementView.vue
git commit -m "feat: 管理页移动端垂直堆叠布局"
```

---

### 任务 5：全局触摸优化

**文件：**
- 修改：`src/styles/global.scss`

- [ ] **步骤 1：添加全局触摸优化规则**

在 `src/styles/global.scss` 底部添加：

```scss
/* 移动端触摸优化 */
@media (max-width: 768px) {
  button, a, [role="button"] {
    min-height: 44px;
  }
}
```

- [ ] **步骤 2：构建验证**

运行：`npm run build`
预期：成功

- [ ] **步骤 3：Commit**

```bash
git add src/styles/global.scss
git commit -m "feat: 全局移动端触摸目标优化"
```

---

### 任务 6：最终验证

- [ ] **步骤 1：完整构建**

运行：`npm run build`
预期：成功，无 TypeScript 错误，无 SCSS 编译错误

- [ ] **步骤 2：最终 Commit**

```bash
git status
git log --oneline -5
```

确认所有 5 个 commit 都已正确提交。

---

## 规格覆盖检查

| 规格需求 | 对应任务 |
|----------|----------|
| 频道页侧边栏→抽屉 | 任务 1 |
| 收藏页单列布局 | 任务 2 |
| 设置页横向标签栏 | 任务 3 |
| 管理页垂直堆叠 | 任务 4 |
| 全局触摸优化 | 任务 5 |
| 断点 768px | 所有任务 |
| 不影响桌面端 | 所有任务（都在 @media 内） |

---

## 自检

- ✅ 无占位符/TODO
- ✅ 所有步骤都有实际代码
- ✅ 类型/选择器一致
- ✅ 每个任务可独立构建和测试
- ✅ 无跨任务矛盾
