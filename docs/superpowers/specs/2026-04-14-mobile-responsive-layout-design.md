# 移动端响应式布局设计

## 概述

为 LPTV 的 4 个主要视图（频道页、收藏页、设置页、管理页）添加移动端响应式布局，断点设为 **768px**。所有改动通过 `@media (max-width: 768px)` 隔离，不影响桌面端。

---

## 设计原则

1. **断点隔离**：所有移动端规则在 `@media (max-width: 768px)` 内
2. **触摸目标**：按钮和链接最小高度 44px
3. **渐进式适配**：只改必要布局，不动颜色/按钮/图标
4. **YAGNI**：不引入新组件，仅 CSS 调整

---

## 1. 频道页 (ChannelView.vue)

### 改动
- `.channel-view` → `flex-direction: column`
- `.channel-sidebar` → 左侧滑出抽屉：`position: fixed; left: -100%; width: 80vw; max-width: 280px; transition: left 0.3s ease`
- 新增 `.sidebar-open .channel-sidebar` → `left: 0`
- 新增 `.channel-sidebar-overlay` → 半透明遮罩，点击关闭侧边栏
- `.channel-main` → `flex: 1; min-width: 0` 全宽
- 在 `.channel-main` 顶部（播放器上方）新增移动端频道切换按钮（仅移动端可见）

### 新增状态
- ChannelView 组件中新增 `sidebarOpen = ref(false)`
- 点击切换按钮 → `sidebarOpen.value = true`
- 点击遮罩或选中频道 → `sidebarOpen.value = false`

---

## 2. 收藏页 (FavoriteView.vue)

### 改动
- `.favorite-view` → `padding: 16px`（覆盖默认的 40px 60px）
- `.favorites-grid` → `grid-template-columns: 1fr; gap: 12px`
- `.favorite-card` → `padding: 12px`（覆盖默认值）
- 卡片内频道名 → `white-space: normal`（允许换行）

---

## 3. 设置页 (SettingsView.vue)

### 改动
- `.settings-view` → `flex-direction: column`
- `.settings-sidebar` → `position: sticky; top: 56px; width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--border-color); padding: 8px 0`
- `.settings-menu` → `flex-direction: row; overflow-x: auto; gap: 4px; padding: 0 8px`（隐藏滚动条）
- `.menu-item` → `white-space: nowrap; padding: 8px 14px; min-width: fit-content; flex-shrink: 0`
- `.settings-content` → `padding: 16px`
- `.settings-form-grid` → `grid-template-columns: 1fr`
- 源管理表格容器 → `overflow-x: auto`（允许横向滚动）
- 更新频率按钮 → `grid-template-columns: repeat(3, 1fr)` + 自动换行

---

## 4. 管理页 (ManagementView.vue)

### 改动
- `.management-view` → `padding: 16px`
- `.management-card` → `padding: 16px`
- 管理卡片内的行布局 → `flex-direction: column; gap: 8px`
- 表格列最小宽度 → 移除或减小 `min-width`

---

## 5. 全局触摸优化

```scss
@media (max-width: 768px) {
  button, a, [role="button"] {
    min-height: 44px;
  }
  
  /* 隐藏滚动条但保留滚动功能 */
  .settings-menu::-webkit-scrollbar {
    display: none;
  }
  .settings-menu {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
```

---

## 文件变更清单

| 文件 | 变更类型 |
|------|----------|
| `src/views/ChannelView.vue` | 新增侧边栏状态、遮罩层、移动端 CSS |
| `src/views/FavoriteView.vue` | 覆盖 padding、grid 列数、卡片样式 |
| `src/views/SettingsView.vue` | 侧边栏→横向标签、网格→单列 |
| `src/views/ManagementView.vue` | 覆盖 padding、行布局→堆叠 |
| `src/styles/global.scss` | （可选）全局触摸优化 |
